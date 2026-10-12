"""Collect and normalise telemetry before handing it to the scoring engine."""

import os
from datetime import datetime, timedelta, timezone

import requests


PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://localhost:9090")
LOKI_URL = os.getenv("LOKI_URL", "http://localhost:3100")
JAEGER_URL = os.getenv("JAEGER_URL", "http://localhost:16686")
TIMEOUT_SECONDS = float(os.getenv("OBSERVABILITY_TIMEOUT_SECONDS", "2"))


def _get_json(url: str, params: dict[str, str] | None = None) -> dict | None:
    try:
        response = requests.get(url, params=params, timeout=TIMEOUT_SECONDS)
        response.raise_for_status()
        return response.json()
    except (requests.RequestException, ValueError):
        return None


def _prometheus_value(payload: dict | None) -> float:
    result = (payload or {}).get("data", {}).get("result", [])
    try:
        return float(result[0]["value"][1]) if result else 0.0
    except (KeyError, IndexError, TypeError, ValueError):
        return 0.0


def collect_telemetry() -> dict:
    now = datetime.now(timezone.utc)
    prom = [_get_json(f"{PROMETHEUS_URL}/api/v1/query", {"query": query}) for query in (
        "sum(rate(container_cpu_usage_seconds_total[1m])) * 100",
        "sum(container_memory_working_set_bytes) / sum(container_spec_memory_limit_bytes) * 100",
        "sum(rate(http_requests_total[1m]))",
    )]
    loki = _get_json(f"{LOKI_URL}/loki/api/v1/query_range", {
        "query": '{level="error"}',
        "start": (now - timedelta(minutes=15)).isoformat(),
        "end": now.isoformat(),
        "limit": "100",
        "direction": "backward",
    })
    jaeger = _get_json(f"{JAEGER_URL}/api/services")
    streams = (loki or {}).get("data", {}).get("result", [])
    services = (jaeger or {}).get("data", [])
    error_count = sum(len(stream.get("values", [])) for stream in streams)
    return {
        "metrics": {"cpuUsage": _prometheus_value(prom[0]), "memoryUsage": _prometheus_value(prom[1]), "requestCount": _prometheus_value(prom[2])},
        "logs": {"errorCount": error_count, "recentErrors": [entry[1] for stream in streams for entry in stream.get("values", [])[-5:] if len(entry) > 1]},
        "traces": {"latency": 0.0, "errorRate": 0.0, "serviceCount": len(services) if isinstance(services, list) else 0},
        "sources": {"prometheus": any(item is not None for item in prom), "loki": loki is not None, "jaeger": jaeger is not None},
        "lastUpdated": now.isoformat(),
    }
