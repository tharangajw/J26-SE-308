import { PrometheusCollector } from './prometheus.js';
import { LokiCollector } from './loki.js';
import { JaegerCollector } from './jaeger.js';
import { K8sCollector } from './k8s.js';
import { MultiServiceSnapshot, RawTelemetrySnapshot } from './types.js';

export class TelemetryCollectorEngine {
  private promCollector: PrometheusCollector;
  private lokiCollector: LokiCollector;
  private jaegerCollector: JaegerCollector;
  private k8sCollector: K8sCollector;

  constructor(endpoints?: { prometheus?: string; loki?: string; jaeger?: string; kubernetes?: string }) {
    this.promCollector = new PrometheusCollector(endpoints?.prometheus);
    this.lokiCollector = new LokiCollector(endpoints?.loki);
    this.jaegerCollector = new JaegerCollector(endpoints?.jaeger);
    this.k8sCollector = new K8sCollector(endpoints?.kubernetes);
  }

  public async collectServiceSnapshot(serviceId: string): Promise<RawTelemetrySnapshot> {
    const [prometheusResult, lokiResult, jaegerResult, k8sResult] = await Promise.allSettled([
      this.promCollector.fetchServiceMetrics(serviceId),
      this.lokiCollector.fetchLogs(serviceId),
      this.jaegerCollector.fetchTraces(serviceId),
      this.k8sCollector.fetchClusterState(serviceId),
    ]);

    const sourceValue = <T>(result: PromiseSettledResult<T>, fallback: T): T =>
      result.status === 'fulfilled' ? result.value : fallback;

    const promValue = sourceValue(prometheusResult, {
      cpuUsageMillicores: 0,
      memoryUsageMB: 0,
      diskIoBytesPerSec: 0,
      avgResponseTimeMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      rps: 0,
    });

    const lokiValue = sourceValue(lokiResult, {
      errorCount: 0,
      totalCount: 0,
      entries: [],
    });

    const jaegerValue = sourceValue(jaegerResult, []);

    const k8sValue = sourceValue(k8sResult, {
      podReplicaCount: 0,
      hpaTriggerEvents: 0,
      podSpinUpLagSec: 0,
      uptimeSeconds: 0,
    });

    return {
      serviceId,
      timestamp: Date.now(),
      prometheus: promValue,
      loki: lokiValue,
      jaeger: jaegerValue,
      k8s: k8sValue,
      sources: {
        prometheus: prometheusResult.status === 'fulfilled',
        loki: lokiResult.status === 'fulfilled',
        jaeger: jaegerResult.status === 'fulfilled',
        kubernetes: k8sResult.status === 'fulfilled',
      },
    };
  }

  public async collectServiceSnapshots(serviceIds: string[]): Promise<MultiServiceSnapshot> {
    const results = await Promise.allSettled(serviceIds.map((serviceId) => this.collectServiceSnapshot(serviceId)));
    const snapshots: RawTelemetrySnapshot[] = [];
    const errors: { serviceId: string; message: string }[] = [];

    results.forEach((result, index) => {
      const serviceId = serviceIds[index];
      if (result.status === 'fulfilled') {
        snapshots.push(result.value);
      } else {
        errors.push({
          serviceId,
          message: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    });

    return {
      requestedServices: serviceIds,
      collectedAt: Date.now(),
      snapshots,
      errors,
    };
  }
}
