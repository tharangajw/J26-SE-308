from fastapi import FastAPI

from app.calculations import evaluate_resilience
from app.kubernetes_client import get_cluster_snapshot
from app.models import ResilienceMetrics

app = FastAPI(title="Resilience Calculation Engine", version="1.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "resilience-engine"}


@app.post("/api/resilience/evaluate")
def evaluate(metrics: ResilienceMetrics) -> dict:
    return evaluate_resilience(metrics)


@app.get("/api/kubernetes/snapshot")
def kubernetes_snapshot() -> dict:
    return get_cluster_snapshot()
