"""Phase 2 - Build: API Contract Change Count, Downstream Count, Blast Radius."""
import base64
import json
import os
import shutil
import subprocess
import tempfile

import requests

from app import db
from app.github_client import API, get_installation_token

OPENAPI_FILE = "openapi.yaml"  # expected inside each service folder


def find_oasdiff():
    """oasdiff may not be on PATH (Go installs it in ~/go/bin)."""
    path = shutil.which("oasdiff")
    if path:
        return path
    candidate = os.path.join(os.path.expanduser("~"), "go", "bin", "oasdiff.exe")
    return candidate if os.path.exists(candidate) else "oasdiff"


def fetch_file(installation_id, full_name, path, ref):
    """Download one file from GitHub at a branch/commit. Returns text or None."""
    token = get_installation_token(installation_id)
    headers = {"Authorization": f"token {token}", "Accept": "application/vnd.github+json"}
    r = requests.get(f"{API}/repos/{full_name}/contents/{path}",
                     headers=headers, params={"ref": ref}, timeout=30)
    if r.status_code == 404:
        return None
    r.raise_for_status()
    return base64.b64decode(r.json()["content"]).decode("utf-8")


def count_breaking_changes(old_text, new_text):
    """Compare two OpenAPI files with oasdiff -> (count, list of messages)."""
    tmp = tempfile.mkdtemp()
    old_path, new_path = os.path.join(tmp, "old.yaml"), os.path.join(tmp, "new.yaml")
    open(old_path, "w", encoding="utf-8").write(old_text)
    open(new_path, "w", encoding="utf-8").write(new_text)

    result = subprocess.run(
        [find_oasdiff(), "breaking", old_path, new_path, "--format", "json"],
        capture_output=True, text=True, timeout=60,
    )
    output = result.stdout.strip()
    changes = json.loads(output) if output else []
    messages = [c.get("text", c.get("id", "breaking change")) for c in changes]
    return len(messages), messages


def get_phase2_features(installation_id, full_name, service, repo_id, base_branch, head_sha):
    path = f"{service}/{OPENAPI_FILE}"
    old = fetch_file(installation_id, full_name, path, base_branch)  # production (main)
    new = fetch_file(installation_id, full_name, path, head_sha)      # the Pull Request

    if old and new:
        api_changes, messages = count_breaking_changes(old, new)
    else:
        api_changes, messages = 0, []  # no spec to compare (new service / no file)

    downstream = db.get_consumers(repo_id, service)  # who calls this service?
    return {
        "api_changes": api_changes,
        "downstream_count": len(downstream),
        "blast_radius": api_changes * len(downstream),
        "breaking_messages": messages,
        "downstream_services": downstream,
    }
