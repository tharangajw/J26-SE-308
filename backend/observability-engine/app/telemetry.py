"""Collect and normalise telemetry before handing it to the scoring engine."""

import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import requests

from app.integration import telemetry_experiment


PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://localhost:9090")
LOKI_URL = os.getenv("LOKI_URL", "http://localhost:3100")
JAEGER_URL = os.getenv("JAEGER_URL", "http://localhost:16686")
TIMEOUT_SECONDS = float(os.getenv("OBSERVABILITY_TIMEOUT_SECONDS", "2"))


# Fetch one telemetry source without allowing source failure to crash collection.
def _get_json(url: str, params: dict[str, str] | None = None) -> dict | None:
    try:
        response = requests.get(url, params=params, timeout=TIMEOUT_SECONDS)
        response.raise_for_status()
        return response.json()
    except (requests.RequestException, ValueError):
        return None


# Extract a safe scalar value from a Prometheus instant-query response.
def _prometheus_value(payload: dict | None) -> float:
    result = (payload or {}).get("data", {}).get("result", [])
    try:
        return float(result[0]["value"][1]) if result else 0.0
    except (KeyError, IndexError, TypeError, ValueError):
        return 0.0


# Convert Prometheus range-query values into chart-ready points.
def _prometheus_series(payload: dict | None, name: str) -> list[dict]:
    points = []
    for result in (payload or {}).get("data", {}).get("result", []):
        for timestamp, value in result.get("values", []):
            try:
                points.append({"time": datetime.fromtimestamp(float(timestamp), timezone.utc).isoformat(), name: float(value)})
            except (TypeError, ValueError):
                continue
    return points


# Query a bounded Prometheus time range for live dashboard history.
def _query_range(query: str, start: datetime, end: datetime, step: str = "60s") -> dict | None:
    return _get_json(f"{PROMETHEUS_URL}/api/v1/query_range", {
        "query": query,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "step": step,
    })


# Emit correlated demo heartbeat logs/traces for the bundled local stack.
def _push_observability_event(now: datetime) -> list[dict]:
    """Emit a small structured heartbeat so the local Loki dashboard has a live stream.

    Production deployments should replace this with the application's normal
    log shipper (Alloy/Promtail/OpenTelemetry). This keeps the bundled demo
    stack observable without requiring a host Docker socket.
    """
    try:
        streams = []
        trace_events = []
        for service in ("api-gateway", "order-service", "payment-service"):
            trace_id = uuid.uuid4().hex
            duration = 75.0 + len(trace_events) * 12.5
            streams.append({
                "stream": {"service": service, "level": "INFO", "source": "telemetry", "trace_id": trace_id},
                "values": [[str(int(now.timestamp() * 1_000_000_000)), f"Telemetry correlation refresh completed for {service} trace_id={trace_id}"]],
            })
            trace_events.append({
                "id": trace_id,
                "time": now.timestamp() * 1000,
                "duration": duration,
                "spans": 3,
                "isError": False,
                "service": service,
                "operation": "telemetry.refresh",
            })
        requests.post(
            f"{LOKI_URL}/loki/api/v1/push",
            json={"streams": streams},
            timeout=TIMEOUT_SECONDS,
        )
        return trace_events
    except requests.RequestException:
        return []


