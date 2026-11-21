// Client contract and API adapter for the backend's live Prometheus/Loki/Jaeger snapshot.
export interface TelemetryData {
  metrics: {
    cpuUsage: number | null;
    memoryUsage: number | null;
    requestCount: number | null;
    p95Latency: number | null;
  };
  metricAvailability: {
    cpu: boolean;
    memory: boolean;
    requestCount: boolean;
    p95Latency: boolean;
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
    latency: number | null;
    errorRate: number | null;
    serviceCount: number;
    samples: Array<{ id: string; time: number; duration: number; spans: number; isError: boolean; service: string; operation: string }>;
  };
  availability: {
    metrics: boolean;
    traces: boolean;
    logs: boolean;
  };
  sources: {
    prometheus: boolean;
    loki: boolean;
    jaeger: boolean;
  };
  activeExperiment?: {
    faultType: string;
    serviceId: string | null;
    simulated: boolean;
  } | null;
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

export interface DiscoveredService {
  name: string;
  namespace: string | null;
  sources: string[];
  type?: string;
  clusterIP?: string;
  ports?: Array<{ name?: string; port?: number; protocol?: string }>;
}

export interface DiscoveredWorkload {
  name: string;
  namespace: string | null;
  desiredReplicas: number;
  readyReplicas: number;
  availableReplicas: number;
}

export interface ServiceDiscovery {
  services: DiscoveredService[];
  workloads: DiscoveredWorkload[];
  sources: Record<string, {
    configured: boolean;
    connected: boolean;
    count: number;
    error?: string;
    namespace?: string | null;
    workloadsError?: string | null;
  }>;
  discoveredAt: string;
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
        this.fetchPrometheusQuery('sum(rate(process_cpu_time_seconds_total[1m])) * 100'),
        this.fetchPrometheusQuery('avg(process_memory_utilization) * 100'),
        this.fetchPrometheusQuery('sum(rate(http_server_request_duration_seconds_count[1m]))'),
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
        query: '{service_name=~".+"}',
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
    const telemetry = body.telemetry ?? {};
    const metrics = telemetry.metrics ?? {};
    const logs = telemetry.logs ?? {};
    const traces = telemetry.traces ?? {};
    const metricAvailability = telemetry.metricAvailability ?? {
      cpu: metrics.cpuUsage != null,
      memory: metrics.memoryUsage != null,
      requestCount: metrics.requestCount != null,
      p95Latency: metrics.p95Latency != null,
    };

    return {
      ...telemetry,
      metrics: {
        cpuUsage: metrics.cpuUsage ?? null,
        memoryUsage: metrics.memoryUsage ?? null,
        requestCount: metrics.requestCount ?? null,
        p95Latency: metrics.p95Latency ?? null,
      },
      metricAvailability,
      series: telemetry.series ?? { cpu: [], memory: [], requests: [], latency: [] },
      logs: {
        errorCount: logs.errorCount ?? 0,
        recentErrors: logs.recentErrors ?? [],
        recentLogs: logs.recentLogs ?? [],
        series: logs.series ?? [],
      },
      traces: {
        latency: traces.latency ?? null,
        errorRate: traces.errorRate ?? null,
        serviceCount: traces.serviceCount ?? 0,
        samples: traces.samples ?? [],
      },
      availability: telemetry.availability ?? {
        metrics: Object.values(metricAvailability).some(Boolean),
        logs: (logs.recentLogs?.length ?? 0) > 0,
        traces: (traces.samples?.length ?? 0) > 0,
      },
      sources: telemetry.sources ?? { prometheus: false, loki: false, jaeger: false },
      calculation: body.calculation,
      history: body.history ?? [],
    };
  }

  static async getServiceDiscovery(): Promise<ServiceDiscovery> {
    const response = await fetch('/api/observability/discovery');
    const body = await response.text();
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          'The observability backend does not have the discovery endpoint. Rebuild and restart it with: docker compose up --build -d observability-engine',
        );
      }
      throw new Error(`Service discovery failed (${response.status}): ${body || response.statusText}`);
    }
    try {
      return JSON.parse(body) as ServiceDiscovery;
    } catch {
      throw new Error('Observability discovery endpoint returned invalid JSON.');
    }
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
    const discovery = await this.getServiceDiscovery();
    const collected = this.getCollectedServices();
    const discoveredNames = discovery.services.map((service) => service.name);
    const allServices = Array.from(new Set([...collected, ...discoveredNames]));
    return {
      prometheusJobs: discovery.services
        .filter((service) => service.sources.includes('prometheus'))
        .map((service) => service.name),
      jaegerServices: discovery.services
        .filter((service) => service.sources.includes('jaeger'))
        .map((service) => service.name),
      dockerContainers: [],
      lastCollectedServices: collected,
      applicationServices: allServices,
      infrastructureServices: [],
      allServices,
    };

  }
}
