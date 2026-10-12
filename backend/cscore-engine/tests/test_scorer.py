from app.scorer import predict_cscore

LOW = {"commit_freq": 0.2, "co_deploy_rate": 0.0}
HIGH = {
    "commit_freq": 5, "co_deploy_rate": 0.9, "api_changes": 6,
    "downstream_count": 5, "max_call_depth": 8, "sync_call_count": 10,
    "cpu_spike_pct": 90, "mem_spike_pct": 85, "error_rate_pct": 20, "pod_restarts": 6,
}


def test_scores_in_range_and_ordered():
    low, high = predict_cscore(LOW), predict_cscore(HIGH)
    print("LOW:", low["cscore"], "HIGH:", high["cscore"])
    assert 0 <= low["cscore"] <= 100
    assert 0 <= high["cscore"] <= 100
    assert high["cscore"] > low["cscore"]
