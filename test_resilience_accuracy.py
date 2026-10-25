"""Evaluate resilience threshold behavior and, when available, measured accuracy.

Run the reproducible threshold checks:
    python test_resilience_accuracy.py

Measure against independently labeled observations in a CSV:
    python test_resilience_accuracy.py --csv resilience_labeled_data.csv

The CSV must contain expected_incident (0=healthy, 1=incident) and these metric
columns: availability,cpu,memory,errorRate,restarts,mttr,latency,failoverSuccess.
Labels must come from an independent source such as reviewed incident records,
alert/incident timelines, or controlled chaos experiments with recorded outcomes.
Do not create labels by applying the same thresholds being evaluated.
"""

import argparse
import csv
import os
import random
import sys
import time
from collections import defaultdict


CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
ENGINE_PATH = os.path.join(CURRENT_DIR, "backend", "resilience-engine")
if ENGINE_PATH not in sys.path:
    sys.path.insert(0, ENGINE_PATH)

from app.calculations import WEIGHTS, evaluate_resilience  # noqa: E402
from app.models import ResilienceMetrics  # noqa: E402


METRIC_COLUMNS = (
    "availability",
    "cpu",
    "memory",
    "errorRate",
    "restarts",
    "mttr",
    "latency",
    "failoverSuccess",
)

# Keep these reference thresholds aligned with the published resilience SLOs.
# They define the expected label for the generated rule-conformance benchmark.
REFERENCE_THRESHOLDS = {
    "availability": ("min", 99.0),
    "cpu": ("max_exclusive", 70.0),
    "memory": ("max_exclusive", 75.0),
    "errorRate": ("max_exclusive", 1.0),
    "restarts": ("max_exclusive", 2.0),
    "mttr": ("max_inclusive", 15.0),
    "latency": ("max_exclusive", 50.0),
    "failoverSuccess": ("min", 100.0),
}


def expected_incident_from_slos(metrics):
    """Independent benchmark oracle based on the documented SLO definitions."""
    for name, (comparison, threshold) in REFERENCE_THRESHOLDS.items():
        value = metrics[name]
        if comparison == "min" and value < threshold:
            return 1
        if comparison == "max_exclusive" and value >= threshold:
            return 1
        if comparison == "max_inclusive" and value > threshold:
            return 1
    return 0


