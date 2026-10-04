import { createServer } from 'node:http';
import { TelemetryCollectorEngine } from './collector.js';

const port = Number(process.env.PORT ?? 8787);
const engine = new TelemetryCollectorEngine({
  prometheus: process.env.PROMETHEUS_URL ?? 'http://localhost:9090',
  jaeger: process.env.JAEGER_URL ?? 'http://localhost:16686',
  kubernetes: process.env.KUBERNETES_URL ?? 'http://localhost:8001',
});

const sendJson = (response: import('node:http').ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  response.end(JSON.stringify(body));
};

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  if (request.method === 'OPTIONS') return sendJson(response, 204, {});
  if (request.method !== 'GET') return sendJson(response, 405, { error: 'Only GET is supported' });
  if (url.pathname === '/health') return sendJson(response, 200, { status: 'ok', service: 'telemetry-collector' });
  if (url.pathname === '/api/telemetry/snapshot') {
    const services = (url.searchParams.get('services') ?? 'api-gateway,order-service').split(',').map((service) => service.trim()).filter(Boolean);
    if (services.length === 0) return sendJson(response, 400, { error: 'Provide at least one service in the services query parameter' });
    return sendJson(response, 200, await engine.collectServiceSnapshots([...new Set(services)]));
  }
  return sendJson(response, 404, { error: 'Route not found' });
}).listen(port, () => console.log(`Telemetry collector listening on http://localhost:${port}`));