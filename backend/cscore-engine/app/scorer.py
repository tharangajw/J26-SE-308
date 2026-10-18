"""The Brain: loads the XGBoost model and turns 10 features into a C-Score (0-100)."""
import joblib
import numpy as np

from app.config import MODEL_PATH, SCALER_PATH, FEATURE_NAMES, THRESHOLD

_model = joblib.load(MODEL_PATH)
_scaler = joblib.load(SCALER_PATH)


def predict_cscore(features: dict) -> dict:
    """features: dict with the 10 feature names (missing ones default to 0)."""
    row = [float(features.get(name, 0) or 0) for name in FEATURE_NAMES]
    scaled = _scaler.transform(np.array([row]))
    probability = float(_model.predict_proba(scaled)[0][1])  # prob. of high risk
    
    # --- Guardrail: Research Proposal Constraint ---
    # If Phase 1 detects highly tight coupling, force abort (override ML)
    c_freq = features.get("commit_freq", 0)
    c_deploy = features.get("co_deploy_rate", 0)
    coupling_index = 0.5 * min(c_freq / 24, 1.0) + 0.5 * c_deploy
    
    if coupling_index > 0.5:
        probability = max(probability, 0.95)  # Force C-Score to 95.0
        
    # --- Guardrail: Phase 2 Blast Radius Constraint ---
    # Breaking API changes affecting downstream consumer services must abort
    api_changes = features.get("api_changes", 0) or 0
    downstream_count = features.get("downstream_count", 0) or 0
    blast_radius = api_changes * downstream_count
    if blast_radius > 0:
        probability = max(probability, 0.98)  # Force C-Score to 98.0
    # -----------------------------------------------

    cscore = round(probability * 100, 2)
    high_risk = cscore >= THRESHOLD
    return {
        "cscore": cscore,
        "threshold": THRESHOLD,
        "decision": "HIGH_RISK" if high_risk else "LOW_RISK",
        "features": dict(zip(FEATURE_NAMES, row)),
    }
