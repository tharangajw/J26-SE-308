# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Performance data collection

The multi-service collection flow is:

```text
k6 / JMeter -> API gateway -> microservices
                         -> Prometheus (metrics)
                         -> Jaeger (distributed traces)
                         -> Kubernetes API (replicas and HPA)
                         -> telemetry-collector:8787
```

Start the local telemetry stack from the repository root:

```bash
docker compose up --build -d
```

The collector is available at `http://localhost:8787` and this stack's Prometheus UI is at `http://localhost:9091` (host port `9090` may already be used by another local stack). Check the collector with:

```bash
curl "http://localhost:8787/api/telemetry/snapshot?services=api-gateway,order-service,payment-service"
```

Import `postman/performance-telemetry.postman_collection.json` into Postman and run **Collector health** first, followed by **Collect multiple service snapshots**. Each successful snapshot contains `prometheus`, `jaeger`, and `k8s` data for each service; unavailable sources are returned under `errors` without losing other service results.

For Kubernetes:

```bash
kubectl apply -f k8s/performance-stack.yaml
kubectl apply -f k8s/prometheus-jaeger-manifests.yaml
kubectl port-forward -n telemetry svc/prometheus-service 9090:9090
kubectl port-forward -n telemetry svc/jaeger-service 16686:16686
```

Use the **Performance Collection** page at `/dimensions/performance/collection` to select multiple services and trigger the same request. Run the load generators against the gateway with `k6 run load-tests/k8s_load_test.js` or open `load-tests/performance-plan.jmx` in JMeter. The Kubernetes demo pods are connectivity fixtures; production measurements require each application to expose Prometheus metrics and emit OpenTelemetry traces to Jaeger.
