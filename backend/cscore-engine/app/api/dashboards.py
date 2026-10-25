"""Dashboard endpoints: Phase 1 coupling, Phase 2 blast radius, live webhook logs."""
import json

from fastapi import APIRouter

from app.core import db
from app.services.live_logs import clear_live_logs, get_live_logs

router = APIRouter()


@router.get("/api/phase1/dashboard")
def get_dashboard_data():
    runs = db.get_runs(limit=20)
    
    prs = []
    total_commit_freq = 0
    total_co_deploy = 0
    total_coupling = 0
    count = 0
    
    for r in runs:
        features = json.loads(r["features"])
        c_freq = features.get("commit_freq", 0)
        c_deploy = features.get("co_deploy_rate", 0)
        
        # coupling formula used in Phase 1
        coupling_index = round(0.5 * min(c_freq / 24.0, 1.0) + 0.5 * c_deploy, 3)
        
        prs.append({
            "id": f"PR #{r['pr_number']}",
            "prNumber": r["pr_number"],
            "title": f"Update {r['service_name']}",
            "services": [r["service_name"]],
            "commitFreq": round(c_freq, 1),
            "coDeployRate": round(c_deploy, 3),
            "couplingIndex": coupling_index,
            "blastRadius": round(float(r.get("blast_radius") or 0), 1),
            "cscore": round(float(r.get("cscore", 0) or 0), 1),
            "decision": r["decision"],
            "status": "Passed" if r["decision"] == "LOW_RISK" else "Blocked",
            "time": r["created_at"]
        })
        
        total_commit_freq += c_freq
        total_co_deploy += c_deploy
        total_coupling += coupling_index
        count += 1
        
    # Generate history for the chart (reverse so oldest is first)
    history_data = []
    for p in reversed(prs[:10]):
        # take time like '14:47' from '2026-10-09 14:47:52'
        time_label = p["time"].split(" ")[1][:5] if " " in p["time"] else p["time"]
        history_data.append({
            "name": f"{p['id']} {p['services'][0]} {time_label}",
            "commitFreq": p["commitFreq"],
            "coDeploy": p["coDeployRate"],
            "couplingIndex": p["couplingIndex"]
        })
        
    # Aggregate service coupling distribution
    service_map = {}
    for p in prs:
        svc = p["services"][0]
        if svc not in service_map:
            service_map[svc] = []
        service_map[svc].append(p["couplingIndex"])
        
    service_dist = []
    colors = ['#10b981', '#fbbf24', '#f43f5e'] # low, med, high
    for svc, indices in service_map.items():
        avg_idx = sum(indices) / len(indices)
        color = colors[0] if avg_idx < 0.4 else (colors[1] if avg_idx < 0.6 else colors[2])
        service_dist.append({
            "name": svc,
            "couplingIndex": round(avg_idx, 3),
            "color": color
        })

    avg_c_freq = round(total_commit_freq / count, 1) if count > 0 else 0
    avg_c_deploy = round((total_co_deploy / count) * 100, 1) if count > 0 else 0
    avg_coupling = round(total_coupling / count, 3) if count > 0 else 0

    return {
        "averages": {
            "couplingIndex": avg_coupling,
            "commitFreq": avg_c_freq,
            "coDeployRate": avg_c_deploy,
        },
        "recentPRs": prs,
        "history": history_data,
        "serviceDist": service_dist,
        "liveLogs": get_live_logs("phase1"),
    }


