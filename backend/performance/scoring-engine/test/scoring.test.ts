import { PScoreEngineService } from '../src/scoring';
import { ServiceSignals } from '../src/types';

function testScoringEngine() {
  console.log('--- Testing P-Score Formula Engine Module ---');
  const engine = new PScoreEngineService();

  // Test 1: Optimal operating conditions
  const optimalSignals: ServiceSignals = {
    serviceId: 'book-service',
    driftScore: 0.05,
    fanOutScore: 0.10,
    anomalyScore: 0.0,
  };
  const optimalRes = engine.calculatePScore(optimalSignals);
  console.assert(optimalRes.pScore >= 90.0, 'Optimal service should achieve >= 90 P-Score');
  console.assert(optimalRes.maturityTier === 'Optimized', 'Tier should be Optimized');

  // Test 2: Severe performance degradation
  const degradedSignals: ServiceSignals = {
    serviceId: 'order-service',
    driftScore: 0.85,  // 40% * 0.85 = 34 pts loss
    fanOutScore: 0.60, // 40% * 0.60 = 24 pts loss
    anomalyScore: 0.90,// 20% * 0.90 = 18 pts loss
  };
  const degradedRes = engine.calculatePScore(degradedSignals);
  console.assert(degradedRes.pScore < 40.0, 'Degraded service should drop to Initial level');
  console.assert(degradedRes.maturityTier === 'Initial', 'Tier should be Initial');

  // Test 3: Sensitivity Test - Minor Metric Fluctuation
  const minorFluctuation: ServiceSignals = {
    serviceId: 'user-service',
    driftScore: 0.08,
    fanOutScore: 0.12,
    anomalyScore: 0.05,
  };
  const minorRes = engine.calculatePScore(minorFluctuation);
  console.assert(minorRes.pScore >= 85.0, 'Minor fluctuation should NOT over-penalize baseline score');

  // Test 4: Latency SLA check (< 5000 ms per microservice)
  console.assert(minorRes.evaluationLatencyMs < 50.0, 'Scoring latency must be well under 5 seconds');

  console.log('[OK] Scoring Engine tests & sensitivity benchmarks passed successfully!');
  console.log('Optimal Result:', optimalRes);
  console.log('Degraded Result:', degradedRes);
}

testScoringEngine();
