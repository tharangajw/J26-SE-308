export interface TelemetryData {
  metrics: {
    cpuUsage: number;
    memoryUsage: number;
    requestCount: number;
    p95Latency: number;
  };
  series: {
    cpu: Array<{ time: string; value: number }>;
    memory: Array<{ time: string; value: number }>;
    requests: Array<{ time: string; value: number }>;
    latency: Array<{ time: string; value: number }>;
  };
  logs: {
    errorCount: number;
    recentErrors: string[];
    recentLogs: Array<{ timestamp: string; level: string; service: string; message: string; traceId: string }>;
    series: Array<{ time: string; info: number; error: number }>;
  };
  traces: {
    latency: number;
    errorRate: number;
    serviceCount: number;
    samples: Array<{ id: string; time: number; duration: number; spans: number; isError: boolean; service: string; operation: string }>;
  };
  sources: {
    prometheus: boolean;
    loki: boolean;
    jaeger: boolean;
  };
  lastUpdated: string;
  calculation: {
    oScore: number;
    cciIndex: number;
    blindSpotCount: number;
    status: string;
    maturity: string;
    ahp: any;
    cciData: any;
    scoreBreakdown: any;
  };
  history: Array<{ timestamp: string; oscore: number; cci_index: number; blind_spot_count: number }>;
}

// Use Vite proxies to bypass CORS issues
const PROMETHEUS_URL = '/proxy/prometheus';
const LOKI_URL = '/proxy/loki';
const JAEGER_URL = '/proxy/jaeger';

async function fetchJson(
  url: string,
  params: Record<string, string>,
  source: string,
): Promise<any> {
  const query = new URLSearchParams(params);
  const response = await fetch(`${url}?${query.toString()}`);
  const body = await response.text();

  let data: any = null;
  if (body) {
    try {
      data = JSON.parse(body);
    } catch {
      throw new Error(`${source} returned invalid JSON (${response.status})`);
    }
  }

  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : body || response.statusText;
    throw new Error(`${source} request failed (${response.status}): ${message}`);
  }

  return data;
}

export class TelemetryService {
  static async fetchPrometheusQuery(query: string): Promise<any> {
    return fetchJson(`${PROMETHEUS_URL}/api/v1/query`, { query }, 'Prometheus');
  }

  static async fetchPrometheusMetrics(): Promise<any> {
    try {
      const [cpu, memory, requests] = await Promise.all([
        this.fetchPrometheusQuery('sum(rate(container_cpu_usage_seconds_total[1m])) * 100'),
        this.fetchPrometheusQuery('sum(container_memory_working_set_bytes) / sum(container_spec_memory_limit_bytes) * 100'),
        this.fetchPrometheusQuery('sum(rate(http_requests_total[1m]))'),
      ]);
      return { cpu, memory, requests };
    } catch (error) {
      console.warn('Prometheus fetch failed. Start the telemetry stack if metrics are needed.', error);
      return null;
    }
  }

  static async fetchLokiLogs(): Promise<any> {
    try {
      const start = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      return await fetchJson(`${LOKI_URL}/loki/api/v1/query_range`, {
        query: '{level="error"}',
        start,
        end: new Date().toISOString(),
        limit: '100',
        direction: 'backward',
      }, 'Loki');
    } catch (error) {
      console.warn('Loki fetch failed. Start the telemetry stack if logs are needed.', error);
      return null;
    }
  }

  static async fetchJaegerTraces(): Promise<any> {
    try {
      return await fetchJson(`${JAEGER_URL}/api/services`, {}, 'Jaeger');
    } catch (error) {
      console.warn('Jaeger fetch failed. Start the telemetry stack if traces are needed.', error);
      return null;
    }
  }

  static async getCombinedTelemetry(): Promise<TelemetryData> {
    const response = await fetch('/api/observability/telemetry');
    if (!response.ok) throw new Error(`Observability engine request failed (${response.status})`);
    const body = await response.json();
    return { ...body.telemetry, calculation: body.calculation, history: body.history };
  }
}
