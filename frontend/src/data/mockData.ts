export interface MaturityDimension {
  id: string;
  name: string;
  score: number;
  level: string;
  color: string;
  metrics: { name: string; score: number; weight: number }[];
  weaknesses: string[];
}

export interface FaultType {
  id: string;
  name: string;
  icon: string;
  badgeClass: string;
  desc: string;
}

export interface TelemetrySource {
  name: string;
  category: string;
  status: 'CONNECTED' | 'STREAMING';
}

export const mockTelemetrySources: TelemetrySource[] = [
  { name: 'Prometheus', category: 'CPU, Memory, Error Metrics', status: 'STREAMING' },
  { name: 'Jaeger', category: 'Distributed Tracing & Latency', status: 'STREAMING' },
  { name: 'ELK Stack', category: 'Logs & System Exceptions', status: 'STREAMING' },
  { name: 'Kubernetes API', category: 'Pods & Auto-Scaling', status: 'CONNECTED' },
  { name: 'Istio Service Mesh', category: 'Circuit Breakers & Retries', status: 'STREAMING' }
];

export interface ArchitectureAssessment {
  id: string;
  projectName: string;
  architectureType: string;
  lastEvaluated: string;
  evaluationDuration: string;
  confidence: number;
  overallScore: number;
  overallLevel: string;
  baselineComparison: number;
  previousScore: number;
  dimensions: {
    cicd: MaturityDimension;
    performance: MaturityDimension;
    observability: MaturityDimension;
    faultTolerance: MaturityDimension;
  };
  recommendations: {
    id: string;
    title: string;
    impact: "High" | "Medium" | "Low";
    effort: "High" | "Medium" | "Low";
    description: string;
    expectedImprovement: string;
    evidence: string;
    currentScore: number;
  }[];
  history: {
    assessmentId: string;
    date: string;
    overall: number;
    cicd: number;
    performance: number;
    observability: number;
    faultTolerance: number;
  }[];
}


