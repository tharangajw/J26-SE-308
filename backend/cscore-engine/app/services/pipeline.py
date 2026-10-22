"""Runs the full analysis for one Pull Request:
Phase 1 + Phase 2 -> XGBoost -> GitHub Check."""
import traceback

from app.core import db
from app.github.checks import build_report, complete_check, create_check, post_pr_comment
from app.services.live_logs import add_log, finish_webhook_session, set_result
from app.phases.phase1 import get_phase1_features, get_pr_services
from app.phases.phase2 import get_phase2_features
from app.ml.scorer import predict_cscore

PHASE3_KEYS = ["max_call_depth", "sync_call_count", "cpu_spike_pct",
               "mem_spike_pct", "error_rate_pct", "pod_restarts"]


def analyze_service(repo, full_name, installation_id, service, base_branch, head_sha):
    p1 = get_phase1_features(installation_id, full_name, service)
    add_log(
        "phase1",
        f"[phase1] {service}: commit_freq={p1['commit_freq']}, co_deploy_rate={p1['co_deploy_rate']}, coupling_index={p1['coupling_index']}",
        level="warn" if p1["coupling_index"] > 0.5 else "info",
    )

    p2 = get_phase2_features(installation_id, full_name, service, repo["id"], base_branch, head_sha)
    add_log(
        "phase2",
        f"[phase2] {service}: oasdiff breaking_changes={p2['api_changes']}, downstream_consumers={p2['downstream_count']}, blast_radius={p2['blast_radius']}",
        level="warn" if p2["blast_radius"] > 0 else "info",
    )

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
    pipeline_msg = f"[pipeline] {full_name} PR=#{pr_number} sha={head_sha[:7]} base={base_branch}"
    print(pipeline_msg)
    add_log("phase1", pipeline_msg, level="info")
    add_log("phase2", pipeline_msg, level="info")

    check_id = create_check(inst, full_name, head_sha)

    try:
        services = get_pr_services(inst, full_name, pr_number)
        if not services:
            add_log("phase1", "[phase1] No microservice folder changes detected in PR.", level="info")
            add_log("phase2", "[phase2] No microservice folder changes detected in PR.", level="info")
            complete_check(inst, full_name, check_id, "neutral", "No service changes",
                           "This PR does not change any service folder.")
            finish_webhook_session()
            return

        add_log("phase1", f"[phase1] Target services in PR #{pr_number}: {', '.join(services)}", level="info")
        add_log("phase2", f"[phase2] Target services in PR #{pr_number}: {', '.join(services)}", level="info")

        # Analyse each changed service, report the riskiest one
        analysed = []
        for service in services:
            result, p1, p2 = analyze_service(repo, full_name, inst, service, base_branch, head_sha)
            db.save_run(repo["id"], pr_number, head_sha, service, result)
            analysed.append((service, result, p1, p2))
            verdict_msg = f"[pipeline] {service}: C-Score={result['cscore']} -> {result['decision']}"
            print(verdict_msg)
            lvl = "error" if result["decision"] == "HIGH_RISK" else "success"
            add_log("phase1", verdict_msg, level=lvl)
            add_log("phase2", verdict_msg, level=lvl)

        service, result, p1, p2 = max(analysed, key=lambda x: x[1]["cscore"])
        report = build_report(service, result, p1, p2)
        set_result(service, result["cscore"], result["threshold"], result["decision"], p1, p2)

        # Final PR-level verdict = the RISKIEST changed service (this is what GitHub shows)
        if len(analysed) > 1:
            summary = ", ".join(f"{s}={r['cscore']}" for s, r, _, _ in analysed)
            print(f"[pipeline] services analysed: {summary}")
            add_log("phase1", f"[pipeline] services analysed: {summary}", level="info")
            add_log("phase2", f"[pipeline] services analysed: {summary}", level="info")
        final_msg = (f"[pipeline] FINAL PR #{pr_number}: {result['decision']} "
                     f"(riskiest service: {service}, C-Score={result['cscore']}, threshold>{result['threshold']})")
        print(final_msg)
        final_lvl = "error" if result["decision"] == "HIGH_RISK" else "success"
        add_log("phase1", final_msg, level=final_lvl)
        add_log("phase2", final_msg, level=final_lvl)

        if result["decision"] == "HIGH_RISK":
            complete_check(inst, full_name, check_id, "failure",
                           f"High Risk - C-Score {result['cscore']}", report)
            post_pr_comment(inst, full_name, pr_number, report)
        else:
            complete_check(inst, full_name, check_id, "success",
                           f"Low Risk - C-Score {result['cscore']}", report)

    except Exception as e:  # never leave the check hanging
        traceback.print_exc()
        add_log("phase1", f"[error] {str(e)}", level="error")
        add_log("phase2", f"[error] {str(e)}", level="error")
        complete_check(inst, full_name, check_id, "neutral", "C-Score engine error", str(e))
    finally:
        finish_webhook_session()
