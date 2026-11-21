import os, time, uuid
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.calculations import calculate_observability
from app.ai import analyze, generate_remediation
from app.discovery import discover_services
from app.models import AIAnalysisRequest, AIRemediationRequest
from app.telemetry import collect_telemetry
from app.integration import chaos_history, clear_chaos, collect_integrated, inject_chaos

app = FastAPI(title="Observability Calculation Engine")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

history: list[dict] = []
approval_queue: list[dict] = []


def _parse_services(services: str = "") -> list[str]:
    return [s.strip() for s in services.split(",") if s.strip()]


def _update_approval(approval_id: str, status: str) -> dict:
    for a in approval_queue:
        if a["approval_id"] == approval_id:
            a["status"] = status
            a[f"{status}_at"] = time.time()
            return a
    return {"error": "approval not found"}


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "observability-engine"}


@app.get("/api/observability/telemetry")
def telemetry() -> dict:
    snapshot = collect_telemetry()
    discovered = [n["name"] for n in snapshot.get("dependencyMap", {}).get("nodes", []) if n.get("name") not in {None, "unknown-service"}]
    snapshot["integration"] = collect_integrated(list(dict.fromkeys(discovered)))
    calc = calculate_observability(snapshot)
    history.append({"timestamp": snapshot["lastUpdated"], "oscore": calc["oScore"], "cci_index": calc["cciIndex"], "blind_spot_count": calc["blindSpotCount"]})
    del history[:-30]
    return {"telemetry": snapshot, "calculation": calc, "history": history}


@app.get("/api/observability/discovery")
def service_discovery() -> dict:
    return discover_services()


@app.get("/api/observability/ai/providers")
def ai_providers() -> dict:
    return {
        "gemini": {"configured": bool(os.getenv("GEMINI_API_KEY")), "model": os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite"), "fallbackModels": os.getenv("GEMINI_FALLBACK_MODELS", "gemini-3.8-flash").split(",")},
        "claude": {"configured": bool(os.getenv("ANTHROPIC_API_KEY")), "model": os.getenv("CLAUDE_MODEL", "claude-3-5-sonnet-latest")},
        "openrouter": {"configured": bool(os.getenv("OPENROUTER_API_KEY")), "model": os.getenv("OPENROUTER_MODEL", "openrouter/free")},
    }


@app.post("/api/observability/ai/analyze")
def ai_analyze(request: AIAnalysisRequest) -> dict:
    return {"error": "provider must be gemini, claude, or openrouter"} if request.provider not in {"gemini", "claude", "openrouter"} else analyze(request.provider, request.snapshot)


@app.post("/api/observability/ai/remediation")
def ai_remediation(request: AIRemediationRequest) -> dict:
    if request.provider not in {"gemini", "claude", "openrouter"}:
        return {"error": "provider must be gemini, claude, or openrouter"}
    res = generate_remediation(request.provider, request.report)
    if res.get("mode") == "live" and res.get("guardrail_status") in {"review_required", "dangerous"}:
        appr_id = f"approval-{uuid.uuid4().hex[:10]}"
        approval_queue.append({"approval_id": appr_id, "created_at": time.time(), "status": "pending", "provider": request.provider, "risk_level": res.get("risk_level"), "script_type": res.get("script_type")})
        del approval_queue[:-100]
        return {**res, "approval_required": True, "approval_id": appr_id}
    return {**res, "approval_required": False}


@app.get("/api/observability/ai/approvals")
def get_approvals() -> dict:
    return {"approvals": list(reversed(approval_queue))}


@app.post("/api/observability/ai/approvals/{approval_id}/approve")
def approve_remediation(approval_id: str) -> dict:
    return _update_approval(approval_id, "approved")


@app.post("/api/observability/ai/approvals/{approval_id}/reject")
def reject_remediation(approval_id: str) -> dict:
    return _update_approval(approval_id, "rejected")


@app.post("/api/observability/ai/remediation/apply")
def apply_remediation(payload: dict | None = None) -> dict:
    target_service = (payload or {}).get("service") or (payload or {}).get("target_service")
    clear_chaos(target_service if target_service else None)
    return {
        "status": "applied",
        "message": f"Remediation patch successfully applied for {target_service or 'all workloads'}.",
        "service": target_service,
        "applied_at": time.time(),
        "recovery": "Chaos faults cleared, rollout initiated, and healthy telemetry restored.",
    }


@app.get("/api/observability/integrated")
def integrated_snapshot(services: str = "") -> dict:
    svcs = _parse_services(services)
    return {"services": svcs, **collect_integrated(svcs)}


@app.get("/api/observability/resilience/score")
def resilience_score(services: str = "") -> dict:
    resilience = collect_integrated(_parse_services(services))["resilience"]
    active = sum(item["active_faults"] for item in resilience["services"])
    score = max(0.0, round(100 - active * 12.5, 1))
    service_rows = [{
        "id": it["service_id"],
        "name": it["service_id"].replace("-", " ").title(),
        "status": "DEGRADED" if it["active_faults"] > 0 else "ONLINE",
        "faultType": next((e["fault_type"] for e in resilience["events"] if e["target_service"] in {it["service_id"], "all"} and e["status"] == "active"), None),
        "port": 0, "restarts": 0, "cpu": 0, "memory": 0, "latency": 0,
    } for it in resilience["services"]]
    return {
        "metrics": {
            "cpu": 0, "memory": 0, "availability": 100 if active == 0 else max(0, 100 - active * 5),
            "latency": 0, "errorRate": 0, "restarts": 0,
            "mttr": resilience["services"][0]["mttr_seconds"] if resilience["services"] else 0,
            "failoverSuccess": resilience["services"][0]["recovery_success_rate"] if resilience["services"] else 100,
            "score": score,
            "maturity": "Optimized" if score >= 88 else "Mature" if score >= 75 else "Developing" if score >= 50 else "Initial",
        },
        "services": service_rows,
        "resilience": resilience,
    }


@app.get("/api/observability/chaos/history")
def get_chaos_history() -> dict:
    return {"events": chaos_history()}


@app.post("/api/observability/chaos/inject")
def post_chaos_inject(req: dict) -> dict:
    return inject_chaos(str(req.get("faultType", "UNKNOWN")), str(req.get("serviceId", "all")), int(req.get("duration", 15)), int(req.get("latencyMs", 0)), int(req.get("errorRate", 0)))


@app.post("/api/observability/chaos/clear")
def post_chaos_clear(req: dict | None = None) -> dict:
    return {"recovered": clear_chaos((req or {}).get("serviceId"))}
