// Client contract and API adapter for the backend's live Prometheus/Loki/Jaeger snapshot.
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
    verification: {
      status: string;
      verificationPercentage: number;
      sourceCoveragePct: number;
      correlationConfidencePct: number;
      ahpConsistencyRatio: number;
      ahpConsistent: boolean;
      scoreRangeValid: boolean;
      cciRangeValid: boolean;
      blindSpotPenalty: number;
    };
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

  static async discoverServices(): Promise<{
    prometheusJobs: string[];
    jaegerServices: string[];
    dockerContainers?: string[];
    applicationServices: string[];
    infrastructureServices: string[];
    allServices: string[];
  }> {
    // 0. Query Telemetry Collector (/api/telemetry/discovered-services) which inspects Docker Socket + Prometheus + Jaeger
    const collectorUrls = [
      '/api/telemetry/discovered-services',
      'http://localhost:8787/api/telemetry/discovered-services',
    ];
    for (const url of collectorUrls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const body = await res.json();
          if (body && Array.isArray(body.allServices) && body.allServices.length > 0) {
            return {
              prometheusJobs: body.prometheusJobs || [],
              jaegerServices: body.jaegerServices || [],
              dockerContainers: body.dockerContainers || [],
              applicationServices: body.applicationServices || [],
              infrastructureServices: body.infrastructureServices || [],
              allServices: body.allServices || [],
            };
          }
        }
      } catch {
        // fallback to direct queries below
      }
    }

    let prometheusJobs: string[] = [];
    let jaegerServices: string[] = [];

    // 1. Fetch Prometheus job labels
    try {
      const promRes = await fetchJson(`${PROMETHEUS_URL}/api/v1/label/job/values`, {}, 'Prometheus');
      if (promRes?.status === 'success' && Array.isArray(promRes.data)) {
        prometheusJobs = promRes.data;
      }
    } catch {
      try {
        const res = await fetch('http://localhost:9090/api/v1/label/job/values');
        const data = await res.json();
        if (data?.status === 'success' && Array.isArray(data.data)) {
          prometheusJobs = data.data;
        }
      } catch {
        // unreachable
      }
    }

    // 2. Fetch Jaeger services
    try {
      const jaegerRes = await this.fetchJaegerTraces();
      if (jaegerRes?.data && Array.isArray(jaegerRes.data)) {
        jaegerServices = jaegerRes.data;
      }
    } catch {
      try {
        const res = await fetch('http://localhost:16686/api/services');
        const data = await res.json();
        if (Array.isArray(data.data)) {
          jaegerServices = data.data;
        }
      } catch {
        // unreachable
      }
    }

    const infraKeywords = ['prometheus', 'jaeger', 'loki', 'grafana', 'collector'];
    const isInfra = (name: string) => infraKeywords.some((kw) => name.toLowerCase().includes(kw));

    const allSet = new Set<string>([...prometheusJobs, ...jaegerServices]);
    const allServices = Array.from(allSet);
    const applicationServices = allServices.filter((s) => !isInfra(s));
    const infrastructureServices = allServices.filter((s) => isInfra(s));

    return {
      prometheusJobs,
      jaegerServices,
      dockerContainers: [],
      applicationServices,
      infrastructureServices,
      allServices,
    };
  }
}

