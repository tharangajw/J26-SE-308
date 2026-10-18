import { ScoringWeights, ServiceSignals, PScoreEvaluationResult } from './types';
import { MaturityTierMapper } from './maturity_mapper';

export class PScoreEngineService {
  private weights: ScoringWeights;

  constructor(weights: ScoringWeights = { latencyDriftWeight: 0.40, fanOutWeight: 0.40, anomalyWeight: 0.20 }) {
    this.weights = weights;
    this.normalizeWeights();
  }

  private normalizeWeights() {
    const total = this.weights.latencyDriftWeight + this.weights.fanOutWeight + this.weights.anomalyWeight;
    if (total > 0 && Math.abs(total - 1.0) > 0.001) {
      this.weights.latencyDriftWeight /= total;
      this.weights.fanOutWeight /= total;
      this.weights.anomalyWeight /= total;
    }
  }

  public calculatePScore(signals: ServiceSignals): PScoreEvaluationResult {
    const startTime = performance.now();

    const { driftScore, fanOutScore, anomalyScore, serviceId } = signals;

    // Component Penalty Calculations
    const driftPenalty = Math.min(1.0, Math.max(0.0, driftScore)) * this.weights.latencyDriftWeight;
    const fanOutPenalty = Math.min(1.0, Math.max(0.0, fanOutScore)) * this.weights.fanOutWeight;
    const anomalyPenalty = Math.min(1.0, Math.max(0.0, anomalyScore)) * this.weights.anomalyWeight;

    const totalPenalty = driftPenalty + fanOutPenalty + anomalyPenalty;

    // P-Score Composite Formula: PScore = 100 * (1.0 - TotalPenalty)
    const rawScore = 100.0 * (1.0 - totalPenalty);
    const pScore = parseFloat(Math.min(100.0, Math.max(0.0, rawScore)).toFixed(1));

    const maturityTier = MaturityTierMapper.mapScoreToTier(pScore);
    const evaluationLatencyMs = parseFloat((performance.now() - startTime).toFixed(2));

    return {
      serviceId,
      timestamp: Date.now(),
      pScore,
      maturityTier,
      componentScores: {
        latencyDriftContribution: parseFloat((driftPenalty * 100).toFixed(1)),
        fanOutContribution: parseFloat((fanOutPenalty * 100).toFixed(1)),
        anomalyContribution: parseFloat((anomalyPenalty * 100).toFixed(1)),
      },
      evaluationLatencyMs,
    };
  }
}