@router.get("/api/phase2/dashboard")
def get_phase2_dashboard():
    # Get recent PR runs for blast radius data
    runs = db.get_runs(limit=20)
    
    prs = []
    relevant_prs = []
    total_blast = 0
    total_api_changes = 0
    count = 0
    
    for r in runs:
        features = json.loads(r["features"])
        api_changes = features.get("api_changes", 0)
        downstream = features.get("downstream_count", 0)
        blast = r.get("blast_radius") or (api_changes * downstream)
        
        pr_item = {
            "id": f"PR #{r['pr_number']}",
            "prNumber": r["pr_number"],
            "title": f"Update {r['service_name']}",
            "services": [r["service_name"]],
            "apiChanges": api_changes,
            "downstreamCount": downstream,
            "blastRadius": blast,
            "cscore": round(float(r.get("cscore", 0) or 0), 1),
            "decision": r["decision"],
            "status": "Passed" if r["decision"] == "LOW_RISK" else "Blocked",
            "time": r["created_at"],
            "hasContractChange": api_changes > 0 or blast > 0
        }
        prs.append(pr_item)
        
        if api_changes > 0 or blast > 0:
            relevant_prs.append(pr_item)
        
        total_blast += blast
        total_api_changes += api_changes
        count += 1
        
    avg_blast = round(total_blast / count, 1) if count > 0 else 0
    avg_api_changes = round(total_api_changes / count, 1) if count > 0 else 0

    # Build history for Blast Radius chart (reverse for chronological)
    history_data = []
    for p in reversed(prs[:10]):
        time_label = p["time"].split(" ")[1][:5] if " " in p["time"] else p["time"]
        history_data.append({
            "name": f"{p['id']} {p['services'][0]} {time_label}",
            "blastRadius": p["blastRadius"],
            "apiChanges": p["apiChanges"],
            "downstreamCount": p["downstreamCount"]
        })

    # Get dependencies for the graph
    deps = db.get_all_dependencies(repo_id=1)
    
    # Compute downstream exposure count per service (provider)
    service_exposure_map = {}
    nodes_set = set()
    edges = []
    for d in deps:
        nodes_set.add(d["consumer"])
        nodes_set.add(d["provider"])
        edges.append({"source": d["consumer"], "target": d["provider"]})
        service_exposure_map[d["provider"]] = service_exposure_map.get(d["provider"], 0) + 1
        
    service_exposure = [
        {"service": s, "downstreamConsumers": service_exposure_map.get(s, 0)}
        for s in nodes_set
    ]
    
    nodes = [{"id": n, "label": n} for n in nodes_set]

    return {
        "averages": {
            "blastRadius": avg_blast,
            "apiChanges": avg_api_changes
        },
        "allPRs": prs,
        "relevantPRs": relevant_prs if relevant_prs else prs,
        "recentPRs": prs,
        "history": history_data,
        "serviceExposure": service_exposure,
        "graph": {
            "nodes": nodes,
            "edges": edges
        },
        "liveLogs": get_live_logs("phase2"),
    }


@router.post("/api/live-logs/clear")
def api_clear_live_logs(phase: str = None):
    clear_live_logs(phase)
    return {"status": "cleared"}


@router.post("/api/phase2/sync-architecture")
def sync_architecture():
    # Fetch first active repo
    repo = db.get_repo("tharangajw/rp-core-product")
    if not repo:
        conn = db.get_conn()
        row = conn.execute("SELECT * FROM repos ORDER BY id ASC LIMIT 1").fetchone()
        conn.close()
        repo = dict(row) if row else {"id": 1, "installation_id": 5239950, "full_name": "tharangajw/rp-core-product"}
        
    from app.phases.phase2 import auto_discover_dependencies
    count = auto_discover_dependencies(repo["installation_id"], repo["full_name"], repo["id"])
    return {"status": "ok", "dependencies_discovered": count, "repo": repo["full_name"]}




