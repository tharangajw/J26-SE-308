from app import phase1


def test_service_of():
    assert phase1.service_of("order-service/src/a.js") == "order-service"
    assert phase1.service_of("README.md") is None
    assert phase1.service_of(".github/workflows/ci.yml") is None


def test_phase1_features(monkeypatch):
    def fake_gh_get(installation_id, path, params=None):
        if path.endswith("/commits"):
            return [{"sha": "a"}, {"sha": "b"}, {"sha": "c"}, {"sha": "d"}]
        if path.endswith("/commits/a") or path.endswith("/commits/b"):  # co-deploys
            return {"files": [{"filename": "book-service/x.js"}, {"filename": "order-service/y.js"}]}
        return {"files": [{"filename": "book-service/x.js"}]}

    monkeypatch.setattr(phase1, "gh_get", fake_gh_get)
    f = phase1.get_phase1_features(1, "o/r", "book-service")
    assert f["co_deploy_rate"] == 0.5
    assert f["commit_freq"] == 4
