# Observability Engine

Python service for telemetry collection and all Observability calculations.

Run it through Docker from the repository root; Python does not need to be
installed on the host:

```bash
docker compose up --build observability-engine prometheus loki jaeger
```

The API is available at `http://localhost:8010`.

For live AI analysis, add these values to the repository-root `.env` file before
starting the container. Keys stay inside Docker and are never sent to the browser:

```env
GEMINI_API_KEY=your-gemini-key
ANTHROPIC_API_KEY=your-anthropic-key
OPENROUTER_API_KEY=your-openrouter-key
# Optional: Gemini retries this model if the primary model is busy.
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_FALLBACK_MODELS=gemini-3.8-flash
OPENROUTER_MODEL=openrouter/free
```

Without a key, analysis/remediation reports the provider configuration error; it
does not substitute a synthetic RCA or patch.

To run the complete backend stack:

```bash
docker compose up --build
```

The frontend consumes `GET /api/observability/telemetry` and no longer calculates
the AHP weights, CCI index, blind-spot penalty, or O-Score locally.

## Connecting a microservices system

The engine does not assume application service names. Configure its telemetry
backends to point at the target system, then instrument the services or deploy
an OpenTelemetry Collector/Prometheus scraper and log pipeline:

```env
PROMETHEUS_URL=http://prometheus:9090
LOKI_URL=http://loki:3100
JAEGER_URL=http://jaeger:16686
LOKI_QUERY_FILTER={job=~".+"}
# Optional Prometheus label matchers, for example:
PROMETHEUS_LABEL_FILTER=service_name=~".+"
```

For protected backends, credentials stay in the observability-engine container:
use `PROMETHEUS_BEARER_TOKEN` / `PROMETHEUS_USERNAME` / `PROMETHEUS_PASSWORD`,
and the equivalent `LOKI_*` and `JAEGER_*` variables. Set `*_CA_CERT` to a CA
file mounted into the container when the endpoint uses a private TLS authority.

The engine understands common OpenTelemetry/Prometheus HTTP request duration,
request count, CPU, and Kubernetes/container memory metrics, with fallbacks for
common legacy metric names. If a target exports different metric names, set one
or more complete PromQL expressions with `PROMETHEUS_CPU_QUERY`,
`PROMETHEUS_MEMORY_QUERY`, `PROMETHEUS_REQUESTS_QUERY`,
`PROMETHEUS_LATENCY_QUERY`, or `PROMETHEUS_ERRORS_QUERY`. Metrics that are not
present remain unavailable instead of being reported as zero.

`GET /api/observability/discovery` reports live Prometheus targets, Jaeger
services, Loki readiness, and Kubernetes Services. Kubernetes discovery is
read-only. Run the engine in-cluster with a ServiceAccount that has `get`/`list`
access to Services and Deployments in the intended namespaces, or set `KUBERNETES_URL`,
`KUBERNETES_NAMESPACE`, and `KUBERNETES_BEARER_TOKEN`. For a local
`kubectl proxy`, set `KUBERNETES_URL=http://host.docker.internal:8001`.
Keep credentials server-side; never expose them through frontend configuration.

Discovery does not install instrumentation or scrape targets. A service must
export metrics and send logs/traces to the configured backends for those signals
to be observed. If a signal backend is reachable but has no matching data, the
discovery and telemetry responses distinguish connectivity from data coverage.
