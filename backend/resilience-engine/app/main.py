from fastapi import FastAPI, HTTPException
from fastapi import Header
import hmac
import os

from app.calculations import evaluate_resilience
from app.kubernetes_client import (
    KubernetesConnectionError,
    clear_chaos_experiments,
    create_chaos_experiment,
    get_chaos_targets,
    get_cluster_snapshot,
)
from app.models import ResilienceMetrics

app = FastAPI(title="Resilience Calculation Engine", version="1.0.0")
CHAOS_CONTROL_TOKEN = os.getenv("CHAOS_CONTROL_TOKEN", "")


def require_chaos_token(token: str | None) -> None:
    if not CHAOS_CONTROL_TOKEN or not token or not hmac.compare_digest(token, CHAOS_CONTROL_TOKEN):
        raise HTTPException(status_code=403, detail="Chaos control token is missing or invalid.")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "resilience-engine"}


@app.post("/api/resilience/evaluate")
def evaluate(metrics: ResilienceMetrics) -> dict:
    return evaluate_resilience(metrics)


@app.get("/api/kubernetes/snapshot")
def kubernetes_snapshot() -> dict:
    return get_cluster_snapshot()


@app.get("/api/chaos/targets")
def chaos_targets() -> dict:
    return get_chaos_targets()


@app.post("/api/chaos/experiments")
def create_experiment(payload: dict, x_chaos_token: str | None = Header(default=None)) -> dict:
    require_chaos_token(x_chaos_token)
    try:
        return create_chaos_experiment(payload)
    except KubernetesConnectionError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.delete("/api/chaos/experiments")
def clear_experiments(x_chaos_token: str | None = Header(default=None)) -> dict:
    require_chaos_token(x_chaos_token)
    try:
        return clear_chaos_experiments()
    except KubernetesConnectionError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
