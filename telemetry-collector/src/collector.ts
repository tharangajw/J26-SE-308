import { PrometheusCollector } from './prometheus.js';
import { JaegerCollector } from './jaeger.js';
import { K8sCollector } from './k8s.js';
import { MultiServiceSnapshot, RawTelemetrySnapshot } from './types.js';

export class TelemetryCollectorEngine {
  private promCollector: PrometheusCollector;
  private jaegerCollector: JaegerCollector;
  private k8sCollector: K8sCollector;

  constructor(endpoints?: { prometheus?: string; jaeger?: string; kubernetes?: string }) {
    this.promCollector = new PrometheusCollector(endpoints?.prometheus);
    this.jaegerCollector = new JaegerCollector(endpoints?.jaeger);
    this.k8sCollector = new K8sCollector(endpoints?.kubernetes);
  }

  public async collectServiceSnapshot(serviceId: string): Promise<RawTelemetrySnapshot> {
    const [prometheusResult, jaegerResult, k8sResult] = await Promise.allSettled([
      this.promCollector.fetchServiceMetrics(serviceId),
      this.jaegerCollector.fetchTraces(serviceId),
      this.k8sCollector.fetchClusterState(serviceId),
    ]);

    const sourceErrors: RawTelemetrySnapshot['sourceErrors'] = [];
    const prometheus = prometheusResult.status === 'fulfilled' ? prometheusResult.value : this.emptyPrometheus(sourceErrors, prometheusResult.reason);
    const jaeger = jaegerResult.status === 'fulfilled' ? jaegerResult.value : this.emptyJaeger(sourceErrors, jaegerResult.reason);
    const k8s = k8sResult.status === 'fulfilled' ? k8sResult.value : this.emptyK8s(sourceErrors, k8sResult.reason);

    return {
      serviceId,
      timestamp: Date.now(),
      prometheus,
      jaeger,
      k8s,
      ...(sourceErrors.length > 0 ? { sourceErrors } : {}),
    };
  }

  private emptyPrometheus(errors: NonNullable<RawTelemetrySnapshot['sourceErrors']>, reason: unknown) {
    errors.push({ source: 'prometheus', message: reason instanceof Error ? reason.message : String(reason) });
    return { cpuUsageMillicores: 0, memoryUsageMB: 0, diskIoBytesPerSec: 0, avgResponseTimeMs: 0, p95LatencyMs: 0, p99LatencyMs: 0, rps: 0 };
  }

  private emptyJaeger(errors: NonNullable<RawTelemetrySnapshot['sourceErrors']>, reason: unknown) {
    errors.push({ source: 'jaeger', message: reason instanceof Error ? reason.message : String(reason) });
    return [];
  }

  private emptyK8s(errors: NonNullable<RawTelemetrySnapshot['sourceErrors']>, reason: unknown) {
    errors.push({ source: 'k8s', message: reason instanceof Error ? reason.message : String(reason) });
    return { podReplicaCount: 0, hpaTriggerEvents: 0, podSpinUpLagSec: 0, uptimeSeconds: 0 };
  }

  public async collectServiceSnapshots(serviceIds: string[]): Promise<MultiServiceSnapshot> {
    const results = await Promise.allSettled(serviceIds.map((serviceId) => this.collectServiceSnapshot(serviceId)));
    const snapshots: RawTelemetrySnapshot[] = [];
    const errors: { serviceId: string; message: string }[] = [];

    results.forEach((result, index) => {
      const serviceId = serviceIds[index];
      if (result.status === 'fulfilled') snapshots.push(result.value);
      else errors.push({ serviceId, message: result.reason instanceof Error ? result.reason.message : String(result.reason) });
    });

    return { requestedServices: serviceIds, collectedAt: Date.now(), snapshots, errors };
  }
}
