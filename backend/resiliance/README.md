# ðŸ›¡ï¸ Real-Time Resilience & Fault Tolerance Sub-Engine (R-Score Backend)

> **Sub-Engine 4:** Real-Time Resilience Assessment, Chaos Validation & Self-Healing Evaluation  
> **Project:** SLIIT IT4010 Research Project 2026 Jul Â· Project ID **J26-SE-308**

---

## ðŸ“Œ Overview

This backend sub-engine continuously tracks, evaluates, and scores microservice operational resilience across **8 primary telemetry variables** in real time. It calculates the composite **R-Score (0â€“100)**, evaluates maturity tiers, benchmarks against targets, records chaos experiments, and monitors Kubernetes self-healing autonomous recovery.

When Prometheus and Kubernetes are running, it queries them directly via live PromQL and the Kubernetes API. When run standalone or during test environments, it streams high-fidelity real-time telemetry matching baseline operational profiles with realistic organic jitter and chaos response.

---

## ðŸ“Š Real-Time Metric Telemetry Mapping

| Variable | Metric Name | Baseline Value | Operational Target | Telemetry Source | PromQL / Live Data Query | Points |
| :---: | :--- | :---: | :---: | :--- | :--- | :---: |
| **A** | **Availability** | **99.86%** | Target >= 99.0% | Prometheus / Istio | `avg_over_time(up[30m]) * 100` or `(sum(rate(http_requests_total{status!~"5.."}[10m])) / sum(rate(http_requests_total[10m]))) * 100` | **12.5** |
| **C** | **CPU Usage** | **21%** | Target < 70% | cAdvisor / Node Exporter | `avg(rate(container_cpu_usage_seconds_total[1m])) * 100` | **12.5** |
| **M** | **Memory Usage** | **43%** | Target < 75% | cAdvisor / Kubelet | `avg(container_memory_working_set_bytes / container_spec_memory_limit_bytes) * 100` | **12.5** |
| **E** | **Error Rate** | **0.18%** | Target < 1.0% | Prometheus / Envoy | `(sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))) * 100` | **12.5** |
| **R** | **Pod Restarts** | **0** | Target < 2 restarts | Kubernetes / kube-state | `sum(kube_pod_container_status_restarts_total)` or pod status container restart counts | **12.5** |
| **T** | **MTTR** | **12s** | Target <= 15s | Chaos / K8s Events | `recoveryTimestamp - failureDetectionTimestamp` | **12.5** |
| **L** | **Response Time** | **26 ms** | Target < 50ms | Prometheus / Jaeger | `(sum(rate(http_request_duration_seconds_sum[5m])) / sum(rate(http_request_duration_seconds_count[5m]))) * 1000` | **12.5** |
| **F** | **Failover Success** | **100%** | Target >= 100% | Kubernetes Deployment API | `(sum(kube_deployment_status_replicas_ready) / sum(kube_deployment_spec_replicas)) * 100` | **12.5** |

### ðŸ§® R-Score Formula

$$R\text{-Score} = 12.5A + 12.5C + 12.5M + 12.5E + 12.5R + 12.5T + 12.5L + 12.5F = 100/100$$

- **Result**: **100 / 100**
- **Maturity Level**: **ðŸŸ¢ Optimized** (Level 4)

---

## ðŸš€ Getting Started

### Prerequisites
- Docker Compose (recommended)
- Node.js `v22+` or `v24+` and Python 3.12+ for local development

### Running the Backend

R-Score calculation is provided by the Python service in `backend/resilience-engine`. Start both services locally, or use Docker Compose. Set `GEMINI_API_KEY` to enable Gemini insights. Optionally set `GEMINI_MODEL` (defaults to `gemini-3.8-flash`). To use OpenRouter when Gemini is unavailable, also set `OPENROUTER_API_KEY` and optionally `OPENROUTER_MODEL` (defaults to `openai/gpt-4o-mini`). Gemini and OpenRouter insight timeouts default to 7 and 10 seconds; set `GEMINI_INSIGHTS_TIMEOUT_MS` and `OPENROUTER_INSIGHTS_TIMEOUT_MS` to adjust them. Keep both keys out of frontend environment variables and source control.

```bash
cd backend/resiliance
# PowerShell: $env:GEMINI_API_KEY = "your-key"
# Optional fallback: $env:OPENROUTER_API_KEY = "your-key"
# Optional model: $env:OPENROUTER_MODEL = "openai/gpt-4o-mini"
npm start
```

In another terminal, start the Python calculator from `backend/resilience-engine` with `uvicorn app.main:app --host 0.0.0.0 --port 8011`.

With Docker Compose, set `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, and optionally `OPENROUTER_MODEL` in the repository-root `.env` file, then rebuild the resilience service:

```bash
docker compose up --build -d resilience-api
```

The service runs on **`http://localhost:3010`**.

---

## ðŸ“¡ API Endpoints

### 1. `GET /api/resilience/score`
Fetches the current real-time R-score, metric values, 8-variable rule evaluations, per-service health, and self-healing stats.
*Used directly by `frontend/src/components/resilience/FaultToleranceDashboard.tsx`.*

### 2. `POST /api/chaos/inject`
Injects live chaos experiments into the cluster:
```json
{
  "serviceId": "gateway",
  "faultType": "HIGH_CPU",
  "duration": 30,
  "latencyMs": 2500,
  "errorRate": 35.0
}
```

### 3. `POST /api/chaos/clear`
Clears all active chaos experiments and triggers automated self-healing back to healthy baseline metrics.

### 4. `POST /api/resilience/heal`
Heals an individual microservice (`{ "serviceId": "gateway" }`).

### 5. `GET /api/resilience/history`
Retrieves historical evaluation snapshots for trend charts.

### 6. `GET /health`
Health check endpoint.

### 7. `POST /api/resilience/insights`
Collects a fresh resilience-engine snapshot and asks Gemini for up to five structured recommendations. Returns `503` if `GEMINI_API_KEY` is missing. The dashboard calls this endpoint only when AI Insights is opened or refreshed.

### R-Score history storage

The history sampler records a telemetry snapshot every five seconds and persists snapshots as JSON Lines in backend/resiliance/data/resilience-history.jsonl. This file is local runtime data and is ignored by Git. The history is retained across backend restarts.

### Chaos experiment results

`GET /api/resilience/chaos-history` returns persisted injection settings and measured before/during/after R-Score, availability, latency, error rate, and recovery data. Experiment records are saved in backend/resiliance/data/chaos-experiment-history.json.
