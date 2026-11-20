"""Collect and normalise telemetry before handing it to the scoring engine."""

import os
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


# Build a service dependency graph strictly from real Jaeger spans.
def _dependency_map(traces_payload: dict | None) -> dict:
    """Build a dynamic service graph from real Jaeger parent/child spans.
    No mock or hardcoded fallback edges are injected.
    """
    edges: dict[tuple[str, str], dict] = {}
    discovered_edges = False
    root = "unknown-service"

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
        return {"root": None, "nodes": [], "edges": [], "live": False}

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


# Collect and normalize the complete Prometheus/Loki/Jaeger snapshot in real-time.
def collect_telemetry() -> dict:
    now = datetime.now(timezone.utc)
    start = now - timedelta(minutes=30)
    # Define Prometheus queries for CPU, memory, request count, latency, and error rate.
    prom_queries = (
        "sum(rate(process_cpu_seconds_total[1m])) * 100",  # cpu usage percentage
        "sum(process_resident_memory_bytes) / clamp_min(sum(process_virtual_memory_bytes), 1) * 100",# memory usage percentage
        "sum(rate(prometheus_http_requests_total[1m]))",# request count per second
        "histogram_quantile(0.95, sum(rate(prometheus_http_request_duration_seconds_bucket[5m])) by (le)) * 1000",# p95 latency in milliseconds
        "100 * sum(rate(http_requests_total{status=~'5..'}[5m])) / clamp_min(sum(rate(http_requests_total[5m])), 1)",# error rate percentage
    )
    # Query all active services from Loki for the last 15 minutes
    loki_params = {
        "query": '{level=~"INFO|WARN|ERROR|CRITICAL"}',
        "start": (now - timedelta(minutes=15)).isoformat(),
        "end": now.isoformat(),
        "limit": "100",
        "direction": "backward",
    }

    # Query all pillars concurrently via real endpoints
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
                "timestamp": entry[0],# nanoseconds since epoch
                "level": labels.get("level", "ERROR").upper(),# log level
                "service": labels.get("service", labels.get("app", "unknown-service")),# service name
                "message": entry[1],# log message
                "traceId": labels.get("trace_id", labels.get("traceId", "-")),# trace ID
            })
    log_buckets = {}
    for item in recent_logs:
        try:
            bucket = datetime.fromtimestamp(int(item["timestamp"]) / 1_000_000_000, timezone.utc).strftime("%H:%M")
        except (TypeError, ValueError, OSError):
            bucket = "now"
        counts = log_buckets.setdefault(bucket, {"time": bucket, "info": 0, "error": 0})
        counts["error" if item["level"] in {"ERROR", "CRITICAL"} else "info"] += 1

    # Real Jaeger trace parsing - no synthetic fallbacks
    trace_samples = []
    for trace in (traces_payload or {}).get("data", []):
        spans = trace.get("spans", [])
        if not spans:
            continue
        root = min(spans, key=lambda span: span.get("startTime", 0))
        tags = {tag.get("key"): tag.get("value") for tag in root.get("tags", [])}
        trace_samples.append({
            "id": trace.get("traceID", root.get("traceID", "trace-unknown")),# trace ID
            "time": root.get("startTime", 0) / 1000,# start time in seconds since epoch
            "duration": max(0, root.get("duration", 0) / 1000),# duration in seconds
            "spans": len(spans),# number of spans in the trace
            "isError": tags.get("error") is True or tags.get("otel.status_code") == "ERROR",# whether the trace indicates an error
            "service": (root.get("process", {}) or {}).get("serviceName", "unknown-service"),# service name
            "operation": root.get("operationName", "unknown-operation"),# operation name
        })
    trace_samples.sort(key=lambda item: item["time"])

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
            "message": "Chaos fault injection: upstream error spike",
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
        "series": {
            "cpu": _prometheus_series(cpu_series, "value"),
            "memory": _prometheus_series(memory_series, "value"),
            "requests": _prometheus_series(request_series, "value"),
            "latency": _prometheus_series(latency_series, "value")
        },
        "logs": {
            "errorCount": error_count,
            "recentErrors": [item["message"] for item in recent_logs[-20:]],
            "recentLogs": recent_logs[-100:],
            "series": list(log_buckets.values())
        },
        "traces": {
            "latency": average_trace_latency or _prometheus_value(prom[3]),
            "errorRate": error_rate,
            "serviceCount": len(services) if isinstance(services, list) else 0,
            "samples": trace_samples[-100:]
        },
        "dependencyMap": _dependency_map(traces_payload),
        "serviceFault": {"type": "SERVICE_DOWN", "service": service_fault} if service_fault else None,
        "sources": {
            "prometheus": any(item is not None for item in prom),
            "loki": loki is not None,
            "jaeger": jaeger is not None and active_gap != "TRACE_GAP"
        },
        "lastUpdated": now.isoformat(),
    }
