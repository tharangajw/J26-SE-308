"""All observability scoring and correlation calculations live here."""

from datetime import datetime, timezone
from typing import Any


RI = {1: 0.0, 2: 0.0, 3: 0.58, 4: 0.90, 5: 1.12,
      6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49}

PILLAR_LABELS = [
    "Metrics Coverage (Prometheus)",
    "Trace Propagation (Jaeger)",
    "Log Structural Integrity (Loki)",
]
PILLAR_MATRIX = [[1.0, 1.0, 1.2], [1.0, 1.0, 1.2], [1 / 1.2, 1 / 1.2, 1.0]]


def run_ahp(matrix: list[list[float]], labels: list[str]) -> dict[str, Any]:
    n = len(matrix)
    column_sums = [sum(row[column] for row in matrix) for column in range(n)]
    normalised = [[value / column_sums[column] for column, value in enumerate(row)] for row in matrix]
    weights = [sum(row) / n for row in normalised]
    weighted_sum = [sum(value * weights[column] for column, value in enumerate(row)) for row in matrix]
    lambda_max = sum(weighted_sum[i] / weights[i] for i in range(n)) / n
    consistency_index = (lambda_max - n) / (n - 1) if n > 1 else 0.0
    random_index = RI.get(n, 1.49)
    consistency_ratio = consistency_index / random_index if random_index else 0.0
    return {
        "matrix": matrix,
        "normalisedMatrix": normalised,
        "weights": weights,
        "labels": labels,
        "lambdaMax": lambda_max,
        "consistencyIndex": consistency_index,
        "randomIndex": random_index,
        "consistencyRatio": consistency_ratio,
        "isConsistent": consistency_ratio < 0.10,
    }


OBS_AHP = run_ahp(PILLAR_MATRIX, PILLAR_LABELS)


def _timestamp_ms(value: Any) -> float | None:
    try:
        number = float(value)
        # Normalize the timestamp formats used by Loki (ns), Jaeger (µs),
        # Prometheus (s), and the frontend payloads (ms) to milliseconds.
        if number > 10**17:
            return number / 1_000_000
        if number > 10**14:
            return number / 1_000
        if number < 10**11:
            return number * 1_000
        return number
    except (TypeError, ValueError):
        return None


def _service_name(value: Any) -> str:
    return str(value or "").strip().lower().replace("_", "-")


def _within_window(left: dict[str, Any], right: dict[str, Any], window_ms: int = 2_000) -> bool:
    left_time = _timestamp_ms(left.get("timestamp", left.get("time")))
    right_time = _timestamp_ms(right.get("timestamp", right.get("time")))
    if left_time is None or right_time is None:
        return False
    left_service = _service_name(left.get("service"))
    right_service = _service_name(right.get("service"))
    same_service = not left_service or not right_service or "unknown" in {left_service, right_service} or left_service == right_service
    return same_service and abs(left_time - right_time) <= window_ms


