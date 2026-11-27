"""All observability scoring and correlation calculations live here."""

import math
from datetime import datetime, timezone
from typing import Any

RI = {1: 0.0, 2: 0.0, 3: 0.58, 4: 0.90, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49}
PILLAR_LABELS = ["Metrics Coverage", "Trace Propagation", "Log Structural Integrity"]
PILLAR_MATRIX = [[1.0, 1.0, 1.2], [1.0, 1.0, 1.2], [1 / 1.2, 1 / 1.2, 1.0]]


def run_ahp(matrix: list[list[float]], labels: list[str]) -> dict[str, Any]:
    n = len(matrix)
    col_sums = [sum(matrix[r][c] for r in range(n)) for c in range(n)]
    normalised = [[matrix[r][c] / col_sums[c] for c in range(n)] for r in range(n)]
    weights = [sum(row) / n for row in normalised]
    w_sum = [sum(matrix[r][c] * weights[c] for c in range(n)) for r in range(n)]
    lambda_max = sum(w_sum[i] / weights[i] for i in range(n)) / n
    ci = (lambda_max - n) / (n - 1) if n > 1 else 0.0
    ri = RI.get(n, 1.49)
    cr = ci / ri if ri else 0.0
    return {
        "matrix": matrix, "normalisedMatrix": normalised, "weights": weights, "labels": labels,
        "lambdaMax": lambda_max, "consistencyIndex": ci, "randomIndex": ri, "consistencyRatio": cr,
        "isConsistent": cr < 0.10,
    }

OBS_AHP = run_ahp(PILLAR_MATRIX, PILLAR_LABELS)


def _timestamp_ms(val: Any) -> float | None:
    try:
        n = float(val)
        return n / 1_000_000 if n > 1e17 else n / 1_000 if n > 1e14 else n * 1_000 if n < 1e11 else n
    except (TypeError, ValueError):
        return None


def _service_name(value: Any) -> str:
    return str(value or "").strip().lower().replace("_", "-")


def _pillar_available(snapshot: dict[str, Any], pillar: str) -> bool:
    availability = snapshot.get("availability")
    if isinstance(availability, dict) and pillar in availability:
        return bool(availability[pillar])
    source_key = {"metrics": "prometheus", "traces": "jaeger", "logs": "loki"}[pillar]
    return bool(snapshot.get("sources", {}).get(source_key, False))


def _number_or_zero(value: Any) -> float:
    try:
        number = float(value)
        return number if math.isfinite(number) else 0.0
    except (TypeError, ValueError):
        return 0.0


# ==================== CCI: TIME-WINDOW CORRELATION ====================
# Normalize timestamps to milliseconds, then allow matching events from the
# same service (or an unknown service) when they are within the 2-second window.
def _within_window(left: dict[str, Any], right: dict[str, Any], window_ms: int = 2_000) -> bool:
    lt, rt = _timestamp_ms(left.get("timestamp", left.get("time"))), _timestamp_ms(right.get("timestamp", right.get("time")))
    if lt is None or rt is None:
        return False
    ls, rs = _service_name(left.get("service")), _service_name(right.get("service"))
    return (not ls or not rs or "unknown" in {ls, rs} or ls == rs) and abs(lt - rt) <= window_ms


