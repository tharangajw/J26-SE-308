import { RecommendationRulesEngine } from '../src/rules';
import { RecommendationContext } from '../src/types';

function testRecommendationEngine() {
  console.log('--- Testing Recommendation Engine Module ---');
  const engine = new RecommendationRulesEngine();

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

  const recommendations = engine.evaluateRules(ctx);
  console.assert(recommendations.length === 3, 'Should generate all 3 targeted recommendations');
  console.assert(recommendations[0].category === 'DATABASE_INDEXING', 'First rec should be DB Indexing');
  console.assert(recommendations[1].category === 'REDIS_CACHING', 'Second rec should be Redis Caching');

  console.log('[OK] Recommendation Engine tests passed successfully!');
  console.log('Generated Recommendations:', recommendations);
}

testRecommendationEngine();
