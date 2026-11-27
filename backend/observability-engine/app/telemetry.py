"""Telemetry-Only RCA-to-Kubernetes Remediation Pipeline - Step 1.

Collect and normalize telemetry from Prometheus, Loki, and Jaeger without
reading or ingesting application source code.
"""

import math
import os
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from typing import Any

import requests

from app.integration import telemetry_experiment

PIPELINE_NAME = "Telemetry-Only RCA-to-Kubernetes Remediation Pipeline"

# Base URLs and request defaults are configurable so the telemetry collector
# works consistently across local development and deployed environments.
PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://localhost:9090").rstrip("/")
LOKI_URL = os.getenv("LOKI_URL", "http://localhost:3100").rstrip("/")
JAEGER_URL = os.getenv("JAEGER_URL", "http://localhost:16686").rstrip("/")
TIMEOUT = float(os.getenv("OBSERVABILITY_TIMEOUT_SECONDS", "2"))
PROMETHEUS_LABEL_FILTER = os.getenv(
    "PROMETHEUS_LABEL_FILTER", os.getenv("APP_LABEL_FILTER", "")
).strip().strip("{}")
LOKI_QUERY = os.getenv("LOKI_QUERY_FILTER", '{job=~".+"}')


def backend_request_options(url: str) -> dict[str, Any]:
    """Return authentication and TLS options for the matching observability backend."""
    for base_url, prefix in (
        (PROMETHEUS_URL, "PROMETHEUS"),
        (LOKI_URL, "LOKI"),
        (JAEGER_URL, "JAEGER"),
    ):
        if not url.startswith(base_url):
            continue
        token = os.getenv(f"{prefix}_BEARER_TOKEN", "").strip()
        username = os.getenv(f"{prefix}_USERNAME", "")
        password = os.getenv(f"{prefix}_PASSWORD", "")
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        options: dict[str, Any] = {
            "headers": headers,
            "verify": os.getenv(f"{prefix}_CA_CERT") or True,
        }
        if username or password:
            options["auth"] = (username, password)
        return options
    return {"headers": {}, "verify": True}


def _get_json(url: str, params: dict[str, str] | None = None) -> dict | None:
    """Fetch JSON data and treat network, HTTP, or decoding failures as unavailable."""
    try:
        response = requests.get(
            url, params=params, timeout=TIMEOUT, **backend_request_options(url)
        )
        response.raise_for_status()
        payload = response.json()
        return payload if isinstance(payload, dict) else None
    except (requests.RequestException, ValueError):
        return None


def _get_text(url: str) -> bool:
    """Check whether an endpoint responds successfully without reading the response body."""
    try:
        response = requests.get(url, timeout=TIMEOUT, **backend_request_options(url))
        response.raise_for_status()
        return True
    except requests.RequestException:
        return False


def _prometheus_value(payload: dict | None) -> float | None:
    """Extract one finite scalar value from a Prometheus instant-query response."""
    try:
        if payload.get("status") != "success":
            return None
        value = float(payload["data"]["result"][0]["value"][1])
        return value if math.isfinite(value) else None
    except (AttributeError, KeyError, IndexError, TypeError, ValueError):
        return None


def _prometheus_series(payload: dict | None, name: str) -> list[dict]:
    """Convert Prometheus range-query samples into dashboard time-series points."""
    points = []
    for result in (payload or {}).get("data", {}).get("result", []):
        for timestamp, value in result.get("values", []):
            try:
                number = float(value)
                if math.isfinite(number):
                    points.append({
                        "time": datetime.fromtimestamp(
                            float(timestamp), timezone.utc
                        ).isoformat(),
                        name: number,
                    })
            except (TypeError, ValueError, OSError):
                continue
    return points


