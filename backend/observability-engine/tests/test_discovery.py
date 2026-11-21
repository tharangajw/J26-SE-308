from app import discovery


def test_prometheus_discovery_prefers_service_labels(monkeypatch):
    monkeypatch.setattr(discovery, "PROMETHEUS_URL", "http://prometheus:9090")
    monkeypatch.setattr(
        discovery,
        "_get_json",
        lambda *args, **kwargs: (
            {
                "status": "success",
                "data": {
                    "activeTargets": [
                        {"labels": {"job": "scrape-job", "service_name": "checkout"}},
                        {"labels": {"job": "inventory"}},
                    ]
                },
            },
            None,
        ),
    )
    services = {}

    source = discovery._discover_prometheus(services)

    assert source["connected"] is True
    assert source["count"] == 2
    assert ("None", "checkout") not in services
    assert (None, "checkout") in services
    assert (None, "scrape-job") not in services
    assert (None, "inventory") in services


def test_kubernetes_discovery_uses_namespace_and_keeps_service_metadata(monkeypatch):
    monkeypatch.setattr(
        discovery,
        "_kubernetes_config",
        lambda: (
            "https://cluster.example",
            {"Authorization": "Bearer test-token"},
            "/tmp/cluster-ca.crt",
            "research",
        ),
    )
    def kubernetes_list(base_url, path, headers, verify):
        if path.endswith("/services"):
            return ([
                {
                    "metadata": {"name": "checkout", "namespace": "research"},
                    "spec": {
                        "type": "ClusterIP",
                        "clusterIP": "10.0.0.8",
                        "ports": [{"port": 8080, "protocol": "TCP"}],
                    },
                },
                {"metadata": {"name": "kubernetes", "namespace": "default"}},
            ], None)
        return ([
            {
                "metadata": {"name": "checkout", "namespace": "research"},
                "spec": {"replicas": 2},
                "status": {"readyReplicas": 1, "availableReplicas": 1},
            }
        ], None)

    monkeypatch.setattr(discovery, "_kubernetes_list", kubernetes_list)
    services = {}

    source = discovery._discover_kubernetes(services)

    assert source["connected"] is True
    assert source["count"] == 1
    assert source["namespace"] == "research"
    service = services[("research", "checkout")]
    assert service["sources"] == ["kubernetes"]
    assert service["ports"] == [{"name": None, "port": 8080, "protocol": "TCP"}]
    assert ("default", "kubernetes") not in services
    assert source["workloads"] == [{
        "name": "checkout",
        "namespace": "research",
        "desiredReplicas": 2,
        "readyReplicas": 1,
        "availableReplicas": 1,
    }]


def test_discovery_reports_unconfigured_kubernetes_without_demo_services(monkeypatch):
    monkeypatch.setattr(discovery, "_discover_prometheus", lambda services: {"connected": True, "count": 0})
    monkeypatch.setattr(discovery, "_discover_loki", lambda: {"connected": True, "count": 0})
    monkeypatch.setattr(discovery, "_discover_jaeger", lambda services: {"connected": True, "count": 0})
    monkeypatch.setattr(
        discovery,
        "_discover_kubernetes",
        lambda services: {
            "configured": False,
            "connected": False,
            "count": 0,
            "error": "Kubernetes URL is not configured.",
        },
    )

    result = discovery.discover_services()

    assert result["services"] == []
    assert result["sources"]["kubernetes"]["configured"] is False