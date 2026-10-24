import type { FaultMetrics } from '../../data/mockData';

export const RSCORE_WEIGHTS = {
  availability: 0.2663, failoverSuccess: 0.2411, errorRate: 0.1486, mttr: 0.1405,
  latency: 0.0842, restarts: 0.0541, cpu: 0.0326, memory: 0.0326,
} as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

export function calculateResilienceScore(metrics: Pick<FaultMetrics, 'availability' | 'cpu' | 'memory' | 'errorRate' | 'restarts' | 'mttr' | 'latency' | 'failoverSuccess'>): number {
  const normalized = [
    clamp01(metrics.availability / 99),
    clamp01(metrics.failoverSuccess / 100),
    1 - clamp01(metrics.errorRate / 1),
    1 - clamp01(metrics.mttr / 15),
    1 - clamp01(metrics.latency / 50),
    1 - clamp01(metrics.restarts / 2),
    1 - clamp01(metrics.cpu / 70),
    1 - clamp01(metrics.memory / 75),
  ];
  return Math.round(normalized.reduce((score, value, index) => score + value * Object.values(RSCORE_WEIGHTS)[index] * 100, 0) * 10) / 10;
}
