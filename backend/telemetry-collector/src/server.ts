import { createServer } from 'node:http';
import { TelemetryCollectorEngine } from './collector.js';
import {
  alignTo5SecondGrid,
  applyImputation,
  applyMinMaxNormalization,
  generateTelemetrySamples
} from './pipeline.js';

const port = Number(process.env.PORT ?? 8787);
const engine = new TelemetryCollectorEngine({
  prometheus: process.env.PROMETHEUS_URL ?? 'http://localhost:9090',
  jaeger: process.env.JAEGER_URL ?? 'http://localhost:16686',
  loki: process.env.LOKI_URL ?? 'http://localhost:3100',
  kubernetes: process.env.KUBERNETES_URL ?? 'http://localhost:8001',
});

const sendJson = (response: import('node:http').ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  response.end(JSON.stringify(body));
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  if (request.method === 'OPTIONS') return sendJson(response, 204, {});
  if (request.method !== 'GET') return sendJson(response, 405, { error: 'Only GET is supported' });

  if (url.pathname === '/health') {
    return sendJson(response, 200, { status: 'ok', service: 'telemetry-collector' });
  }

  if (url.pathname === '/api/telemetry/snapshot') {
    const services = (url.searchParams.get('services') ?? 'api-gateway,order-service').split(',').map((s) => s.trim()).filter(Boolean);
    if (services.length === 0) return sendJson(response, 400, { error: 'Provide at least one service in the services query parameter' });
    return sendJson(response, 200, await engine.collectServiceSnapshots([...new Set(services)]));
  }

  if (url.pathname === '/api/telemetry/normalized') {
    const servicesParam = url.searchParams.get('services') ?? 'api-gateway,order-service,payment-service';
    const services = servicesParam.split(',').map((s) => s.trim()).filter(Boolean);
    const imputationMethod = (url.searchParams.get('imputation') ?? 'linear_interpolation') as any;
    const gapRate = Number(url.searchParams.get('gap_rate') ?? 0.15);

    const rawSamples = generateTelemetrySamples(services, 6, gapRate);
    const gridAligned = alignTo5SecondGrid(rawSamples, 5);
    const imputed = applyImputation(gridAligned, imputationMethod);
    const normalized = applyMinMaxNormalization(imputed);

    return sendJson(response, 200, {
      pipeline: 'Phase 2 Telemetry Data Pipeline (Preprocessing & Normalization)',
      gridInterval: '5s',
      imputationMethod,
      requestedServices: services,
      totalNormalizedSamples: normalized.length,
      dataset: normalized
    });
  }

  if (url.pathname === '/api/telemetry/live') {
    try {
      const fetchJson = async (url: string, source: string) => {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`${res.status}`);
          return await res.json();
        } catch (e) {
          console.warn(`${source} fetch failed:`, e);
          return null;
        }
      };

      const [cpuProm, memProm, reqProm, loki, jaeger] = await Promise.all([
        fetchJson(`http://localhost:9090/api/v1/query?query=sum(rate(container_cpu_usage_seconds_total[1m]))*100`, 'Prometheus CPU'),
        fetchJson(`http://localhost:9090/api/v1/query?query=sum(container_memory_working_set_bytes)/sum(container_spec_memory_limit_bytes)*100`, 'Prometheus Mem'),
        fetchJson(`http://localhost:9090/api/v1/query?query=sum(rate(http_requests_total[1m]))`, 'Prometheus Req'),
        fetchJson(`http://localhost:3100/loki/api/v1/query_range?query={level="error"}&start=${new Date(Date.now() - 15*60*1000).toISOString()}&end=${new Date().toISOString()}&limit=100&direction=backward`, 'Loki'),
        fetchJson(`http://localhost:16686/api/services`, 'Jaeger')
      ]);

      const cpuValue = cpuProm?.data?.result?.[0]?.value?.[1];
      const cpuUsage = cpuValue == null ? 0 : Number(cpuValue);
      const lokiStreams = loki?.data?.result ?? [];
      const errorCount = lokiStreams.reduce((c: number, s: any) => c + (Array.isArray(s.values) ? s.values.length : 0), 0);
      const jaegerServices = jaeger?.data ?? [];

      const liveData = {
        metrics: {
          cpuUsage: Number.isFinite(cpuUsage) ? cpuUsage : 0,
          memoryUsage: Number(memProm?.data?.result?.[0]?.value?.[1] ?? 0),
          requestCount: Number(reqProm?.data?.result?.[0]?.value?.[1] ?? 0),
        },
        logs: {
          errorCount,
          recentErrors: lokiStreams.flatMap((s: any) => (s.values ?? []).slice(-5).map((e: string[]) => e[1])),
        },
        traces: {
          latency: 0,
          errorRate: 0,
          serviceCount: Array.isArray(jaegerServices) ? jaegerServices.length : 0,
        },
        sources: {
          prometheus: cpuProm !== null,
          loki: loki !== null,
          jaeger: jaeger !== null,
        },
        lastUpdated: new Date().toISOString(),
      };

      if (dbCollection) {
        await dbCollection.insertOne({ ...liveData, timestamp: new Date() });
      }

      return sendJson(response, 200, liveData);
    } catch (err) {
      return sendJson(response, 500, { error: 'Failed to fetch live telemetry' });
    }
  }

  return sendJson(response, 404, { error: 'Route not found' });
});

let dbCollection: any = null;
import { MongoClient } from 'mongodb';
async function startServer() {
  try {
    const mongoUrl = process.env.MONGODB_URI ?? 'mongodb://localhost:27017';
    const client = new MongoClient(mongoUrl);
    await client.connect();
    const db = client.db('observability');
    dbCollection = db.collection('live_telemetry');
    console.log('Connected to MongoDB');
  } catch (err) {
    console.warn('Failed to connect to MongoDB', err);
  }
  server.listen(port, () => console.log(`Telemetry collector listening on http://localhost:${port}`));
}

startServer();
