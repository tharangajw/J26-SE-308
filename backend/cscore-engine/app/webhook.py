"""Receives GitHub webhooks (PR opened / pushed / app installed)."""
import hashlib
import hmac
import json

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request

from app import db
from app.config import GITHUB_WEBHOOK_SECRET
from app.pipeline import run_pipeline

router = APIRouter()


def verify_signature(body: bytes, signature: str) -> bool:
    """GitHub signs every webhook with our secret (HMAC SHA-256)."""
    if not signature:
        return False
    expected = "sha256=" + hmac.new(GITHUB_WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/webhook/github")
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_github_event: str = Header(default=""),
    x_hub_signature_256: str = Header(default=""),
):
    body = await request.body()
    if not verify_signature(body, x_hub_signature_256):
        raise HTTPException(status_code=401, detail="Invalid signature")

    payload = json.loads(body)
    print(f"[webhook] event={x_github_event} action={payload.get('action')}")

    # Client clicked "Connect with GitHub App" -> save their repos
    if x_github_event in ("installation", "installation_repositories"):
        installation_id = payload["installation"]["id"]
        repos = payload.get("repositories") or payload.get("repositories_added") or []
        for r in repos:
            db.add_repo(r["full_name"], installation_id)
            print(f"[webhook] connected repo {r['full_name']}")

    # New / updated Pull Request -> start the C-Score analysis
    elif x_github_event == "pull_request" and payload.get("action") in (
        "opened", "synchronize", "reopened"
    ):
        pr = payload["pull_request"]
        full_name = payload["repository"]["full_name"]
        repo = db.add_repo(full_name, payload["installation"]["id"])
        background_tasks.add_task(
            run_pipeline, repo, pr["number"], pr["head"]["sha"], pr["base"]["ref"]
        )

    return {"received": True}
