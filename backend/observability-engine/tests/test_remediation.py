from app.ai import analyze, generate_remediation, _detect_scenario, _validate_remediation


def test_simulated_prometheus_gap_returns_recovery_guidance(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    report = {
        "telemetry": {
            "sources": {"prometheus": False, "loki": True, "jaeger": True},
            "activeExperiment": {
                "faultType": "METRIC_GAP",
                "serviceId": "all",
                "simulated": True,
            },
        }
    }

    result = generate_remediation("openrouter", report)

    assert result["mode"] == "simulation"
    assert result["script_type"] == "operator_guidance"
    assert result["guardrail_status"] == "not_required"
    assert "No Kubernetes patch is required" in result["script"]
    assert "Restore Telemetry" in result["script"]
    assert "order-service" not in result["script"]


def test_prometheus_gap_takes_priority_over_trace_correlation_text(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    report = {
        "summary": (
            "Telemetry data indicates a significant gap in Prometheus metrics coverage, "
            "leading to a lack of correlation between traces and logs, which may hinder effective root cause analysis."
        ),
        "root_cause": "Prometheus metrics coverage gap.",
        "affected_services": ["order-service"],
        "telemetry": {
            "sources": {"prometheus": False, "loki": True, "jaeger": True},
        },
    }

    assert _detect_scenario(report)[0] == "METRIC_GAP"

    result = generate_remediation("openrouter", report)

    assert result["script_type"] == "operator_guidance"
    assert result["mode"] == "guidance"
    assert "No Kubernetes YAML patch was generated" in result["script"]
    assert "jaeger-agent" not in result["script"]
    assert "order-service" not in result["script"]


def test_simulated_service_down_does_not_claim_to_restore_kubernetes(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    report = {
        "summary": "Service payment-service is down and unreachable.",
        "affected_services": ["payment-service"],
        "telemetry": {
            "activeExperiment": {
                "faultType": "SERVICE_DOWN",
                "serviceId": "payment-service",
                "simulated": True,
            },
            "serviceFault": {"type": "SERVICE_DOWN", "service": "payment-service"},
        },
    }

    result = generate_remediation("openrouter", report)

    assert result["script_type"] == "operator_guidance"
    assert result["mode"] == "simulation"
    assert "did not change a Kubernetes workload" in result["script"]
    assert "replicas:" not in result["script"]


def test_simulated_error_spike_returns_guidance_not_a_workload_patch(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    report = {
        "summary": "An error spike was detected in the payment service due to chaos fault injection.",
        "affected_services": ["payment-service"],
        "telemetry": {
            "activeExperiment": {
                "faultType": "ERROR_SPIKE",
                "serviceId": "payment-service",
                "simulated": True,
            },
            "logs": {"recentLogs": [{"level": "ERROR", "service": "payment-service", "message": "Chaos fault injection: upstream error spike"}]},
        },
    }

    result = generate_remediation("openrouter", report)

    assert result["script_type"] == "operator_guidance"
    assert result["mode"] == "simulation"
    assert "did not change a Kubernetes workload" in result["script"]


def test_hallucinated_jaeger_host_is_sanitized():
    bad_ai_output = {
        "script": """apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-service
  namespace: performance-demo
spec:
  template:
    spec:
      containers:
        - name: payment-service
          env:
            - name: JAEGER_AGENT_HOST
              value: "jaeger-agent.performance-demo.svc.cluster.local"
""",
        "risk_level": "High",
        "description": "Adding jaeger env vars",
    }
    report = {
        "summary": "An error spike was detected in the payment service due to chaos fault injection, resulting in a lack of trace identifiers for error logs.",
        "affected_services": ["payment-service"],
        "telemetry": {
            "activeExperiment": {
                "faultType": "ERROR_SPIKE",
                "serviceId": "payment-service",
            }
        },
        "discovery": {
            "sources": {"kubernetes": {"connected": True}},
            "workloads": [
                {
                    "name": "payment-service",
                    "namespace": "performance-demo",
                    "desiredReplicas": 1,
                    "readyReplicas": 1,
                }
            ],
        },
    }

    sanitized = _validate_remediation(bad_ai_output, report)
    assert "jaeger-agent" not in sanitized["script"]
    assert sanitized["script_type"] == "operator_guidance"
    assert "payment-service" in sanitized["script"]
    assert "replicas:" not in sanitized["script"]


def test_missing_ai_provider_returns_an_error_not_fabricated_rca(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    result = analyze("gemini", {"metrics": {}, "logs": {}, "traces": {}})

    assert "error" in result
    assert "summary" not in result
    assert result["mode"] == "unavailable"


def test_unknown_report_does_not_invent_a_target_service():
    assert _detect_scenario({}) == ("UNKNOWN", "")


def test_manifest_requires_exactly_discovered_deployment_and_namespace():
    report = {
        "summary": "Service checkout is down.",
        "affected_services": ["checkout"],
        "discovery": {
            "sources": {"kubernetes": {"connected": True}},
            "workloads": [
                {
                    "name": "checkout",
                    "namespace": "research",
                    "desiredReplicas": 1,
                    "readyReplicas": 0,
                }
            ],
        },
    }
    manifest = {
        "script": """apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout
  namespace: research
spec:
  replicas: 1
""",
        "risk_level": "Low",
        "description": "Restore the verified workload.",
    }

    result = _validate_remediation(manifest, report)

    assert result["guardrail_status"] == "review_required"


def test_manifest_cannot_target_another_namespace():
    report = {
        "summary": "Service checkout is down.",
        "affected_services": ["checkout"],
        "discovery": {
            "sources": {"kubernetes": {"connected": True}},
            "workloads": [{"name": "checkout", "namespace": "research"}],
        },
    }
    manifest = {
        "script": """apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout
  namespace: default
spec:
  replicas: 1
""",
        "risk_level": "Low",
    }

    try:
        _validate_remediation(manifest, report)
    except ValueError as error:
        assert "namespace does not match" in str(error)
    else:
        raise AssertionError("a manifest for a different namespace must be rejected")

