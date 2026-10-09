from fastapi import FastAPI
from pydantic import BaseModel

from app import db
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
    for p in reversed(prs[:7]):
        # take time like '14:47' from '2026-10-09 14:47:52'
        time_label = p["time"].split(" ")[1][:5] if " " in p["time"] else p["time"]
        history_data.append({
            "name": time_label,
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
        "serviceDist": service_dist
    }


@app.get("/api/phase2/dashboard")
def get_phase2_dashboard():
    # Get recent PR runs for blast radius data
    runs = db.get_runs(limit=20)
    
    prs = []
    total_blast = 0
    total_api_changes = 0
    count = 0
    
    for r in runs:
        features = json.loads(r["features"])
        api_changes = features.get("api_changes", 0)
        downstream = features.get("downstream_count", 0)
        blast = r.get("blast_radius") or (api_changes * downstream)
        
        prs.append({
            "id": f"PR #{r['pr_number']}",
            "title": f"Update {r['service_name']}",
            "services": [r["service_name"]],
            "apiChanges": api_changes,
            "downstreamCount": downstream,
            "blastRadius": blast,
            "status": "Passed" if r["decision"] == "LOW_RISK" else "Blocked",
            "time": r["created_at"]
        })
        
        total_blast += blast
        total_api_changes += api_changes
        count += 1
        
    avg_blast = round(total_blast / count, 1) if count > 0 else 0
    avg_api_changes = round(total_api_changes / count, 1) if count > 0 else 0

    # Get dependencies for the graph
    # Assume repo 1 for the dashboard
    deps = db.get_all_dependencies(repo_id=1)
    
    # Format graph nodes and edges
    nodes_set = set()
    edges = []
    for d in deps:
        nodes_set.add(d["consumer"])
        nodes_set.add(d["provider"])
        edges.append({"source": d["consumer"], "target": d["provider"]})
        
    nodes = [{"id": n, "label": n} for n in nodes_set]
    # Default mock graph if db is empty
    if not nodes:
        nodes = [
            {"id": "gateway", "label": "gateway"},
            {"id": "order-service", "label": "order-service"},
            {"id": "payment-service", "label": "payment-service"},
            {"id": "inventory-service", "label": "inventory-service"},
        ]
        edges = [
            {"source": "gateway", "target": "order-service"},
            {"source": "gateway", "target": "payment-service"},
            {"source": "order-service", "target": "payment-service"},
            {"source": "order-service", "target": "inventory-service"},
        ]

    return {
        "averages": {
            "blastRadius": avg_blast,
            "apiChanges": avg_api_changes
        },
        "recentPRs": prs,
        "graph": {
            "nodes": nodes,
            "edges": edges
        }
    }
