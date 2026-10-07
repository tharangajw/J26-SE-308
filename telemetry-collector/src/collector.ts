import { PrometheusCollector } from './prometheus.js';
import { JaegerCollector } from './jaeger.js';
import { K8sCollector } from './k8s.js';
import { MultiServiceSnapshot, RawTelemetrySnapshot } from './types.js';
import { PrometheusCollector } from './prometheus';
import { JaegerCollector } from './jaeger';
import { K8sCollector } from './k8s';
import { LokiCollector } from './loki';
import { RawTelemetrySnapshot } from './types';

export class TelemetryCollectorEngine {
  private promCollector: PrometheusCollector;
  private jaegerCollector: JaegerCollector;
  private k8sCollector: K8sCollector;
  private lokiCollector: LokiCollector;

  constructor(endpoints?: { prometheus?: string; jaeger?: string; kubernetes?: string }) {
    this.promCollector = new PrometheusCollector(endpoints?.prometheus);
    this.jaegerCollector = new JaegerCollector(endpoints?.jaeger);
    this.k8sCollector = new K8sCollector(endpoints?.kubernetes);
  }

  public async collectServiceSnapshot(serviceId: string): Promise<RawTelemetrySnapshot> {
    const [prometheusResult, jaegerResult, k8sResult] = await Promise.allSettled([
  constructor() {
    this.promCollector = new PrometheusCollector();
    this.jaegerCollector = new JaegerCollector();
    this.k8sCollector = new K8sCollector();
    this.lokiCollector = new LokiCollector();
  }

  public async collectServiceSnapshot(serviceId: string): Promise<RawTelemetrySnapshot> {
    const [prometheus, loki, jaeger, k8s] = await Promise.allSettled([
      this.promCollector.fetchServiceMetrics(serviceId),
      this.lokiCollector.fetchLogs(serviceId),
      this.jaegerCollector.fetchTraces(serviceId),
      this.k8sCollector.fetchClusterState(serviceId),
    ]);

    const sourceErrors: RawTelemetrySnapshot['sourceErrors'] = [];
    const prometheus = prometheusResult.status === 'fulfilled' ? prometheusResult.value : this.emptyPrometheus(sourceErrors, prometheusResult.reason);
    const jaeger = jaegerResult.status === 'fulfilled' ? jaegerResult.value : this.emptyJaeger(sourceErrors, jaegerResult.reason);
    const k8s = k8sResult.status === 'fulfilled' ? k8sResult.value : this.emptyK8s(sourceErrors, k8sResult.reason);
    const sourceValue = <T>(result: PromiseSettledResult<T>, fallback: T): T =>
      result.status === 'fulfilled' ? result.value : fallback;

    const promValue = sourceValue(prometheus, {
      cpuUsageMillicores: 0, memoryUsageMB: 0, diskIoBytesPerSec: 0,
      avgResponseTimeMs: 0, p95LatencyMs: 0, p99LatencyMs: 0, rps: 0,
    });
    const lokiValue = sourceValue(loki, { errorCount: 0, totalCount: 0, entries: [] });
    const jaegerValue = sourceValue(jaeger, []);
    const k8sValue = sourceValue(k8s, { podReplicaCount: 0, hpaTriggerEvents: 0, podSpinUpLagSec: 0, uptimeSeconds: 0 });

    return {
      serviceId,
      timestamp: Date.now(),
      prometheus,
      jaeger,
      k8s,
      ...(sourceErrors.length > 0 ? { sourceErrors } : {}),
      prometheus: promValue,
      loki: lokiValue,
      jaeger: jaegerValue,
      k8s: k8sValue,
      sources: {
        prometheus: prometheus.status === 'fulfilled',
        loki: loki.status === 'fulfilled',
        jaeger: jaeger.status === 'fulfilled',
        kubernetes: k8s.status === 'fulfilled',
      },
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
