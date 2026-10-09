import os
import tempfile

# Use a temporary DB file so tests never touch the real database.
os.environ["CSCORE_DB"] = os.path.join(tempfile.mkdtemp(), "test.db")

from app import db  # noqa: E402


def test_db_flow():
    db.init_db()

    repo = db.add_repo("client/shop", installation_id=123)
    key = db.create_api_key(repo["id"])
    assert db.get_repo_by_api_key(key)["full_name"] == "client/shop"

    db.add_dependency(repo["id"], "order-service", "book-service")
    db.add_dependency(repo["id"], "gateway", "book-service")
    assert sorted(db.get_consumers(repo["id"], "book-service")) == ["gateway", "order-service"]

    db.add_deploy_event(repo["id"], "book-service", "abc", ["book-service", "order-service"])
    assert len(db.get_deploy_events(repo["id"], "book-service")) == 1

    db.add_telemetry(repo["id"], "book-service", "max_call_depth", 4)
    assert db.get_latest_telemetry(repo["id"], "book-service")["max_call_depth"] == 4

    result = {"features": {"commit_freq": 1}, "blast_radius": 6, "cscore": 72.5, "decision": "HIGH_RISK"}
    db.save_run(repo["id"], 7, "abc", "book-service", result)
    assert db.get_runs(repo["id"])[0]["decision"] == "HIGH_RISK"
