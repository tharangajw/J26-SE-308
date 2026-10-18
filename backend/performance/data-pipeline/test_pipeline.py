import time
from pipeline import DataPipelineEngine

def test_data_pipeline():
    print("--- Testing Data Pipeline Module ---")
    engine = DataPipelineEngine()
    
    mock_snapshots = [
        {
            "serviceId": "order-service",
            "timestamp": int(time.time() * 1000) - 10000,
            "prometheus": {
                "cpuUsageMillicores": 850,
                "memoryUsageMB": 1024,
                "p95LatencyMs": 650,
                "p99LatencyMs": 1200,
                "rps": 450
            },
            "k8s": {"podReplicaCount": 3, "podSpinUpLagSec": 15.0}
        },
        {
            "serviceId": "order-service",
            "timestamp": int(time.time() * 1000),
            "prometheus": {
                "cpuUsageMillicores": 920,
                "memoryUsageMB": 1100,
                "p95LatencyMs": 710,
                "p99LatencyMs": 1350,
                "rps": 480
            },
            "k8s": {"podReplicaCount": 4, "podSpinUpLagSec": 10.0}
        }
    ]
    
    processed_df = engine.process_raw_snapshots(mock_snapshots)
    assert not processed_df.empty, "Processed dataframe should not be empty"
    assert "cpu_millicores_norm" in processed_df.columns, "Normalized CPU feature missing"
    assert 0.0 <= processed_df["cpu_millicores_norm"].iloc[0] <= 1.0, "Normalized value out of 0-1 range"
    
    print("[OK] Data Pipeline tests passed successfully!")
    print(processed_df[["service_id", "cpu_millicores", "cpu_millicores_norm", "p95_latency_ms_norm"]])

if __name__ == "__main__":
    test_data_pipeline()
