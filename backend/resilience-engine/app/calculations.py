from typing import Any

THRESHOLDS = {
    "availability": {"min": 99.0, "label": ">= 99.0%"},
    "cpu": {"max": 70.0, "label": "< 70%"},
    "memory": {"max": 75.0, "label": "< 75%"},
    "errorRate": {"max": 1.0, "label": "< 1.0%"},
    "restarts": {"max": 2.0, "label": "< 2 restarts"},
    "mttr": {"max": 15.0, "label": "<= 15s"},
    "latency": {"max": 50.0, "label": "< 50ms"},
    "failoverSuccess": {"min": 100.0, "label": ">= 100%"},
}

WEIGHTS = {
    "availability": 0.2663,
    "failoverSuccess": 0.2411,
    "errorRate": 0.1486,
    "mttr": 0.1405,
    "latency": 0.0842,
    "restarts": 0.0541,
    "cpu": 0.0326,
    "memory": 0.0326,
}

RULES = (
    ("Availability", "A", "availability"),
    ("CPU", "C", "cpu"),
    ("Memory", "M", "memory"),
    ("ErrorRate", "E", "errorRate"),
    ("Restarts", "R", "restarts"),
    ("MTTR", "T", "mttr"),
    ("Latency", "L", "latency"),
    ("Failover", "F", "failoverSuccess"),
)


def _clamp01(value: float) -> float:
    return min(1.0, max(0.0, value))


def _normalise(metrics: dict[str, float]) -> dict[str, float]:
    return {
        "availability": _clamp01(metrics["availability"] / 99.0),
        "cpu": 1.0 - _clamp01(metrics["cpu"] / 70.0),
        "memory": 1.0 - _clamp01(metrics["memory"] / 75.0),
        "errorRate": 1.0 - _clamp01(metrics["errorRate"] / 1.0),
        "restarts": 1.0 - _clamp01(metrics["restarts"] / 2.0),
        "mttr": 1.0 - _clamp01(metrics["mttr"] / 15.0),
        "latency": 1.0 - _clamp01(metrics["latency"] / 50.0),
        "failoverSuccess": _clamp01(metrics["failoverSuccess"] / 100.0),
    }


def resolve_maturity(score: float) -> str:
    if score >= 87.5:
        return "Optimized"
    if score >= 75.0:
        return "Mature"
    if score >= 50.0:
        return "Developing"
    return "Initial"


def evaluate_resilience(metrics: Any) -> dict[str, Any]:
    values = metrics.model_dump() if hasattr(metrics, "model_dump") else dict(metrics)
    normalized = _normalise(values)
    passed = {
        "availability": values["availability"] >= 99.0,
        "cpu": values["cpu"] < 70.0,
        "memory": values["memory"] < 75.0,
        "errorRate": values["errorRate"] < 1.0,
        "restarts": values["restarts"] < 2.0,
        "mttr": values["mttr"] <= 15.0,
        "latency": values["latency"] < 50.0,
        "failoverSuccess": values["failoverSuccess"] >= 100.0,
    }

    rules = []
    for label, variable, key in RULES:
        rules.append({
            "rule": label,
            "variable": variable,
            "threshold": THRESHOLDS[key]["label"],
            "actualValue": values[key],
            "passed": passed[key],
            "points": normalized[key] * WEIGHTS[key] * 100.0,
        })

    total_score = round(sum(rule["points"] for rule in rules), 1)
    return {
        "rules": rules,
        "totalScore": total_score,
        "maturity": resolve_maturity(total_score),
    }