@router.get("/api/cicd/overview")
def get_cicd_overview():
    runs = db.get_runs(limit=50)
    total_evals = len(runs)
    if total_evals == 0:
        return {
            "summary": {
                "totalEvaluations": 0,
                "passRate": 0,
                "avgCouplingIndex": 0.0,
                "avgBlastRadius": 0.0,
                "avgCScore": 0.0,
                "runtimeRestarts": 0,
                "runtimeCpu": 0.0,
                "runtimeStatus": "NOMINAL"
            },
            "runs": [],
            "timeline": []
        }

    formatted_runs = []
    total_coupling = 0.0
    total_blast = 0.0
    total_cscore = 0.0
    total_restarts = 0
    passed_count = 0

    for r in runs:
        features = json.loads(r["features"])
        c_freq = float(features.get("commit_freq", 0) or 0)
        c_deploy = float(features.get("co_deploy_rate", 0) or 0)
        api_changes = float(features.get("api_changes", 0) or 0)
        downstream = float(features.get("downstream_count", 0) or 0)
        pod_restarts = int(features.get("pod_restarts", 0) or 0)
        cpu_spike = float(features.get("cpu_spike_pct", 0) or 0)
        mem_spike = float(features.get("mem_spike_pct", 0) or 0)
        error_rate = float(features.get("error_rate_pct", 0) or 0)
        max_call_depth = int(features.get("max_call_depth", 0) or 0)
        sync_call_count = int(features.get("sync_call_count", 0) or 0)

        coupling_index = round(0.5 * min(c_freq / 24.0, 1.0) + 0.5 * c_deploy, 3)
        blast = float(r.get("blast_radius") if r.get("blast_radius") is not None else (api_changes * downstream))
        cscore = float(r.get("cscore", 0) or 0)
        is_passed = (r.get("decision") == "LOW_RISK")
        if is_passed:
            passed_count += 1

        total_coupling += coupling_index
        total_blast += blast
        total_cscore += cscore
        total_restarts += pod_restarts

        formatted_runs.append({
            "id": f"PR #{r['pr_number']}",
            "prNumber": r["pr_number"],
            "title": f"Update {r['service_name']}",
            "service": r["service_name"],
            "phase1": {
                "commitFreq": round(c_freq, 1),
                "coDeployRate": round(c_deploy * 100, 1),
                "couplingIndex": coupling_index,
            },
            "phase2": {
                "apiChanges": int(api_changes),
                "downstreamCount": int(downstream),
                "blastRadius": round(blast, 1),
            },
            "phase3": {
                "podRestarts": pod_restarts,
                "cpuSpikePct": round(cpu_spike, 1),
                "memSpikePct": round(mem_spike, 1),
                "errorRatePct": round(error_rate, 1),
                "maxCallDepth": max_call_depth,
                "syncCallCount": sync_call_count,
            },
            "cscore": round(cscore, 1),
            "decision": r["decision"],
            "status": "Passed" if is_passed else "Blocked",
            "time": r["created_at"],
        })

    avg_coupling = round(total_coupling / total_evals, 3)
    avg_blast = round(total_blast / total_evals, 1)
    avg_cscore = round(total_cscore / total_evals, 1)
    pass_rate = round((passed_count / total_evals) * 100)

    timeline = []
    for run in reversed(formatted_runs[:10]):
        time_label = run["time"].split(" ")[1][:5] if " " in run["time"] else run["time"]
        timeline.append({
            "name": f"{run['id']} ({time_label})",
            "cscore": run["cscore"],
            "coupling": round(run["phase1"]["couplingIndex"] * 100, 1),
            "blast": round(run["phase2"]["blastRadius"] * 10, 1),
            "restarts": run["phase3"]["podRestarts"],
        })

    runtime_status = "CRITICAL" if any(r["status"] == "Blocked" for r in formatted_runs[:3]) else "NOMINAL"

    return {
        "summary": {
            "totalEvaluations": total_evals,
            "passRate": pass_rate,
            "avgCouplingIndex": avg_coupling,
            "avgBlastRadius": avg_blast,
            "avgCScore": avg_cscore,
            "runtimeRestarts": total_restarts,
            "runtimeCpu": round(sum(r["phase3"]["cpuSpikePct"] for r in formatted_runs) / total_evals, 1),
            "runtimeStatus": runtime_status,
        },
        "runs": formatted_runs,
        "timeline": timeline,
    }
