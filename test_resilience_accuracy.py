"""Benchmark the resilience engine's threshold rules with synthetic scenarios.

Requires Node.js 22+ with native TypeScript type stripping enabled.
Run from the repository root: python test_resilience_accuracy.py
"""

import json
import random
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SCORER = ROOT / "backend" / "resiliance" / "src" / "rScore.ts"
NODE_EVALUATOR = r"""
import { pathToFileURL } from 'node:url';
let input = '';
for await (const chunk of process.stdin) input += chunk;
const { evaluateRScoreRules } = await import(pathToFileURL(process.argv[1]).href);
const scenarios = JSON.parse(input);
const output = scenarios.map(metrics => evaluateRScoreRules(metrics));
process.stdout.write(JSON.stringify(output));
"""


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
    try:
        result = subprocess.run(
            ["node", "--experimental-strip-types", "--input-type=module", "-e", NODE_EVALUATOR, str(SCORER)],
            input=json.dumps(scenarios),
            capture_output=True,
            text=True,
            check=True,
        )
    except FileNotFoundError:
        print("Node.js was not found. Install Node.js 22 or newer and try again.", file=sys.stderr)
        return 1
    except subprocess.CalledProcessError as error:
        print(error.stderr.strip() or "Could not run the resilience scorer.", file=sys.stderr)
        return 1

    elapsed_ms = (time.perf_counter() - start) * 1000
    outputs = json.loads(result.stdout)
    if len(outputs) != len(labels):
        print("The resilience scorer returned an unexpected number of results.", file=sys.stderr)
        return 1

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
    print(f"\nReal-time execution duration: {elapsed_ms:.2f} ms (includes Node startup)")
    print("\nResults by scenario:")
    for category in dict.fromkeys(categories):
        indexes = [i for i, name in enumerate(categories) if name == category]
        correct = sum(labels[i] == predictions[i] for i in indexes)
        print(f"  {category:<20} {correct}/{len(indexes)} correct ({correct / len(indexes) * 100:.1f}%)")
    print("\nAccuracy is measured on synthetic scenarios; it is not live production accuracy.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
