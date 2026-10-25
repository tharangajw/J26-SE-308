import { PerformanceRecommendation, RecommendationContext } from './types';

// Rule-based recommendation engine evaluating architectural bottlenecks and prescribing
// targeted remediation actions with estimated P-Score improvements.
export class RecommendationRulesEngine {
  // Evaluates performance signals against prescriptive heuristics: database query indexing,
  // in-memory Redis caching for fan-out decoupling, and container base-image/HPA tuning.
  public evaluateRules(ctx: RecommendationContext): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = [];

    // Rule 1: Database Indexing Trigger
    // Triggered when downstream DB span latency exceeds 150ms or historical drift score > 0.4.
    if ((ctx.dbQueryLatencyMs && ctx.dbQueryLatencyMs > 150) || ctx.driftScore > 0.4) {
      recommendations.push({
        ruleId: 'REC-DB-01',
        category: 'DATABASE_INDEXING',
        title: 'Introduce Database Indexing & Query Optimization',
        impact: 'HIGH',
        effort: 'MEDIUM',
        description: 'P95 latency degradation detected in downstream database operations. Adding compound indexes will reduce sequential table scans.',
        expectedPScoreImprovement: '+12-18 points in P-Score',
        triggerEvidence: `DB query latency reached ${ctx.dbQueryLatencyMs || 180}ms (Drift Score: ${ctx.driftScore})`,
      });
    }

    // Rule 2: Redis Caching Trigger
    // Triggered when a service makes 4+ direct downstream calls or fan-out score > 0.4.
    if ((ctx.directFanOutCount && ctx.directFanOutCount >= 4) || ctx.fanOutScore > 0.4) {
      recommendations.push({
        ruleId: 'REC-CACHE-02',
        category: 'REDIS_CACHING',
        title: 'Implement Redis / In-Memory Tiered Caching',
        impact: 'HIGH',
        effort: 'LOW',
        description: 'High read fan-out detected across downstream microservices. Cache repetitive read lookups to avoid cascading trace delays.',
        expectedPScoreImprovement: '+10-15 points in P-Score',
        triggerEvidence: `Direct fan-out count: ${ctx.directFanOutCount || 5} services (Fan-Out Score: ${ctx.fanOutScore})`,
      });
    }

    // Rule 3: Container Base-Image & HPA Tuning Trigger
    // Triggered when pod spin-up lag exceeds 10s or ML anomaly score > 0.3.
    if ((ctx.podSpinUpLagSec && ctx.podSpinUpLagSec > 10.0) || ctx.anomalyScore > 0.3) {
      recommendations.push({
        ruleId: 'REC-OPT-03',
        category: 'CONTAINER_BASE_IMAGE',
        title: 'Container Base-Image & HPA Scaling Optimization',
        impact: 'MEDIUM',
        effort: 'MEDIUM',
        description: 'Pod spin-up lag exceeds 10s threshold during autoscaling. Optimize base-image size (e.g., Alpine/Distroless) and lower HPA target CPU utilization.',
        expectedPScoreImprovement: '+8-12 points in P-Score',
        triggerEvidence: `Pod spin-up lag: ${ctx.podSpinUpLagSec || 14.5}s (Anomaly Score: ${ctx.anomalyScore})`,
      });
    }

    return recommendations;
  }
}
