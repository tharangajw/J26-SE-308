import type { FaultMetrics, MaturityLevel, RScoreRuleResult } from './types.ts';

export const THRESHOLDS = {
  availabilityPercent: { min: 99.0, label: '> 99.0%' },
  cpuPercent: { max: 70.0, label: '< 70%' },
  memoryPercent: { max: 75.0, label: '< 75%' },
  errorRate: { max: 1.0, label: '< 1.0%' },
  totalRestarts: { max: 2, label: '< 2 restarts' },
  mttrSeconds: { max: 15.0, label: '< 15s' },
  avgLatencyMs: { max: 50.0, label: '< 50ms' },
  failoverSuccessRate: { min: 100.0, label: '>= 100%' },
} as const;

export const POINTS_PER_RULE = 12.5;

export function resolveMaturityLevel(score: number): MaturityLevel {
  if (score >= 87.5) return 'Optimized';
  if (score >= 75.0) return 'Mature';
  if (score >= 50.0) return 'Developing';
  return 'Initial';
}

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
  const rules: RScoreRuleResult[] = [
    {
      rule: 'Availability',
      variable: 'A',
      threshold: THRESHOLDS.availabilityPercent.label,
      actualValue: metrics.availability,
      passed: metrics.availability >= THRESHOLDS.availabilityPercent.min,
      points: 0,
    },
    {
      rule: 'CPU',
      variable: 'C',
      threshold: THRESHOLDS.cpuPercent.label,
      actualValue: metrics.cpu,
      passed: metrics.cpu < THRESHOLDS.cpuPercent.max,
      points: 0,
    },
    {
      rule: 'Memory',
      variable: 'M',
      threshold: THRESHOLDS.memoryPercent.label,
      actualValue: metrics.memory,
      passed: metrics.memory < THRESHOLDS.memoryPercent.max,
      points: 0,
    },
    {
      rule: 'ErrorRate',
      variable: 'E',
      threshold: THRESHOLDS.errorRate.label,
      actualValue: metrics.errorRate,
      passed: metrics.errorRate < THRESHOLDS.errorRate.max,
      points: 0,
    },
    {
      rule: 'Restarts',
      variable: 'R',
      threshold: THRESHOLDS.totalRestarts.label,
      actualValue: metrics.restarts,
      passed: metrics.restarts < THRESHOLDS.totalRestarts.max,
      points: 0,
    },
    {
      rule: 'MTTR',
      variable: 'T',
      threshold: THRESHOLDS.mttrSeconds.label,
      actualValue: metrics.mttr,
      passed: metrics.mttr <= THRESHOLDS.mttrSeconds.max,
      points: 0,
    },
    {
      rule: 'Latency',
      variable: 'L',
      threshold: THRESHOLDS.avgLatencyMs.label,
      actualValue: metrics.latency,
      passed: metrics.latency < THRESHOLDS.avgLatencyMs.max,
      points: 0,
    },
    {
      rule: 'Failover',
      variable: 'F',
      threshold: THRESHOLDS.failoverSuccessRate.label,
      actualValue: metrics.failoverSuccess,
      passed: metrics.failoverSuccess >= THRESHOLDS.failoverSuccessRate.min,
      points: 0,
    },
  ];

  let totalScore = 0;
  for (const r of rules) {
    if (r.passed) {
      r.points = POINTS_PER_RULE;
      totalScore += POINTS_PER_RULE;
    }
  }

  totalScore = Math.min(100, Math.max(0, Math.round(totalScore * 10) / 10));
  const maturity = resolveMaturityLevel(totalScore);

  return { rules, totalScore, maturity };
}
