export type MaturityTier = 'Initial' | 'Developing' | 'Mature' | 'Optimized';

export interface ScoringWeights {
  latencyDriftWeight: number; // Default 0.40
  fanOutWeight: number;      // Default 0.40
  anomalyWeight: number;     // Default 0.20
}

export interface ServiceSignals {
  serviceId: string;
  driftScore: number;     // 0.0 (no drift) to 1.0 (severe drift)
  fanOutScore: number;    // 0.0 (optimal) to 1.0 (excessive fanout depth)
  anomalyScore: number;   // 0.0 (normal) to 1.0 (anomalous saturation)
}

export interface PScoreEvaluationResult {
  serviceId: string;
  timestamp: number;
  pScore: number; // Real-time 0.0 to 100.0
  maturityTier: MaturityTier;
  componentScores: {
    latencyDriftContribution: number;
    fanOutContribution: number;
    anomalyContribution: number;
  };
  evaluationLatencyMs: number; // Target < 5000 ms
}
