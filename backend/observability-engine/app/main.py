import os
import time
import uuid

# FastAPI routes expose live telemetry, scoring, RCA, and guarded remediation APIs.

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.calculations import calculate_observability
from app.ai import analyze, generate_remediation
from app.models import AIAnalysisRequest, AIRemediationRequest
from app.telemetry import collect_telemetry
from app.integration import (
    chaos_history,
    clear_chaos,
    collect_integrated,
    inject_chaos,
)

app = FastAPI(title="Observability Calculation Engine")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

history: list[dict] = []
approval_queue: list[dict] = []


@app.get("/health")
# Lightweight liveness endpoint for container and proxy health checks.
def health() -> dict:
    return {"status": "ok", "service": "observability-engine"}


@app.get("/api/observability/telemetry")
# Collect one live snapshot, calculate scores, and append bounded history.
def telemetry() -> dict:
    snapshot = collect_telemetry()
    snapshot["integration"] = collect_integrated(
        ["api-gateway", "order-service", "payment-service"]
    )
    calculation = calculate_observability(snapshot)
    history.append({
        "timestamp": snapshot["lastUpdated"],
        "oscore": calculation["oScore"],
        "cci_index": calculation["cciIndex"],
        "blind_spot_count": calculation["blindSpotCount"],
    })
    del history[:-30]
    return {"telemetry": snapshot, "calculation": calculation, "history": history}


@app.get("/api/observability/ai/providers")
# Report provider configuration without exposing API keys.
def ai_providers() -> dict:
    return {
        "gemini": {"configured": bool(os.getenv("GEMINI_API_KEY")), "model": os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite"), "fallbackModels": os.getenv("GEMINI_FALLBACK_MODELS", "gemini-3.8-flash").split(",")},
        "claude": {"configured": bool(os.getenv("ANTHROPIC_API_KEY")), "model": os.getenv("CLAUDE_MODEL", "claude-3-5-sonnet-latest")},
        "openrouter": {"configured": bool(os.getenv("OPENROUTER_API_KEY")), "model": os.getenv("OPENROUTER_MODEL", "openrouter/free")},
    }


@app.post("/api/observability/ai/analyze")
# Run provider-backed RCA against the supplied telemetry snapshot.
def ai_analyze(request: AIAnalysisRequest) -> dict:
    if request.provider not in {"gemini", "claude", "openrouter"}:
        return {"error": "provider must be gemini, claude, or openrouter"}
    return analyze(request.provider, request.snapshot)


@app.post("/api/observability/ai/remediation")
# Generate a guarded remediation patch and queue risky live results for review.
def ai_remediation(request: AIRemediationRequest) -> dict:
    if request.provider not in {"gemini", "claude", "openrouter"}:
        return {"error": "provider must be gemini, claude, or openrouter"}
    result = generate_remediation(request.provider, request.report)
    if result.get("mode") == "live" and result.get("guardrail_status") in {"review_required", "dangerous"}:
        approval = {
            "approval_id": f"approval-{uuid.uuid4().hex[:10]}",
            "created_at": time.time(),
            "status": "pending",
            "provider": request.provider,
            "risk_level": result.get("risk_level"),
            "script_type": result.get("script_type"),
        }
        approval_queue.append(approval)
        del approval_queue[:-100]
        result = {**result, "approval_required": True, "approval_id": approval["approval_id"]}
    else:
        result = {**result, "approval_required": False}
    return result


@app.get("/api/observability/ai/approvals")
# List pending and completed remediation approval records.
def get_approvals() -> dict:
    return {"approvals": list(reversed(approval_queue))}


@app.post("/api/observability/ai/approvals/{approval_id}/approve")
# Mark a remediation approval record as operator-approved.
def approve_remediation(approval_id: str) -> dict:
    for approval in approval_queue:
        if approval["approval_id"] == approval_id:
            approval["status"] = "approved"
            approval["approved_at"] = time.time()
            return approval
    return {"error": "approval not found"}


@app.post("/api/observability/ai/approvals/{approval_id}/reject")
# Mark a remediation approval record as operator-rejected.
def reject_remediation(approval_id: str) -> dict:
    for approval in approval_queue:
        if approval["approval_id"] == approval_id:
            approval["status"] = "rejected"
            approval["rejected_at"] = time.time()
            return approval
    return {"error": "approval not found"}


@app.get("/api/observability/integrated")
# Return integrated performance and resilience data for selected services.
def integrated_snapshot(services: str = "api-gateway,order-service,payment-service") -> dict:
    service_ids = [item.strip() for item in services.split(",") if item.strip()]
    return {"services": service_ids, **collect_integrated(service_ids)}


@app.get("/api/observability/resilience/score")
# Calculate resilience score and service rows from active chaos history.
def resilience_score(services: str = "api-gateway,order-service,payment-service") -> dict:
    service_ids = [item.strip() for item in services.split(",") if item.strip()]
    resilience = collect_integrated(service_ids)["resilience"]
    active = sum(item["active_faults"] for item in resilience["services"])
    score = max(0.0, round(100 - active * 12.5, 1))
    service_rows = []
    for item in resilience["services"]:
        active = item["active_faults"] > 0
        service_rows.append({
            "id": item["service_id"],
            "name": item["service_id"].replace("-", " ").title(),
            "status": "DEGRADED" if active else "ONLINE",
            "faultType": next((event["fault_type"] for event in resilience["events"] if event["target_service"] in {item["service_id"], "all"} and event["status"] == "active"), None),
            "port": 0,
            "restarts": 0,
            "cpu": 0,
            "memory": 0,
            "latency": 0,
        })
    return {
        "metrics": {
            "cpu": 0,
            "memory": 0,
            "availability": 100 if active == 0 else max(0, 100 - active * 5),
            "latency": 0,
            "errorRate": 0,
            "restarts": 0,
            "mttr": resilience["services"][0]["mttr_seconds"] if resilience["services"] else 0,
            "failoverSuccess": resilience["services"][0]["recovery_success_rate"] if resilience["services"] else 100,
            "score": score,
            "maturity": "Optimized" if score >= 88 else "Mature" if score >= 75 else "Developing" if score >= 50 else "Initial",
        },
        "services": service_rows,
        "resilience": resilience,
    }


@app.get("/api/observability/chaos/history")
# Expose chaos experiment history for the observability UI.
def get_chaos_history() -> dict:
    return {"events": chaos_history()}


@app.post("/api/observability/chaos/inject")
# Start a bounded telemetry fault simulation requested by the UI.
def post_chaos_inject(request: dict) -> dict:
    return inject_chaos(
        str(request.get("faultType", "UNKNOWN")),
        str(request.get("serviceId", "all")),
        int(request.get("duration", 15)),
        int(request.get("latencyMs", 0)),
        int(request.get("errorRate", 0)),
    )


@app.post("/api/observability/chaos/clear")
# Recover selected or all active telemetry fault simulations.
def post_chaos_clear(request: dict | None = None) -> dict:
    return {"recovered": clear_chaos((request or {}).get("serviceId"))}
