import hashlib
import hmac
import json
import os
import tempfile

os.environ["CSCORE_DB"] = os.path.join(tempfile.mkdtemp(), "test_wh.db")

from fastapi.testclient import TestClient  # noqa: E402

from app.config import GITHUB_WEBHOOK_SECRET  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)


def _sign(body: bytes) -> str:
    return "sha256=" + hmac.new(GITHUB_WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()


def test_rejects_bad_signature():
    r = client.post("/webhook/github", content=b"{}", headers={"X-Hub-Signature-256": "sha256=bad"})
    assert r.status_code == 401


def test_accepts_installation_event():
    payload = {
        "action": "created",
        "installation": {"id": 99},
        "repositories": [{"full_name": "tharangajw/demo"}],
    }
    body = json.dumps(payload).encode()
    r = client.post(
        "/webhook/github",
        content=body,
        headers={"X-Hub-Signature-256": _sign(body), "X-GitHub-Event": "installation"},
    )
    assert r.status_code == 200
    from app import db
    assert db.get_repo("tharangajw/demo")["installation_id"] == 99
