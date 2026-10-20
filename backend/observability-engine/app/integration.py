"""Integration boundary for performance and resilience telemetry.

The observability engine owns the correlation boundary, while the performance
and resilience components remain responsible for their own calculations.
"""

from __future__ import annotations

import threading
import time
import uuid
from typing import Any

import requests


TELEMETRY_COLLECTOR_URL = __import__("os").getenv(
    "TELEMETRY_COLLECTOR_URL", "http://localhost:8787"
).rstrip("/")
_lock = threading.Lock()
_chaos_events: list[dict[str, Any]] = []
_telemetry_gap: dict[str, Any] | None = None


def _get_json(path: str, params: dict[str, Any] | None = None) -> dict[str, Any] | None:
    try:
        response = requests.get(
            f"{TELEMETRY_COLLECTOR_URL}{path}", params=params, timeout=3
        )
        response.raise_for_status()
        payload = response.json()
        return payload if isinstance(payload, dict) else None
    except (requests.RequestException, ValueError):
        return None


def collect_performance(service_ids: list[str]) -> dict[str, Any]:
    """Read the existing performance collector without duplicating its logic."""
    payload = _get_json(
        "/api/telemetry/snapshot", {"services": ",".join(service_ids)}
    )
    if payload:
        return {"source": "telemetry-collector", **payload}
    return {
        "source": "unavailable",
        "requestedServices": service_ids,
        "collectedAt": int(time.time() * 1000),
        "snapshots": [],
        "errors": [{"message": "Performance telemetry collector unavailable"}],
    }


def inject_chaos(
    fault_type: str,
    target_service: str,
    duration_seconds: int = 15,
    latency_ms: int = 0,
    error_rate: int = 0,
) -> dict[str, Any]:
    global _telemetry_gap
    now = int(time.time() * 1000)
    event = {
        "experiment_id": f"exp-{uuid.uuid4().hex[:10]}",
        "fault_type": fault_type,
        "target_service": target_service,
        "started_at": now,
        "ends_at": now + max(1, duration_seconds) * 1000,
        "duration_seconds": max(1, duration_seconds),
        "latency_ms": max(0, latency_ms),
        "error_rate": max(0, min(100, error_rate)),
        "status": "active",
        "recovered": False,
        "mttr_seconds": None,
    }
    with _lock:
        _chaos_events.append(event)
        del _chaos_events[:-100]
        if fault_type in {"TRACE_GAP", "LOG_GAP", "METRIC_GAP", "SERVICE_DOWN", "LATENCY_SPIKE", "ERROR_SPIKE"}:
            _telemetry_gap = {
                "fault_type": fault_type,
                "service_id": target_service,
                "ends_at": event["ends_at"],
            }
    return event


def clear_chaos(target_service: str | None = None) -> list[dict[str, Any]]:
    global _telemetry_gap
    now = int(time.time() * 1000)
    recovered: list[dict[str, Any]] = []
    with _lock:
        for event in _chaos_events:
            if event["status"] == "active" and (
                target_service is None or event["target_service"] in {target_service, "all"}
            ):
                event["status"] = "recovered"
                event["recovered"] = True
                event["ended_at"] = now
                event["mttr_seconds"] = round((now - event["started_at"]) / 1000, 1)
                recovered.append(dict(event))
        if _telemetry_gap and (target_service is None or _telemetry_gap["service_id"] in {target_service, "all"}):
            _telemetry_gap = None
    return recovered


def telemetry_gap() -> str | None:
    """Return the active research/demo telemetry gap, if any."""
    global _telemetry_gap
    with _lock:
        if _telemetry_gap and time.time() >= _telemetry_gap["ends_at"]:
            _telemetry_gap = None
        return _telemetry_gap["fault_type"] if _telemetry_gap else None


def telemetry_experiment() -> dict[str, Any] | None:
    """Return the active experiment context without exposing internal state."""
    global _telemetry_gap
    with _lock:
        if _telemetry_gap and time.time() >= _telemetry_gap["ends_at"]:
            _telemetry_gap = None
        return dict(_telemetry_gap) if _telemetry_gap else None


def chaos_history() -> list[dict[str, Any]]:
    now = int(time.time() * 1000)
    with _lock:
        for event in _chaos_events:
            if event["status"] == "active" and now >= event["ends_at"]:
                event["status"] = "recovered"
                event["recovered"] = True
                event["ended_at"] = event["ends_at"]
                event["mttr_seconds"] = event["duration_seconds"]
        return [dict(event) for event in reversed(_chaos_events)]


def collect_resilience(service_ids: list[str]) -> dict[str, Any]:
    events = chaos_history()
    by_service = []
    for service_id in service_ids:
        service_events = [
            event for event in events if event["target_service"] in {service_id, "all"}
        ]
        recovered = [event for event in service_events if event["recovered"]]
        mttrs = [event["mttr_seconds"] for event in recovered if event["mttr_seconds"] is not None]
        by_service.append({
            "service_id": service_id,
            "active_faults": sum(event["status"] == "active" for event in service_events),
            "chaos_experiments": len(service_events),
            "recovery_success_rate": round((len(recovered) / len(service_events)) * 100, 2) if service_events else 100.0,
            "mttr_seconds": round(sum(mttrs) / len(mttrs), 1) if mttrs else 0.0,
        })
    return {
        "source": "observability-chaos-gateway",
        "events": events,
        "services": by_service,
    }


def collect_integrated(service_ids: list[str]) -> dict[str, Any]:
    return {
        "performance": collect_performance(service_ids),
        "resilience": collect_resilience(service_ids),
    }
