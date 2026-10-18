
// Real-Time R-Score Engine
// Raw telemetry inputs collected from Prometheus + K8s
// These are the 8 metrics that feed the R-Score formula:R-Score = 12.5A + 12.5C + 12.5M + 12.5E + 12.5R + 12.5T + 12.5L + 12.5F

export interface FaultToleranceRawMetrics {
  serviceId: string;
  timestamp: number; // UTC epoch ms

  // A — Availability (from Prometheus `up` metric, %)
  availabilityPercent: number;

  // C — CPU utilization (from container_cpu_usage_seconds_total, %)
  cpuPercent: number;

  // M — Memory utilization (from container_memory_working_set_bytes, %)
  memoryPercent: number;

  // E — Error rate (http 5xx / total requests, %)
  errorRate: number;

  // R — Total pod restarts (from kube_pod_container_status_restarts_total)
  totalRestarts: number;

  // T — Mean Time To Repair in seconds (derived from K8s pod event timestamps)
  mttrSeconds: number;

  // L — Average API latency in ms (P95 from Prometheus histogram_quantile)
  avgLatencyMs: number;

  // F — Failover success rate (ready replicas / desired replicas * 100, %)
  failoverSuccessRate: number;
}

// Single R-Score rule evaluation result
export interface RScoreRuleResult {
  rule: 'Availability' | 'CPU' | 'Memory' | 'ErrorRate' | 'Restarts' | 'MTTR' | 'Latency' | 'Failover';
  variable: 'A' | 'C' | 'M' | 'E' | 'R' | 'T' | 'L' | 'F';
  threshold: string;        // human-readable e.g. '> 99.0%'
  actualValue: number;
  passed: boolean;
  points: number;           // 12.5 if passed, 0 if failed
}

// Computed R-Score snapshot for one service at one point in time
export interface RScoreSnapshot {
  serviceId: string;
  timestamp: number;
  rScore: number;            // 0–100
  maturityLevel: 'Initial' | 'Developing' | 'Mature' | 'Optimized';
  ruleResults: RScoreRuleResult[];
  passingRules: number;      // out of 8
  totalRules: number;        // always 8
}

// Chaos experiment event — recorded when a fault is injected
export type ChaosFaultType =
  | 'SERVICE_DOWN'
  | 'LATENCY'
  | 'API_ERROR'
  | 'HIGH_CPU'
  | 'HIGH_MEMORY'
  | 'RATE_LIMIT'
  | 'CASCADING_FAILURE';

export interface ChaosExperimentRecord {
  experimentId: string;
  faultType: ChaosFaultType;
  targetService: string;
  injectedAt: number;                // UTC epoch ms — when fault was injected
  resolvedAt: number | null;         // null if still active
  recoveryTimeSec: number | null;    // null if not yet recovered
  availabilityImpactPercent: number; // % drop during the fault window
  rScoreBefore: number;              // R-Score snapshot before injection
  rScoreAfter: number | null;        // R-Score after recovery (null if pending)
  recovered: boolean;
  faultRecoverySuccessRate: number;  // FRSR = successful recoveries / total attempts * 100
}

// Kubernetes self-healing effectiveness snapshot
export interface SelfHealingSnapshot {
  serviceId: string;
  timestamp: number;

  // % of pod restarts that completed successfully without manual intervention
  podRestartSuccessRate: number;

  // % of failed replicas replaced successfully by K8s replication controller
  replicaReplacementSuccessRate: number;

  // How effectively HPA scaled to prevent resource exhaustion (0–100)
  hpaEffectiveness: number;

  // How effectively circuit breakers prevented cascading failures (0–100)
  circuitBreakerEffectiveness: number;

  // Weighted composite Self-Healing Score (0–100)
  // Formula: (podRestart * 0.3) + (replicaReplacement * 0.3) + (hpa * 0.2) + (circuitBreaker * 0.2)
  selfHealingScore: number;
}


// Full combined fault tolerance data snapshot for one service
export interface FaultToleranceCollectedSnapshot {
  serviceId: string;
  timestamp: number;

  // Raw telemetry inputs (8 metrics)
  rawMetrics: FaultToleranceRawMetrics;

  // Computed R-Score from the raw metrics
  rScore: RScoreSnapshot;

  // K8s self-healing effectiveness
  selfHealing: SelfHealingSnapshot;

  // If a chaos experiment is currently active for this service
  activeChaosExperiment: ChaosExperimentRecord | null;

  // Which data sources successfully responded
  sources: {
    prometheus: boolean;
    kubernetes: boolean;
  };
}

// Aggregated cluster-wide resilience summary
export interface ClusterResilienceSummary {
  timestamp: number;
  serviceCount: number;
  avgRScore: number;                  // average across all services
  overallMaturityLevel: 'Initial' | 'Developing' | 'Mature' | 'Optimized';
  criticalServices: string[];         // serviceIds with R-Score < 50
  degradedServices: string[];         // serviceIds with R-Score 50–74
  snapshots: FaultToleranceCollectedSnapshot[];
}
