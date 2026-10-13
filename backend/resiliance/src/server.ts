import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { performance } from 'node:perf_hooks';
import { ResilienceCollector } from './collector.ts';
import { evaluateRScoreRules } from './rScore.ts';
import type { ChaosInjectRequest } from './types.ts';

const PORT = Number(process.env.PORT ?? 3010);
const collector = new ResilienceCollector(
  process.env.PROMETHEUS_URL ?? 'http://localhost:9090',
  process.env.KUBERNETES_URL ?? 'http://localhost:8001'
);

// History buffer
interface HistoryRecord {
  timestamp: string;
  score: number;
  maturity: string;
  cpu: number;
  memory: number;
  availability: number;
  latency: number;
  errorRate: number;
  restarts: number;
  mttr: number;
  failoverSuccess: number;
}
const historyBuffer: HistoryRecord[] = [];

// Helper to send JSON responses with full CORS support
function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

// Helper to read JSON request body
function parseBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : ({} as T));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const reqStart = performance.now();
  res.on('finish', () => {
    const duration = performance.now() - reqStart;
    const isError = res.statusCode >= 500;
    collector.getDeviceMonitor().recordRequest(isError, duration);
  });

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method ?? 'GET';

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return sendJson(res, 204, {});
  }

  try {
    // 1. Health endpoint
    if (pathname === '/health' && method === 'GET') {
      return sendJson(res, 200, {
        status: 'ok',
        service: 'resilience-backend',
        port: PORT,
        uptime: process.uptime()
      });
    }

    // 2. Main R-Score & Real-Time Telemetry endpoint
    // Polled by FaultToleranceDashboard.tsx (http://localhost:3010/api/resilience/score)
    if (pathname === '/api/resilience/score' && method === 'GET') {
      const data = await collector.collectTelemetry();
      const { rules } = evaluateRScoreRules({
        availability: data.metrics.availability,
        cpu: data.metrics.cpu,
        memory: data.metrics.memory,
        errorRate: data.metrics.errorRate,
        restarts: data.metrics.restarts,
        mttr: data.metrics.mttr,
        latency: data.metrics.latency,
        failoverSuccess: data.metrics.failoverSuccess,
      });

      // Maintain rolling history
      if (historyBuffer.length === 0 || Date.now() % 15000 < 5000) {
        historyBuffer.unshift({
          timestamp: new Date().toLocaleTimeString(),
          score: data.metrics.score,
          maturity: data.metrics.maturity,
          cpu: data.metrics.cpu,
          memory: data.metrics.memory,
          availability: data.metrics.availability,
          latency: data.metrics.latency,
          errorRate: data.metrics.errorRate,
          restarts: data.metrics.restarts,
          mttr: data.metrics.mttr,
          failoverSuccess: data.metrics.failoverSuccess
        });
        if (historyBuffer.length > 50) historyBuffer.pop();
      }

      return sendJson(res, 200, {
        timestamp: new Date().toISOString(),
        metrics: data.metrics,
        services: data.services,
        rules,
        selfHealing: data.selfHealing,
        activeChaos: data.activeChaos,
        deviceHardware: data.deviceHardware,
        aiPrediction: data.aiPrediction,
        sources: data.sources
      });
    }

    // 3. Chaos injection endpoint (POST /api/chaos/inject)
    if (pathname === '/api/chaos/inject' && method === 'POST') {
      const body = await parseBody<ChaosInjectRequest>(req);
      const activeEvent = collector.injectChaos(
        body.serviceId || 'gateway',
        body.faultType || 'SERVICE_DOWN',
        body.duration || 30,
        body.latencyMs,
        body.errorRate
      );
      console.log(`[Chaos] Injected ${body.faultType} on ${body.serviceId}`);
      return sendJson(res, 200, {
        success: true,
        message: `Injected fault ${body.faultType} on service ${body.serviceId}`,
        event: activeEvent
      });
    }

    // 4. Clear all chaos faults (POST /api/chaos/clear)
    if (pathname === '/api/chaos/clear' && method === 'POST') {
      collector.clearChaos();
      console.log('[Chaos] Cleared all active faults and restored baseline telemetry');
      return sendJson(res, 200, {
        success: true,
        message: 'All chaos faults cleared. Services recovering to baseline state.'
      });
    }

    // 5. Heal individual service (POST /api/resilience/heal)
    if (pathname === '/api/resilience/heal' && method === 'POST') {
      const body = await parseBody<{ serviceId?: string }>(req);
      collector.healService(body.serviceId || 'all');
      return sendJson(res, 200, {
        success: true,
        message: `Service ${body.serviceId || 'all'} healed.`
      });
    }

    // 6. Resilience history (GET /api/resilience/history)
    if (pathname === '/api/resilience/history' && method === 'GET') {
      return sendJson(res, 200, {
        count: historyBuffer.length,
        history: historyBuffer
      });
    }

    // Route not found
    return sendJson(res, 404, { error: `Route ${method} ${pathname} not found` });
  } catch (error: any) {
    console.error('Server error:', error);
    return sendJson(res, 500, { error: error?.message ?? 'Internal Server Error' });
  }
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  🛡️ Resilience & Fault Tolerance Sub-Engine (R-Score) `);
  console.log(`  Running on http://localhost:${PORT}`);
  console.log(`  Target Metrics Baseline:`);
  console.log(`    - CPU Usage:       21%      (Target < 70%)`);
  console.log(`    - Memory Usage:    43%      (Target < 75%)`);
  console.log(`    - Availability:    99.86%   (Target > 99.0%)`);
  console.log(`    - Response Time:   26 ms    (Average Latency)`);
  console.log(`    - Error Rate:      0.18%    (Target < 1.0%)`);
  console.log(`    - Pod Restarts:    0        (Target < 2)`);
  console.log(`    - MTTR:            12s      (Target < 15s)`);
  console.log(`    - Failover:        100%     (Redirection Rate)`);
  console.log(`  Active Endpoints:`);
  console.log(`    GET  http://localhost:${PORT}/api/resilience/score`);
  console.log(`    POST http://localhost:${PORT}/api/chaos/inject`);
  console.log(`    POST http://localhost:${PORT}/api/chaos/clear`);
  console.log(`    POST http://localhost:${PORT}/api/resilience/heal`);
  console.log(`    GET  http://localhost:${PORT}/api/resilience/history`);
  console.log(`=======================================================`);
});