def generate_scenarios(total_trials=500, seed=42):
    """Create healthy, near-boundary, single-fault and combined-fault cases."""
    random.seed(seed)
    scenarios = []
    healthy_count = total_trials * 3 // 5
    fault_count = total_trials - healthy_count

    for _ in range(healthy_count):
        # Includes healthy values close to the SLOs, not only ideal values.
        metrics = {
            "availability": random.uniform(99.0, 100.0),
            "cpu": random.uniform(0.0, 69.999),
            "memory": random.uniform(0.0, 74.999),
            "errorRate": random.uniform(0.0, 0.999),
            "restarts": random.uniform(0.0, 1.999),
            "mttr": random.uniform(0.0, 15.0),
            "latency": random.uniform(0.0, 49.999),
            "failoverSuccess": 100.0,
        }
        scenarios.append(("HEALTHY_NEAR_OR_WITHIN_SLO", metrics, 0))

    fault_names = tuple(REFERENCE_THRESHOLDS)
    for index in range(fault_count):
        metrics = {
            "availability": random.uniform(99.0, 100.0),
            "cpu": random.uniform(0.0, 69.0),
            "memory": random.uniform(0.0, 74.0),
            "errorRate": random.uniform(0.0, 0.9),
            "restarts": random.uniform(0.0, 1.9),
            "mttr": random.uniform(0.0, 15.0),
            "latency": random.uniform(0.0, 49.0),
            "failoverSuccess": 100.0,
        }

        # Most cases violate one SLO; every fourth combines multiple failures.
        fault_count_for_case = 1 if index % 4 else random.randint(2, 4)
        selected_faults = random.sample(fault_names, fault_count_for_case)
        for name in selected_faults:
            comparison, threshold = REFERENCE_THRESHOLDS[name]
            if comparison == "min":
                metrics[name] = max(0.0, threshold - random.uniform(0.01, 10.0))
            elif comparison == "max_exclusive":
                maximum = 100.0 if name in {"cpu", "memory", "errorRate", "failoverSuccess"} else threshold * 5
                metrics[name] = min(maximum, threshold + random.uniform(0.001, max(1.0, threshold)))
            else:
                metrics[name] = threshold + random.uniform(0.001, max(1.0, threshold))
        category = "COMBINED_FAULTS" if len(selected_faults) > 1 else f"FAULT_{selected_faults[0].upper()}"
        scenarios.append((category, metrics, 1))

    # Explicit exact-boundary cases validate inclusive versus exclusive SLOs.
    boundary_cases = (
        ("BOUNDARY_AVAILABILITY", {"availability": 99.0}, 0),
        ("BOUNDARY_CPU", {"cpu": 70.0}, 1),
        ("BOUNDARY_MEMORY", {"memory": 75.0}, 1),
        ("BOUNDARY_ERROR_RATE", {"errorRate": 1.0}, 1),
        ("BOUNDARY_RESTARTS", {"restarts": 2.0}, 1),
        ("BOUNDARY_MTTR", {"mttr": 15.0}, 0),
        ("BOUNDARY_LATENCY", {"latency": 50.0}, 1),
        ("BOUNDARY_FAILOVER", {"failoverSuccess": 100.0}, 0),
    )
    for category, changes, label in boundary_cases:
        metrics = {
            "availability": 100.0,
            "cpu": 10.0,
            "memory": 10.0,
            "errorRate": 0.1,
            "restarts": 0.0,
            "mttr": 1.0,
            "latency": 10.0,
            "failoverSuccess": 100.0,
        }
        metrics.update(changes)
        scenarios.append((category, metrics, label))
    return scenarios


def summarize(y_true, y_pred, timings, category_results=None, title="EVALUATION"):
    tp = sum(actual == 1 and predicted == 1 for actual, predicted in zip(y_true, y_pred))
    tn = sum(actual == 0 and predicted == 0 for actual, predicted in zip(y_true, y_pred))
    fp = sum(actual == 0 and predicted == 1 for actual, predicted in zip(y_true, y_pred))
    fn = sum(actual == 1 and predicted == 0 for actual, predicted in zip(y_true, y_pred))
    total = len(y_true)
    accuracy = (tp + tn) / total if total else 0.0
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    specificity = tn / (tn + fp) if tn + fp else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0

    print("\n" + "=" * 75)
    print(f"   RESILIENCE COMPONENT - {title}")
    print("=" * 75)
    print(f"Samples: {total} | Incident labels: {sum(y_true)} | Healthy labels: {total - sum(y_true)}")
    print("\n[1] CONFUSION MATRIX")
    print("-" * 55)
    print(f"TP={tp:<5} FN={fn:<5} FP={fp:<5} TN={tn:<5}")
    print("\n[2] CLASSIFICATION METRICS")
    print("-" * 55)
    print(f"Accuracy      : {accuracy * 100:.2f}%")
    print(f"Precision     : {precision * 100:.2f}%")
    print(f"Recall        : {recall * 100:.2f}%")
    print(f"Specificity   : {specificity * 100:.2f}%")
    print(f"F1-score      : {f1 * 100:.2f}%")
    average_ms = sum(timings) / len(timings) if timings else 0.0
    print(f"Average eval  : {average_ms:.3f} ms / sample")

    if category_results:
        print("\n[3] BREAKDOWN BY SCENARIO")
        print("-" * 55)
        for category, values in category_results.items():
            count = values["total"]
            rate = values["correct"] / count * 100 if count else 0.0
            print(f"{category:<32}: {values['correct']}/{count} ({rate:.1f}%)")

    return {"accuracy": accuracy, "precision": precision, "recall": recall, "specificity": specificity, "f1": f1}


