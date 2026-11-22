"""Benchmark C-Score Engine's Deterministic Output Accuracy for Phase 1 & Phase 2.

Evaluates the completed CI/CD Governance Pipeline components:
  - Phase 1 (Pre-Build): Git Mining, Commit Frequency, Co-Deploy Rate, Logical Coupling Index
  - Phase 2 (Build): OpenAPI AST Diffing (oasdiff), Dynamic Consumer Topology, Blast Radius Hard Guardrail
  - Master Brain: XGBoost Scoring & Hybrid Decision Boundary (Soft Advisory vs Hard Guardrail)

Run from the repository root:
    python test_cscore_accuracy.py
"""

import os
import sys
import time
import random
import subprocess

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Auto-delegate to backend/cscore-engine/.venv if dependencies (joblib, xgboost) are missing in current python
current_dir = os.path.dirname(os.path.abspath(__file__))
engine_path = os.path.join(current_dir, "backend", "cscore-engine")
venv_python = os.path.join(engine_path, ".venv", "Scripts", "python.exe")

try:
    import joblib
    import numpy as np
except ImportError:
    if os.path.exists(venv_python) and os.path.abspath(sys.executable) != os.path.abspath(venv_python):
        result = subprocess.run([venv_python, os.path.abspath(__file__)] + sys.argv[1:])
        sys.exit(result.returncode)
    else:
        raise

if engine_path not in sys.path:
    sys.path.insert(0, engine_path)

from app.ml.scorer import predict_cscore
from app.core.config import THRESHOLD, MODEL_FEATURES


