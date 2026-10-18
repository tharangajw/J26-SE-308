export type RecommendationImpact = 'HIGH' | 'MEDIUM' | 'LOW';
export type RecommendationEffort = 'HIGH' | 'MEDIUM' | 'LOW';

export interface PerformanceRecommendation {
  ruleId: string;
  category: 'DATABASE_INDEXING' | 'REDIS_CACHING' | 'CONTAINER_BASE_IMAGE' | 'HPA_TUNING';
  title: string;
  impact: RecommendationImpact;
  effort: RecommendationEffort;
  description: string;
  expectedPScoreImprovement: string;
  triggerEvidence: string;
}

export interface RecommendationContext {
  serviceId: string;
  pScore: number;
  driftScore: number;
  fanOutScore: number;
  anomalyScore: number;
  dbQueryLatencyMs?: number;
  directFanOutCount?: number;
  podSpinUpLagSec?: number;
}
