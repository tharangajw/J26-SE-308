import type { MaturityLevel, RScoreRuleResult } from './types.ts';

export const THRESHOLDS = {
  availabilityPercent: { min: 99.0, label: '>= 99.0%' },
  cpuPercent: { max: 70.0, label: '< 70%' },
  memoryPercent: { max: 75.0, label: '< 75%' },
  errorRate: { max: 1.0, label: '< 1.0%' },
  totalRestarts: { max: 2, label: '< 2 restarts' },
  mttrSeconds: { max: 15.0, label: '<= 15s' },
  avgLatencyMs: { max: 50.0, label: '< 50ms' },
  failoverSuccessRate: { min: 100.0, label: '>= 100%' },
} as const;

/** AHP principal-eigenvector weights, keyed to the engine's metric names. */
export const RSCORE_WEIGHTS = {
  availability: 0.2663,
  failoverSuccess: 0.2411,
  errorRate: 0.1486,
  mttr: 0.1405,
  latency: 0.0842,
  restarts: 0.0541,
  cpu: 0.0326,
  memory: 0.0326,
} as const;

export function resolveMaturityLevel(score: number): MaturityLevel {
  if (score >= 87.5) return 'Optimized';
  if (score >= 75.0) return 'Mature';
  if (score >= 50.0) return 'Developing';
  return 'Initial';
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

export function evaluateRScoreRules(metrics: {
  availability: number;
  cpu: number;
  memory: number;
  errorRate: number;
  restarts: number;
  mttr: number;
  latency: number;
  failoverSuccess: number;
}): { rules: RScoreRuleResult[]; totalScore: number; maturity: MaturityLevel } {
  // Normalize every metric to [0, 1], with 1 always representing better resilience.
  // Thresholds serve as the reference bounds: reaching the good target yields 1;
  // adverse metrics decline linearly to 0 as they reach/exceed their limit.
  const normalized = {
    availability: clamp01(metrics.availability / THRESHOLDS.availabilityPercent.min),
    cpu: 1 - clamp01(metrics.cpu / THRESHOLDS.cpuPercent.max),
    memory: 1 - clamp01(metrics.memory / THRESHOLDS.memoryPercent.max),
    errorRate: 1 - clamp01(metrics.errorRate / THRESHOLDS.errorRate.max),
    restarts: 1 - clamp01(metrics.restarts / THRESHOLDS.totalRestarts.max),
    mttr: 1 - clamp01(metrics.mttr / THRESHOLDS.mttrSeconds.max),
    latency: 1 - clamp01(metrics.latency / THRESHOLDS.avgLatencyMs.max),
    failoverSuccess: clamp01(metrics.failoverSuccess / THRESHOLDS.failoverSuccessRate.min),
  };

  const definitions: Array<{ rule: RScoreRuleResult['rule']; variable: RScoreRuleResult['variable']; threshold: string; actualValue: number; key: keyof typeof RSCORE_WEIGHTS }> = [
    { rule: 'Availability', variable: 'A', threshold: THRESHOLDS.availabilityPercent.label, actualValue: metrics.availability, key: 'availability' },
    { rule: 'CPU', variable: 'C', threshold: THRESHOLDS.cpuPercent.label, actualValue: metrics.cpu, key: 'cpu' },
    { rule: 'Memory', variable: 'M', threshold: THRESHOLDS.memoryPercent.label, actualValue: metrics.memory, key: 'memory' },
    { rule: 'ErrorRate', variable: 'E', threshold: THRESHOLDS.errorRate.label, actualValue: metrics.errorRate, key: 'errorRate' },
    { rule: 'Restarts', variable: 'R', threshold: THRESHOLDS.totalRestarts.label, actualValue: metrics.restarts, key: 'restarts' },
    { rule: 'MTTR', variable: 'T', threshold: THRESHOLDS.mttrSeconds.label, actualValue: metrics.mttr, key: 'mttr' },
    { rule: 'Latency', variable: 'L', threshold: THRESHOLDS.avgLatencyMs.label, actualValue: metrics.latency, key: 'latency' },
    { rule: 'Failover', variable: 'F', threshold: THRESHOLDS.failoverSuccessRate.label, actualValue: metrics.failoverSuccess, key: 'failoverSuccess' },
  ];

  const passes: Record<keyof typeof RSCORE_WEIGHTS, boolean> = {
    availability: metrics.availability >= THRESHOLDS.availabilityPercent.min,
    cpu: metrics.cpu < THRESHOLDS.cpuPercent.max,
    memory: metrics.memory < THRESHOLDS.memoryPercent.max,
    errorRate: metrics.errorRate < THRESHOLDS.errorRate.max,
    restarts: metrics.restarts < THRESHOLDS.totalRestarts.max,
    mttr: metrics.mttr <= THRESHOLDS.mttrSeconds.max,
    latency: metrics.latency < THRESHOLDS.avgLatencyMs.max,
    failoverSuccess: metrics.failoverSuccess >= THRESHOLDS.failoverSuccessRate.min,
  };
  const rules = definitions.map(({ rule, variable, threshold, actualValue, key }) => ({
    rule, variable, threshold, actualValue, passed: passes[key],
    points: normalized[key] * RSCORE_WEIGHTS[key] * 100,
  }));
  const totalScore = Math.round(rules.reduce((sum, rule) => sum + rule.points, 0) * 10) / 10;
  return { rules, totalScore, maturity: resolveMaturityLevel(totalScore) };
}
