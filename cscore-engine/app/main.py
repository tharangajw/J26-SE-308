from fastapi import FastAPI
from pydantic import BaseModel

from app import db
from app.scorer import predict_cscore
from app.webhook import router as webhook_router

app = FastAPI(title="C-Score Engine")
app.include_router(webhook_router)
db.init_db()  # create SQLite tables on startup


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


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/score")
def score(features: Features):
    result = predict_cscore(features.model_dump())
    # Derived values: shown in the PR comment, NOT fed to the model.
    result["blast_radius"] = features.api_changes * features.downstream_count
    return result
