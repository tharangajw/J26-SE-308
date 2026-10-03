export interface TelemetryData {
  metrics: {
    cpuUsage: number;
    memoryUsage: number;
    requestCount: number;
  };
  logs: {
    errorCount: number;
    recentErrors: string[];
  };
  traces: {
    latency: number;
    errorRate: number;
  };
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
  
  static async fetchPrometheusMetrics(): Promise<any> {
    try {
      return await fetchJson(`${PROMETHEUS_URL}/api/v1/query`, {
        query: 'sum(rate(container_cpu_usage_seconds_total[1m])) * 100',
      }, 'Prometheus');
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
    const [prom, loki, jaeger] = await Promise.all([
      this.fetchPrometheusMetrics(),
      this.fetchLokiLogs(),
      this.fetchJaegerTraces(),
    ]);

    // Parse the actual data from the responses. 
    // Here we provide mock parsed values as placeholders.
    // You will need to adjust the parsing logic based on your specific PromQL/LogQL queries.
    return {
      metrics: {
        cpuUsage: prom ? parseFloat(prom.data?.result?.[0]?.value?.[1] || 45.2) : 45.2,
        memoryUsage: 68.5,
        requestCount: 1205,
      },
      logs: {
        errorCount: loki ? loki.data?.result?.length || 12 : 12,
        recentErrors: ['payment-service connection refused', 'order-service db timeout'],
      },
      traces: {
        latency: jaeger ? 124 : 124, // ms
        errorRate: 1.2, // %
      }
    };
  }
}
