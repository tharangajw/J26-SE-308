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

const PROMETHEUS_URL = '/proxy/prometheus';
const LOKI_URL = '/proxy/loki';
const JAEGER_URL = '/proxy/jaeger';

const COLLECTED_SERVICES_KEY = 'pscore_collected_services';
const ACTIVE_SERVICE_KEY = 'pscore_active_service';

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
  static getCollectedServices(): string[] {
    try {
      const raw = localStorage.getItem(COLLECTED_SERVICES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string' && s.trim().length > 0) : [];
      const active = localStorage.getItem(ACTIVE_SERVICE_KEY);
      if (active && typeof active === 'string' && active.trim().length > 0 && !list.includes(active.trim())) {
        list.push(active.trim());
      }
      return list;
    } catch {
      return [];
    }
  }

  static setCollectedServices(services: string[], activeService?: string): void {
    try {
      const unique = Array.from(new Set(services.map((s) => s.trim()).filter(Boolean)));
      if (activeService && !unique.includes(activeService.trim())) {
        unique.push(activeService.trim());
      }
      localStorage.setItem(COLLECTED_SERVICES_KEY, JSON.stringify(unique));
      if (activeService) {
        localStorage.setItem(ACTIVE_SERVICE_KEY, activeService.trim());
      } else if (unique.length > 0) {
        const currentActive = localStorage.getItem(ACTIVE_SERVICE_KEY);
        if (!currentActive || !unique.includes(currentActive)) {
          localStorage.setItem(ACTIVE_SERVICE_KEY, unique[0]);
        }
      }
      window.dispatchEvent(new CustomEvent('pscore-services-updated', { detail: { services: unique, activeService } }));
    } catch {
      // ignore storage errors
    }
  }

  static getActiveService(): string | null {
    try {
      const val = localStorage.getItem(ACTIVE_SERVICE_KEY);
      return val && val.trim().length > 0 ? val.trim() : null;
    } catch {
      return null;
    }
  }

  static setActiveService(serviceId: string): void {
    try {
      if (serviceId && typeof serviceId === 'string') {
        const trimmed = serviceId.trim();
        localStorage.setItem(ACTIVE_SERVICE_KEY, trimmed);
        const raw = localStorage.getItem(COLLECTED_SERVICES_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        const list = Array.isArray(parsed) ? parsed : [];
        if (!list.includes(trimmed)) {
          list.push(trimmed);
          localStorage.setItem(COLLECTED_SERVICES_KEY, JSON.stringify(list));
        }
        window.dispatchEvent(
          new CustomEvent('pscore-services-updated', {
            detail: { services: list, activeService: trimmed },
          })
        );
      }
    } catch {
      // ignore
    }
  }

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
    lastCollectedServices?: string[];
    applicationServices: string[];
    infrastructureServices: string[];
    allServices: string[];
  }> {
    const storedCollected = this.getCollectedServices();

    const collectorUrls = [
      '/api/telemetry/discovered-services',
      'http://localhost:8787/api/telemetry/discovered-services',
    ];
    for (const url of collectorUrls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const body = await res.json();
          if (body && Array.isArray(body.allServices)) {
            const backendCollected: string[] = Array.isArray(body.lastCollectedServices)
              ? body.lastCollectedServices
              : [];
            const combinedCollected = Array.from(new Set([...storedCollected, ...backendCollected]));

            // If user explicitly collected services in Data Collection, prioritize them
            const appServices = Array.from(
              new Set([...combinedCollected, ...(body.applicationServices || [])])
            );
            const allServices = Array.from(
              new Set([...combinedCollected, ...(body.allServices || [])])
            );

            if (allServices.length > 0) {
              return {
                prometheusJobs: body.prometheusJobs || [],
                jaegerServices: body.jaegerServices || [],
                dockerContainers: body.dockerContainers || [],
                lastCollectedServices: combinedCollected,
                applicationServices: appServices,
                infrastructureServices: body.infrastructureServices || [],
                allServices,
              };
            }
          }
        }
      } catch {
        // fallback to direct queries below
      }
    }

    let prometheusJobs: string[] = [];
    let jaegerServices: string[] = [];

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

    const infraKeywords = ['prometheus', 'jaeger', 'loki', 'grafana', 'collector', 'performance-engine', 'pscore-'];
    const isInfra = (name: string) => infraKeywords.some((kw) => name.toLowerCase().includes(kw));

    const allSet = new Set<string>([...storedCollected, ...prometheusJobs, ...jaegerServices]);
    const allServices = Array.from(allSet);
    const applicationServices = allServices.filter((s) => !isInfra(s));
    const infrastructureServices = allServices.filter((s) => isInfra(s));

    return {
      prometheusJobs,
      jaegerServices,
      dockerContainers: [],
      lastCollectedServices: storedCollected,
      applicationServices,
      infrastructureServices,
      allServices,
    };
  }
}