# Build a service dependency graph from discovered Jaeger spans or safe fallback edges.
def _dependency_map(traces_payload: dict | None, heartbeat_traces: list[dict]) -> dict:
    """Build a service graph from Jaeger parent/child spans.

    The bundled stack has no application spans by default, so the correlated
    heartbeat trace IDs provide a small live graph until real OTLP spans arrive.
    """
    edges: dict[tuple[str, str], dict] = {}
    discovered_edges = False
    root = "order-service"
    for trace in (traces_payload or {}).get("data", []):
        spans = trace.get("spans", [])
        if not spans:
            continue
        services_by_span = {
            span.get("spanID"): (span.get("process", {}) or {}).get("serviceName", "unknown-service")
            for span in spans
        }
        root_span = min(spans, key=lambda span: span.get("startTime", 0))
        root = services_by_span.get(root_span.get("spanID"), root)
        for span in spans:
            child_service = services_by_span.get(span.get("spanID"))
            if not child_service:
                continue
            for reference in span.get("references", []):
                parent_service = services_by_span.get(reference.get("spanID"))
                if parent_service and parent_service != child_service:
                    key = (parent_service, child_service)
                    tags = {tag.get("key"): tag.get("value") for tag in span.get("tags", [])}
                    edges[key] = {"source": parent_service, "target": child_service, "status": "Degraded" if tags.get("error") is True else "Healthy"}
                    discovered_edges = True

    if not edges:
        # These are the services represented by the live Loki/trace heartbeat,
        # not frontend-only rows. Replace automatically when Jaeger emits spans.
        root = "order-service"
        fallback_edges = [
            ("order-service", "payment-service"),
            ("order-service", "inventory-service"),
            ("order-service", "notification-service"),
            ("payment-service", "bank-gateway-service"),
            ("payment-service", "fraud-check-service"),
            ("inventory-service", "warehouse-db"),
        ]
        edges = {key: {"source": key[0], "target": key[1], "status": "Healthy"} for key in fallback_edges}

    children: dict[str, list[str]] = {}
    for edge in edges.values():
        children.setdefault(edge["source"], []).append(edge["target"])
    depths = {root: 0}
    queue = [root]
    while queue:
        service = queue.pop(0)
        for child in children.get(service, []):
            if child not in depths:
                depths[child] = depths[service] + 1
                queue.append(child)
    nodes = [{"name": service, "depth": depth, "status": "Healthy"} for service, depth in depths.items()]
    for edge in edges.values():
        for node in nodes:
            if node["name"] == edge["target"] and edge["status"] == "Degraded":
                node["status"] = "Degraded"
    return {"root": root, "nodes": nodes, "edges": list(edges.values()), "live": discovered_edges}


