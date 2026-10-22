"""Basic endpoints: health check and manual C-Score scoring."""
from fastapi import APIRouter
from pydantic import BaseModel

from app.ml.scorer import predict_cscore

router = APIRouter()


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


@router.get("/health")
def health():
    return {"status": "ok"}


@router.post("/score")
def score(features: Features):
    result = predict_cscore(features.model_dump())
    result["blast_radius"] = features.api_changes * features.downstream_count
    return result
