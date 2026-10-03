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
}
