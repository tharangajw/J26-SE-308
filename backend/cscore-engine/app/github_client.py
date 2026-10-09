"""All GitHub API calls live here."""
import time

import jwt  # PyJWT
import requests

from app.config import GITHUB_APP_ID, GITHUB_PRIVATE_KEY_PATH

API = "https://api.github.com"


def _app_jwt():
    """Short-lived token that proves we are the GitHub App."""
    now = int(time.time())
    payload = {"iat": now - 60, "exp": now + 9 * 60, "iss": GITHUB_APP_ID}
    private_key = open(GITHUB_PRIVATE_KEY_PATH, "r").read()
    return jwt.encode(payload, private_key, algorithm="RS256")


def get_app_info():
    """Used to test that our App ID + private key work."""
    headers = {"Authorization": f"Bearer {_app_jwt()}", "Accept": "application/vnd.github+json"}
    r = requests.get(f"{API}/app", headers=headers, timeout=20)
    r.raise_for_status()
    return r.json()


def get_installation_token(installation_id):
    """Token that lets us read the client's repo / write checks."""
    headers = {"Authorization": f"Bearer {_app_jwt()}", "Accept": "application/vnd.github+json"}
    r = requests.post(
        f"{API}/app/installations/{installation_id}/access_tokens", headers=headers, timeout=20
    )
    r.raise_for_status()
    return r.json()["token"]


def gh_get(installation_id, path, params=None):
    """Generic authenticated GET, e.g. gh_get(id, '/repos/a/b/commits')."""
    token = get_installation_token(installation_id)
    headers = {"Authorization": f"token {token}", "Accept": "application/vnd.github+json"}
    r = requests.get(f"{API}{path}", headers=headers, params=params, timeout=30)
    r.raise_for_status()
    return r.json()