def _detect_log_level(labels: dict, message: str) -> str:
    """[STEP 1 / LOKI] Normalize runtime log severity from labels or log text."""
    level = str(labels.get("level", labels.get("severity", ""))).upper()
    if level in {"ERROR", "CRITICAL", "FATAL", "WARN", "WARNING", "DEBUG", "INFO"}:
        return "WARN" if level == "WARNING" else level
    if re.search(r"\b(ERROR|CRITICAL|FATAL|EXCEPTION|PANIC)\b", message, re.I):
        return "ERROR"
    if re.search(r"\b(WARN|WARNING)\b", message, re.I):
        return "WARN"
    if re.search(r"\bDEBUG\b", message, re.I):
        return "DEBUG"
    return "INFO"


def _selector(metric: str, extra_matchers: str = "") -> str:
    """Build a metric selector with optional global and query-specific label filters."""
    matchers = ",".join(
        part for part in (PROMETHEUS_LABEL_FILTER, extra_matchers) if part
    )
    return f"{metric}{{{matchers}}}" if matchers else metric


def _metric_queries() -> dict[str, list[str]]:
    """[STEP 1 / PROMETHEUS] Return runtime metric queries only.

    CPU, memory, request, latency, and error-rate signals are collected
    from Prometheus. No application source code is requested or ingested.
    """
    queries = {
        "cpu": [
            f"sum(rate({_selector('process_cpu_time_seconds_total')}[1m])) * 100",
            f"sum(rate({_selector('process_cpu_seconds_total')}[1m])) * 100",
            f"sum(rate({_selector('process_cpu_user_seconds_total')}[1m]) + rate({_selector('process_cpu_system_seconds_total')}[1m])) * 100",
            f"avg({_selector('process_cpu_utilization')}) * 100",
        ],
        "memory": [
            f"avg({_selector('process_memory_utilization')}) * 100",
            f"100 * sum({_selector('nodejs_heap_size_used_bytes')}) / clamp_min(sum({_selector('nodejs_heap_size_total_bytes')}), 1)",
            f"100 * sum({_selector('container_memory_working_set_bytes')}) / clamp_min(sum({_selector('kube_pod_container_resource_limits', 'resource=\"memory\"')}), 1)",
            f"100 * sum({_selector('container_memory_working_set_bytes')}) / clamp_min(sum({_selector('container_spec_memory_limit_bytes')}), 1)",
        ],
        "requests": [
            f"sum(rate({_selector('http_server_request_duration_seconds_count')}[1m]))",
            f"sum(rate({_selector('http_requests_total')}[1m]))",
            f"sum(rate({_selector('http_server_requests_seconds_count')}[1m]))",
            f"sum(rate({_selector('http_server_requests_total')}[1m]))",
        ],
        "latency": [
            f"histogram_quantile(0.95, sum(rate({_selector('http_server_request_duration_seconds_bucket')}[5m])) by (le)) * 1000",
            f"histogram_quantile(0.95, sum(rate({_selector('http_request_duration_seconds_bucket')}[5m])) by (le)) * 1000",
            f"histogram_quantile(0.95, sum(rate({_selector('http_server_requests_seconds_bucket')}[5m])) by (le)) * 1000",
        ],
        "errors": [
            f"100 * sum(rate({_selector('http_server_request_duration_seconds_count', 'http_response_status_code=~\"5..\"')}[5m])) / clamp_min(sum(rate({_selector('http_server_request_duration_seconds_count')}[5m])), 1)",
            f"100 * sum(rate({_selector('http_requests_total', 'status=~\"5..\"')}[5m])) / clamp_min(sum(rate({_selector('http_requests_total')}[5m])), 1)",
            f"100 * sum(rate({_selector('http_server_requests_seconds_count', 'status_code=~\"5..\"')}[5m])) / clamp_min(sum(rate({_selector('http_server_requests_seconds_count')}[5m])), 1)",
        ],
    }
    for key in queries:
        configured = os.getenv(f"PROMETHEUS_{key.upper()}_QUERY", "").strip()
        if configured:
            queries[key] = [configured]
    return queries


def _query_range(
    query: str, start: datetime, end: datetime, step: str = "60s"
) -> dict | None:
    """Fetch the historical samples used to draw a metric chart."""
    return _get_json(
        f"{PROMETHEUS_URL}/api/v1/query_range",
        {
            "query": query,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "step": step,
        },
    )


