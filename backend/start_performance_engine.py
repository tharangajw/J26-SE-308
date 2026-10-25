import os
import sys
import time
import signal
import subprocess


# Supervisor entrypoint for the unified performance container: boots both the Node.js
# Telemetry Collector (port 8787) and Python FastAPI Anomaly/P-Score engine (port 8000).
def main() -> None:
    os.environ.setdefault("PORT", "8787")
    os.environ.setdefault("COLLECTOR_URL", "http://127.0.0.1:8787")

    # Step 1: Launch the Node.js Telemetry Collector daemon as a background subprocess.
    print("[pscore-performance-engine] Starting Node.js Telemetry Collector on :8787...")
    node_proc = subprocess.Popen(
        ["node", "/app/telemetry-collector/dist/server.js"],
        cwd="/app/telemetry-collector",
    )

    # Give telemetry-collector a moment to bind port 8787
    time.sleep(1.0)

    # Step 2: Launch the Python FastAPI Anomaly and P-Score scoring engine under Uvicorn.
    print("[pscore-performance-engine] Starting Python FastAPI Anomaly & P-Score Engine on :8000...")
    py_proc = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "server:app",
            "--host",
            "0.0.0.0",
            "--port",
            "8000",
        ],
        cwd="/app/anomaly-detection",
    )

    # Clean shutdown signal handler to terminate both child processes on SIGTERM/SIGINT.
    def handle_sigterm(signum, frame):
        node_proc.terminate()
        py_proc.terminate()
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_sigterm)
    signal.signal(signal.SIGINT, handle_sigterm)

    # Main health polling loop ensuring that if either process fails, both are cleanly shutdown.
    while True:
        node_rc = node_proc.poll()
        py_rc = py_proc.poll()
        if node_rc is not None:
            print(f"[pscore-performance-engine] Telemetry collector exited with {node_rc}, shutting down...")
            py_proc.terminate()
            sys.exit(node_rc)
        if py_rc is not None:
            print(f"[pscore-performance-engine] Python FastAPI engine exited with {py_rc}, shutting down...")
            node_proc.terminate()
            sys.exit(py_rc)
        time.sleep(2.0)


if __name__ == "__main__":
    main()
