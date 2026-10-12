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
    for p in reversed(prs[:7]):
        time_label = p["time"].split(" ")[1][:5] if " " in p["time"] else p["time"]
        history_data.append({
            "name": time_label,
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
        for s in (nodes_set if nodes_set else ["order-service", "book-service", "user-service", "gateway"])
    ]
    
    nodes = [{"id": n, "label": n} for n in nodes_set]
    if not nodes:
        nodes = [
            {"id": "gateway", "label": "gateway"},
            {"id": "order-service", "label": "order-service"},
            {"id": "book-service", "label": "book-service"},
            {"id": "user-service", "label": "user-service"},
        ]
        edges = [
            {"source": "gateway", "target": "order-service"},
            {"source": "gateway", "target": "book-service"},
            {"source": "order-service", "target": "book-service"},
            {"source": "order-service", "target": "user-service"},
        ]
        service_exposure = [
            {"service": "book-service", "downstreamConsumers": 2},
            {"service": "order-service", "downstreamConsumers": 1},
            {"service": "user-service", "downstreamConsumers": 1},
            {"service": "gateway", "downstreamConsumers": 0},
        ]

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
        }
    }


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


# ─── Phase 3: Runtime Telemetry Endpoints ─────────────────────────
class TelemetryPayload(BaseModel):
    service_name: str
    metric: str | None = None
    value: float | None = None
    pod_restarts: float | None = None
    cpu_spike_pct: float | None = None
    mem_spike_pct: float | None = None
    error_rate_pct: float | None = None
    max_call_depth: float | None = None
    sync_call_count: float | None = None


class SimulatePayload(BaseModel):
    service_name: str = "order-service"
    preset: str = "healthy"  # "healthy", "pod_crash", "cpu_burn", "cascading_failure"


@app.get("/api/phase3/dashboard")
def get_phase3_dashboard():
    from app.phase3 import get_phase3_features
    services_list = ["order-service", "book-service", "user-service", "gateway"]
    results = []
    total_restarts = 0
    total_cpu = 0
    total_error = 0
    
    for svc in services_list:
        metrics = get_phase3_features(1, svc)
        total_restarts += metrics["pod_restarts"]
        total_cpu += metrics["cpu_spike_pct"]
        total_error += metrics["error_rate_pct"]
        
        is_risky = metrics["pod_restarts"] > 0 or metrics["cpu_spike_pct"] > 70 or metrics["error_rate_pct"] > 2.0
        results.append({
            "service": svc,
            "podRestarts": int(metrics["pod_restarts"]),
            "cpuSpikePct": round(metrics["cpu_spike_pct"], 1),
            "memSpikePct": round(metrics["mem_spike_pct"], 1),
            "errorRatePct": round(metrics["error_rate_pct"], 2),
            "maxCallDepth": int(metrics["max_call_depth"]),
            "syncCallCount": int(metrics["sync_call_count"]),
            "status": "Degraded" if is_risky else "Healthy"
        })
        
    return {
        "services": results,
        "summary": {
            "totalPodRestarts": int(total_restarts),
            "avgCpuSpike": round(total_cpu / len(services_list), 1),
            "avgErrorRate": round(total_error / len(services_list), 2),
            "overallRuntimeStatus": "CRITICAL" if total_restarts > 5 else ("WARNING" if total_restarts > 0 else "NOMINAL")
        }
    }


@app.post("/v1/telemetry")
@app.post("/api/v1/telemetry")
def ingest_telemetry(payload: TelemetryPayload):
    from app.phase3 import record_metric, record_batch_metrics
    if payload.metric and payload.value is not None:
        record_metric(1, payload.service_name, payload.metric, payload.value)
        return {"status": "recorded", "service": payload.service_name, "metric": payload.metric, "value": payload.value}
        
    batch = {}
    for k in ["pod_restarts", "cpu_spike_pct", "mem_spike_pct", "error_rate_pct", "max_call_depth", "sync_call_count"]:
        v = getattr(payload, k, None)
        if v is not None:
            batch[k] = v
    if batch:
        record_batch_metrics(1, payload.service_name, batch)
        return {"status": "recorded_batch", "service": payload.service_name, "metrics": batch}
        
    return {"status": "noop", "message": "No valid telemetry fields provided"}


