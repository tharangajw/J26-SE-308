import { createServer } from 'node:http';
import { TelemetryCollectorEngine } from './collector.js';
import {
  alignTo5SecondGrid,
  applyImputation,
  applyMinMaxNormalization,
  generateTelemetrySamples,
  recordRealSnapshotsToPipeline
} from './pipeline.js';

import { HistoricalDriftAnalyzer } from './drift.js';
import { FanOutEngine } from './fanout.js';
import { telemetryMongo } from './mongodb.js';

const port = Number(process.env.PORT ?? 8787);
const engine = new TelemetryCollectorEngine({
  prometheus: process.env.PROMETHEUS_URL ?? 'http://localhost:9090',
  loki: process.env.LOKI_URL ?? 'http://localhost:3100',
  jaeger: process.env.JAEGER_URL ?? 'http://localhost:16686',
  kubernetes: process.env.KUBERNETES_URL ?? 'http://localhost:8001',
});

const driftAnalyzer = new HistoricalDriftAnalyzer();
const fanOutEngine = new FanOutEngine({
  jaeger: process.env.JAEGER_URL ?? 'http://localhost:16686',
});

// Remembers the services most recently collected via /api/telemetry/snapshot so all downstream modules stay in sync
let lastCollectedServices: string[] = [];
let cachedSnapshotResult: { snapshots: any[]; timestamp: number } | null = null;

const sendJson = (response: import('node:http').ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  response.end(JSON.stringify(body));
};

