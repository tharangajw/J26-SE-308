import time
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from isolation_forest import AnomalyDetectionService

app = FastAPI(title="P-Score Anomaly Detection Service", version="1.0.0")
detector = AnomalyDetectionService()

# Stores the most recent live telemetry vector pushed for each service (from JMeter or /predict)
latest_telemetry: Dict[str, Dict[str, Any]] = {}

# Sliding window of incoming JMeter HTTP request timestamps per service
request_windows: Dict[str, List[float]] = {
    "order-service": [],
    "payment-service": [],
    "api-gateway": [],
    "inventory-service": [],
}

ENDPOINT_SERVICE_MAP = {
    "orders": "order-service",
    "order-service": "order-service",
    "payments": "payment-service",
    "payment-service": "payment-service",
    "users": "api-gateway",
    "gateway": "api-gateway",
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
    # Keep requests within the last 5 seconds
    cutoff = now - 5.0
    window[:] = [t for t in window if t >= cutoff]

    rps = len(window) / 5.0

    # Convert live JMeter RPS into normalized [CPU, Memory, P95 Latency, Error Rate]
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
        # High JMeter concurrency / traffic burst -> Anomaly spike
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
    return {"status": "ONLINE", "model_trained": detector.is_trained}


@app.post("/predict")
def predict_anomaly(req: InferenceRequest):
    if len(req.feature_vector) != 4:
        raise HTTPException(status_code=400, detail="Feature vector must contain exactly 4 normalized values.")

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
def handle_jmeter_service_traffic(resource: str, item_id: Optional[str] = None, uptime: float = 120.0):
    """
    Receives live HTTP load test traffic from Apache JMeter / k6 (e.g. /api/v1/orders)
    and dynamically calculates real-time RPS, resource saturation, and Isolation Forest anomaly status.
    """
    service_id = ENDPOINT_SERVICE_MAP.get(resource.lower(), "order-service")
    return record_live_traffic(service_id, uptime)


@app.get("/latest/{service_id}")
def get_latest_service_telemetry(service_id: str):
    now = time.time()
    entry = latest_telemetry.get(service_id)
    if entry:
        age = now - entry.get("updated_at", now)
        # If traffic source stopped > 12s ago, clear traffic window and return to normal baseline
        if entry.get("source") == "traffic" and age > 12.0:
            request_windows[service_id] = []
            del latest_telemetry[service_id]
        else:
            return entry
    return {"service_id": service_id, "feature_vector": None}