def run_cscore_phase1_phase2_benchmark(total_trials=500):
    print("=" * 75)
    print("   C-SCORE ENGINE (CI/CD) - PHASE 1 & PHASE 2 DETERMINISTIC ACCURACY")
    print("=" * 75)

    # Random seed for reproducible deterministic benchmark
    random.seed(42)

    # Ground truth tracking: High Risk (Abort PR) = 1, Low Risk (Pass) = 0
    y_true = []
    y_pred = []

    # Latency tracking
    eval_times_ms = []

    # Category breakdowns (Phase 1 & Phase 2 realistic CI/CD scenarios)
    scenario_counts = {
        "CLEAN_INDEPENDENT_PR": 0,
        "NON_BREAKING_API_PR": 0,
        "BREAKING_ZERO_CONSUMERS": 0,
        "HIGH_COUPLING_ADVISORY": 0,
        "BREAKING_SINGLE_CONSUMER": 0,
        "BREAKING_MULTI_CONSUMER": 0,
        "COUPLING_WITH_BREAKING_API": 0,
    }

    category_results = {cat: {"total": 0, "correct": 0} for cat in scenario_counts}

    # 60/40 Split: 60% Healthy/Safe PRs (Pass), 40% Breaking/High Risk PRs (Abort)
    num_incidents = int(total_trials * 0.40)
    num_healthy = total_trials - num_incidents

    for i in range(total_trials):
        start_t = time.perf_counter()

        is_incident = 1 if i < num_incidents else 0
        y_true.append(is_incident)

        # In production, Phase 3 telemetry defaults to 0 before canary deployment
        features = {
            "commit_freq": 2.0,
            "co_deploy_rate": 0.0,
            "api_changes": 0.0,
            "downstream_count": 0.0,
            "max_call_depth": 0.0,
            "sync_call_count": 0.0,
            "cpu_spike_pct": 0.0,
            "mem_spike_pct": 0.0,
            "error_rate_pct": 0.0,
            "pod_restarts": 0.0,
        }

        if is_incident == 0:
            # Safe / Low Risk PR Scenarios (Should PASS)
            safe_type = i % 4
            if safe_type == 0:
                # 1. Clean Independent PR: Small changes to isolated service
                scenario = "CLEAN_INDEPENDENT_PR"
                features["commit_freq"] = round(random.uniform(1.0, 6.0), 1)
                features["co_deploy_rate"] = 0.0
                features["api_changes"] = 0.0
                features["downstream_count"] = 0.0
            elif safe_type == 1:
                # 2. Non-breaking API additions: Additive OpenAPI changes with downstream consumers
                scenario = "NON_BREAKING_API_PR"
                features["commit_freq"] = round(random.uniform(2.0, 8.0), 1)
                features["co_deploy_rate"] = round(random.uniform(0.0, 0.15), 2)
                features["api_changes"] = 0.0  # Backward compatible (oasdiff breaking = 0)
                features["downstream_count"] = float(random.choice([1, 2, 3, 4]))
            elif safe_type == 2:
                # 3. Breaking changes on zero-consumer service (blast radius = 0, no consumer impacted)
                scenario = "BREAKING_ZERO_CONSUMERS"
                features["commit_freq"] = round(random.uniform(2.0, 10.0), 1)
                features["co_deploy_rate"] = round(random.uniform(0.0, 0.20), 2)
                features["api_changes"] = float(random.choice([1, 2, 3]))
                features["downstream_count"] = 0.0  # 0 consumers -> blast radius = 0
            else:
                # 4. Phase 1 High Logical Coupling Soft Advisory (coupling > 0.50, but non-blocking)
                scenario = "HIGH_COUPLING_ADVISORY"
                features["commit_freq"] = round(random.uniform(16.0, 24.0), 1)
                features["co_deploy_rate"] = round(random.uniform(0.70, 0.95), 2)
                features["api_changes"] = 0.0
                features["downstream_count"] = 0.0

            scenario_counts[scenario] += 1

        else:
            # High Risk / Breaking PR Scenarios (Should ABORT)
            incident_type = i % 3
            if incident_type == 0:
                # 1. Breaking API on 1 downstream consumer (Blast Radius = 1 -> Hard Guardrail)
                scenario = "BREAKING_SINGLE_CONSUMER"
                features["commit_freq"] = round(random.uniform(2.0, 10.0), 1)
                features["co_deploy_rate"] = round(random.uniform(0.0, 0.25), 2)
                features["api_changes"] = 1.0
                features["downstream_count"] = 1.0
            elif incident_type == 1:
                # 2. Breaking API on multiple downstream consumers (Blast Radius = 2 to 12)
                scenario = "BREAKING_MULTI_CONSUMER"
                features["commit_freq"] = round(random.uniform(4.0, 14.0), 1)
                features["co_deploy_rate"] = round(random.uniform(0.10, 0.40), 2)
                features["api_changes"] = float(random.choice([2, 3, 4]))
                features["downstream_count"] = float(random.choice([2, 3, 4]))
            else:
                # 3. Compound: High Logical Coupling + Breaking API with Consumers
                scenario = "COUPLING_WITH_BREAKING_API"
                features["commit_freq"] = round(random.uniform(16.0, 24.0), 1)
                features["co_deploy_rate"] = round(random.uniform(0.60, 0.90), 2)
                features["api_changes"] = float(random.choice([1, 2, 3]))
                features["downstream_count"] = float(random.choice([1, 2, 3]))

            scenario_counts[scenario] += 1

        # Run C-Score Inference (Phase 1 & Phase 2 governance)
        res = predict_cscore(features)

        eval_ms = (time.perf_counter() - start_t) * 1000.0
        eval_times_ms.append(eval_ms)

        # Decision Criterion:
        # PR is classified as HIGH_RISK (Abort) if:
        # 1. Decision == 'HIGH_RISK'
        # OR 2. C-Score > THRESHOLD (28.9)
        # OR 3. Blast Radius > 0 (Phase 2 Hard Guardrail triggers C-Score >= 98.0)
        predicted_high_risk = 1 if (
            res["decision"] == "HIGH_RISK"
            or res["cscore"] > THRESHOLD
        ) else 0

        y_pred.append(predicted_high_risk)

        category_results[scenario]["total"] += 1
        if predicted_high_risk == is_incident:
            category_results[scenario]["correct"] += 1

    # Confusion Matrix
    tp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 1)
    tn = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 0 and yp == 0)
    fp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 0 and yp == 1)
    fn = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 0)

    accuracy = (tp + tn) / total_trials
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
    avg_latency = sum(eval_times_ms) / len(eval_times_ms)

    print(f"\n[1] TEST SUITE CONFUSION MATRIX (N = {total_trials})")
    print("-" * 55)
    print(f"                       Predicted Positive   Predicted Negative")
    print(f"Actual Positive ({num_incidents:<3}):      TP = {tp:<5}          FN = {fn:<5}")
    print(f"Actual Negative ({num_healthy:<3}):      FP = {fp:<5}          TN = {tn:<5}")
    print("-" * 55)

    print("\n[2] SCIENTIFIC METRIC RESULTS")
    print("-" * 55)
    print(f" • Accuracy      : {accuracy * 100:.2f}%  (Formula: [TP + TN] / Total)")
    print(f" • Precision     : {precision * 100:.2f}%  (Formula: TP / [TP + FP])")
    print(f" • Recall        : {recall * 100:.2f}%  (Formula: TP / [TP + FN])")
    print(f" • Specificity   : {specificity * 100:.2f}%  (Formula: TN / [TN + FP])")
    print(f" • F1-Score      : {f1 * 100:.2f}%  (Harmonic Mean of Precision & Recall)")
    print(f" • Avg Latency   : {avg_latency:.3f} ms / evaluation")
    print("-" * 55)

    print("\n[3] BREAKDOWN BY FAILURE CATEGORY")
    print("-" * 55)
    for cat, data in category_results.items():
        cat_acc = (data["correct"] / data["total"]) * 100 if data["total"] > 0 else 0
        print(f" • {cat:<28} : {data['correct']}/{data['total']} correct ({cat_acc:.1f}%)")
    print("-" * 55)

    print("\n[4] DETERMINISTIC OUTPUT & MATHEMATICAL INVARIANT VALIDATION")
    print("-" * 55)

    # 1. Output Idempotency (Zero Variance Test)
    sample_features = {
        "commit_freq": 12.0,
        "co_deploy_rate": 0.35,
        "api_changes": 0.0,
        "downstream_count": 2.0,
    }
    repeated_scores = [predict_cscore(sample_features)["cscore"] for _ in range(100)]
    variance = sum((s - repeated_scores[0]) ** 2 for s in repeated_scores) / len(repeated_scores)
    idempotency_pass = variance == 0.0

    # 2. Phase 2 Hard Guardrail Invariant: Blast Radius > 0 ALWAYS forces C-Score >= 98.0
    blast_tests = [
        predict_cscore({"api_changes": c, "downstream_count": d})["cscore"]
        for c in [1, 2, 4] for d in [1, 2, 5]
    ]
    guardrail_pass = all(score >= 98.0 for score in blast_tests)

    # 3. Phase 2 Zero-Consumer Invariant: api_changes > 0 with downstream = 0 does NOT trigger abort
    zero_consumer_score = predict_cscore({"api_changes": 3, "downstream_count": 0})["cscore"]
    zero_consumer_pass = zero_consumer_score <= THRESHOLD

    # 4. Phase 1 Soft Advisory Invariant: Coupling Index > 0.50 triggers advisory warning
    adv_true = predict_cscore({"commit_freq": 20, "co_deploy_rate": 0.8})["coupling_warning"]
    adv_false = predict_cscore({"commit_freq": 2, "co_deploy_rate": 0.1})["coupling_warning"]
    advisory_pass = (adv_true is True) and (adv_false is False)

    # 5. Output Range Confinement: for all inputs, 0.0 <= cscore <= 100.0
    range_tests = [
        predict_cscore({"commit_freq": f, "co_deploy_rate": r, "api_changes": a, "downstream_count": d})["cscore"]
        for f in [0, 5, 24] for r in [0.0, 0.5, 1.0] for a in [0, 1] for d in [0, 2]
    ]
    range_pass = all(0.0 <= s <= 100.0 for s in range_tests)

    # 6. Monotonic Risk Escalation: Adding downstream blast strictly escalates C-Score
    clean_score = predict_cscore({"commit_freq": 3, "api_changes": 0, "downstream_count": 0})["cscore"]
    blast_score = predict_cscore({"commit_freq": 3, "api_changes": 1, "downstream_count": 1})["cscore"]
    monotonicity_pass = blast_score > clean_score

    print(f" • Bitwise Output Determinism   : {'PASS' if idempotency_pass else 'FAIL'} (100 runs identical, Variance = {variance:.4f})")
    print(f" • Phase 2 Hard Guardrail Rule  : {'PASS' if guardrail_pass else 'FAIL'} (Blast Radius > 0 forces C-Score >= 98.0)")
    print(f" • Phase 2 Zero-Consumer Guard  : {'PASS' if zero_consumer_pass else 'FAIL'} (Isolated service with 0 consumers avoids false abort)")
    print(f" • Phase 1 Soft Advisory Rule   : {'PASS' if advisory_pass else 'FAIL'} (Coupling Index > 0.50 triggers warning)")
    print(f" • Score Range Confinement      : {'PASS' if range_pass else 'FAIL'} (C-Score strictly confined in [0.00, 100.00])")
    print(f" • Monotonic Risk Escalation    : {'PASS' if monotonicity_pass else 'FAIL'} (Clean={clean_score:.2f} -> Guardrail={blast_score:.2f})")
    print(f" • Tuned Decision Threshold     : {THRESHOLD:.2f} (Cutoff boundary for PR Abort / Pass)")
    print(f" • Active Pipeline Scope        : Phase 1 (Pre-Build) + Phase 2 (Build Contract)")
    print("=" * 75)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Evaluate C-Score Engine Deterministic Output Accuracy (Phase 1 & 2)")
    parser.add_argument("--trials", "-n", type=int, default=500, help="Total evaluation trials (default: 500)")
    args = parser.parse_args()
    run_cscore_phase1_phase2_benchmark(total_trials=args.trials)
