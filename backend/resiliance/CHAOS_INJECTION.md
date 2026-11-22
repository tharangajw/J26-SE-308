# Docker Compose fault injection

The resilience API can inject HTTP-layer faults into the core product's `gateway`, `book-service`, `user-service`, and `order-service`. Set the same strong random `CHAOS_CONTROL_TOKEN` in both projects' git-ignored `.env` files. The token is passed backend-to-backend and is not exposed to frontend code.

Supported experiments are `SERVICE_DOWN` (HTTP 503), `API_ERROR` (configured share of HTTP 500 responses), `LATENCY` (request delay), `RATE_LIMIT` (HTTP 429), `HIGH_CPU` (one throttled worker thread), `HIGH_MEMORY` (up to 128 MiB allocated by the selected service), and `CASCADING_FAILURE` (fail a Book or User dependency so dependent order requests fail). Resource faults require one online target; cascading faults require `book-service` or `user-service`. Every experiment is limited to 60 seconds, auto-clears, and can be cleared sooner in the dashboard.

After setting the same token in both `.env` files, rebuild the two projects:

```powershell
# In the core product folder
docker compose up --build -d gateway book-service user-service order-service prometheus

# In J26-SE-308
docker compose up --build -d resilience-api frontend
```

The core product's legacy resilience engine is not part of its Compose stack. Its dashboard API is served by this project's resilience API on host port `3010`.
