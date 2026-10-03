# Telemetry Collector

This folder contains the observability ingestion layer used by the J26-SE-308 dashboard.

## Data flow

```text
Microservices
  ├─ Prometheus metrics ─┐
  ├─ Loki structured logs ├─> TelemetryCollectorEngine ─> RawTelemetrySnapshot
  ├─ Jaeger traces       ┘
  └─ Kubernetes state
```

## Collectors

- `prometheus.ts` reads CPU, latency and request-rate metrics.
- `loki.ts` reads recent service error logs.
- `jaeger.ts` reads distributed traces and calculates duration/depth/error counts.
- `k8s.ts` reads deployment replica health from the Kubernetes API.
- `collector.ts` combines all sources into one timestamped snapshot.
- `types.ts` defines the normalized contract consumed by the dashboard.

The engine uses `Promise.allSettled`, so one unavailable source does not stop the other telemetry sources. The `sources` field shows which collectors were available for each snapshot.

## Local prerequisites

Start the telemetry stack from the project root:

```bash
docker compose -f docker-compose.telemetry.yml up -d
```

Then build the collector:

```bash
cd telemetry-collector
npm install
npm run build
```

The microservices must expose Prometheus/OpenTelemetry-compatible telemetry for non-empty production values. Grafana is a visualization layer; it is not required by this collector.
