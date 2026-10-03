import { PrometheusCollector } from './prometheus';
import { JaegerCollector } from './jaeger';
import { K8sCollector } from './k8s';
import { RawTelemetrySnapshot } from './types';

export class TelemetryCollectorEngine {
  private promCollector: PrometheusCollector;
  private jaegerCollector: JaegerCollector;
  private k8sCollector: K8sCollector;

  constructor() {
    this.promCollector = new PrometheusCollector();
    this.jaegerCollector = new JaegerCollector();
    this.k8sCollector = new K8sCollector();
  }

  public async collectServiceSnapshot(serviceId: string): Promise<RawTelemetrySnapshot> {
    const [prometheus, jaeger, k8s] = await Promise.all([
      this.promCollector.fetchServiceMetrics(serviceId),
      this.jaegerCollector.fetchTraces(serviceId),
      this.k8sCollector.fetchClusterState(serviceId),
    ]);

    return {
      serviceId,
      timestamp: Date.now(),
      prometheus,
      jaeger,
      k8s,
    };
  }
}