def calculate_cci(snapshot: dict[str, Any]) -> dict[str, Any]:
    """Calculate pillar coverage, error-event correlation, and CCI blind spots."""
    sources = snapshot["sources"]
    error_count = int(snapshot["logs"]["errorCount"])
    error_rate = _number_or_zero(snapshot["traces"].get("errorRate"))
    metrics_available = _pillar_available(snapshot, "metrics")
    traces_available = _pillar_available(snapshot, "traces")
    logs_available = _pillar_available(snapshot, "logs")
    missing = [name for name, ok in (
        ("Metrics", metrics_available),
        ("Traces", traces_available),
        ("Logs", logs_available),
    ) if not ok]
    available = 3 - len(missing)
    logs, traces = snapshot["logs"].get("recentLogs", []), snapshot["traces"].get("samples", [])
    service_fault = snapshot.get("serviceFault") or {}
    error_logs = [item for item in logs if str(item.get("level", "")).upper() in {"ERROR", "CRITICAL"}]
    error_traces = [item for item in traces if item.get("isError")]
    trace_ids = {item.get("id") for item in traces if item.get("id")}
    log_trace_ids = {item.get("traceId") for item in logs if item.get("traceId") not in {None, "", "-"}}

    # ==================== CCI: ERROR LOG <-> ERROR TRACE MATCHING ====================
    # Match by trace ID when available, otherwise by the time window. A trace
    # can be paired only once so duplicate logs cannot inflate the match count.
    matched_pairs, matched_trace_indexes = 0, set()
    for log in error_logs:
        lid = log.get("traceId")
        for tidx, trace in enumerate(error_traces):
            if tidx not in matched_trace_indexes and ((lid not in {None, "", "-"} and lid == trace.get("id")) or _within_window(log, trace)):
                matched_pairs += 1
                matched_trace_indexes.add(tidx)
                break

    observed_events = max(len(error_logs), len(error_traces), 1 if error_rate > 0 else 0, 1 if service_fault.get("type") == "SERVICE_DOWN" else 0)
    matched_events = 0 if observed_events == 0 else min(matched_pairs, observed_events)
    correlation_confidence = 100.0 if not missing else 0.0 if observed_events == 0 else round((matched_events / observed_events) * 100, 2)

    # ==================== CCI: BLIND-SPOT CLASSIFICATION ====================
    # Record missing pillars, missing log trace IDs, service outages, and
    # observed trace/log context that could not be correlated.
    now_iso = datetime.now(timezone.utc).isoformat()
    def _spot(pillars: list[str], reason: str | None = None, trace_ok: bool | None = None, log_ok: bool | None = None) -> dict[str, Any]:
        d: dict[str, Any] = {
            "timestamp_utc": now_iso,
            "has_metric": metrics_available,
            "has_trace": traces_available if trace_ok is None else trace_ok,
            "has_log": logs_available if log_ok is None else log_ok,
            "missing_pillars": pillars,
        }
        if reason: d["reason"] = reason
        return d

    blind_spots = []
    # Flag a service outage while monitoring backends are reachable.
    if service_fault.get("type") == "SERVICE_DOWN":
        blind_spots.append(_spot(["Service telemetry: " + str(service_fault.get("service") or "selected service")], "The selected service is down while the observability backends remain reachable."))
    # Flag any unavailable telemetry pillar.
    if missing:
        blind_spots.append(_spot(missing))
    # Flag error logs that have no trace ID.
    if error_logs and any(item.get("traceId") in {None, "", "-"} for item in error_logs):
        blind_spots.append(_spot(["Trace context propagation"], "Error logs were received without a trace identifier.", trace_ok=bool(error_traces)))
    # Flag observed trace/log IDs when no error log and trace can be matched.
    if observed_events and (trace_ids or log_trace_ids) and not matched_pairs:
        blind_spots.append(_spot(["Trace-log context correlation"], "No shared trace identifier was found in the current observation window.", trace_ok=bool(trace_ids), log_ok=bool(log_trace_ids)))

    # ==================== CCI INDEX: COVERAGE x CORRELATION ====================
    # With observed error events, combine three-pillar coverage with correlation
    # confidence. If no events were observed, use pillar coverage alone.
    coverage_score = (available / 3) * 100
    cci_index = round(coverage_score * (correlation_confidence / 100)) if observed_events else round(coverage_score)
    return {
        "cci_index": cci_index,
        "total_events": observed_events,
        "matched_events": matched_events,
        "matched_trace_log_ids": len(trace_ids & log_trace_ids),
        "correlation_confidence": correlation_confidence,
        "sampling_warning": "Trace query reached its collection limit; sampling completeness should be reviewed." if len(traces) >= 100 else None,
        "blind_spots": blind_spots,
        "pillar_coverage": {
            "metric": int(metrics_available),
            "trace": int(traces_available),
            "log": int(logs_available),
        },
        "event_source": "prometheus" if sources.get("prometheus") else "jaeger" if sources.get("jaeger") else "loki",
    }


def calculate_observability(snapshot: dict[str, Any]) -> dict[str, Any]:
    """Calculate the weighted observability score and apply the blind-spot penalty."""
    metrics, traces, logs = (
        1.0 if _pillar_available(snapshot, pillar) else 0.0
        for pillar in ("metrics", "traces", "logs")
    )
    cci = calculate_cci(snapshot)
    w = OBS_AHP["weights"]
    raw_score = (metrics * w[0] + traces * w[1] + logs * w[2]) * 100
    # ==================== O-SCORE: BLIND-SPOT PENALTY ====================
    # Deduct 2 points per detected blind spot, capped at 15, without going below 0.
    penalty = min(len(cci["blind_spots"]) * 2, 15)
    score = max(0.0, raw_score - penalty)
    status = "HEALTHY" if score >= 80 else "WARNING" if score >= 60 else "CRITICAL"
    maturity = "Proactive" if score >= 80 else "Intermediate" if score >= 50 else "Reactive"
    source_coverage = round((sum((metrics, traces, logs)) / 3) * 100, 2)
    score_valid, cci_valid, ahp_consistent = 0 <= score <= 100, 0 <= cci["cci_index"] <= 100, OBS_AHP["consistencyRatio"] < 0.10
    verification_pct = round(max(0.0, min(100.0, (source_coverage * 0.4 + cci["correlation_confidence"] * 0.4 + (100.0 if ahp_consistent else 0.0) * 0.1 + (100.0 if score_valid and cci_valid else 0.0) * 0.1 - penalty))), 2)

    return {
        "oScore": round(score, 2),
        "cciIndex": cci["cci_index"],
        "blindSpotCount": len(cci["blind_spots"]),
        "status": status,
        "maturity": maturity,
        "ahp": OBS_AHP,
        "cciData": cci,
        "scoreBreakdown": {
            "metricsCoverage": metrics,
            "tracePropagation": traces,
            "logStructuralIntegrity": logs,
            "weightedRawScore": round(raw_score, 2),
            "blindSpotPenalty": penalty,
        },
        "verification": {
            "status": "VERIFIED" if score_valid and cci_valid and ahp_consistent else "REVIEW_REQUIRED",
            "verificationPercentage": verification_pct,
            "sourceCoveragePct": source_coverage,
            "correlationConfidencePct": cci["correlation_confidence"],
            "ahpConsistencyRatio": round(OBS_AHP["consistencyRatio"], 6),
            "ahpConsistent": ahp_consistent,
            "scoreRangeValid": score_valid,
            "cciRangeValid": cci_valid,
            "blindSpotPenalty": penalty,
        },
    }
