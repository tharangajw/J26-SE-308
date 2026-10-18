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


def calculate_cci(sources: dict[str, bool], error_count: int, error_rate: float) -> dict[str, Any]:
    missing = [name for name, present in (
        ("Prometheus Metric", sources.get("prometheus", False)),
        ("Jaeger Trace", sources.get("jaeger", False)),
        ("Loki Log", sources.get("loki", False)),
    ) if not present]
    available = 3 - len(missing)
    observed_events = max(error_count, 1 if error_rate > 0 else 0, 1 if missing else 0)
    matched_events = observed_events if not missing else 0
    blind_spots = []
    if missing:
        blind_spots.append({
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "has_metric": sources.get("prometheus", False),
            "has_trace": sources.get("jaeger", False),
            "has_log": sources.get("loki", False),
            "missing_pillars": missing,
        })
    return {
        "cci_index": round((available / 3) * 100),
        "total_events": observed_events,
        "matched_events": matched_events,
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
    cci = calculate_cci(sources, int(snapshot["logs"]["errorCount"]), float(snapshot["traces"]["errorRate"]))
    weights = OBS_AHP["weights"]
    raw_score = (metrics * weights[0] + traces * weights[1] + logs * weights[2]) * 100
    penalty = min(len(cci["blind_spots"]) * 2, 15)
    score = max(0.0, raw_score - penalty)
    status = "HEALTHY" if score >= 80 else "WARNING" if score >= 60 else "CRITICAL"
    maturity = "Proactive" if score >= 80 else "Intermediate" if score >= 50 else "Reactive"
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
    }
