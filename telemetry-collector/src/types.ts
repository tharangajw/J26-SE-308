export interface PrometheusMetrics {
  cpuUsageMillicores: number;
  memoryUsageMB: number;
  diskIoBytesPerSec: number;
  avgResponseTimeMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  rps: number;
}

export interface LokiLogEntry {
  timestamp: string;
  level: string;
  message: string;
  labels: Record<string, string>;
}

export interface LokiMetrics {
  errorCount: number;
  totalCount: number;
  entries: LokiLogEntry[];
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
  loki: LokiMetrics;
  jaeger: JaegerTraceSummary[];
  k8s: K8sClusterState;
  sources: {
    prometheus: boolean;
    loki: boolean;
    jaeger: boolean;
    kubernetes: boolean;
  };
}