@app.post("/api/telemetry/simulate")
def simulate_telemetry(payload: SimulatePayload):
    from app.phase3 import simulate_telemetry_preset
    metrics = simulate_telemetry_preset(1, payload.service_name, payload.preset)
    return {"status": "ok", "service": payload.service_name, "preset": payload.preset, "metrics": metrics}


@app.post("/v1/traces")
def ingest_otlp_traces(trace_data: dict):
    from app.phase3 import parse_otlp_traces, record_batch_metrics
    parsed = parse_otlp_traces(trace_data)
    record_batch_metrics(1, "gateway", parsed)
    return {"status": "traces_analyzed", "metrics": parsed}


@app.get("/api/cicd/overview")
def get_cicd_overview():
    runs = db.get_runs(limit=30)
    
    formatted_runs = []
    total_passed = 0
    total_coupling = 0
    total_blast = 0
    timeline = []
    
    for r in runs:
        f = json.loads(r["features"])
        c_freq = f.get("commit_freq", 0) or 0
        c_deploy = f.get("co_deploy_rate", 0) or 0
        coupling_idx = round(0.5 * min(c_freq / 24, 1.0) + 0.5 * c_deploy, 3)
        api_changes = f.get("api_changes", 0) or 0
        downstream = f.get("downstream_count", 0) or 0
        blast = r.get("blast_radius") or (api_changes * downstream)
        
        is_passed = r["decision"] == "LOW_RISK"
        if is_passed:
            total_passed += 1
            
        total_coupling += coupling_idx
        total_blast += blast
        
        item = {
            "id": f"PR #{r['pr_number']}",
            "prNumber": r["pr_number"],
            "title": f"Update {r['service_name']}",
            "service": r["service_name"],
            "phase1": {
                "commitFreq": c_freq,
                "coDeployRate": round(c_deploy * 100, 1),
                "couplingIndex": coupling_idx
            },
            "phase2": {
                "apiChanges": api_changes,
                "downstreamCount": downstream,
                "blastRadius": blast
            },
            "phase3": {
                "podRestarts": int(f.get("pod_restarts", 0) or 0),
                "cpuSpikePct": round(f.get("cpu_spike_pct", 0) or 0, 1),
                "errorRatePct": round(f.get("error_rate_pct", 0) or 0, 2),
                "maxCallDepth": int(f.get("max_call_depth", 1) or 1),
                "syncCallCount": int(f.get("sync_call_count", 0) or 0)
            },
            "cscore": r["cscore"],
            "status": "Passed" if is_passed else "Blocked",
            "time": r["created_at"]
        }
        formatted_runs.append(item)
        
    for item in reversed(formatted_runs[:8]):
        time_lbl = item["time"].split(" ")[1][:5] if " " in item["time"] else item["time"]
        timeline.append({
            "name": time_lbl,
            "cscore": item["cscore"],
            "coupling": round(item["phase1"]["couplingIndex"] * 100, 1),
            "blast": item["phase2"]["blastRadius"] * 10,
            "restarts": item["phase3"]["podRestarts"]
        })

    p3_dashboard = get_phase3_dashboard()
    
    total_count = len(formatted_runs)
    pass_rate = round((total_passed / total_count) * 100) if total_count > 0 else 100
    avg_coupling = round(total_coupling / total_count, 3) if total_count > 0 else 0
    avg_blast = round(total_blast / total_count, 1) if total_count > 0 else 0

    return {
        "summary": {
            "totalEvaluations": total_count,
            "passRate": pass_rate,
            "avgCouplingIndex": avg_coupling,
            "avgBlastRadius": avg_blast,
            "runtimeRestarts": p3_dashboard["summary"]["totalPodRestarts"],
            "runtimeCpu": p3_dashboard["summary"]["avgCpuSpike"],
            "runtimeStatus": p3_dashboard["summary"]["overallRuntimeStatus"]
        },
        "runs": formatted_runs,
        "timeline": timeline
    }
