import type { FaultMetrics, RScoreRuleResult } from './types.ts';

type ResilienceScoreInput = Pick<FaultMetrics,
  'availability' | 'cpu' | 'memory' | 'errorRate' | 'restarts' | 'mttr' | 'latency' | 'failoverSuccess'
>;

export interface ResilienceEvaluation {
  rules: RScoreRuleResult[];
  totalScore: number;
  maturity: FaultMetrics['maturity'];
}

const engineUrl = process.env.RESILIENCE_ENGINE_URL ?? 'http://localhost:8011/api/resilience/evaluate';

export async function evaluateResilience(metrics: ResilienceScoreInput): Promise<ResilienceEvaluation> {
  const response = await fetch(engineUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metrics),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    throw new Error(`Resilience calculation engine returned ${response.status}.`);
  }
  return await response.json() as ResilienceEvaluation;
}
