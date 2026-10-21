from fastapi import FastAPI
from pydantic import BaseModel

from app import db
from app.live_logs import clear_live_logs, get_live_logs
from app.scorer import predict_cscore
from app.webhook import router as webhook_router

from fastapi.middleware.cors import CORSMiddleware
import json

app = FastAPI(title="C-Score Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhook_router)
db.init_db()  # create SQLite tables on startup


class Features(BaseModel):
    commit_freq: float = 0
    co_deploy_rate: float = 0
    api_changes: float = 0
    downstream_count: float = 0
    max_call_depth: float = 0
    sync_call_count: float = 0
    cpu_spike_pct: float = 0
    mem_spike_pct: float = 0
    error_rate_pct: float = 0
    pod_restarts: float = 0


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/score")
def score(features: Features):
    result = predict_cscore(features.model_dump())
    result["blast_radius"] = features.api_changes * features.downstream_count
    return result


@app.get("/api/phase1/dashboard")
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
            "title": f"Update {r['service_name']}",
            "services": [r["service_name"]],
            "commitFreq": round(c_freq, 1),
            "coDeployRate": round(c_deploy, 3),
            "couplingIndex": coupling_index,
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


@app.get("/api/phase2/dashboard")
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
            "title": f"Update {r['service_name']}",
            "services": [r["service_name"]],
            "apiChanges": api_changes,
            "downstreamCount": downstream,
            "blastRadius": blast,
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


@app.post("/api/live-logs/clear")
def api_clear_live_logs(phase: str = None):
    clear_live_logs(phase)
    return {"status": "cleared"}


@app.post("/api/phase2/sync-architecture")
def sync_architecture():
    # Fetch first active repo
    repo = db.get_repo("tharangajw/rp-core-product")
    if not repo:
        conn = db.get_conn()
        row = conn.execute("SELECT * FROM repos ORDER BY id ASC LIMIT 1").fetchone()
        conn.close()
        repo = dict(row) if row else {"id": 1, "installation_id": 5239950, "full_name": "tharangajw/rp-core-product"}
        
    from app.phase2 import auto_discover_dependencies
    count = auto_discover_dependencies(repo["installation_id"], repo["full_name"], repo["id"])
    return {"status": "ok", "dependencies_discovered": count, "repo": repo["full_name"]}
