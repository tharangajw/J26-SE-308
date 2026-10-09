"""Central settings. Values can be overridden with environment variables."""
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _load_env_file():
    """Tiny .env reader (KEY=VALUE per line) so we need no extra library."""
    path = os.path.join(BASE_DIR, ".env")
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())


_load_env_file()

MODEL_PATH = os.path.join(BASE_DIR, "models", "xgboost_c_score_model.pkl")
SCALER_PATH = os.path.join(BASE_DIR, "models", "minmax_scaler.pkl")

# GitHub App
GITHUB_APP_ID = os.environ.get("GITHUB_APP_ID", "")
GITHUB_WEBHOOK_SECRET = os.environ.get("GITHUB_WEBHOOK_SECRET", "")
GITHUB_PRIVATE_KEY_PATH = os.path.join(
    BASE_DIR, os.environ.get("GITHUB_PRIVATE_KEY_PATH", "github-app.pem")
)

# C-Score >= THRESHOLD  -> High Risk (pipeline fails)
THRESHOLD = float(os.environ.get("CSCORE_THRESHOLD", 60))

# EXACT order used when the model was trained (Excel columns):
# Commit_Freq, Co_Deploy_Rate, API_Changes, Downstream_Count, Max_Call_Depth,
# Sync_Call_Count, CPU_Spike_%, Mem_Spike_%, Error_Rate_%, Pod_Restarts
FEATURE_NAMES = [
    "commit_freq",       # Phase 1
    "co_deploy_rate",    # Phase 1
    "api_changes",       # Phase 2
    "downstream_count",  # Phase 2
    "max_call_depth",    # Phase 3
    "sync_call_count",   # Phase 3
    "cpu_spike_pct",     # Phase 3
    "mem_spike_pct",     # Phase 3
    "error_rate_pct",    # Phase 3
    "pod_restarts",      # Phase 3
]
