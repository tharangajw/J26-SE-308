import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.calculations import calculate_observability
from app.ai import analyze
from app.models import AIAnalysisRequest
from app.telemetry import collect_telemetry

app = FastAPI(title="Observability Calculation Engine")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

history: list[dict] = []


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "observability-engine"}


@app.get("/api/observability/telemetry")
def telemetry() -> dict:
    snapshot = collect_telemetry()
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
def ai_providers() -> dict:
    return {
        "gemini": {"configured": bool(os.getenv("GEMINI_API_KEY")), "model": os.getenv("GEMINI_MODEL", "gemini-2.0-flash")},
        "claude": {"configured": bool(os.getenv("ANTHROPIC_API_KEY")), "model": os.getenv("CLAUDE_MODEL", "claude-3-5-sonnet-latest")},
    }


@app.post("/api/observability/ai/analyze")
def ai_analyze(request: AIAnalysisRequest) -> dict:
    if request.provider not in {"gemini", "claude"}:
        return {"error": "provider must be gemini or claude"}
    return analyze(request.provider, request.snapshot)