def _dependency_map(traces_payload: dict | None) -> dict:
    """[STEP 1 / JAEGER] Build a service graph from trace span relationships only.

    Parent and child references come from Jaeger span metadata. This analysis
    does not inspect application source code.
    """
    edges: dict[tuple[str, str], dict] = {}
    root = "unknown-service"
    for trace in (traces_payload or {}).get("data", []):
        spans = trace.get("spans", [])
        if not spans:
            continue
        services = {
            span.get("spanID"): (span.get("process", {}) or {}).get(
                "serviceName", "unknown-service"
            )
            for span in spans
        }
        root_span = min(spans, key=lambda span: span.get("startTime", 0))
        root = services.get(root_span.get("spanID"), root)
        for span in spans:
            child = services.get(span.get("spanID"))
            if not child:
                continue
            tags = {tag.get("key"): tag.get("value") for tag in span.get("tags", [])}
            for reference in span.get("references", []):
                parent = services.get(reference.get("spanID"))
                if parent and parent != child:
                    edges[(parent, child)] = {
                        "source": parent,
                        "target": child,
                        "status": "Degraded" if tags.get("error") is True else "Healthy",
                    }
    if not edges:
        return {"root": None, "nodes": [], "edges": [], "live": False}

    children: dict[str, list[str]] = {}
    for edge in edges.values():
        children.setdefault(edge["source"], []).append(edge["target"])
    depths, queue = {root: 0}, [root]
    while queue:
        current = queue.pop(0)
        for child in children.get(current, []):
            if child not in depths:
                depths[child] = depths[current] + 1
                queue.append(child)
    nodes = [{"name": name, "depth": depth, "status": "Healthy"} for name, depth in depths.items()]
    for edge in edges.values():
        if edge["status"] == "Degraded":
            for node in nodes:
                if node["name"] == edge["target"]:
                    node["status"] = "Degraded"
    return {"root": root, "nodes": nodes, "edges": list(edges.values()), "live": True}