def run_synthetic_benchmark(total_trials=500):
    scenarios = generate_scenarios(total_trials)
    y_true, y_pred, timings = [], [], []
    category_results = defaultdict(lambda: {"total": 0, "correct": 0})

    for category, metrics, expected in scenarios:
        start = time.perf_counter()
        result = evaluate_resilience(metrics)
        timings.append((time.perf_counter() - start) * 1000.0)
        predicted = int(any(not rule["passed"] for rule in result["rules"]))
        y_true.append(expected)
        y_pred.append(predicted)
        category_results[category]["total"] += 1
        category_results[category]["correct"] += int(predicted == expected)

    summary = summarize(y_true, y_pred, timings, category_results, "SYNTHETIC SLO CONFORMANCE")
    weight_sum = sum(WEIGHTS.values())
    print("\n[4] CONFIGURATION CHECK")
    print("-" * 55)
    print(f"Scoring weights sum: {weight_sum:.4f} ({'PASS' if abs(weight_sum - 1.0) < 1e-9 else 'FAIL'})")
    print("Interpretation: agreement with the documented SLO rules on generated cases.")
    print("This is not measured accuracy on real service behavior.")
    return summary


def run_labeled_csv(csv_path):
    """Evaluate predictions against independently sourced labels in a CSV file."""
    y_true, y_pred, timings = [], [], []
    category_results = defaultdict(lambda: {"total": 0, "correct": 0})

    with open(csv_path, newline="", encoding="utf-8-sig") as csv_file:
        reader = csv.DictReader(csv_file)
        required = {"expected_incident", *METRIC_COLUMNS}
        missing = required - set(reader.fieldnames or ())
        if missing:
            raise ValueError(f"CSV is missing required columns: {', '.join(sorted(missing))}")

        for row_number, row in enumerate(reader, start=2):
            try:
                label = int(row["expected_incident"])
                if label not in (0, 1):
                    raise ValueError("expected_incident must be 0 or 1")
                metrics = {name: float(row[name]) for name in METRIC_COLUMNS}
                metrics = ResilienceMetrics(**metrics).model_dump()
            except Exception as error:
                raise ValueError(f"Invalid data on CSV row {row_number}: {error}") from error

            start = time.perf_counter()
            result = evaluate_resilience(metrics)
            timings.append((time.perf_counter() - start) * 1000.0)
            predicted = int(any(not rule["passed"] for rule in result["rules"]))
            y_true.append(label)
            y_pred.append(predicted)

            category = "INCIDENT" if label else "HEALTHY"
            category_results[category]["total"] += 1
            category_results[category]["correct"] += int(predicted == label)

    if not y_true:
        raise ValueError("CSV contains no labeled observations")
    summary = summarize(y_true, y_pred, timings, category_results, "LABELED DATASET MEASUREMENT")
    print(f"Dataset: {os.path.abspath(csv_path)}")
    print("Interpretation: measured agreement with the supplied independent labels; results depend on dataset quality and coverage.")
    return summary


def main():
    parser = argparse.ArgumentParser(description="Evaluate resilience threshold classification.")
    parser.add_argument("--csv", help="CSV with independent expected_incident labels and resilience metrics")
    parser.add_argument("--trials", type=int, default=500, help="Number of generated scenarios (default: 500)")
    args = parser.parse_args()

    if args.trials <= 0:
        parser.error("--trials must be greater than zero")
    if args.csv:
        run_labeled_csv(args.csv)
    else:
        run_synthetic_benchmark(args.trials)
        print("\nFor a measured result, gather independently labeled observations and run:")
        print("  python test_resilience_accuracy.py --csv resilience_labeled_data.csv")
        print("Use incident review / alert outcomes or controlled chaos outcomes for labels;")
        print("do not assign labels by applying the same threshold rules under evaluation.")


if __name__ == "__main__":
    main()
