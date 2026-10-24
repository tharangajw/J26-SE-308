"""Ephemeral in-memory log buffer for real-time webhook execution visibility.
Does NOT persist anything to disk or database. Only holds the latest webhook trigger's
essential Phase 1 and Phase 2 logs in memory.
"""
from datetime import datetime

_STATE = {
    "session_id": 0,
    "pr_number": None,
    "repo": None,
    "sha": None,
    "status": "idle",  # "running" | "completed" | "idle"
    "phase1": [],
    "phase2": [],
    "result": None,
}


def _now() -> str:
    return datetime.now().strftime("%H:%M:%S")


def start_webhook_session(pr_number: int, repo: str, sha: str, action: str = "opened"):
    """Reset ephemeral logs when a new PR webhook triggers."""
    _STATE["session_id"] += 1
    _STATE["pr_number"] = pr_number
    _STATE["repo"] = repo
    _STATE["sha"] = sha[:7]
    _STATE["status"] = "running"
    _STATE["phase1"] = []
    _STATE["phase2"] = []
    _STATE["result"] = None

    msg = f"[webhook] event=pull_request action={action} | {repo} PR=#{pr_number} (sha={sha[:7]})"
    add_log("phase1", msg, level="webhook")
    add_log("phase2", msg, level="webhook")


def add_log(phase: str, message: str, level: str = "info"):
    """Add an essential log line to 'phase1' or 'phase2' in memory."""
    if phase not in ("phase1", "phase2"):
        return
    entry = {
        "time": _now(),
        "level": level,  # "webhook" | "info" | "success" | "warn" | "error"
        "message": message,
    }
    _STATE[phase].append(entry)


def set_result(service: str, cscore: float, threshold: float, decision: str, p1: dict, p2: dict):
    """Store the final verdict (in memory only) for the dashboard popup."""
    _STATE["result"] = {
        "service": service,
        "cscore": cscore,
        "threshold": threshold,
        "decision": decision,  # "HIGH_RISK" | "LOW_RISK"
        "couplingIndex": p1.get("coupling_index"),
        "commitFreq": p1.get("commit_freq"),
        "coDeployRate": p1.get("co_deploy_rate"),
        "apiChanges": p2.get("api_changes"),
        "downstreamCount": p2.get("downstream_count"),
        "blastRadius": p2.get("blast_radius"),
    }


def finish_webhook_session():
    _STATE["status"] = "completed"


def get_live_logs(phase: str) -> dict:
    return {
        "sessionId": _STATE["session_id"],
        "prNumber": _STATE["pr_number"],
        "repo": _STATE["repo"],
        "sha": _STATE["sha"],
        "status": _STATE["status"],
        "result": _STATE["result"],
        "logs": list(_STATE.get(phase, [])),
    }


def clear_live_logs(phase: str = None):
    if phase in ("phase1", "phase2"):
        _STATE[phase] = []
    else:
        _STATE["phase1"] = []
        _STATE["phase2"] = []
        _STATE["status"] = "idle"
