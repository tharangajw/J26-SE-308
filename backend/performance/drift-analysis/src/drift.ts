import { HistoricalDeploymentPoint, DriftAnalysisResult } from './types';

export class HistoricalDriftService {
  private sensitivityWindowDays: number;

  constructor(sensitivityWindowDays: number = 14) {
    this.sensitivityWindowDays = sensitivityWindowDays;
  }

  /**
   * Calculates moving-average latency baseline across historical deployments.
   */
  public calculateBaseline(history: HistoricalDeploymentPoint[]): number {
    if (!history || history.length === 0) {
      return 100.0; // Default baseline in ms
    }
    const sum = history.reduce((acc, h) => acc + h.baselineP95Ms, 0);
    return sum / history.length;
  }

  /**
   * Computes historical drift score comparing current P95 latency against historical baseline.
   */
  public analyzeDrift(serviceId: string, currentP95Ms: number, history: HistoricalDeploymentPoint[]): DriftAnalysisResult {
    const historicalBaseline = this.calculateBaseline(history);
    const driftDeltaMs = currentP95Ms - historicalBaseline;
    const driftPercentage = historicalBaseline > 0 ? (driftDeltaMs / historicalBaseline) * 100 : 0;

    // Empirical sensitivity formula: 100% latency increase maps to driftScore = 1.0
    const rawScore = driftPercentage > 0 ? driftPercentage / 100.0 : 0.0;
    const driftScore = Math.min(1.0, Math.max(0.0, rawScore));

    return {
      serviceId,
      currentP95Ms,
      historicalBaselineP95Ms: parseFloat(historicalBaseline.toFixed(2)),
      driftDeltaMs: parseFloat(driftDeltaMs.toFixed(2)),
      driftPercentage: parseFloat(driftPercentage.toFixed(2)),
      driftScore: parseFloat(driftScore.toFixed(3)),
      sensitivityWindowDays: this.sensitivityWindowDays,
    };
  }
}
