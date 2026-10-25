import { RecommendationRulesEngine } from '../src/rules';
import { RecommendationContext } from '../src/types';

// Integration test suite validating rule-based optimization triggers, ensuring that DB latency,
// high fan-out couplings, and pod spin-up lag generate targeted architectural recommendations.
function testRecommendationEngine() {
  console.log('--- Testing Recommendation Engine Module ---');
  const engine = new RecommendationRulesEngine();

  // Simulated service context with multiple performance bottlenecks
  const ctx: RecommendationContext = {
    serviceId: 'order-service',
    pScore: 52.4,
    driftScore: 0.55,
    fanOutScore: 0.45,
    anomalyScore: 0.35,
    dbQueryLatencyMs: 210,
    directFanOutCount: 5,
    podSpinUpLagSec: 14.0,
  };

  // Evaluate context against recommendation heuristics and assert expected rule activations
  const recommendations = engine.evaluateRules(ctx);
  console.assert(recommendations.length === 3, 'Should generate all 3 targeted recommendations');
  console.assert(recommendations[0].category === 'DATABASE_INDEXING', 'First rec should be DB Indexing');
  console.assert(recommendations[1].category === 'REDIS_CACHING', 'Second rec should be Redis Caching');

  console.log('[OK] Recommendation Engine tests passed successfully!');
  console.log('Generated Recommendations:', recommendations);
}

testRecommendationEngine();
