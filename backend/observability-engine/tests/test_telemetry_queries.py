from app import telemetry


def test_prometheus_queries_support_otlp_and_legacy_metric_names():
    queries = telemetry._metric_queries()

    assert any("http_server_request_duration_seconds_count" in query for query in queries["requests"])
    assert any("http_requests_total" in query for query in queries["requests"])
    assert any("http_server_request_duration_seconds_bucket" in query for query in queries["latency"])
    assert any("process_cpu_time_seconds_total" in query for query in queries["cpu"])


def test_prometheus_label_filter_applies_to_metric_selectors(monkeypatch):
    monkeypatch.setattr(telemetry, "PROMETHEUS_LABEL_FILTER", 'service_name="checkout"')

    queries = telemetry._metric_queries()

    assert all('service_name="checkout"' in query for query in queries["requests"])


def test_missing_prometheus_result_is_not_reported_as_zero():
    assert telemetry._prometheus_value({"status": "success", "data": {"result": []}}) is None
    assert telemetry._prometheus_value(
        {"status": "success", "data": {"result": [{"value": [1, "0"]}]}}
    ) == 0.0


def test_connected_empty_backends_return_no_synthetic_samples(monkeypatch):
    def empty_response(url, params=None):
        if url.endswith("/api/v1/status/buildinfo"):
            return {"status": "success", "data": {"version": "test"}}
        if url.endswith("/loki/api/v1/query_range"):
            return {"status": "success", "data": {"result": []}}
        if url.endswith("/api/services"):
            return {"data": []}
        if url.endswith("/api/traces"):
            return {"data": []}
        return {"status": "success", "data": {"result": []}}

    monkeypatch.setattr(telemetry, "_get_json", empty_response)
    monkeypatch.setattr(telemetry, "telemetry_experiment", lambda: None)

    snapshot = telemetry.collect_telemetry()

    assert snapshot["sources"] == {"prometheus": True, "loki": True, "jaeger": True}
    assert snapshot["availability"] == {"metrics": False, "logs": False, "traces": False}
    assert snapshot["metrics"] == {
        "cpuUsage": None,
        "memoryUsage": None,
        "requestCount": None,
        "p95Latency": None,
    }
    assert snapshot["logs"]["recentLogs"] == []
    assert snapshot["traces"]["samples"] == []
