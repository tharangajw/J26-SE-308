import argparse
import json
import random
import time
import urllib.request

ANOMALY_API_URL = "http://localhost:8000/predict"
SERVICES = ["order-service", "payment-service", "api-gateway", "inventory-service"]


def send_inference(service_id: str, feature_vector: list[float], pod_uptime_sec: float) -> dict:
    payload = json.dumps({
        "service_id": service_id,
        "feature_vector": [round(x, 3) for x in feature_vector],
        "pod_uptime_sec": pod_uptime_sec,
    }).encode("utf-8")

    req = urllib.request.Request(
        ANOMALY_API_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read().decode("utf-8"))


def print_result(stage: str, res: dict, vec: list[float], uptime: float):
    if res.get("prefiltered"):
        status = "PREFILTERED (STARTUP)"
    elif res.get("is_anomaly"):
        status = "ANOMALY DETECTED"
    else:
        status = "NORMAL"

    print(
        f"[{stage}] {res['service_id']:<18} | "
        f"Vec={vec} | Uptime={uptime:>5.0f}s | "
        f"Score={res['anomaly_score']:<5.3f} | "
        f"Decision={res.get('decision_function_score', 0.0):>7.4f} | "
        f"Status: {status}"
    )


def run_stage(name: str, mode: str, iterations: int = 4, delay_sec: float = 1.5):
    print(f"\n=== {name} ===")
    for _ in range(iterations):
        for svc in SERVICES:
            if mode == "normal":
                vec = [
                    round(random.uniform(0.15, 0.32), 3),
                    round(random.uniform(0.18, 0.35), 3),
                    round(random.uniform(0.08, 0.22), 3),
                    0.0,
                ]
                uptime = 180.0
            elif mode == "spike":
                vec = [
                    round(random.uniform(0.88, 0.98), 3),
                    round(random.uniform(0.82, 0.95), 3),
                    round(random.uniform(0.80, 0.96), 3),
                    round(random.choice([0.2, 0.3, 0.4]), 3),
                ]
                uptime = 180.0
            elif mode == "startup":
                vec = [
                    round(random.uniform(0.85, 0.95), 3),
                    round(random.uniform(0.75, 0.90), 3),
                    round(random.uniform(0.50, 0.75), 3),
                    0.0,
                ]
                uptime = 35.0
            else:
                vec = [0.2, 0.25, 0.12, 0.0]
                uptime = 180.0

            res = send_inference(svc, vec, uptime)
            print_result(name, res, vec, uptime)
        time.sleep(delay_sec)


def main():
    parser = argparse.ArgumentParser(description="Live Anomaly Detection Load Test Runner (No k6 required)")
    parser.add_argument(
        "--mode",
        choices=["full", "spike", "startup", "normal"],
        default="full",
        help="Scenario to push to http://localhost:8000 ('spike' leaves services in ANOMALY state for UI testing)",
    )
    args = parser.parse_args()

    print("Connecting to FastAPI Anomaly Detection Engine at http://localhost:8000 ...")
    if args.mode == "spike":
        run_stage("200 VU TRAFFIC SPIKE BURST", "spike", iterations=3, delay_sec=1.0)
        print("\n[LIVE] Spike state is now active on port 8000! Click 'Evaluate Live' in http://localhost:5173 to inspect.")
    elif args.mode == "startup":
        run_stage("HPA POD STARTUP (<90s WINDOW)", "startup", iterations=2, delay_sec=1.0)
        print("\n[LIVE] Startup pre-filter state (<90s) is now active! Click 'Evaluate Live' in http://localhost:5173.")
    elif args.mode == "normal":
        run_stage("20 VU BASELINE TRAFFIC", "normal", iterations=2, delay_sec=1.0)
        print("\n[LIVE] Normal baseline state restored! Click 'Evaluate Live' in http://localhost:5173.")
    else:
        run_stage("STAGE 1: 20 VU BASELINE", "normal", iterations=2, delay_sec=1.0)
        run_stage("STAGE 2: 200 VU TRAFFIC SPIKE", "spike", iterations=3, delay_sec=1.5)
        run_stage("STAGE 3: HPA POD SPIN-UP (<90s)", "startup", iterations=2, delay_sec=1.5)
        run_stage("STAGE 4: PEAK SPIKE HOLD (FOR UI CHECK)", "spike", iterations=1, delay_sec=0.5)
        print("\n[DONE] Load test complete! Services are held in ANOMALY SPIKE state so you can click 'Evaluate Live' in http://localhost:5173.")


if __name__ == "__main__":
    main()
