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
```

Without a key, the UI uses a clearly labelled demo fallback for that provider.

To run the complete backend stack:

```bash
docker compose up --build
```

The frontend consumes `GET /api/observability/telemetry` and no longer calculates
the AHP weights, CCI index, blind-spot penalty, or O-Score locally.
