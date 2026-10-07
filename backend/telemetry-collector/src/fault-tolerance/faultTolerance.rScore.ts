
// R-Score Calculation Engine

import {
  FaultToleranceRawMetrics,
  RScoreRuleResult,
  RScoreSnapshot,
} from './faultTolerance.types';

// Threshold constants — configurable without changing logic
const THRESHOLDS = {
  availabilityPercent: { min: 99.0,  label: '> 99.0%'  },
  cpuPercent:          { max: 70.0,  label: '< 70%'    },
  memoryPercent:       { max: 75.0,  label: '< 75%'    },
  errorRate:           { max: 1.0,   label: '< 1.0%'   },
  totalRestarts:       { max: 2,     label: '< 2'      },
  mttrSeconds:         { max: 15,    label: '< 15s'    },
  avgLatencyMs:        { max: 50,    label: '< 50ms'   },
  failoverSuccessRate: { min: 100.0, label: '= 100%'   },
} as const;

const POINTS_PER_RULE = 12.5;

// Maps a numeric R-Score to a maturity level
function resolveMaturityLevel(
  score: number,
): RScoreSnapshot['maturityLevel'] {
  if (score >= 88) return 'Optimized';
  if (score >= 75) return 'Mature';
  if (score >= 50) return 'Developing';
  return 'Initial';
}

// Core R-Score calculator
export function computeRScore(metrics: FaultToleranceRawMetrics): RScoreSnapshot {
  // Evaluate all 8 binary rules
  const rules: RScoreRuleResult[] = [
    {
      rule: 'Availability',
      variable: 'A',
      threshold: THRESHOLDS.availabilityPercent.label,
      actualValue: metrics.availabilityPercent,
      passed: metrics.availabilityPercent > THRESHOLDS.availabilityPercent.min,
      points: 0,
    },
    {
      rule: 'CPU',
      variable: 'C',
      threshold: THRESHOLDS.cpuPercent.label,
      actualValue: metrics.cpuPercent,
      passed: metrics.cpuPercent < THRESHOLDS.cpuPercent.max,
      points: 0,
    },
    {
      rule: 'Memory',
      variable: 'M',
      threshold: THRESHOLDS.memoryPercent.label,
      actualValue: metrics.memoryPercent,
      passed: metrics.memoryPercent < THRESHOLDS.memoryPercent.max,
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
      actualValue: metrics.totalRestarts,
      passed: metrics.totalRestarts < THRESHOLDS.totalRestarts.max,
      points: 0,
    },
    {
      rule: 'MTTR',
      variable: 'T',
      threshold: THRESHOLDS.mttrSeconds.label,
      actualValue: metrics.mttrSeconds,
      passed: metrics.mttrSeconds < THRESHOLDS.mttrSeconds.max,
      points: 0,
    },
    {
      rule: 'Latency',
      variable: 'L',
      threshold: THRESHOLDS.avgLatencyMs.label,
      actualValue: metrics.avgLatencyMs,
      passed: metrics.avgLatencyMs < THRESHOLDS.avgLatencyMs.max,
      points: 0,
    },
    {
      rule: 'Failover',
      variable: 'F',
      threshold: THRESHOLDS.failoverSuccessRate.label,
      actualValue: metrics.failoverSuccessRate,
      passed: metrics.failoverSuccessRate >= THRESHOLDS.failoverSuccessRate.min,
      points: 0,
    },
  ];

  // Assign points based on pass/fail
  for (const rule of rules) {
    rule.points = rule.passed ? POINTS_PER_RULE : 0;
  }

  const rScore = parseFloat(
    rules.reduce((sum, r) => sum + r.points, 0).toFixed(1),
  );

  const passingRules = rules.filter((r) => r.passed).length;

  return {
    serviceId: metrics.serviceId,
    timestamp: metrics.timestamp,
    rScore,
    maturityLevel: resolveMaturityLevel(rScore),
    ruleResults: rules,
    passingRules,
    totalRules: 8,
  };
}
