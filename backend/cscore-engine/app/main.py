"""Entry point: creates the FastAPI app and plugs in all routers.

Run with:  uvicorn app.main:app --reload

Project layout (app/):
  core/      config.py (settings) + db.py (SQLite helpers)
  ml/        scorer.py (XGBoost model -> C-Score)
  phases/    phase1.py (coupling) + phase2.py (blast radius)
  github/    client.py (API auth) + checks.py (check/PR comment) + webhook.py (receiver)
  services/  pipeline.py (runs the full PR analysis) + live_logs.py (in-memory live logs)
  api/       routes.py (health/score) + dashboards.py (dashboard endpoints)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.dashboards import router as dashboards_router
from app.api.routes import router as basic_router
from app.core import db
from app.github.webhook import router as webhook_router

app = FastAPI(title="C-Score Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhook_router)
app.include_router(basic_router)
app.include_router(dashboards_router)
db.init_db()  # create SQLite tables on startup