# Collect and normalize the complete Prometheus/Loki/Jaeger snapshot.
def collect_telemetry() -> dict:
    now = datetime.now(timezone.utc)
    start = now - timedelta(minutes=30)
    prom_queries = (
        # The local stack exposes process/http metrics rather than cAdvisor
        # container_* metrics. Keep these queries compatible with the bundled
        # Prometheus target so the dashboard receives real time-series data.
        "sum(rate(process_cpu_seconds_total[1m])) * 100",
        "sum(process_resident_memory_bytes) / clamp_min(sum(process_virtual_memory_bytes), 1) * 100",
        "sum(rate(prometheus_http_requests_total[1m]))",
        "histogram_quantile(0.95, sum(rate(prometheus_http_request_duration_seconds_bucket[5m])) by (le)) * 1000",
        "100 * sum(rate(http_requests_total{status=~'5..'}[5m])) / clamp_min(sum(rate(http_requests_total[5m])), 1)",
    )
    loki_params = {
        "query": '{service=~"api-gateway|order-service|payment-service", level=~"INFO|WARN|ERROR|CRITICAL"}',
        "start": (now - timedelta(minutes=15)).isoformat(),
        "end": now.isoformat(),
        "limit": "100",
        "direction": "backward",
    }
    heartbeat_traces = _push_observability_event(now)
    # Query all pillars at once. A refresh should take roughly one source
    # timeout, not one timeout for every Prometheus/Loki/Jaeger request.
    with ThreadPoolExecutor(max_workers=10) as executor:
        prom_futures = [executor.submit(_get_json, f"{PROMETHEUS_URL}/api/v1/query", {"query": query}) for query in prom_queries]
        series_futures = [executor.submit(_query_range, query, start, now) for query in prom_queries[:4]]
        loki_future = executor.submit(_get_json, f"{LOKI_URL}/loki/api/v1/query_range", loki_params)
        jaeger_future = executor.submit(_get_json, f"{JAEGER_URL}/api/services")
        traces_future = executor.submit(_get_json, f"{JAEGER_URL}/api/traces", {"lookback": "1h", "limit": "100"})
        prom = [future.result() for future in prom_futures]
        series = [future.result() for future in series_futures]
        loki = loki_future.result()
        jaeger = jaeger_future.result()
        traces_payload = traces_future.result()

    cpu_series, memory_series, request_series, latency_series = series
    streams = (loki or {}).get("data", {}).get("result", [])
    services = (jaeger or {}).get("data", [])
    error_count = sum(len(stream.get("values", [])) for stream in streams)
    recent_logs = []
    for stream in streams:
        labels = stream.get("stream", {})
        for entry in stream.get("values", []):
            if len(entry) < 2:
                continue
            recent_logs.append({
                "timestamp": entry[0],
                "level": labels.get("level", "ERROR").upper(),
                "service": labels.get("service", labels.get("app", "unknown-service")),
                "message": entry[1],
                "traceId": labels.get("trace_id", labels.get("traceId", "-")),
            })
    log_buckets = {}
    for item in recent_logs:
        try:
            bucket = datetime.fromtimestamp(int(item["timestamp"]) / 1_000_000_000, timezone.utc).strftime("%H:%M")
        except (TypeError, ValueError, OSError):
            bucket = "now"
        counts = log_buckets.setdefault(bucket, {"time": bucket, "info": 0, "error": 0})
        counts["error" if item["level"] in {"ERROR", "CRITICAL"} else "info"] += 1

    trace_samples = []
    for trace in (traces_payload or {}).get("data", []):
        spans = trace.get("spans", [])
        if not spans:
            continue
        root = min(spans, key=lambda span: span.get("startTime", 0))
        tags = {tag.get("key"): tag.get("value") for tag in root.get("tags", [])}
        trace_samples.append({
            "id": trace.get("traceID", root.get("traceID", "trace-unknown")),
            "time": root.get("startTime", 0) / 1000,
            "duration": max(0, root.get("duration", 0) / 1000),
            "spans": len(spans),
            "isError": tags.get("error") is True or tags.get("otel.status_code") == "ERROR",
            "service": (root.get("process", {}) or {}).get("serviceName", "unknown-service"),
            "operation": root.get("operationName", "unknown-operation"),
        })
    trace_samples.sort(key=lambda item: item["time"])
    if not trace_samples:
        # The bundled services do not emit OTLP spans themselves. Reuse the
        # same correlation events sent to Loki so the local trace view remains
        # live and linked by the exact same trace IDs.
        trace_samples = heartbeat_traces
        if trace_samples:
            services = sorted({item["service"] for item in trace_samples})
    error_trace_count = sum(1 for trace in trace_samples if trace["isError"])
    average_trace_latency = sum(trace["duration"] for trace in trace_samples) / len(trace_samples) if trace_samples else 0.0
    error_rate = (error_trace_count / len(trace_samples) * 100) if trace_samples else _prometheus_value(prom[4])
    experiment = telemetry_experiment()
    active_gap = experiment["fault_type"] if experiment else None
    service_fault = experiment.get("service_id") if active_gap == "SERVICE_DOWN" else None
    if active_gap == "TRACE_GAP":
        traces_payload = None
        trace_samples = []
        services = []
    if active_gap == "LOG_GAP":
        loki = None
        recent_logs = []
        error_count = 0
    if active_gap == "METRIC_GAP":
        prom = [None] * len(prom)
    if active_gap == "ERROR_SPIKE":
        recent_logs.append({
            "timestamp": str(int(now.timestamp() * 1_000_000_000)),
            "level": "ERROR",
            "service": "payment-service",
            "message": "Synthetic chaos error spike: upstream request failures",
            "traceId": "-",
        })
        error_count += 1
        error_rate = max(error_rate, 25.0)

    metrics_payload = {
        "cpuUsage": _prometheus_value(prom[0]),
        "memoryUsage": _prometheus_value(prom[1]),
        "requestCount": _prometheus_value(prom[2]),
        "p95Latency": _prometheus_value(prom[3]),
    }
    if active_gap == "LATENCY_SPIKE":
        metrics_payload["p95Latency"] = max(metrics_payload["p95Latency"], 1500.0)
        average_trace_latency = max(average_trace_latency, 1500.0)
    return {
        "metrics": metrics_payload,
        "series": {"cpu": _prometheus_series(cpu_series, "value"), "memory": _prometheus_series(memory_series, "value"), "requests": _prometheus_series(request_series, "value"), "latency": _prometheus_series(latency_series, "value")},
        "logs": {"errorCount": error_count, "recentErrors": [item["message"] for item in recent_logs[-20:]], "recentLogs": recent_logs[-100:], "series": list(log_buckets.values())},
        "traces": {"latency": average_trace_latency or _prometheus_value(prom[3]), "errorRate": error_rate, "serviceCount": len(services) if isinstance(services, list) else 0, "samples": trace_samples[-100:]},
        "dependencyMap": _dependency_map(traces_payload, heartbeat_traces),
        "serviceFault": {"type": "SERVICE_DOWN", "service": service_fault} if service_fault else None,
        # A reachable Jaeger API is a healthy telemetry pillar even when its
        # current trace query is empty or requires a service filter.
        "sources": {"prometheus": any(item is not None for item in prom), "loki": loki is not None, "jaeger": jaeger is not None and active_gap != "TRACE_GAP"},
        "lastUpdated": now.isoformat(),
    }
