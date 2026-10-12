"""GitHub Checks API (green/red check) and PR comments."""
import requests

from app.github_client import API, get_installation_token


def _headers(installation_id):
    token = get_installation_token(installation_id)
    return {"Authorization": f"token {token}", "Accept": "application/vnd.github+json"}


def create_check(installation_id, full_name, head_sha):
    """Show an 'in progress' check on the PR. Returns the check id."""
    r = requests.post(
        f"{API}/repos/{full_name}/check-runs",
        headers=_headers(installation_id),
        json={"name": "C-Score", "head_sha": head_sha, "status": "in_progress"},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["id"]


def complete_check(installation_id, full_name, check_id, conclusion, title, summary):
    """conclusion: 'success' (green) | 'failure' (red) | 'neutral'."""
    r = requests.patch(
        f"{API}/repos/{full_name}/check-runs/{check_id}",
        headers=_headers(installation_id),
        json={
            "status": "completed",
            "conclusion": conclusion,
            "output": {"title": title, "summary": summary},
        },
        timeout=30,
    )
    r.raise_for_status()


def post_pr_comment(installation_id, full_name, pr_number, body):
    r = requests.post(
        f"{API}/repos/{full_name}/issues/{pr_number}/comments",
        headers=_headers(installation_id),
        json={"body": body},
        timeout=30,
    )
    r.raise_for_status()


def build_report(service, result, p1, p2):
    """Markdown text for the check summary / PR comment."""
    icon = "🔴 HIGH RISK" if result["decision"] == "HIGH_RISK" else "🟢 LOW RISK"
    f = result["features"]
    lines = [
        f"## C-Score Report: `{service}`",
        f"### {icon} - C-Score **{result['cscore']}** (threshold {result['threshold']})",
        "",
        "| Metric | Value |",
        "|---|---|",
        f"| Blast Radius | **{p2['blast_radius']}** ({p2['api_changes']} breaking changes x {p2['downstream_count']} consumers) |",
        f"| Coupling Index | **{p1['coupling_index']}** |",
        f"| Commit Frequency (per day) | {f['commit_freq']} |",
        f"| Co-Deploy Rate | {f['co_deploy_rate']} |",
        f"| Downstream Services | {', '.join(p2['downstream_services']) or 'none'} |",
        f"| Pod Restarts (Runtime) | **{int(f.get('pod_restarts', 0))}** |",
        f"| CPU Spike / Error Rate | {f.get('cpu_spike_pct', 0)}% / {f.get('error_rate_pct', 0)}% |",
        f"| Trace Depth / Sync Calls | {int(f.get('max_call_depth', 1))} / {int(f.get('sync_call_count', 0))} |",
    ]
    if p2["breaking_messages"]:
        lines += ["", "**Breaking API changes:**"] + [f"- {m}" for m in p2["breaking_messages"]]
    if f.get("pod_restarts", 0) > 0 or f.get("cpu_spike_pct", 0) > 80:
        lines += ["", f"⚠️ **Critical Runtime Anomalies Detected:** {int(f.get('pod_restarts', 0))} pod restarts recorded."]
    if result["decision"] == "HIGH_RISK":
        lines += ["", "> 🛑 **Deployment Aborted:** High architectural or runtime risk score exceeds safety threshold."]
    return "\n".join(lines)
