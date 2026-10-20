import os
import time
import urllib.request
import urllib.parse
import urllib.error
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import numpy as np
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

# Sliding window of incoming JMeter HTTP request timestamps & measured latencies per service
request_windows: Dict[str, List[float]] = {}
traffic_sample_windows: Dict[str, List[Dict[str, Any]]] = {}

# Short-lived cache (1.5s TTL) for live collector snapshots during high-RPS JMeter runs
collector_snapshot_cache: Dict[str, Dict[str, Any]] = {}
SNAPSHOT_CACHE_TTL_SEC = 1.5

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

SERVICE_PORT_HINTS: Dict[str, int] = {
    "api-gateway": 3000,
    "gateway-1": 3000,
    "order-service": 3001,
    "order-service-1": 3001,
    "user-service": 3002,
    "user-service-1": 3002,
    "book-service": 3003,
    "book-service-1": 3003,
    "payment-service": 3004,
    "inventory-service": 3005,
}


class InferenceRequest(BaseModel):
    service_id: str
    feature_vector: List[float]  # [cpu_norm, memory_norm, p95_latency_norm, error_rate]
    pod_uptime_sec: Optional[float] = 120.0


def _probe_target_service(service_id: str, forward_path: str = "/") -> Optional[Dict[str, Any]]:
    """
    Forwards the incoming JMeter request to the actual microservice container if reachable,
    measuring real round-trip latency (ms) and HTTP error status.
    """
    port = SERVICE_PORT_HINTS.get(service_id)
    candidate_urls: List[str] = []
    clean_host = service_id.removesuffix("-1")
    if port:
        candidate_urls.extend([
            f"http://{clean_host}:{port}{forward_path}",
            f"http://host.docker.internal:{port}{forward_path}",
            f"http://localhost:{port}{forward_path}",
        ])
    else:
        candidate_urls.append(f"http://{clean_host}{forward_path}")

    for url in candidate_urls:
        start_t = time.perf_counter()
        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=0.6) as resp:
                resp.read()
                latency_ms = max(0.1, (time.perf_counter() - start_t) * 1000.0)
                is_error = resp.status >= 500
                return {"latency_ms": round(latency_ms, 2), "is_error": is_error}
        except urllib.error.HTTPError as http_err:
            latency_ms = max(0.1, (time.perf_counter() - start_t) * 1000.0)
            # 4xx means the container responded; 5xx is a server error
            return {"latency_ms": round(latency_ms, 2), "is_error": http_err.code >= 500}
        except Exception:
            continue
    return None


def _get_live_service_snapshot(service_id: str, now: float) -> Dict[str, Any]:
    """
    Fetches real container metrics (CPU, Memory, P95 Latency, Loki Errors, K8s Uptime)
    from the Telemetry Collector with a 1.5s TTL cache to prevent socket exhaustion under JMeter load.
    """
    cached = collector_snapshot_cache.get(service_id)
    if cached and (now - cached["fetched_at"]) < SNAPSHOT_CACHE_TTL_SEC:
        return cached["snapshot"]

    encoded = urllib.parse.quote(service_id)
    snap_resp = pipeline_engine._fetch_json(f"/api/telemetry/snapshot?services={encoded}", timeout=1.5)
    snapshots = (snap_resp or {}).get("snapshots") or []

    target_snap: Dict[str, Any] = {}
    for s in snapshots:
        if s.get("serviceId") == service_id:
            target_snap = s
            break
    if not target_snap and snapshots:
        target_snap = snapshots[0]

    if target_snap:
        pipeline_engine.ingest_live_snapshot(target_snap)
        collector_snapshot_cache[service_id] = {"snapshot": target_snap, "fetched_at": now}

    return target_snap


