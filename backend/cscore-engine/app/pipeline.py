"""Runs the full analysis for one Pull Request:
Phase 1 + Phase 2 (+ Phase 3 telemetry from DB) -> XGBoost -> GitHub Check."""
import traceback

from app import db
from app.checks import build_report, complete_check, create_check, post_pr_comment
from app.phase1 import get_phase1_features, get_pr_services
from app.phase2 import get_phase2_features
from app.scorer import predict_cscore

PHASE3_KEYS = ["max_call_depth", "sync_call_count", "cpu_spike_pct",
               "mem_spike_pct", "error_rate_pct", "pod_restarts"]


def analyze_service(repo, full_name, installation_id, service, base_branch, head_sha):
    p1 = get_phase1_features(installation_id, full_name, service)
    p2 = get_phase2_features(installation_id, full_name, service, repo["id"], base_branch, head_sha)
    p3 = db.get_latest_telemetry(repo["id"], service)  # {} if no telemetry yet -> 0

    features = {
        "commit_freq": p1["commit_freq"],
        "co_deploy_rate": p1["co_deploy_rate"],
        "api_changes": p2["api_changes"],
        "downstream_count": p2["downstream_count"],
    }
    for key in PHASE3_KEYS:
        features[key] = p3.get(key, 0)

    result = predict_cscore(features)
    result["blast_radius"] = p2["blast_radius"]
    return result, p1, p2


def run_pipeline(repo: dict, pr_number: int, head_sha: str, base_branch: str):
    full_name, inst = repo["full_name"], repo["installation_id"]
    print(f"[pipeline] {full_name} PR=#{pr_number} sha={head_sha[:7]} base={base_branch}")
    check_id = create_check(inst, full_name, head_sha)

    try:
        services = get_pr_services(inst, full_name, pr_number)
        if not services:
            complete_check(inst, full_name, check_id, "neutral", "No service changes",
                           "This PR does not change any service folder.")
            return

        # Analyse each changed service, report the riskiest one
        analysed = []
        for service in services:
            result, p1, p2 = analyze_service(repo, full_name, inst, service, base_branch, head_sha)
            db.save_run(repo["id"], pr_number, head_sha, service, result)
            analysed.append((service, result, p1, p2))
            print(f"[pipeline] {service}: C-Score={result['cscore']} -> {result['decision']}")

        service, result, p1, p2 = max(analysed, key=lambda x: x[1]["cscore"])
        report = build_report(service, result, p1, p2)

        if result["decision"] == "HIGH_RISK":
            complete_check(inst, full_name, check_id, "failure",
                           f"High Risk - C-Score {result['cscore']}", report)
            post_pr_comment(inst, full_name, pr_number, report)
        else:
            complete_check(inst, full_name, check_id, "success",
                           f"Low Risk - C-Score {result['cscore']}", report)

    except Exception as e:  # never leave the check hanging
        traceback.print_exc()
        complete_check(inst, full_name, check_id, "neutral", "C-Score engine error", str(e))
