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

const sendJson = (response: import('node:http').ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  response.end(JSON.stringify(body));
};

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  if (request.method === 'OPTIONS') return sendJson(response, 204, {});
  if (request.method !== 'GET') return sendJson(response, 405, { error: 'Only GET is supported' });

  if (url.pathname === '/health') {
    return sendJson(response, 200, { status: 'ok', service: 'telemetry-collector' });
  }

  if (url.pathname === '/api/telemetry/snapshot') {
    const servicesParam = url.searchParams.get('services');
    let services: string[] = [];
    if (servicesParam) {
      services = servicesParam.split(',').map((s) => s.trim()).filter(Boolean);
    } else {
      const discovery = await engine.discoverServices();
      services = discovery.applicationServices.length > 0 ? discovery.applicationServices : discovery.allServices;
    }
    if (services.length === 0) return sendJson(response, 200, { requestedServices: [], collectedAt: Date.now(), snapshots: [], errors: [] });
    const snapshotResult = await engine.collectServiceSnapshots([...new Set(services)]);
    recordRealSnapshotsToPipeline(snapshotResult.snapshots);
    return sendJson(response, 200, snapshotResult);
  }

  if (url.pathname === '/api/telemetry/normalized') {
    const servicesParam = url.searchParams.get('services');
    let services: string[] = [];
    if (servicesParam) {
      services = servicesParam.split(',').map((s) => s.trim()).filter(Boolean);
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
    return sendJson(response, 200, discovery);
  }

  if (url.pathname === '/api/telemetry/phase3') {
    let services: string[] = [];
    const requested = url.searchParams.get('services');

    if (requested) {
      services = requested.split(',').map((s) => s.trim()).filter(Boolean);
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

    const snapshotData = await engine.collectServiceSnapshots(services);
    recordRealSnapshotsToPipeline(snapshotData.snapshots);

    const driftResults = services.map((serviceId) => {
      const snap = snapshotData.snapshots.find((s) => s.serviceId === serviceId);
      const liveP95 = snap ? (snap.prometheus.p95LatencyMs || snap.prometheus.avgResponseTimeMs || 0) : 0;
      return driftAnalyzer.analyzeDrift(serviceId, liveP95);
    });

    const fanOutResults = await Promise.all(
      services.map((serviceId) => {
        const snap = snapshotData.snapshots.find((s) => s.serviceId === serviceId);
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

  return sendJson(response, 404, { error: 'Route not found' });
}).listen(port, () => console.log(`Telemetry collector listening on http://localhost:${port}`));
