# Resilience Calculation Engine

Python service that owns the resilience threshold rules, weighted R-Score, and maturity calculation. It also reads Kubernetes pods, deployments, and HPAs through a read-only `kubectl proxy`; the resilience API uses that Python snapshot for the dashboard's Kubernetes connection status and recovery metrics.

The service listens on port `8011` inside Docker. Its endpoints are `GET /health`, `POST /api/resilience/evaluate`, and `GET /api/kubernetes/snapshot`. The connector implementation is `app/kubernetes_client.py`.

For Docker Desktop on Windows, start a proxy in a separate PowerShell window and leave it running:

```powershell
kubectl proxy --address=0.0.0.0 --port=8001 --accept-hosts='^host\.docker\.internal(:[0-9]+)?$,^localhost(:[0-9]+)?$,^127\.0\.0\.1(:[0-9]+)?$'
```

Check the Python connector after starting Compose:

```powershell
Invoke-RestMethod http://localhost:8011/api/kubernetes/snapshot
```

The snapshot reports `connected: true` and pod, restart, deployment, and HPA counts when the connection works. A `403` means the proxy host rules or Kubernetes permissions need attention; `connected: false` includes an error message.

## Chaos Mesh experiments

The dashboard's Chaos Mesh selector discovers running Kubernetes Pods and creates real Chaos Mesh custom resources through the same proxy. Install Chaos Mesh with the `PodChaos`, `NetworkChaos`, and `StressChaos` CRDs, deploy the application into Kubernetes, and grant the kubectl identity permissions to list Pods and create/list/delete those experiment resources. `HTTPChaos` is also required for HTTP 500 experiments. Set the same `CHAOS_CONTROL_TOKEN` in both project `.env` files before using the dashboard.

The current Chaos Mesh mapping supports service outage and pod restart (`PodChaos`), network latency (`NetworkChaos`), CPU/memory stress (`StressChaos`), and HTTP 500 response replacement (`HTTPChaos`). The HTTP 500 percentage selects the percentage of matching Pods affected; it is not a per-request probability. With a single selected Pod, this setting cannot produce an exact HTTP request error rate. HTTP 429 rate limiting and cascading failures remain Docker Compose-only. Use **Clear All Chaos** to delete dashboard-created experiments early; otherwise Chaos Mesh ends duration-based experiments automatically.

Run it with the full application from the repository root:

```powershell
docker compose up --build -d resilience-engine resilience-api frontend
```
