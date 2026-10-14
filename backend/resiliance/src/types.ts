export type MaturityLevel = 'Initial' | 'Developing' | 'Mature' | 'Optimized';

export interface FaultMetrics {
  cpu: number;             // % utilization (Target < 70%)
  memory: number;          // % utilization (Target < 75%)
  availability: number;    // % uptime (Target > 99.0%)
  latency: number;         // ms average API latency (Target < 50ms)
  errorRate: number;       // % 5xx errors (Target < 1.0%)
  restarts: number;        // total pod restarts (Target < 2)
  mttr: number;            // seconds Mean Time to Repair (Target < 15s)
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
  restarts: number;
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
  podRestartSuccessRate: number;
  replicaReplacementSuccessRate: number;
  hpaEffectiveness: number;
  circuitBreakerEffectiveness: number;
  selfHealingScore: number;
}

export interface ChaosInjectRequest {
  serviceId: string;
  faultType: string;
  duration?: number;
  latencyMs?: number;
  errorRate?: number;
  engine?: 'Chaos Mesh';
}

export interface KubernetesChaosLog {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SYSTEM';
  source: 'Chaos Mesh' | 'Kubernetes' | 'Prometheus' | 'Grafana';
  message: string;
}

export interface ActiveChaosEvent {
  serviceId: string;
  serviceName: string;
  faultType: string;
  injectedAt: number;
  durationSec: number;
  status: string;
  engine: 'Chaos Mesh';
  experimentName: string;
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
  activeChaos: ActiveChaosEvent | null;
  sources: {
    prometheus: boolean;
    kubernetes: boolean;
    streamMode: 'REAL_DEVICE_TELEMETRY' | 'LIVE_PROMETHEUS' | 'FALLBACK_SYNTHESIS';
  };
  deviceHardware?: DeviceHardwareInfo;
  aiPrediction?: AiFailurePrediction;
}
