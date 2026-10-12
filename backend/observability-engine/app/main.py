from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.calculations import calculate_observability
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
