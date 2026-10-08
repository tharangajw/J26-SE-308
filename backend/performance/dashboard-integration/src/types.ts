export interface SharedMaturityPayload {
  evaluationId: string;
  timestamp: string;
  serviceId: string;
  scores: {
    pScore: number; // Performance Score
    rScore?: number; // Resilience Score
    oScore?: number; // Observability Score
    aScore?: number; // Architecture Score
    compositeMaturity: number;
  };
  pScoreBreakdown: {
    maturityTier: 'Initial' | 'Developing' | 'Mature' | 'Optimized';
    driftScore: number;
    fanOutScore: number;
    anomalyScore: number;
    recommendationsCount: number;
  };
}
