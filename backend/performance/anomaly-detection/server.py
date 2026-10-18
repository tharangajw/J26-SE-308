import os
import time
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from isolation_forest import AnomalyDetectionService
from pipeline_engine import LiveTelemetryPipelineEngine
from pscore_engine import PScoreAndRecommendationEngine

app = FastAPI(
    title="Python Performance Efficiency Engine (ML Anomaly, Pandas Pipeline & Composite P-Score)",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

COLLECTOR_URL = os.environ.get("COLLECTOR_URL", "http://telemetry-collector:8787")

detector = AnomalyDetectionService()
pipeline_engine = LiveTelemetryPipelineEngine(collector_url=COLLECTOR_URL)
pscore_engine = PScoreAndRecommendationEngine(detector=detector, collector_url=COLLECTOR_URL)

# Stores the most recent live telemetry vector pushed for each service (from JMeter or /predict)
latest_telemetry: Dict[str, Dict[str, Any]] = {}

# Sliding window of incoming JMeter HTTP request timestamps per service
request_windows: Dict[str, List[float]] = {}

ENDPOINT_SERVICE_MAP = {
    "orders": "order-service",
    "order-service": "order-service",
    "order-service-1": "order-service-1",
    "payments": "payment-service",
    "payment-service": "payment-service",
    "users": "user-service-1",
    "user-service": "user-service-1",
    "user-service-1": "user-service-1",
    "books": "book-service-1",
    "book-service": "book-service-1",
    "book-service-1": "book-service-1",
    "gateway": "gateway-1",
    "gateway-1": "gateway-1",
    "api-gateway": "api-gateway",
    "inventory": "inventory-service",
    "inventory-service": "inventory-service",
}


class InferenceRequest(BaseModel):
    service_id: str
    feature_vector: List[float]  # [cpu_norm, memory_norm, p95_latency_norm, error_rate]
    pod_uptime_sec: Optional[float] = 120.0


def record_live_traffic(service_id: str, uptime_sec: float = 120.0) -> Dict[str, Any]:
    now = time.time()
    window = request_windows.setdefault(service_id, [])
    window.append(now)
    cutoff = now - 5.0
    window[:] = [t for t in window if t >= cutoff]

    rps = len(window) / 5.0

    if rps < 2.0:
        cpu_norm = round(min(0.35, 0.18 + rps * 0.04), 3)
        mem_norm = round(min(0.35, 0.24 + rps * 0.03), 3)
        lat_norm = round(min(0.30, 0.12 + rps * 0.04), 3)
        err_rate = 0.0
    elif rps < 6.0:
        factor = (rps - 2.0) / 4.0
        cpu_norm = round(0.35 + factor * 0.40, 3)
        mem_norm = round(0.35 + factor * 0.38, 3)
        lat_norm = round(0.30 + factor * 0.42, 3)
        err_rate = round(factor * 0.10, 3)
    else:
        overload = min(1.0, (rps - 6.0) / 15.0)
        cpu_norm = round(min(1.0, 0.82 + overload * 0.17), 3)
        mem_norm = round(min(1.0, 0.80 + overload * 0.16), 3)
        lat_norm = round(min(1.0, 0.78 + overload * 0.20), 3)
        err_rate = round(min(1.0, 0.15 + overload * 0.25), 3)

    feature_vector = [cpu_norm, mem_norm, lat_norm, err_rate]
    result = detector.predict(feature_vector, uptime_sec)
    result["service_id"] = service_id
    result["live_rps"] = round(rps, 1)

    latest_telemetry[service_id] = {
        "service_id": service_id,
        "feature_vector": feature_vector,
        "pod_uptime_sec": uptime_sec,
        "prediction": result,
        "updated_at": now,
        "source": "traffic",
    }
    return result


@app.get("/health")
def health_check():
    return {
        "status": "ONLINE",
        "model_trained": detector.is_trained,
        "engine": "Python 3.11 FastAPI (Isolation Forest + Pandas Pipeline + Composite P-Score)",
    }


@app.post("/predict")
def predict_anomaly(req: InferenceRequest):
    if len(req.feature_vector) != 4:
        raise HTTPException(
            status_code=400, detail="Feature vector must contain exactly 4 normalized values."
        )

    uptime = req.pod_uptime_sec if req.pod_uptime_sec is not None else 120.0
    result = detector.predict(req.feature_vector, uptime)
    result["service_id"] = req.service_id

    latest_telemetry[req.service_id] = {
        "service_id": req.service_id,
        "feature_vector": req.feature_vector,
        "pod_uptime_sec": uptime,
        "prediction": result,
        "updated_at": time.time(),
        "source": "predict",
    }
    return result


@app.get("/api/v1/{resource}")
@app.get("/api/v1/{resource}/{item_id}")
def handle_jmeter_service_traffic(
    resource: str, item_id: Optional[str] = None, uptime: float = 120.0
):
    service_id = ENDPOINT_SERVICE_MAP.get(resource.lower(), resource.lower())
    return record_live_traffic(service_id, uptime)


@app.get("/latest/{service_id}")
def get_latest_service_telemetry(service_id: str):
    now = time.time()
    entry = latest_telemetry.get(service_id)
    if entry:
        age = now - entry.get("updated_at", now)
        if entry.get("source") == "traffic" and age > 12.0:
            request_windows[service_id] = []
            del latest_telemetry[service_id]
        else:
            return entry
    return {"service_id": service_id, "feature_vector": None}


@app.get("/pipeline/process")
def run_python_telemetry_pipeline(
    service_id: str = Query(..., description="Target microservice ID"),
    imputation: str = Query("linear_interpolation", description="Imputation strategy"),
):
    """
    Phase 2 Python Pandas + NumPy Data Pipeline:
    Aligns real container snapshots to a 5-second UTC grid, imputes missing scrape intervals,
    and outputs [0, 1] Min-Max normalized feature vectors.
    """
    return pipeline_engine.process_service_pipeline(service_id, imputation)


@app.get("/pscore/evaluate")
def evaluate_composite_pscore(
    services: Optional[str] = Query(
        None, description="Comma-separated list of services to evaluate"
    )
):
    """
    Phase 4 & 5 Python Composite P-Score & Context-Aware Recommendation Engine:
    Computes P-Score = 100 * (1 - (0.40*Drift + 0.40*FanOut + 0.20*Anomaly)),
    maps to 4 Maturity Tiers, and generates live architectural recommendations.
    """
    req_list = (
        [s.strip() for s in services.split(",") if s.strip()] if services else None
    )
    return pscore_engine.evaluate_cluster_pscore(req_list, latest_telemetry)
