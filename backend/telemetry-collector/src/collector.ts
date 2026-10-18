import { DockerCollector } from './docker.js';
import { JaegerCollector } from './jaeger.js';
import { K8sCollector } from './k8s.js';
import { LokiCollector } from './loki.js';
import { PrometheusCollector } from './prometheus.js';
import { MultiServiceSnapshot, RawTelemetrySnapshot } from './types.js';

export class TelemetryCollectorEngine {
  private readonly promCollector: PrometheusCollector;
  private readonly jaegerCollector: JaegerCollector;
  private readonly k8sCollector: K8sCollector;
  private readonly lokiCollector: LokiCollector;
  private readonly dockerCollector: DockerCollector;

  constructor(endpoints: { prometheus?: string; jaeger?: string; kubernetes?: string; loki?: string } = {}) {
    this.promCollector = new PrometheusCollector(endpoints.prometheus);
    this.jaegerCollector = new JaegerCollector(endpoints.jaeger);
    this.k8sCollector = new K8sCollector(endpoints.kubernetes);
    this.lokiCollector = new LokiCollector(endpoints.loki);
    this.dockerCollector = new DockerCollector();
  }

  public async collectServiceSnapshot(serviceId: string): Promise<RawTelemetrySnapshot> {
    const [prometheus, loki, jaeger, k8s] = await Promise.allSettled([
      this.promCollector.fetchServiceMetrics(serviceId),
      this.lokiCollector.fetchLogs(serviceId),
      this.jaegerCollector.fetchTraces(serviceId),
      this.k8sCollector.fetchClusterState(serviceId),
    ]);

    const errors: { source: string; message: string }[] = [];
    const fallback = (result: PromiseSettledResult<unknown>, source: string, value: unknown) => {
      if (result.status === 'fulfilled') return result.value;
      errors.push({ source, message: result.reason instanceof Error ? result.reason.message : String(result.reason) });
      return value;
    };

    const snapshot: RawTelemetrySnapshot = {
      serviceId,
      timestamp: Date.now(),
      prometheus: fallback(prometheus, 'prometheus', { cpuUsageMillicores: 0, memoryUsageMB: 0, diskIoBytesPerSec: 0, avgResponseTimeMs: 0, p95LatencyMs: 0, p99LatencyMs: 0, rps: 0 }) as RawTelemetrySnapshot['prometheus'],
      loki: fallback(loki, 'loki', { errorCount: 0, totalCount: 0, entries: [] }) as RawTelemetrySnapshot['loki'],
      jaeger: fallback(jaeger, 'jaeger', []) as RawTelemetrySnapshot['jaeger'],
      k8s: fallback(k8s, 'k8s', { podReplicaCount: 0, hpaTriggerEvents: 0, podSpinUpLagSec: 0, uptimeSeconds: 0 }) as RawTelemetrySnapshot['k8s'],
      sources: {
        prometheus: prometheus.status === 'fulfilled',
        loki: loki.status === 'fulfilled',
        jaeger: jaeger.status === 'fulfilled',
        kubernetes: k8s.status === 'fulfilled',
      },
    };
    if (errors.length > 0) snapshot.sourceErrors = errors;
    return snapshot;
  }

  public async collectServiceSnapshots(serviceIds: string[]): Promise<MultiServiceSnapshot> {
    const results = await Promise.allSettled(serviceIds.map((id) => this.collectServiceSnapshot(id)));
    const snapshots: RawTelemetrySnapshot[] = [];
    const errors: { serviceId: string; message: string }[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') snapshots.push(result.value);
      else errors.push({ serviceId: serviceIds[index], message: result.reason instanceof Error ? result.reason.message : String(result.reason) });
    });
    return { requestedServices: serviceIds, collectedAt: Date.now(), snapshots, errors };
  }

  public async discoverServices(): Promise<{
    prometheusJobs: string[];
    jaegerServices: string[];
    dockerContainers: string[];
    applicationServices: string[];
    infrastructureServices: string[];
    allServices: string[];
  }> {
    let prometheusJobs: string[] = [];
    let jaegerServices: string[] = [];
    let dockerContainers: string[] = [];

    try {
      const promEndpoint = (this.promCollector as any).endpoint || 'http://localhost:9090';
      const res = await fetch(`${promEndpoint}/api/v1/label/job/values`);
      if (res.ok) {
        const body: any = await res.json();
        if (body?.status === 'success' && Array.isArray(body.data)) {
          prometheusJobs = body.data;
        }
      }
    } catch {
      // ignore
    }

    try {
      const jaegerEndpoint = (this.jaegerCollector as any).endpoint || 'http://localhost:16686';
      const res = await fetch(`${jaegerEndpoint}/api/services`);
      if (res.ok) {
        const body: any = await res.json();
        if (Array.isArray(body.data)) {
          jaegerServices = body.data;
        }
      }
    } catch {
      // ignore
    }

    try {
      const containers = await this.dockerCollector.getRunningContainers();
      dockerContainers = containers.map((c) => c.displayId);
    } catch {
      // ignore
    }

    const infraKeywords = [
      'prometheus',
      'jaeger',
      'loki',
      'grafana',
      'collector',
      'anomaly-detection',
      'mongo',
      'postgres',
      'redis',
      'mysql',
    ];
    const isInfra = (name: string) => infraKeywords.some((kw) => name.toLowerCase().includes(kw));

    const allSet = new Set<string>([...dockerContainers, ...prometheusJobs, ...jaegerServices]);
    const allServices = Array.from(allSet);
    const applicationServices = allServices.filter((s) => !isInfra(s));
    const infrastructureServices = allServices.filter((s) => isInfra(s));

    return {
      prometheusJobs,
      jaegerServices,
      dockerContainers,
      applicationServices,
      infrastructureServices,
      allServices,
    };
  }
}