export const mockAssessmentData: ArchitectureAssessment = {
  id: "ARCH-042",
  projectName: "Payment Gateway Core",
  architectureType: "Microservices",
  lastEvaluated: "2m ago",
  evaluationDuration: "43.8s",
  confidence: 94,
  overallScore: 78.4,
  overallLevel: "Managed",
  baselineComparison: 12.4,
  previousScore: 72.1,
  dimensions: {
    cicd: {
      id: "cicd",
      name: "CI/CD",
      score: 82,
      level: "Optimized",
      color: "var(--color-brand-cicd)",
      metrics: [
        { name: "Pipeline Automation", score: 95, weight: 1.5 },
        { name: "Deployment Frequency", score: 85, weight: 1.2 },
        { name: "Lead Time", score: 80, weight: 1.0 },
        { name: "Change Failure Rate", score: 90, weight: 1.5 },
        { name: "Rollback Capability", score: 75, weight: 1.2 },
        { name: "Environment Consistency", score: 80, weight: 1.0 },
        { name: "Test Automation", score: 70, weight: 1.2 },
        { name: "Infrastructure Automation", score: 85, weight: 1.0 },
      ],
      weaknesses: ["Test Automation coverage below 80% baseline", "Manual approval gates delay Lead Time"],
    },
    performance: {
      id: "performance",
      name: "Performance",
      score: 74,
      level: "Intermediate",
      color: "var(--color-brand-perf)",
      metrics: [
        { name: "Response Time", score: 70, weight: 1.5 },
        { name: "Throughput", score: 80, weight: 1.2 },
        { name: "Resource Utilization", score: 75, weight: 1.0 },
        { name: "Scalability", score: 78, weight: 1.5 },
        { name: "Load Testing", score: 65, weight: 1.0 },
        { name: "Performance Regression", score: 72, weight: 1.2 },
      ],
      weaknesses: ["No automated load testing in pipeline", "P99 Response Time degradation during peak hours"],
    },
    observability: {
      id: "observability",
      name: "Observability",
      score: 86,
      level: "Advanced",
      color: "var(--color-brand-obs)",
      metrics: [
        { name: "Logging", score: 90, weight: 1.0 },
        { name: "Metrics", score: 88, weight: 1.2 },
        { name: "Distributed Tracing", score: 85, weight: 1.5 },
        { name: "Alerting", score: 80, weight: 1.5 },
        { name: "Monitoring Coverage", score: 90, weight: 1.2 },
        { name: "Incident Detection", score: 85, weight: 1.5 },
        { name: "Root Cause Analysis", score: 82, weight: 1.0 },
      ],
      weaknesses: ["Alert fatigue: excessive warning-level alerts without tuning", "Missing trace context in 15% of downstream requests"],
    },
    faultTolerance: {
      id: "faultTolerance",
      name: "Fault Tolerance",
      score: 71,
      level: "Intermediate",
      color: "var(--color-brand-fault)",
      metrics: [
        { name: "Retry Mechanisms", score: 75, weight: 1.0 },
        { name: "Circuit Breakers", score: 60, weight: 1.5 },
        { name: "Failover", score: 70, weight: 1.5 },
        { name: "Graceful Degradation", score: 65, weight: 1.2 },
        { name: "Redundancy", score: 80, weight: 1.2 },
        { name: "Recovery Time", score: 75, weight: 1.5 },
        { name: "Disaster Recovery", score: 72, weight: 1.0 },
        { name: "Chaos Testing", score: 30, weight: 1.0 },
      ],
      weaknesses: ["Missing circuit breakers on 3 external payment provider integrations", "No automated chaos engineering implemented"],
    },
  },
  recommendations: [
    {
      id: "REC-01",
      title: "Introduce circuit breaker patterns",
      impact: "High",
      effort: "Medium",
      description: "Implement circuit breaker patterns on all external API integrations to prevent cascading failures during provider outages. Currently 3 critical providers lack this.",
      expectedImprovement: "+8-12 points in Fault Tolerance",
      evidence: "3 architectural weaknesses detected in dependency analysis",
      currentScore: 58,
    },
    {
      id: "REC-02",
      title: "Automate Load Testing in CI pipeline",
      impact: "Medium",
      effort: "Medium",
      description: "Integrate k6 or similar load testing framework into the pre-deployment pipeline to catch performance regressions earlier.",
      expectedImprovement: "+5-8 points in Performance",
      evidence: "Load testing metric scored 65/100",
      currentScore: 65,
    },
    {
      id: "REC-03",
      title: "Tune Alert Thresholds",
      impact: "Medium",
      effort: "Low",
      description: "Review and tune P3 and P4 alert thresholds to reduce alert fatigue and improve signal-to-noise ratio.",
      expectedImprovement: "+3-5 points in Observability",
      evidence: "High frequency of non-actionable alerts identified",
      currentScore: 80,
    }
  ],
  history: [
    { assessmentId: "ARCH-001", date: "2026-02-15", overall: 62.4, cicd: 65, performance: 58, observability: 70, faultTolerance: 55 },
    { assessmentId: "ARCH-012", date: "2026-04-20", overall: 68.7, cicd: 72, performance: 64, observability: 75, faultTolerance: 62 },
    { assessmentId: "ARCH-028", date: "2026-06-10", overall: 72.1, cicd: 78, performance: 68, observability: 80, faultTolerance: 64 },
    { assessmentId: "ARCH-042", date: "2026-08-17", overall: 78.4, cicd: 82, performance: 74, observability: 86, faultTolerance: 71 },
  ]
};


// Mock Data: Resilience & Fault Tolerance Engine

// Mock Microservices Type
export interface Service {
  name: string;
  id: string;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  faultType: string | null;
  port: number | null;
  restarts: number | null;
  processUptimeSeconds?: number | null;
  recoveriesObserved?: number;
  chaosSupported?: boolean;
  cpu: number;
  memory: number;
  latency: number;
}

// Mock Fault Metrics Type
export interface FaultMetrics {
  cpu: number;
  memory: number;
  availability: number;
  latency: number;
  errorRate: number;
  restarts: number;
  mttr: number;
  failoverSuccess: number;
  score: number;
  maturity: 'Initial' | 'Developing' | 'Mature' | 'Optimized';
}

// Mock AI Failure Prediction Type
export interface AiFailurePrediction {
  failureProbability: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  predictedFailureTimeSec: number;
  targetService: string;
  confidence: number;
}

