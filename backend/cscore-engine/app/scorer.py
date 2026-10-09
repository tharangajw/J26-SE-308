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
    cscore = round(probability * 100, 2)
    high_risk = cscore >= THRESHOLD
    return {
        "cscore": cscore,
        "threshold": THRESHOLD,
        "decision": "HIGH_RISK" if high_risk else "LOW_RISK",
        "features": dict(zip(FEATURE_NAMES, row)),
    }
