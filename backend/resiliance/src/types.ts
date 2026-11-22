// Defines shared TypeScript data contracts for resilience metrics, services, and experiments.
export type MaturityLevel = 'Initial' | 'Developing' | 'Mature' | 'Optimized';

export interface FaultMetrics {
  cpu: number;             // % utilization (Target < 70%)
  memory: number;          // % utilization (Target < 75%)
  availability: number;    // % uptime (Target >= 99.0%)
  latency: number;         // ms average API latency (Target < 50ms)
  errorRate: number;       // % 5xx errors (Target < 1.0%)
  restarts: number;        // total pod restarts (Target < 2)
  mttr: number;            // seconds Mean Time to Repair (Target <= 15s)
  failoverSuccess: number; // % redirection rate (Target = 100%)
  score: number;           // Composite R-Score (0 - 100)
  maturity: MaturityLevel; // Qualitative tier
}

export interface Service {
  id: string;
  name: string;
  type: string;
  status: 'HEALTHY' | 'DEGRADED' | 'OFFLINE';
  cpu: number;
  memory: number;
  latency: number;
  errorRate: number;
  restarts: number | null;
  processUptimeSeconds?: number | null;
  recoveriesObserved?: number;
  port?: number | null;
  chaosSupported?: boolean;
  faultType?: string;
}

export interface RScoreRuleResult {
  rule: 'Availability' | 'CPU' | 'Memory' | 'ErrorRate' | 'Restarts' | 'MTTR' | 'Latency' | 'Failover';
  variable: 'A' | 'C' | 'M' | 'E' | 'R' | 'T' | 'L' | 'F';
  threshold: string;
  actualValue: number;
  passed: boolean;
  points: number;
}

export interface SelfHealingMetrics {
  podRestartSuccessRate: number | null;
  replicaReplacementSuccessRate: number | null;
  hpaEffectiveness: number | null;
  circuitBreakerEffectiveness: number | null;
  selfHealingScore: number | null;
}

export interface KubernetesValidationSnapshot {
  podCount: number;
  podRestartCount: number;
  deploymentCount: number;
  desiredReplicas: number;
  readyReplicas: number;
  coreServices: Array<{
    name: string;
    podCount: number;
    readyPodCount: number;
    restartCount: number;
  }>;
  corePods: Array<{
    id: string;
    namespace: string;
    podName: string;
    name: string;
    phase: string;
    ready: boolean;
    chaosFaultActive: boolean;
    restartCount: number;
    port: number | null;
  }>;
  hpas: Array<{
    name: string;
    namespace: string;
    currentReplicas: number;
    desiredReplicas: number;
    currentCpuPercent: number | null;
    targetCpuPercent: number | null;
  }>;
  circuitBreaker: {
    configured: false;
    status: 'NOT_MEASURED';
    reason: string;
  };
}

export interface ChaosInjectRequest {
  serviceId: string;
  faultType: string;
  duration?: number;
  latencyMs?: number;
  errorRate?: number;
  engine?: 'Chaos Mesh' | 'Docker Compose';
}

export interface KubernetesChaosLog {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SYSTEM';
  source: 'Chaos Mesh' | 'Docker Compose' | 'Kubernetes' | 'Prometheus' | 'Grafana';
  message: string;
}

export interface ActiveChaosEvent {
  serviceId: string;
  serviceName: string;
  faultType: string;
  injectedAt: number;
  durationSec: number;
  status: string;
  engine: 'Chaos Mesh' | 'Docker Compose';
  experimentName: string;
  latencyMs?: number;
  errorRatePercent?: number;
  kubernetesLogs: KubernetesChaosLog[];
  metricsSnapshot?: {
    preChaosAvailability: number;
    postChaosAvailability: number;
    mttrObservedSec?: number;
    errorRateSpike: number;
  };
  selfHealingValidation?: {
    podRestarted: boolean;
    podRestartTimeSec?: number;
    replicaReplaced: boolean;
    hpaTriggered: boolean;
    circuitBreakerTripped: boolean;
    validationStatus: 'VALIDATING' | 'PASSED' | 'FAILED' | 'RECOVERED';
  };
}

export interface DeviceHardwareInfo {
  hostname: string;
  platform: string;
  release: string;
  cpuModel: string;
  cpuCores: number;
  totalMemoryGB: number;
  freeMemoryGB: number;
  usedMemoryGB: number;
  systemUptimeHours: number;
}

export interface AiFailurePrediction {
  failureProbability: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  predictedFailureTimeSec: number;
  targetService: string;
  confidence: number;
}

export interface ResilienceScoreResponse {
  timestamp: string;
  metrics: FaultMetrics;
  services: Service[];
  rules: RScoreRuleResult[];
  selfHealing: SelfHealingMetrics;
  kubernetesValidation?: KubernetesValidationSnapshot | null;
  activeChaos: ActiveChaosEvent | null;
  sources: {
    prometheus: boolean;
    kubernetes: boolean;
    streamMode: 'REAL_DEVICE_TELEMETRY' | 'LIVE_PROMETHEUS' | 'FALLBACK_SYNTHESIS';
  };
  deviceHardware?: DeviceHardwareInfo;
  aiPrediction?: AiFailurePrediction;
}
