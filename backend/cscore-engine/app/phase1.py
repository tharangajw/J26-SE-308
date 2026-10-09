"""Phase 1 - Pre-Build: Commit Frequency, Co-Deploy Rate, Coupling Index.

Everything is computed from the client's GitHub commit history.
A "service" = a top-level folder of the repo (e.g. order-service/).
"""
from datetime import datetime, timedelta, timezone

from app.github_client import gh_get

IGNORE_FOLDERS = {".github", "ci-cd-engine", "docs", "node_modules"}
HISTORY_DAYS = 30
MAX_COMMITS = 30  # limit GitHub API calls


def service_of(file_path: str):
    """'order-service/src/app.js' -> 'order-service' (None for root files)."""
    if "/" not in file_path:
        return None
    folder = file_path.split("/")[0]
    return None if folder in IGNORE_FOLDERS else folder


def services_in_files(file_paths):
    return sorted({s for s in (service_of(p) for p in file_paths) if s})


def get_pr_services(installation_id, full_name, pr_number):
    """Which services does this Pull Request change?"""
    files = gh_get(installation_id, f"/repos/{full_name}/pulls/{pr_number}/files",
                   params={"per_page": 100})
    return services_in_files([f["filename"] for f in files])


def get_phase1_features(installation_id, full_name, service):
    since = (datetime.now(timezone.utc) - timedelta(days=HISTORY_DAYS)).isoformat()
    commits = gh_get(installation_id, f"/repos/{full_name}/commits",
                     params={"path": service, "since": since, "per_page": MAX_COMMITS})

    commit_freq = len(commits)  # commits in the last 30 days (matches training range 1-24)

    # Co-deploy: how many of those commits ALSO changed another service?
    co_deploy_commits = 0
    for c in commits:
        detail = gh_get(installation_id, f"/repos/{full_name}/commits/{c['sha']}")
        touched = services_in_files([f["filename"] for f in detail.get("files", [])])
        if len(touched) > 1:
            co_deploy_commits += 1
    co_deploy_rate = co_deploy_commits / len(commits) if commits else 0.0

    # Coupling index (shown in PR comment, not a model input)
    coupling_index = round(0.5 * min(commit_freq / 24, 1.0) + 0.5 * co_deploy_rate, 3)

    return {
        "commit_freq": round(commit_freq, 4),
        "co_deploy_rate": round(co_deploy_rate, 4),
        "coupling_index": coupling_index,
    }