// Mock Self-Healing Metrics Type
export interface SelfHealingMetrics {
  podRestartSuccessRate: number;
  replicaReplacementSuccessRate: number;
  hpaEffectiveness: number;
  circuitBreakerEffectiveness: number;
}

// Mock Telemetry History Point Type
export interface HistoryPoint {
  timestamp: string;
  cpu: number;
  memory: number;
  latency: number;
  errorRate: number;
  availability: number;
  score: number;
}

// Mock Fault Card Settings Type
export interface CardSetting {
  target: string;
  duration: number;
  latencyMs: number;
  errorRate: number;
}

// Mock Active Fault Type
export interface ActiveFault {
  id: string;
  targetId: string;
  faultType: string;
  faultName: string;
  badgeClass: string;
  duration: number;
  endTime: number;
  remainingSec: number;
}

export interface KubernetesChaosLog {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SYSTEM';
  source: 'Chaos Mesh' | 'Docker Compose' | 'Kubernetes' | 'Prometheus' | 'Grafana';
  message: string;
}

// Mock Active Chaos Event Type
export interface ActiveChaosEvent {
  service: string;
  targetId: string;
  time: string;
  type: string;
  status: string;
  recoveryTime?: string;
  engine?: 'Chaos Mesh' | 'Docker Compose';
  experimentName?: string;
  latencyMs?: number;
  errorRatePercent?: number;
  kubernetesLogs?: KubernetesChaosLog[];
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

export interface KubernetesValidationSnapshot {
  podCount: number;
  podRestartCount: number;
  deploymentCount: number;
  desiredReplicas: number;
  readyReplicas: number;
  coreServices: Array<{ name: string; podCount: number; readyPodCount: number; restartCount: number }>;
  corePods: Array<{ id: string; namespace: string; podName: string; name: string; phase: string; ready: boolean; chaosFaultActive: boolean; restartCount: number; port: number | null }>;
  hpas: Array<{ name: string; namespace: string; currentReplicas: number; desiredReplicas: number; currentCpuPercent: number | null; targetCpuPercent: number | null }>;
  circuitBreaker: { configured: false; status: 'NOT_MEASURED'; reason: string };
}

// Mock AI Recommendation Type
export interface AiRecommendation {
  level: 'critical' | 'warning' | 'info';
  icon: string;
  title: string;
  detail: string;
  action: string;
}

// Mock Recent Activity Type
export interface RecentActivity {
  id: string;
  timestamp: string;
  type: 'INJECT' | 'HEAL' | 'RULE_ALERT' | 'AI_RECOMMEND' | 'SYSTEM';
  title: string;
  description: string;
  status: 'info' | 'success' | 'warning' | 'danger';
}

// Mock Microservices List
export const mockFaultToleranceServices: Service[] = [
  { name: 'API Gateway', id: 'gateway', status: 'ONLINE', faultType: null, port: 3000, restarts: 0, cpu: 22, memory: 35, latency: 15 },
  { name: 'User Service', id: 'user-service', status: 'ONLINE', faultType: null, port: 3002, restarts: 0, cpu: 18, memory: 44, latency: 28 },
  { name: 'Order Service', id: 'order-service', status: 'ONLINE', faultType: null, port: 3003, restarts: 0, cpu: 25, memory: 52, latency: 45 },
  { name: 'Book Service', id: 'book-service', status: 'ONLINE', faultType: null, port: 3001, restarts: 0, cpu: 19, memory: 41, latency: 22 }
];

// Mock Fault Injection Types
export const mockFaultTypes: FaultType[] = [
  {
    id: 'SERVICE_DOWN',
    name: 'Service HTTP Outage',
    icon: 'Power',
    badgeClass: 'fault-down',
    desc: 'Returns HTTP 503 from the selected service for the experiment duration'
  },
  {
    id: 'POD_RESTART',
    name: 'Pod Restart',
    icon: 'RotateCcw',
    badgeClass: 'fault-down',
    desc: 'Kills the selected Kubernetes pod so its controller recreates it'
  },
  {
    id: 'LATENCY',
    name: 'Network Latency Delay',
    icon: 'Clock',
    badgeClass: 'fault-latency',
    desc: 'Delays requests handled by the selected service'
  },
  {
    id: 'API_ERROR',
    name: 'API Error Spike (500)',
    icon: 'AlertTriangle',
    badgeClass: 'fault-error',
    desc: 'Returns HTTP 500 responses at the configured rate (Compose); Chaos Mesh targets a percentage of pods'
  },
  {
    id: 'HIGH_CPU',
    name: 'High CPU Stress (90%+)',
    icon: 'Cpu',
    badgeClass: 'fault-cpu',
    desc: 'Uses one bounded worker thread to drive CPU load; auto-stops with the experiment'
  },
  {
    id: 'HIGH_MEMORY',
    name: 'High Memory Pressure',
    icon: 'HardDrive',
    badgeClass: 'fault-memory',
    desc: 'Allocates up to 128 MiB in the selected service; releases it when the experiment ends'
  },
  {
    id: 'RATE_LIMIT',
    name: 'Rate Limit (HTTP 429)',
    icon: 'ShieldAlert',
    badgeClass: 'fault-ratelimit',
    desc: 'Returns HTTP 429 responses from the selected service'
  },
  {
    id: 'CASCADING_FAILURE',
    name: 'Cascading Outage',
    icon: 'Flame',
    badgeClass: 'fault-cascading',
    desc: 'Fails a Book or User dependency so dependent order requests fail naturally'
  }
];

// Mock Initial Fault Metrics
export const mockInitialFaultMetrics: FaultMetrics = {
  cpu: 45,
  memory: 55,
  availability: 99.85,
  latency: 120,
  errorRate: 0.25,
  restarts: 0,
  mttr: 12,
  failoverSuccess: 100,
  score: 100,
  maturity: 'Optimized'
};

// Mock Default Fault Card Studio Parameters
export const mockDefaultCardSettings: Record<string, CardSetting> = {
  SERVICE_DOWN: { target: 'all', duration: 15, latencyMs: 2500, errorRate: 35 },
  LATENCY: { target: 'all', duration: 15, latencyMs: 2500, errorRate: 35 },
  API_ERROR: { target: 'all', duration: 15, latencyMs: 2500, errorRate: 35 },
  HIGH_CPU: { target: 'all', duration: 15, latencyMs: 2500, errorRate: 35 },
  HIGH_MEMORY: { target: 'all', duration: 15, latencyMs: 2500, errorRate: 35 },
  RATE_LIMIT: { target: 'all', duration: 12, latencyMs: 2500, errorRate: 35 },
  CASCADING_FAILURE: { target: 'all', duration: 15, latencyMs: 3000, errorRate: 40 }
};

// Mock Recent Activity Feed
export const mockInitialActivities: RecentActivity[] = [
  {
    id: 'act-1',
    timestamp: 'Just now',
    type: 'SYSTEM',
    title: 'Cluster Telemetry Initialized',
    description: 'Real-time telemetry monitoring active across 4 microservices.',
    status: 'info'
  },
  {
    id: 'act-2',
    timestamp: '2 mins ago',
    type: 'HEAL',
    title: 'Self-Healing Engine Executed',
    description: 'gateway container restarted successfully after health check failure.',
    status: 'success'
  },
  {
    id: 'act-3',
    timestamp: '5 mins ago',
    type: 'RULE_ALERT',
    title: 'SLA Rule Evaluation Passed',
    description: 'Resilience score reached 100/100 (+100 pts rule rewards).',
    status: 'success'
  }
];

// Mock Initial Telemetry History Generator
export const generateInitialHistory = (): HistoryPoint[] => {
  const data: HistoryPoint[] = [];
  const now = new Date();
  for (let i = 20; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 15 * 1000);
    data.push({
      timestamp: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      cpu: Math.floor(Math.random() * 10) + 40,
      memory: Math.floor(Math.random() * 5) + 50,
      latency: Math.floor(Math.random() * 20) + 110,
      errorRate: parseFloat((Math.random() * 0.3 + 0.1).toFixed(2)),
      availability: parseFloat((Math.random() * 0.1 + 99.85).toFixed(2)),
      score: 100
    });
  }
  return data;
};