const readJsonBody = async (req: import('node:http').IncomingMessage): Promise<any> => {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
};

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  if (request.method === 'OPTIONS') return sendJson(response, 204, {});
  if (request.method !== 'GET' && !(request.method === 'POST' && url.pathname === '/api/telemetry/report/save')) {
    return sendJson(response, 405, { error: 'Method not allowed' });
  }

  if (url.pathname === '/health') {
    return sendJson(response, 200, { status: 'ok', service: 'telemetry-collector', lastCollectedServices });
  }

  if (url.pathname === '/api/telemetry/snapshot') {
    const servicesParam = url.searchParams.get('services');
    let services: string[] = [];
    if (servicesParam) {
      services = servicesParam.split(',').map((s) => s.trim()).filter(Boolean);
      if (services.length > 0) {
        lastCollectedServices = Array.from(new Set(services));
      }
    } else if (lastCollectedServices.length > 0) {
      services = [...lastCollectedServices];
    } else {
      const discovery = await engine.discoverServices();
      services = discovery.applicationServices.length > 0 ? discovery.applicationServices : discovery.allServices;
    }
    if (services.length === 0) return sendJson(response, 200, { requestedServices: [], collectedAt: Date.now(), snapshots: [], errors: [] });
    const snapshotResult = await engine.collectServiceSnapshots([...new Set(services)]);
    cachedSnapshotResult = { snapshots: snapshotResult.snapshots, timestamp: Date.now() };
    recordRealSnapshotsToPipeline(snapshotResult.snapshots);
    snapshotResult.snapshots.forEach((s) => telemetryMongo.saveRawSnapshot(s).catch(() => {}));
    return sendJson(response, 200, snapshotResult);
  }

  if (url.pathname === '/api/telemetry/normalized') {
    const servicesParam = url.searchParams.get('services');
    let services: string[] = [];
    if (servicesParam) {
      services = servicesParam.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (lastCollectedServices.length > 0) {
      services = [...lastCollectedServices];
    } else {
      const discovery = await engine.discoverServices();
      services = discovery.applicationServices.length > 0 ? discovery.applicationServices : discovery.allServices;
    }
    const imputationMethod = (url.searchParams.get('imputation') ?? 'linear_interpolation') as any;

    if (services.length > 0) {
      const liveBatch = await engine.collectServiceSnapshots([...new Set(services)]);
      recordRealSnapshotsToPipeline(liveBatch.snapshots);
    }

    const rawSamples = generateTelemetrySamples(services, 6, 0);
    const gridAligned = alignTo5SecondGrid(rawSamples, 5);
    const imputed = applyImputation(gridAligned, imputationMethod);
    const normalized = applyMinMaxNormalization(imputed);

    return sendJson(response, 200, {
      pipeline: 'Phase 2 Telemetry Data Pipeline (Real-Time Preprocessing & Normalization)',
      gridInterval: '5s',
      imputationMethod,
      requestedServices: services,
      totalNormalizedSamples: normalized.length,
      rawSamples,
      dataset: normalized
    });
  }

  if (url.pathname === '/api/telemetry/discovered-services') {
    const discovery = await engine.discoverServices();
    const mergedAppServices = Array.from(
      new Set([...lastCollectedServices, ...discovery.applicationServices])
    );
    const mergedAllServices = Array.from(
      new Set([...lastCollectedServices, ...discovery.allServices])
    );
    return sendJson(response, 200, {
      ...discovery,
      lastCollectedServices,
      applicationServices: mergedAppServices,
      allServices: mergedAllServices,
    });
  }

  if (url.pathname === '/api/telemetry/phase3') {
    let services: string[] = [];
    const requested = url.searchParams.get('services');

    if (requested) {
      services = requested.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (lastCollectedServices.length > 0) {
      services = [...lastCollectedServices];
    } else {
      const discovery = await engine.discoverServices();
      services = discovery.applicationServices.length > 0 ? discovery.applicationServices : discovery.allServices;
    }

    if (services.length === 0) {
      return sendJson(response, 200, {
        pipeline: 'Phase 3: Core Signal Sub-Modules (Drift Analysis & Fan-Out Engine)',
        requestedServices: [],
        evaluatedAt: Date.now(),
        historicalDriftAnalysis: [],
        fanOutTopologyAnalysis: [],
      });
    }

    let snapshots =
      cachedSnapshotResult && Date.now() - cachedSnapshotResult.timestamp < 6000
        ? cachedSnapshotResult.snapshots
        : null;

    if (!snapshots) {
      const snapshotData = await engine.collectServiceSnapshots(services);
      snapshots = snapshotData.snapshots;
      cachedSnapshotResult = { snapshots, timestamp: Date.now() };
      recordRealSnapshotsToPipeline(snapshots);
      snapshots.forEach((s) => telemetryMongo.saveRawSnapshot(s).catch(() => {}));
    }

    const runningContainers = await (engine as any).dockerCollector?.getRunningContainers().catch(() => []) ?? [];

    const driftResults = await Promise.all(
      services.map(async (serviceId) => {
        const snap = snapshots.find((s: any) => s.serviceId === serviceId);
        const liveP95 = snap ? (snap.prometheus.p95LatencyMs || snap.prometheus.avgResponseTimeMs || 0) : 0;
        const matched = (engine as any).dockerCollector?.matchContainer(runningContainers, serviceId) || null;
        return driftAnalyzer.analyzeDrift(serviceId, liveP95, matched);
      })
    );

    const fanOutResults = await Promise.all(
      services.map((serviceId) => {
        const snap = snapshots.find((s: any) => s.serviceId === serviceId);
        const liveLatency = snap ? (snap.prometheus.avgResponseTimeMs || 0) : 0;
        return fanOutEngine.analyzeTopology(serviceId, liveLatency);
      })
    );

    return sendJson(response, 200, {
      pipeline: 'Phase 3: Core Signal Sub-Modules (Drift Analysis & Fan-Out Engine)',
      requestedServices: services,
      evaluatedAt: Date.now(),
      historicalDriftAnalysis: driftResults,
      fanOutTopologyAnalysis: fanOutResults,
    });
  }

  if (url.pathname === '/api/telemetry/report/save' && request.method === 'POST') {
    try {
      const payload = await readJsonBody(request);
      const res = await telemetryMongo.savePScoreReport(payload);
      return sendJson(response, 200, res);
    } catch (err: any) {
      return sendJson(response, 400, { success: false, error: err?.message || 'Invalid JSON body' });
    }
  }

  if (url.pathname === '/api/telemetry/report/history' && request.method === 'GET') {
    const service = url.searchParams.get('service') || undefined;
    const limit = Number(url.searchParams.get('limit') || 20);
    const history = await telemetryMongo.getPScoreReportHistory(service, limit);
    return sendJson(response, 200, { service: service || 'all', count: history.length, history });
  }

  return sendJson(response, 404, { error: 'Route not found' });
}).listen(port, () => console.log(`Telemetry collector listening on http://localhost:${port}`));