def collect_telemetry() -> dict:
    """[PIPELINE STEP 1] Collect telemetry only and build a normalized JSON snapshot.

    Data sources:
    - Prometheus: CPU, memory, request, latency, and error-rate metrics.
    - Loki: Runtime log lines and normalized error levels.
    - Jaeger: Distributed trace spans, latency, and error information.

    Source-code exclusion:
    - This function does not read application source files or repository code.
    - It does not use AST, code search, file contents, or code embeddings.
    - The returned value is a telemetry-only JSON snapshot.
    """
    now = datetime.now(timezone.utc)
    start = now - timedelta(minutes=30)
    queries = _metric_queries()
    query_items = [
        (key, query)
        for key, candidates in queries.items()
        for query in candidates
    ]

    # [STEP 1 / LOKI] Limit collection to runtime error and informational log lines
    # from the most recent 15 minutes. Application source files are not accessed.
    loki_params = {
        "query": LOKI_QUERY,
        "start": (now - timedelta(minutes=15)).isoformat(),
        "end": now.isoformat(),
        "limit": "100",
        "direction": "backward",
    }

    # [STEP 1 / SOURCES] Fetch Prometheus, Loki, and Jaeger independently.
    # Concurrent requests keep collection fast without touching application source code.
    with ThreadPoolExecutor(max_workers=24) as executor:
        query_futures = {
            (key, query): executor.submit(
                _get_json,
                f"{PROMETHEUS_URL}/api/v1/query",
                {"query": query},
            )
            for key, query in query_items
        }
        status_future = executor.submit(
            _get_json, f"{PROMETHEUS_URL}/api/v1/status/buildinfo"
        )
        loki_future = executor.submit(
            _get_json, f"{LOKI_URL}/loki/api/v1/query_range", loki_params
        )
        jaeger_future = executor.submit(_get_json, f"{JAEGER_URL}/api/services")
        traces_future = executor.submit(
            _get_json,
            f"{JAEGER_URL}/api/traces",
            {"lookback": "1h", "limit": "100"},
        )

        chosen: dict[str, tuple[str | None, dict | None, float | None]] = {}
        # [STEP 1 / PROMETHEUS] Select CPU, memory, request, latency, and error metrics.
        for key, candidates in queries.items():
            chosen[key] = (None, None, None)
            # Use the first query variant that returns a usable numeric value.
            for query in candidates:
                payload = query_futures[(key, query)].result()
                value = _prometheus_value(payload)
                if value is not None:
                    chosen[key] = (query, payload, value)
                    break

        range_futures = {
            key: executor.submit(_query_range, query, start, now)
            for key, (query, _, _) in chosen.items()
            if query is not None and key != "errors"
        }
        prometheus_status = status_future.result()
        loki = loki_future.result()
        jaeger = jaeger_future.result()
        traces_payload = traces_future.result()
        series_payloads = {
            key: future.result() for key, future in range_futures.items()
        }

    streams = (loki or {}).get("data", {}).get("result", [])
    jaeger_services = (jaeger or {}).get("data", [])
    recent_logs = []
    # [STEP 1 / LOKI] Normalize runtime log entries for the JSON snapshot.
    for stream in streams:
        labels = stream.get("stream", {})
        for entry in stream.get("values", []):
            if len(entry) >= 2:
                recent_logs.append({
                    "timestamp": entry[0],
                    "level": _detect_log_level(labels, entry[1]),
                    "service": next(
                        (
                            labels[key]
                            for key in ("service_name", "service", "app_service", "app", "job")
                            if labels.get(key)
                        ),
                        "unknown-service",
                    ),
                    "message": entry[1],
                    "traceId": labels.get("trace_id", labels.get("traceId", "-")),
                })
    # Count only ERROR and CRITICAL entries; WARN and INFO remain display-only.
    error_count = sum(
        1 for item in recent_logs if item["level"] in {"ERROR", "CRITICAL"}
    )
    # Bucket log volume by minute for the log trend chart.
    log_buckets: dict[str, dict[str, Any]] = {}
    for item in recent_logs:
        try:
            bucket = datetime.fromtimestamp(
                int(item["timestamp"]) / 1e9, timezone.utc
            ).strftime("%H:%M")
        except (TypeError, ValueError, OSError):
            bucket = "now"
        counts = log_buckets.setdefault(
            bucket, {"time": bucket, "info": 0, "error": 0}
        )
        counts["error" if item["level"] in {"ERROR", "CRITICAL"} else "info"] += 1

    trace_samples = []
    # [STEP 1 / JAEGER] Convert distributed trace spans into trace samples.
    # The earliest span represents the trace root; no source code is ingested.
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
    trace_samples.sort(key=lambda sample: sample["time"])

    # Keep the selected Prometheus query alongside its value for chart fallback.
    cpu_query, cpu_payload, cpu_value = chosen["cpu"]
    memory_query, memory_payload, memory_value = chosen["memory"]
    requests_query, requests_payload, requests_value = chosen["requests"]
    latency_query, latency_payload, latency_value = chosen["latency"]
    _, _, metric_error_rate = chosen["errors"]
    error_trace_count = sum(1 for sample in trace_samples if sample["isError"])
    trace_latency = (
        sum(sample["duration"] for sample in trace_samples) / len(trace_samples)
        if trace_samples
        else None
    )
    error_rate = (
        error_trace_count / len(trace_samples) * 100
        if trace_samples
        else metric_error_rate
    )

    # Controlled chaos experiments modify the normalized output to simulate outages.
    experiment = telemetry_experiment()
    active_gap = experiment["fault_type"] if experiment else None
    service_fault = experiment.get("service_id") if active_gap == "SERVICE_DOWN" else None
    if active_gap == "TRACE_GAP":
        traces_payload, trace_samples, jaeger_services = None, [], []
        trace_latency, error_rate = None, None
    elif active_gap == "LOG_GAP":
        loki, recent_logs, error_count = None, [], 0
    elif active_gap == "METRIC_GAP":
        cpu_value = memory_value = requests_value = latency_value = metric_error_rate = None
    elif active_gap == "ERROR_SPIKE":
        service_name = experiment.get("service_id") or "unknown-service"
        recent_logs.append({
            "timestamp": str(int(now.timestamp() * 1e9)),
            "level": "ERROR",
            "service": service_name,
            "message": "Controlled chaos experiment: injected error spike",
            "traceId": "-",
        })
        error_count += 1
        error_rate = max(error_rate or 0, 25.0)

    if active_gap == "LATENCY_SPIKE":
        latency_value = max(latency_value or 0, 1500.0)
        trace_latency = max(trace_latency or 0, 1500.0)

    metrics_payload = {
        "cpuUsage": cpu_value,
        "memoryUsage": memory_value,
        "requestCount": requests_value,
        "p95Latency": latency_value,
    }
    # Try range-query samples first and reuse instant-query payloads as a fallback.
    metric_series = {
        key: _prometheus_series(series_payloads.get(key), "value")
        for key in ("cpu", "memory", "requests", "latency")
    }
    metric_series["cpu"] = _prometheus_series(
        series_payloads.get("cpu") or cpu_payload, "value"
    ) if "cpu" in series_payloads else []
    metric_series["memory"] = _prometheus_series(
        series_payloads.get("memory") or memory_payload, "value"
    ) if "memory" in series_payloads else []
    metric_series["requests"] = _prometheus_series(
        series_payloads.get("requests") or requests_payload, "value"
    ) if "requests" in series_payloads else []
    metric_series["latency"] = _prometheus_series(
        series_payloads.get("latency") or latency_payload, "value"
    ) if "latency" in series_payloads else []
    if active_gap == "METRIC_GAP":
        metric_series = {key: [] for key in metric_series}

    error_count = sum(
        1 for item in recent_logs if item["level"] in {"ERROR", "CRITICAL"}
    )
    # Availability reflects whether each source has at least one usable signal.
    availability = {
        "metrics": any(value is not None for value in (cpu_value, memory_value, requests_value, latency_value, metric_error_rate)),
        "logs": bool(recent_logs),
        "traces": bool(trace_samples),
    }

    # [STEP 1 / SNAPSHOT] Return one normalized, telemetry-only JSON payload.
    # Prometheus metrics, Loki logs, and Jaeger traces are the only data sources.
    # This snapshot is suitable for downstream analysis and later patch generation.
    return {
        "pipeline": {
            "name": PIPELINE_NAME,
            "step": 1,
            "label": "Telemetry Collection",
            "sourceCodeIngested": False,
        },
        "metrics": metrics_payload,
        "metricAvailability": {
            "cpu": cpu_value is not None,
            "memory": memory_value is not None,
            "requestCount": requests_value is not None,
            "p95Latency": latency_value is not None,
        },
        "series": metric_series,
        "logs": {
            "errorCount": error_count,
            "recentErrors": [
                item["message"]
                for item in recent_logs
                if item["level"] in {"ERROR", "CRITICAL"}
            ][-20:],
            "recentLogs": recent_logs[-100:],
            "series": list(log_buckets.values()),
        },
        "traces": {
            "latency": trace_latency,
            "errorRate": error_rate,
            "serviceCount": len(jaeger_services) if isinstance(jaeger_services, list) else 0,
            "samples": trace_samples[-100:],
        },
        "dependencyMap": _dependency_map(traces_payload),
        "serviceFault": {"type": "SERVICE_DOWN", "service": service_fault} if service_fault else None,
        "sources": {
            "prometheus": prometheus_status is not None,
            "loki": loki is not None,
            "jaeger": jaeger is not None and active_gap != "TRACE_GAP",
        },
        "availability": availability,
        "activeExperiment": {
            "faultType": active_gap,
            "serviceId": experiment.get("service_id"),
            "simulated": True,
        } if experiment else None,
        "lastUpdated": now.isoformat(),
    }
