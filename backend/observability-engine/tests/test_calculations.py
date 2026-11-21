from app.calculations import calculate_observability


def test_connected_backends_without_signal_data_do_not_receive_coverage_credit():
    snapshot = {
        "sources": {"prometheus": True, "jaeger": True, "loki": True},
        "availability": {"metrics": False, "traces": False, "logs": False},
        "metrics": {},
        "logs": {"errorCount": 0, "recentLogs": []},
        "traces": {"errorRate": None, "samples": []},
    }

    result = calculate_observability(snapshot)

    assert result["scoreBreakdown"]["metricsCoverage"] == 0
    assert result["scoreBreakdown"]["tracePropagation"] == 0
    assert result["scoreBreakdown"]["logStructuralIntegrity"] == 0
    assert result["oScore"] == 0
