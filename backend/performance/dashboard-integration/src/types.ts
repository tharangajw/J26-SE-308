// Shared schema definitions for cross-pillar enterprise maturity evaluation.
export interface SharedMaturityPayload {
  evaluationId: string;
  timestamp: string;
  serviceId: string;
  scores: {
    pScore: number; // Performance & Efficiency Score (35%)
    rScore?: number; // Resilience & Chaos Score (25%)
    oScore?: number; // Observability & Blind-Spots Score (25%)
    aScore?: number; // Architecture Score (15%)
    cScore?: number; // CI/CD Coupling & Blast Radius C-Score (15%)
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
