import os
import sys
import time
import signal
import subprocess


def main() -> None:
    os.environ.setdefault("PORT", "8787")
    os.environ.setdefault("COLLECTOR_URL", "http://127.0.0.1:8787")

    print("[pscore-performance-engine] Starting Node.js Telemetry Collector on :8787...")
    node_proc = subprocess.Popen(
        ["node", "/app/telemetry-collector/dist/server.js"],
        cwd="/app/telemetry-collector",
    )

    # Give telemetry-collector a moment to bind port 8787
    time.sleep(1.0)

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

    def handle_sigterm(signum, frame):
        node_proc.terminate()
        py_proc.terminate()
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_sigterm)
    signal.signal(signal.SIGINT, handle_sigterm)

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