def record_live_traffic(
    service_id: str,
    uptime_sec: float = 120.0,
    forward_path: str = "/",
) -> Dict[str, Any]:
    now = time.time()
    cutoff = now - 5.0

    # 1. Maintain sliding window of request timestamps for real RPS
    window = request_windows.setdefault(service_id, [])
    window.append(now)
    window[:] = [t for t in window if t >= cutoff]
    observed_rps = len(window) / 5.0

    # 2. Forward probe to target microservice (if reachable) to measure real request latency & errors
    probe_result = _probe_target_service(service_id, forward_path)
    sample_win = traffic_sample_windows.setdefault(service_id, [])
    if probe_result is not None:
        sample_win.append({
            "ts": now,
            "latency_ms": probe_result["latency_ms"],
            "is_error": probe_result["is_error"],
        })
    sample_win[:] = [s for s in sample_win if s["ts"] >= cutoff]

    # 3. Fetch real CPU, Memory, P95 Latency, Error Count & Uptime from Telemetry Collector
    snap = _get_live_service_snapshot(service_id, now)
    prom = snap.get("prometheus") or {}
    loki = snap.get("loki") or {}
    k8s = snap.get("k8s") or {}

    raw_cpu_m = float(prom.get("cpuUsageMillicores") or 0.0)
    raw_mem_mb = float(prom.get("memoryUsageMB") or 0.0)
    collector_p95_ms = float(prom.get("p95LatencyMs") or prom.get("avgResponseTimeMs") or 0.0)
    collector_rps = float(prom.get("rps") or 0.0)

    # Compute P95 latency from real measured traffic samples if available, else collector P95
    if sample_win:
        latencies = [float(s["latency_ms"]) for s in sample_win]
        window_p95_ms = float(np.percentile(latencies, 95))
        effective_p95_ms = max(window_p95_ms, collector_p95_ms)
        window_err_rate = sum(1 for s in sample_win if s["is_error"]) / len(sample_win)
    else:
        effective_p95_ms = collector_p95_ms
        window_err_rate = 0.0

    loki_err_count = int(loki.get("errorCount") or 0)
    loki_total_count = int(loki.get("totalCount") or 0)
    if loki_total_count > 0:
        loki_err_rate = loki_err_count / loki_total_count
    else:
        loki_err_rate = min(1.0, loki_err_count / 10.0)

    effective_err_rate = max(window_err_rate, loki_err_rate)
    effective_rps = max(observed_rps, collector_rps)

    real_uptime = float(k8s.get("uptimeSeconds") or 0.0)
    effective_uptime = real_uptime if real_uptime > 0 else uptime_sec

    # 4. Normalize real metrics to [0, 1] using standard collector bounds (matching pscore_engine)
    cpu_norm = round(min(1.0, max(0.0, raw_cpu_m / 1000.0)), 3)
    mem_norm = round(min(1.0, max(0.0, raw_mem_mb / 512.0)), 3)
    lat_norm = round(min(1.0, max(0.0, effective_p95_ms / 200.0)), 3)
    err_rate = round(min(1.0, max(0.0, effective_err_rate)), 3)

    feature_vector = [cpu_norm, mem_norm, lat_norm, err_rate]
    result = detector.predict(feature_vector, effective_uptime)
    result["service_id"] = service_id
    result["live_rps"] = round(effective_rps, 2)
    result["raw_metrics"] = {
        "cpuUsageMillicores": round(raw_cpu_m, 2),
        "memoryUsageMB": round(raw_mem_mb, 2),
        "p95LatencyMs": round(effective_p95_ms, 2),
        "errorRate": err_rate,
    }

    latest_telemetry[service_id] = {
        "service_id": service_id,
        "feature_vector": feature_vector,
        "pod_uptime_sec": effective_uptime,
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
    forward_path = f"/api/v1/{resource}/{item_id}" if item_id else f"/api/v1/{resource}"
    return record_live_traffic(service_id, uptime, forward_path=forward_path)


@app.get("/latest/{service_id}")
def get_latest_service_telemetry(service_id: str):
    now = time.time()
    entry = latest_telemetry.get(service_id)
    if entry:
        age = now - entry.get("updated_at", now)
        if entry.get("source") == "traffic" and age > 12.0:
            request_windows[service_id] = []
            traffic_sample_windows[service_id] = []
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
    ),
    w_drift: float = Query(0.40, description="AHP weight for Historical Latency Drift"),
    w_fanout: float = Query(0.40, description="AHP weight for Call-Tree Fan-Out"),
    w_anomaly: float = Query(0.20, description="AHP weight for ML Anomaly"),
):
    """
    Phase 4 & 5 Python Composite P-Score, AHP Validator, Apdex & Context-Aware Recommendation Engine:
    Computes P-Score = 100 * (1 - (w_drift*Drift + w_fanout*FanOut + w_anomaly*Anomaly)),
    validates AHP Consistency Ratio (CR < 0.10), computes Apdex & Tail-Latency ratio,
    and generates closed-loop remediation projections.
    """
    req_list = (
        [s.strip() for s in services.split(",") if s.strip()] if services else None
    )
    custom_weights = {"drift": w_drift, "fanout": w_fanout, "anomaly": w_anomaly}
    return pscore_engine.evaluate_cluster_pscore(
        req_list, latest_telemetry, custom_weights
    )
