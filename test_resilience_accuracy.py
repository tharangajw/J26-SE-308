"""Benchmark the resilience engine's threshold rules with synthetic scenarios.

Uses the Python resilience calculation module directly.
Run from the repository root: python test_resilience_accuracy.py
"""

import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent
ENGINE_PATH = ROOT / "backend" / "resilience-engine"
sys.path.insert(0, str(ENGINE_PATH))

from app.calculations import evaluate_resilience


BASELINE = {
    "availability": 99.9,
    "cpu": 35.0,
    "memory": 45.0,
    "errorRate": 0.2,
    "restarts": 0,
    "mttr": 8.0,
    "latency": 30.0,
    "failoverSuccess": 100.0,
}

FAULTS = {
    "LOW_AVAILABILITY": {"availability": 95.0},
    "HIGH_CPU": {"cpu": 90.0},
    "HIGH_MEMORY": {"memory": 90.0},
    "HIGH_ERROR_RATE": {"errorRate": 5.0},
    "POD_RESTARTS": {"restarts": 5},
    "SLOW_RECOVERY": {"mttr": 30.0},
    "HIGH_LATENCY": {"latency": 250.0},
    "FAILOVER_FAILURE": {"failoverSuccess": 60.0},
}


def build_scenarios(repeats=25):
    random.seed(42)
    scenarios = []
    labels = []
    categories = []

    for _ in range(100):
        metrics = dict(BASELINE)
        metrics["cpu"] = random.uniform(20.0, 60.0)
        metrics["memory"] = random.uniform(30.0, 65.0)
        metrics["latency"] = random.uniform(15.0, 45.0)
        scenarios.append(metrics)
        labels.append(0)
        categories.append("HEALTHY")

    for category, fault in FAULTS.items():
        for _ in range(repeats):
            metrics = dict(BASELINE)
            metrics.update(fault)
            scenarios.append(metrics)
            labels.append(1)
            categories.append(category)

    return scenarios, labels, categories


def main():
    scenarios, labels, categories = build_scenarios()
    start = time.perf_counter()
    outputs = [evaluate_resilience(scenario) for scenario in scenarios]
    elapsed_ms = (time.perf_counter() - start) * 1000

    predictions = [int(any(not rule["passed"] for rule in output["rules"])) for output in outputs]
    tp = sum(actual == 1 and predicted == 1 for actual, predicted in zip(labels, predictions))
    tn = sum(actual == 0 and predicted == 0 for actual, predicted in zip(labels, predictions))
    fp = sum(actual == 0 and predicted == 1 for actual, predicted in zip(labels, predictions))
    fn = sum(actual == 1 and predicted == 0 for actual, predicted in zip(labels, predictions))
    total = len(labels)
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    specificity = tn / (tn + fp) if tn + fp else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0

    print("-" * 55)
    print("REAL-TIME RESILIENCE COMPONENT ACCURACY CHECK")
    print("-" * 55)
    print(f"\nChecked at: {datetime.now(timezone.utc).astimezone().isoformat(timespec='seconds')}")
    
    print("Evaluation mode: synthetic threshold scenarios")
    print(f"Scenarios: {total} ({total - sum(labels)} healthy, {sum(labels)} fault-injected)")
    print(f"\nConfusion matrix: TP={tp}, TN={tn}, FP={fp}, FN={fn}")
    print(f"Accuracy:    {(tp + tn) / total * 100:.2f}%")
    print(f"Precision:   {precision * 100:.2f}%")
    print(f"Recall:      {recall * 100:.2f}%")
    print(f"Specificity: {specificity * 100:.2f}%")
    print(f"F1-score:    {f1 * 100:.2f}%")
    print(f"\nCalculation duration: {elapsed_ms:.2f} ms (Python scoring module)")
    print("\nResults by scenario:")
    for category in dict.fromkeys(categories):
        indexes = [i for i, name in enumerate(categories) if name == category]
        correct = sum(labels[i] == predictions[i] for i in indexes)
        print(f"  {category:<20} {correct}/{len(indexes)} correct ({correct / len(indexes) * 100:.1f}%)")
    print("\nAccuracy is measured on synthetic scenarios; it is not live production accuracy.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
