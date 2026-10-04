export interface PrometheusMetrics {
  cpuUsageMillicores: number;
  memoryUsageMB: number;
  diskIoBytesPerSec: number;
  avgResponseTimeMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  rps: number;
}

export interface JaegerTraceSummary {
  traceId: string;
  rootService: string;
  spanCount: number;
  depth: number;
  durationMs: number;
  errorCount: number;
}

export interface K8sClusterState {
  podReplicaCount: number;
  hpaTriggerEvents: number;
  podSpinUpLagSec: number;
  uptimeSeconds: number;
}

export interface RawTelemetrySnapshot {
  serviceId: string;
  timestamp: number; // UTC Epoch millis
  prometheus: PrometheusMetrics;
  jaeger: JaegerTraceSummary[];
  k8s: K8sClusterState;
  sourceErrors?: { source: 'prometheus' | 'jaeger' | 'k8s'; message: string }[];
}

export interface MultiServiceSnapshot {
  requestedServices: string[];
  collectedAt: number;
  snapshots: RawTelemetrySnapshot[];
  errors: { serviceId: string; message: string }[];
}
