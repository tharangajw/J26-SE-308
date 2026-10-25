import { SharedMaturityPayload } from './types';

// API contract adapter transforming local P-Score results into the shared cross-pillar
// maturity schema (combining Performance, Resilience, Observability, and Architecture).
export class MaturityEvaluationApiContract {
  // Formats service metrics and computes a weighted composite maturity score
  // across all 4 pillars (P-Score 35%, R-Score 25%, O-Score 25%, A-Score 15%).
  public formatSharedMaturityPayload(
    serviceId: string,
    pScore: number,
    maturityTier: 'Initial' | 'Developing' | 'Mature' | 'Optimized',
    driftScore: number,
    fanOutScore: number,
    anomalyScore: number,
    recommendationsCount: number,
    otherScores?: { rScore?: number; oScore?: number; aScore?: number }
  ): SharedMaturityPayload {
    const rScore = otherScores?.rScore ?? 80.0;
    const oScore = otherScores?.oScore ?? 85.0;
    const aScore = otherScores?.aScore ?? 75.0;

    // Weighted aggregate score across all 4 maturity dimensions
    const compositeMaturity = parseFloat(
      (pScore * 0.35 + rScore * 0.25 + oScore * 0.25 + aScore * 0.15).toFixed(1)
    );

    return {
      evaluationId: `EVAL-${serviceId}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      serviceId,
      scores: {
        pScore,
        rScore,
        oScore,
        aScore,
        compositeMaturity,
      },
      pScoreBreakdown: {
        maturityTier,
        driftScore,
        fanOutScore,
        anomalyScore,
        recommendationsCount,
      },
    };
  }
}
