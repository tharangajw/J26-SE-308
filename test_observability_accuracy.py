import os
import sys
import random
import time

# Ensure backend/observability-engine is in path
current_dir = os.path.dirname(os.path.abspath(__file__))
engine_path = os.path.join(current_dir, "backend", "observability-engine")
if engine_path not in sys.path:
    sys.path.insert(0, engine_path)

from app.calculations import calculate_observability, calculate_cci, OBS_AHP

def run_empirical_accuracy_benchmark(total_trials=500):
    print("=" * 75)
    print("   OBSERVABILITY COMPONENT - EMPIRICAL BENCHMARK EVALUATION TEST")
    print("=" * 75)
    
    # Random seed for reproducible deterministic benchmark
    random.seed(42)
    
    # Ground truth tracking
    # Incident = 1, Healthy = 0
    y_true = []
    y_pred = []
    
    # Latency tracking
    eval_times_ms = []

    # Category breakdowns
    scenario_counts = {
        "HEALTHY": 0,
        "MEMORY_OOM": 0,
        "LATENCY_SPIKE": 0,
        "CORRELATION_BLINDSPOT": 0,
        "PILLAR_DROPOUT": 0
    }
    
    category_results = {cat: {"total": 0, "correct": 0} for cat in scenario_counts}

    for i in range(total_trials):
        start_t = time.perf_counter()
        
        # 300 Healthy, 200 Injected Anomalies (60/40 Split)
        is_anomaly = 1 if i < 200 else 0
        y_true.append(is_anomaly)
        
        base_time = 1729000000000 + (i * 10000)
        
        if is_anomaly == 0:
            scenario = "HEALTHY"
            scenario_counts["HEALTHY"] += 1
            sources = {"prometheus": True, "jaeger": True, "loki": True}
            logs = [{"timestamp": base_time + 10, "level": "INFO", "service": "order-service", "traceId": f"tr-{i}"}]
            traces = [{"id": f"tr-{i}", "timestamp": base_time + 10, "service": "order-service", "isError": False, "duration": 45.0}]
            error_count = 0
            error_rate = 0.0
            
            # Minor random network noise occasionally (tests specificity/robustness)
            if random.random() < 0.027:  # ~8 out of 300 might have unlinked noise
                error_count = 1
                logs.append({"timestamp": base_time + 8000, "level": "ERROR", "service": "unknown", "traceId": ""})
        else:
            anomaly_type = i % 4
            if anomaly_type == 0:
                # Memory OOM / CPU Saturation
                scenario = "MEMORY_OOM"
                sources = {"prometheus": True, "jaeger": True, "loki": True}
                error_count = 25
                error_rate = 18.5
                logs = [
                    {"timestamp": base_time + 50, "level": "ERROR", "service": "order-service", "traceId": f"tr-{i}", "message": "java.lang.OutOfMemoryError: Java heap space"}
                ]
                traces = [
                    {"id": f"tr-{i}", "timestamp": base_time + 50, "service": "order-service", "isError": True, "duration": 1200.0}
                ]
            elif anomaly_type == 1:
                # Distributed Latency Bottleneck / Downstream Timeout
                scenario = "LATENCY_SPIKE"
                sources = {"prometheus": True, "jaeger": True, "loki": True}
                error_count = 12
                error_rate = 15.0
                logs = [
                    {"timestamp": base_time + 100, "level": "ERROR", "service": "payment-service", "traceId": f"tr-{i}", "message": "Downstream DB Gateway timeout 504"}
                ]
                traces = [
                    {"id": f"tr-{i}", "timestamp": base_time + 100, "service": "payment-service", "isError": True, "duration": 2500.0}
                ]
            elif anomaly_type == 2:
                # Missing Trace Context Propagation (Blind Spot)
                scenario = "CORRELATION_BLINDSPOT"
                sources = {"prometheus": True, "jaeger": True, "loki": True}
                error_count = 35
                error_rate = 8.0
                logs = [
                    # Missing traceId -> Correlator flags Blind Spot
                    {"timestamp": base_time + 100, "level": "ERROR", "service": "order-service", "traceId": "-", "message": "Failed uninstrumented call"}
                ]
                traces = []
            else:
                # Pillar Loss (Prometheus or Jaeger daemon drop)
                scenario = "PILLAR_DROPOUT"
                missing_pillar = random.choice(["jaeger", "loki"])
                sources = {"prometheus": True, "jaeger": (missing_pillar != "jaeger"), "loki": (missing_pillar != "loki")}
                error_count = 10
                error_rate = 10.0
                logs = [{"timestamp": base_time + 100, "level": "ERROR", "service": "api-gateway", "traceId": f"tr-{i}"}] if sources["loki"] else []
                traces = [{"id": f"tr-{i}", "timestamp": base_time + 100, "service": "api-gateway", "isError": True}] if sources["jaeger"] else []

            scenario_counts[scenario] += 1

        # Ingest into Observability Engine pipeline
        snapshot = {
            "sources": sources,
            "metrics": {"cpuUsage": 75.0 if is_anomaly else 20.0, "memoryUsage": 85.0 if is_anomaly else 35.0, "requestCount": 150.0},
            "logs": {"errorCount": error_count, "recentLogs": logs},
            "traces": {"latency": 800.0 if is_anomaly else 45.0, "errorRate": error_rate, "serviceCount": 4, "samples": traces},
            "lastUpdated": "2026-10-24T18:00:00Z"
        }
        
        # Run Mathematical scoring engine
        res = calculate_observability(snapshot)
        
        eval_ms = (time.perf_counter() - start_t) * 1000.0
        eval_times_ms.append(eval_ms)
        
        # Observability Engine Decision Criterion:
        # A state is classified as an Incident if:
        # 1. O-Score drops below threshold (< 80.0)
        # OR 2. Blind spot count > 0
        # OR 3. CCI Index drops below threshold (< 85%)
        # OR 4. Status is WARNING/CRITICAL
        predicted_incident = 1 if (
            res["status"] in ("WARNING", "CRITICAL") 
            or res["blindSpotCount"] > 0 
            or res["oScore"] < 80.0
            or res["cciIndex"] < 85
        ) else 0
        
        y_pred.append(predicted_incident)
        
        category_results[scenario]["total"] += 1
        if predicted_incident == is_anomaly:
            category_results[scenario]["correct"] += 1

    # Confusion Matrix Calculation
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
    print(f"Actual Positive (200):      TP = {tp:<5}          FN = {fn:<5}")
    print(f"Actual Negative (300):      FP = {fp:<5}          TN = {tn:<5}")
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
        print(f" • {cat:<24} : {data['correct']}/{data['total']} correct ({cat_acc:.1f}%)")
    print("-" * 55)
    
    print("\n[4] AHP MATRIX MATHEMATICAL VALIDATION")
    print("-" * 55)
    print(f" • Max Eigenvalue (lambda_max) : {OBS_AHP['lambdaMax']:.4f}")
    print(f" • Consistency Index (CI)      : {OBS_AHP['consistencyIndex']:.4f}")
    print(f" • Consistency Ratio (CR)      : {OBS_AHP['consistencyRatio']:.4f}  (Threshold < 0.10 -> PASS)")
    print(f" • Pillar Weights              : Prometheus={OBS_AHP['weights'][0]*100:.1f}%, Jaeger={OBS_AHP['weights'][1]*100:.1f}%, Loki={OBS_AHP['weights'][2]*100:.1f}%")
    print("=" * 75)

if __name__ == "__main__":
    run_empirical_accuracy_benchmark()

