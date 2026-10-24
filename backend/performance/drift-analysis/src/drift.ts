import { HistoricalDeploymentPoint, DriftAnalysisResult, DriftForecastResult, PredictedDeploymentPoint } from './types';

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
   * Forecasts future P95 latency drift using Ordinary Least Squares (OLS) trend analysis
   * over historical deployment baselines plus live active latency snapshot.
   */
  public forecastDrift(
    historicalBaselineMs: number,
    currentP95Ms: number,
    history: HistoricalDeploymentPoint[],
    forecastSteps: number = 3,
    slaThresholdMs: number = 150.0
  ): DriftForecastResult {
    // Combine historical points with the current live point
    const points: number[] = [
      ...history.map((h) => h.baselineP95Ms),
      currentP95Ms,
    ];

    const n = points.length;
    if (n < 2) {
      return {
        trendSlopeMsPerDeployment: 0,
        trendDirection: 'STABLE',
        predictedDeployments: [],
        estimatedDeploymentsToSLABreach: null,
        predictedNextDriftScore: 0,
        proactiveWarning: 'Insufficient data points to generate forecast.',
      };
    }

    // x values: 0, 1, 2, ..., n-1
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = points[i];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const meanX = sumX / n;
    const meanY = sumY / n;
    const denominator = sumXX - sumX * meanX;
    const slope = denominator !== 0 ? (sumXY - sumX * meanY) / denominator : 0;
    const intercept = meanY - slope * meanX;

    // Calculate standard error of residuals
    let ssResiduals = 0;
    for (let i = 0; i < n; i++) {
      const predicted = slope * i + intercept;
      ssResiduals += Math.pow(points[i] - predicted, 2);
    }
    const standardError = n > 2 ? Math.sqrt(ssResiduals / (n - 2)) : 5.0;

    // Generate predicted future deployment points
    const predictedDeployments: PredictedDeploymentPoint[] = [];
    for (let step = 1; step <= forecastSteps; step++) {
      const futureX = n - 1 + step;
      const predictedVal = Math.max(5.0, slope * futureX + intercept);
      const margin = 1.96 * standardError * Math.sqrt(1 + 1 / n + Math.pow(futureX - meanX, 2) / (denominator || 1));

      predictedDeployments.push({
        step,
        label: `Forecast +${step}`,
        predictedP95Ms: parseFloat(predictedVal.toFixed(2)),
        lowerBoundMs: parseFloat(Math.max(5.0, predictedVal - margin).toFixed(2)),
        upperBoundMs: parseFloat((predictedVal + margin).toFixed(2)),
      });
    }

    // Determine Trend Direction
    let trendDirection: 'DEGRADING_RAPIDLY' | 'DEGRADING_STEADY' | 'STABLE' | 'IMPROVING' = 'STABLE';
    if (slope > 5.0) {
      trendDirection = 'DEGRADING_RAPIDLY';
    } else if (slope > 0.5) {
      trendDirection = 'DEGRADING_STEADY';
    } else if (slope < -0.5) {
      trendDirection = 'IMPROVING';
    } else {
      trendDirection = 'STABLE';
    }

    // SLA Breach Estimation
    let estimatedDeploymentsToSLABreach: number | null = null;
    if (currentP95Ms >= slaThresholdMs) {
      estimatedDeploymentsToSLABreach = 0; // Already breached
    } else if (slope > 0.1) {
      const stepsToBreach = (slaThresholdMs - currentP95Ms) / slope;
      estimatedDeploymentsToSLABreach = Math.max(1, Math.ceil(stepsToBreach));
    }

    // Predicted Next Drift Score
    const nextPred = predictedDeployments[0]?.predictedP95Ms ?? currentP95Ms;
    const nextDelta = nextPred - historicalBaselineMs;
    const nextPercentage = historicalBaselineMs > 0 ? (nextDelta / historicalBaselineMs) * 100 : 0;
    const nextRawScore = nextPercentage > 0 ? nextPercentage / 100.0 : 0;
    const predictedNextDriftScore = parseFloat(Math.min(1.0, Math.max(0.0, nextRawScore)).toFixed(3));

    // Proactive Warning message
    let proactiveWarning = 'Future performance trajectory is stable within normal limits.';
    if (currentP95Ms >= slaThresholdMs) {
      proactiveWarning = `CRITICAL: Active latency (${currentP95Ms}ms) already exceeds SLA threshold (${slaThresholdMs}ms). Immediate remediation needed.`;
    } else if (estimatedDeploymentsToSLABreach !== null && estimatedDeploymentsToSLABreach <= 3) {
      proactiveWarning = `WARNING: Upward latency trend (+${slope.toFixed(2)}ms/release) will breach SLA threshold (${slaThresholdMs}ms) in ~${estimatedDeploymentsToSLABreach} deployment(s).`;
    } else if (trendDirection === 'DEGRADING_STEADY' || trendDirection === 'DEGRADING_RAPIDLY') {
      proactiveWarning = `CAUTION: Steady latency degradation detected (+${slope.toFixed(2)}ms per deployment). Keep monitoring database & service fan-out.`;
    }

    return {
      trendSlopeMsPerDeployment: parseFloat(slope.toFixed(2)),
      trendDirection,
      predictedDeployments,
      estimatedDeploymentsToSLABreach,
      predictedNextDriftScore,
      proactiveWarning,
    };
  }

  /**
   * Computes historical drift score and proactive future forecast.
   */
  public analyzeDrift(
    serviceId: string,
    currentP95Ms: number,
    history: HistoricalDeploymentPoint[],
    forecastSteps: number = 3,
    slaThresholdMs: number = 150.0
  ): DriftAnalysisResult {
    const historicalBaseline = this.calculateBaseline(history);
    const driftDeltaMs = currentP95Ms - historicalBaseline;
    const driftPercentage = historicalBaseline > 0 ? (driftDeltaMs / historicalBaseline) * 100 : 0;

    // Empirical sensitivity formula: 100% latency increase maps to driftScore = 1.0
    const rawScore = driftPercentage > 0 ? driftPercentage / 100.0 : 0.0;
    const driftScore = Math.min(1.0, Math.max(0.0, rawScore));

    const forecast = this.forecastDrift(historicalBaseline, currentP95Ms, history, forecastSteps, slaThresholdMs);

    return {
      serviceId,
      currentP95Ms,
      historicalBaselineP95Ms: parseFloat(historicalBaseline.toFixed(2)),
      driftDeltaMs: parseFloat(driftDeltaMs.toFixed(2)),
      driftPercentage: parseFloat(driftPercentage.toFixed(2)),
      driftScore: parseFloat(driftScore.toFixed(3)),
      sensitivityWindowDays: this.sensitivityWindowDays,
      forecast,
    };
  }
}

