"""Phase 3 - Runtime: Telemetry Ingestion (Prometheus/OTel) & Trace Analysis.
Captures runtime metrics: pod_restarts, cpu_spike_pct, mem_spike_pct,
error_rate_pct, max_call_depth, and sync_call_count.
"""
from datetime import datetime, timezone
from typing import Dict, Any, List

from app import db

METRIC_KEYS = [
    "max_call_depth",
    "sync_call_count",
    "cpu_spike_pct",
    "mem_spike_pct",
    "error_rate_pct",
    "pod_restarts"
]


def get_phase3_features(repo_id: int, service_name: str) -> Dict[str, float]:
    """Retrieve the most recent runtime telemetry metrics for a service."""
    latest = db.get_latest_telemetry(repo_id, service_name)
    features = {}
    for key in METRIC_KEYS:
        # Default to 0 if metric has not been pushed yet
        features[key] = float(latest.get(key, 0.0))
    return features


def record_metric(repo_id: int, service_name: str, metric: str, value: float):
    """Save a single runtime metric reading into SQLite."""
    if metric in METRIC_KEYS:
        db.add_telemetry(repo_id, service_name, metric, float(value))


def record_batch_metrics(repo_id: int, service_name: str, metrics: Dict[str, float]):
    """Save multiple runtime metric readings for a service."""
    for k, v in metrics.items():
        if k in METRIC_KEYS:
            db.add_telemetry(repo_id, service_name, k, float(v))


def parse_otlp_traces(trace_payload: Dict[str, Any]) -> Dict[str, float]:
    """Parse OpenTelemetry OTLP JSON traces to extract max_call_depth and sync_call_count.
    Calculates span tree depth and sequential synchronous call chains.
    """
    try:
        spans = []
        resource_spans = trace_payload.get("resourceSpans", [])
        for rs in resource_spans:
            scope_spans = rs.get("scopeSpans", [])
            for ss in scope_spans:
                spans.extend(ss.get("spans", []))

        if not spans:
            return {"max_call_depth": 1.0, "sync_call_count": 0.0}

        # Build parent -> children map
        span_children: Dict[str, List[str]] = {}
        all_ids = set()
        child_ids = set()

        for s in spans:
            s_id = s.get("spanId")
            p_id = s.get("parentSpanId")
            all_ids.add(s_id)
            if p_id:
                child_ids.add(s_id)
                span_children.setdefault(p_id, []).append(s_id)

        # Roots are spans with no parent in this trace
        root_spans = all_ids - child_ids

        # Compute max call depth via DFS
        def get_depth(span_id: str) -> int:
            children = span_children.get(span_id, [])
            if not children:
                return 1
            return 1 + max(get_depth(c) for c in children)

        max_depth = max((get_depth(r) for r in root_spans), default=1)
        sync_calls = sum(len(c) for c in span_children.values() if len(c) > 1)

        return {
            "max_call_depth": float(max_depth),
            "sync_call_count": float(sync_calls)
        }
    except Exception as e:
        print(f"[phase3] Trace parsing warning: {e}")
        return {"max_call_depth": 1.0, "sync_call_count": 0.0}


def simulate_telemetry_preset(repo_id: int, service_name: str, preset: str) -> Dict[str, float]:
    """Viva & Testing helper to simulate realistic production telemetry scenarios."""
    presets = {
        "healthy": {
            "pod_restarts": 0.0,
            "cpu_spike_pct": 14.5,
            "mem_spike_pct": 28.0,
            "error_rate_pct": 0.05,
            "max_call_depth": 2.0,
            "sync_call_count": 1.0
        },
        "pod_crash": {
            "pod_restarts": 14.0,
            "cpu_spike_pct": 45.0,
            "mem_spike_pct": 65.0,
            "error_rate_pct": 4.5,
            "max_call_depth": 2.0,
            "sync_call_count": 1.0
        },
        "cpu_burn": {
            "pod_restarts": 3.0,
            "cpu_spike_pct": 94.0,
            "mem_spike_pct": 88.0,
            "error_rate_pct": 3.2,
            "max_call_depth": 3.0,
            "sync_call_count": 2.0
        },
        "cascading_failure": {
            "pod_restarts": 18.0,
            "cpu_spike_pct": 98.5,
            "mem_spike_pct": 96.0,
            "error_rate_pct": 14.8,
            "max_call_depth": 6.0,
            "sync_call_count": 5.0
        }
    }

    metrics = presets.get(preset, presets["healthy"])
    record_batch_metrics(repo_id, service_name, metrics)
    return metrics