def calculate_cci(snapshot: dict[str, Any]) -> dict[str, Any]:
    sources = snapshot["sources"]
    error_count = int(snapshot["logs"]["errorCount"])
    error_rate = float(snapshot["traces"]["errorRate"])
    missing = [name for name, present in (
        ("Prometheus Metric", sources.get("prometheus", False)),
        ("Jaeger Trace", sources.get("jaeger", False)),
        ("Loki Log", sources.get("loki", False)),
    ) if not present]
    available = 3 - len(missing)
    logs = snapshot["logs"].get("recentLogs", [])
    traces = snapshot["traces"].get("samples", [])
    service_fault = snapshot.get("serviceFault") or {}
    error_logs = [item for item in logs if str(item.get("level", "")).upper() in {"ERROR", "CRITICAL"}]
    error_traces = [item for item in traces if item.get("isError")]
    trace_ids = {item.get("id") for item in traces if item.get("id")}
    log_trace_ids = {item.get("traceId") for item in logs if item.get("traceId") not in {None, "", "-"}}
    matched_trace_logs = len(trace_ids & log_trace_ids)
    matched_pairs = 0
    matched_log_indexes: set[int] = set()
    matched_trace_indexes: set[int] = set()
    for log_index, log in enumerate(error_logs):
        for trace_index, trace in enumerate(error_traces):
            if trace_index in matched_trace_indexes:
                continue
            same_id = log.get("traceId") not in {None, "", "-"} and log.get("traceId") == trace.get("id")
            if same_id or _within_window(log, trace):
                matched_pairs += 1
                matched_log_indexes.add(log_index)
                matched_trace_indexes.add(trace_index)
                break
    # Normal traces are not incidents. Only error logs/traces and a non-zero
    # error-rate signal should become correlation events.
    observed_events = max(len(error_logs), len(error_traces), 1 if error_rate > 0 else 0, 1 if service_fault.get("type") == "SERVICE_DOWN" else 0)
    if observed_events == 0:
        matched_events = 0
        correlation_confidence = 100.0 if not missing else 0.0
    else:
        matched_events = min(matched_pairs, observed_events)
        correlation_confidence = round((matched_events / observed_events) * 100, 2)
    blind_spots = []
    if service_fault.get("type") == "SERVICE_DOWN":
        blind_spots.append({
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "has_metric": sources.get("prometheus", False),
            "has_trace": sources.get("jaeger", False),
            "has_log": sources.get("loki", False),
            "missing_pillars": ["Service telemetry: " + str(service_fault.get("service") or "selected service")],
            "reason": "The selected service is down while the observability backends remain reachable.",
        })
    if missing:
        blind_spots.append({
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "has_metric": sources.get("prometheus", False),
            "has_trace": sources.get("jaeger", False),
            "has_log": sources.get("loki", False),
            "missing_pillars": missing,
        })
    if error_logs and any(item.get("traceId") in {None, "", "-"} for item in error_logs):
        blind_spots.append({
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "has_metric": sources.get("prometheus", False),
            "has_trace": bool(error_traces),
            "has_log": sources.get("loki", False),
            "missing_pillars": ["Trace context propagation"],
            "reason": "Error logs were received without a trace identifier.",
        })
    if observed_events and (trace_ids or log_trace_ids) and not matched_pairs:
        blind_spots.append({
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "has_metric": sources.get("prometheus", False),
            "has_trace": bool(trace_ids),
            "has_log": bool(log_trace_ids),
            "missing_pillars": ["Trace-log context correlation"],
            "reason": "No shared trace identifier was found in the current observation window.",
        })
    sampling_warning = None
    if len(traces) >= 100:
        # Reaching the query page size is a warning, not proof of telemetry loss.
        sampling_warning = "Trace query reached its collection limit; sampling completeness should be reviewed."
    coverage_score = (available / 3) * 100
    cci_index = round(coverage_score * (correlation_confidence / 100)) if observed_events else round(coverage_score)
    return {
        "cci_index": cci_index,
        "total_events": observed_events,
        "matched_events": matched_events,
        "matched_trace_log_ids": matched_trace_logs,
        "correlation_confidence": correlation_confidence,
        "sampling_warning": sampling_warning,
        "blind_spots": blind_spots,
        "pillar_coverage": {
            "metric": int(sources.get("prometheus", False)),
            "trace": int(sources.get("jaeger", False)),
            "log": int(sources.get("loki", False)),
        },
        "event_source": "prometheus" if sources.get("prometheus") else "jaeger" if sources.get("jaeger") else "loki",
    }


def calculate_observability(snapshot: dict[str, Any]) -> dict[str, Any]:
    sources = snapshot["sources"]
    details = snapshot
    metrics = 1.0 if sources.get("prometheus") else 0.0
    traces = 1.0 if sources.get("jaeger") else 0.0
    logs = 1.0 if sources.get("loki") else 0.0
    cci = calculate_cci(snapshot)
    weights = OBS_AHP["weights"]
    raw_score = (metrics * weights[0] + traces * weights[1] + logs * weights[2]) * 100
    penalty = min(len(cci["blind_spots"]) * 2, 15)
    score = max(0.0, raw_score - penalty)
    status = "HEALTHY" if score >= 80 else "WARNING" if score >= 60 else "CRITICAL"
    maturity = "Proactive" if score >= 80 else "Intermediate" if score >= 50 else "Reactive"
    source_coverage = round((sum((metrics, traces, logs)) / 3) * 100, 2)
    score_range_valid = 0 <= score <= 100
    cci_range_valid = 0 <= cci["cci_index"] <= 100
    ahp_consistent = OBS_AHP["consistencyRatio"] < 0.10
    verification_percentage = round(max(0.0, min(100.0, (
        source_coverage * 0.4
        + cci["correlation_confidence"] * 0.4
        + (100.0 if ahp_consistent else 0.0) * 0.1
        + (100.0 if score_range_valid and cci_range_valid else 0.0) * 0.1
        - penalty
    ))), 2)
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
            "status": "VERIFIED" if score_range_valid and cci_range_valid and ahp_consistent else "REVIEW_REQUIRED",
            "verificationPercentage": verification_percentage,
            "sourceCoveragePct": source_coverage,
            "correlationConfidencePct": cci["correlation_confidence"],
            "ahpConsistencyRatio": round(OBS_AHP["consistencyRatio"], 6),
            "ahpConsistent": ahp_consistent,
            "scoreRangeValid": score_range_valid,
            "cciRangeValid": cci_range_valid,
            "blindSpotPenalty": penalty,
        },
    }
