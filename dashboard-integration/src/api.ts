import { SharedMaturityPayload } from './types';

export class MaturityEvaluationApiContract {
  /**
   * Formats local P-Score calculation into the shared multi-dimension maturity engine schema.
   */
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
