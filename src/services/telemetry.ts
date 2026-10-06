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
    serviceCount: number;
  };
  sources: {
    prometheus: boolean;
    loki: boolean;
    jaeger: boolean;
  };
  lastUpdated: string;
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
    const [prom, loki, jaeger] = await Promise.all([
      this.fetchPrometheusMetrics(),
      this.fetchLokiLogs(),
      this.fetchJaegerTraces(),
    ]);

    const promValue = prom?.cpu?.data?.result?.[0]?.value?.[1];
    const lokiStreams = loki?.data?.result ?? [];
    const jaegerServices = jaeger?.data ?? [];
    const cpuUsage = promValue == null ? 0 : Number(promValue);
    const errorCount = lokiStreams.reduce((count: number, stream: any) => (
      count + (Array.isArray(stream.values) ? stream.values.length : 0)
    ), 0);

    return {
      metrics: {
        cpuUsage: Number.isFinite(cpuUsage) ? cpuUsage : 0,
        memoryUsage: Number(prom?.memory?.data?.result?.[0]?.value?.[1] ?? 0),
        requestCount: Number(prom?.requests?.data?.result?.[0]?.value?.[1] ?? 0),
      },
      logs: {
        errorCount,
        recentErrors: lokiStreams.flatMap((stream: any) => (
          (stream.values ?? []).slice(-5).map((entry: string[]) => entry[1])
        )),
      },
      traces: {
        latency: 0,
        errorRate: 0,
        serviceCount: Array.isArray(jaegerServices) ? jaegerServices.length : 0,
      },
      sources: {
        prometheus: prom !== null,
        loki: loki !== null,
        jaeger: jaeger !== null,
      },
      lastUpdated: new Date().toISOString(),
    };
  }
}
