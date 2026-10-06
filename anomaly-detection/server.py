from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from isolation_forest import AnomalyDetectionService

app = FastAPI(title="P-Score Anomaly Detection Service", version="1.0.0")
detector = AnomalyDetectionService()

class InferenceRequest(BaseModel):
    service_id: str
    feature_vector: List[float] # [cpu_norm, memory_norm, p95_latency_norm, error_rate]
    pod_uptime_sec: Optional[float] = 120.0

@app.get("/health")
def health_check():
    return {"status": "ONLINE", "model_trained": detector.is_trained}

@app.post("/predict")
def predict_anomaly(req: InferenceRequest):
    if len(req.feature_vector) != 4:
        raise HTTPException(status_code=400, detail="Feature vector must contain exactly 4 normalized values.")
    
    result = detector.predict(req.feature_vector, req.pod_uptime_sec)
    result["service_id"] = req.service_id
    return result
