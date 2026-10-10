export interface HistoricalDeploymentRecord {
  version: string;
  evaluatedAt: string;
  p95LatencyMs: number;
}

export interface PredictedDeploymentRecord {
  version: string;
  evaluatedAt: string;
  predictedP95Ms: number;
  lowerBoundMs: number;
  upperBoundMs: number;
}

export interface DriftForecastResult {
  trendSlopeMsPerRelease: number;
  trendDirection: 'DEGRADING_RAPIDLY' | 'DEGRADING_STEADY' | 'STABLE' | 'IMPROVING';
  predictedDeployments: PredictedDeploymentRecord[];
  estimatedDeploymentsToSLABreach: number | null;
  predictedNextDriftScore: number;
  proactiveWarning: string;
}

export interface DriftAnalysisResult {
  serviceId: string;
  liveP95LatencyMs: number;
  historicalBaselineMs: number;
  latencyDeltaMs: number;
  driftRatio: number;      // e.g. 1.25 = 25% increase
  driftScore: number;      // 0.000 (ideal) to 1.000 (critical drift)
  driftLevel: 'NO_DRIFT' | 'SLIGHT_DRIFT' | 'MODERATE_DRIFT' | 'CRITICAL_DRIFT';
  historicalDeployments: HistoricalDeploymentRecord[];
  recommendation: string;
  forecast?: DriftForecastResult;
}

export class HistoricalDriftAnalyzer {
  private baselineHistory: Map<string, HistoricalDeploymentRecord[]> = new Map();

  constructor() {
    this.seedDefaultHistories();
  }

  private seedDefaultHistories() {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Default baseline records for standard services
    this.baselineHistory.set('gateway-1', [
      { version: 'v1.0.0', evaluatedAt: new Date(now - 7 * dayMs).toISOString().split('T')[0], p95LatencyMs: 18.0 },
      { version: 'v1.1.0', evaluatedAt: new Date(now - 4 * dayMs).toISOString().split('T')[0], p95LatencyMs: 19.5 },
      { version: 'v1.2.0', evaluatedAt: new Date(now - 2 * dayMs).toISOString().split('T')[0], p95LatencyMs: 20.0 },
    ]);

    this.baselineHistory.set('book-service-1', [
      { version: 'v1.0.0', evaluatedAt: new Date(now - 7 * dayMs).toISOString().split('T')[0], p95LatencyMs: 22.0 },
      { version: 'v1.1.0', evaluatedAt: new Date(now - 4 * dayMs).toISOString().split('T')[0], p95LatencyMs: 24.0 },
      { version: 'v1.2.0', evaluatedAt: new Date(now - 2 * dayMs).toISOString().split('T')[0], p95LatencyMs: 25.0 },
    ]);

    this.baselineHistory.set('user-service-1', [
      { version: 'v1.0.0', evaluatedAt: new Date(now - 7 * dayMs).toISOString().split('T')[0], p95LatencyMs: 18.0 },
      { version: 'v1.1.0', evaluatedAt: new Date(now - 4 * dayMs).toISOString().split('T')[0], p95LatencyMs: 20.0 },
      { version: 'v1.2.0', evaluatedAt: new Date(now - 2 * dayMs).toISOString().split('T')[0], p95LatencyMs: 21.0 },
    ]);

    this.baselineHistory.set('order-service-1', [
      { version: 'v1.0.0', evaluatedAt: new Date(now - 7 * dayMs).toISOString().split('T')[0], p95LatencyMs: 15.0 },
      { version: 'v1.1.0', evaluatedAt: new Date(now - 4 * dayMs).toISOString().split('T')[0], p95LatencyMs: 17.0 },
      { version: 'v1.2.0', evaluatedAt: new Date(now - 2 * dayMs).toISOString().split('T')[0], p95LatencyMs: 18.0 },
    ]);
  }

  /**
   * Forecasts future P95 latency drift using Ordinary Least Squares (OLS) regression.
   */
  public forecastFutureDrift(
    historicalBaselineMs: number,
    liveP95LatencyMs: number,
    history: HistoricalDeploymentRecord[],
    forecastSteps: number = 3,
    slaThresholdMs: number = 50.0
  ): DriftForecastResult {
    const points: number[] = [
      ...history.map((h) => h.p95LatencyMs),
      liveP95LatencyMs,
    ];

    const n = points.length;
    if (n < 2) {
      return {
        trendSlopeMsPerRelease: 0,
        trendDirection: 'STABLE',
        predictedDeployments: [],
        estimatedDeploymentsToSLABreach: null,
        predictedNextDriftScore: 0,
        proactiveWarning: 'Insufficient data points for trend forecasting.',
      };
    }

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += points[i];
      sumXY += i * points[i];
      sumXX += i * i;
    }

    const meanX = sumX / n;
    const meanY = sumY / n;
    const denominator = sumXX - sumX * meanX;
    const slope = denominator !== 0 ? (sumXY - sumX * meanY) / denominator : 0;
    const intercept = meanY - slope * meanX;

    let ssResiduals = 0;
    for (let i = 0; i < n; i++) {
      const pred = slope * i + intercept;
      ssResiduals += Math.pow(points[i] - pred, 2);
    }
    const standardError = n > 2 ? Math.sqrt(ssResiduals / (n - 2)) : 2.5;

    const predictedDeployments: PredictedDeploymentRecord[] = [];
    for (let step = 1; step <= forecastSteps; step++) {
      const futureX = n - 1 + step;
      const predictedVal = Math.max(5.0, slope * futureX + intercept);
      const margin = 1.96 * standardError * Math.sqrt(1 + 1 / n + Math.pow(futureX - meanX, 2) / (denominator || 1));

      predictedDeployments.push({
        version: `v2.${step}.0 (Forecast)`,
        evaluatedAt: `+${step} Release`,
        predictedP95Ms: parseFloat(predictedVal.toFixed(2)),
        lowerBoundMs: parseFloat(Math.max(5.0, predictedVal - margin).toFixed(2)),
        upperBoundMs: parseFloat((predictedVal + margin).toFixed(2)),
      });
    }

    let trendDirection: 'DEGRADING_RAPIDLY' | 'DEGRADING_STEADY' | 'STABLE' | 'IMPROVING' = 'STABLE';
    if (slope > 3.0) {
      trendDirection = 'DEGRADING_RAPIDLY';
    } else if (slope > 0.3) {
      trendDirection = 'DEGRADING_STEADY';
    } else if (slope < -0.3) {
      trendDirection = 'IMPROVING';
    } else {
      trendDirection = 'STABLE';
    }

    let estimatedDeploymentsToSLABreach: number | null = null;
    if (liveP95LatencyMs >= slaThresholdMs) {
      estimatedDeploymentsToSLABreach = 0;
    } else if (slope > 0.05) {
      const stepsToBreach = (slaThresholdMs - liveP95LatencyMs) / slope;
      estimatedDeploymentsToSLABreach = Math.max(1, Math.ceil(stepsToBreach));
    }

    const nextPred = predictedDeployments[0]?.predictedP95Ms ?? liveP95LatencyMs;
    const nextRatio = historicalBaselineMs > 0 ? nextPred / historicalBaselineMs : 1.0;
    const predictedNextDriftScore = nextRatio > 1.0 ? parseFloat(Math.min(1.0, nextRatio - 1.0).toFixed(3)) : 0.0;

    let proactiveWarning = 'Performance trend is healthy and stable.';
    if (liveP95LatencyMs >= slaThresholdMs) {
      proactiveWarning = `CRITICAL: Active P95 latency (${liveP95LatencyMs}ms) exceeds SLA (${slaThresholdMs}ms).`;
    } else if (estimatedDeploymentsToSLABreach !== null && estimatedDeploymentsToSLABreach <= 3) {
      proactiveWarning = `PROACTIVE ALERT: Upward trajectory (+${slope.toFixed(2)}ms/release) will breach SLA (${slaThresholdMs}ms) in ~${estimatedDeploymentsToSLABreach} release(s).`;
    } else if (trendDirection === 'DEGRADING_STEADY' || trendDirection === 'DEGRADING_RAPIDLY') {
      proactiveWarning = `CAUTION: Progressive latency drift detected (+${slope.toFixed(2)}ms per release). Investigate resource saturation.`;
    }

    return {
      trendSlopeMsPerRelease: parseFloat(slope.toFixed(2)),
      trendDirection,
      predictedDeployments,
      estimatedDeploymentsToSLABreach,
      predictedNextDriftScore,
      proactiveWarning,
    };
  }

  /**
   * Calculates moving average P95 latency baseline and compares live P95 latency to compute DriftScore.
   */
  public analyzeDrift(serviceId: string, liveP95LatencyMs: number): DriftAnalysisResult {
    const sId = serviceId.trim().toLowerCase();
    const history = this.baselineHistory.get(sId) || [
      { version: 'v1.0.0', evaluatedAt: '7d ago', p95LatencyMs: 20.0 },
      { version: 'v1.1.0', evaluatedAt: '3d ago', p95LatencyMs: 22.0 },
    ];

    // Compute moving average of historical P95 baseline latencies
    const sumHistorical = history.reduce((acc, r) => acc + r.p95LatencyMs, 0);
    const historicalBaselineMs = parseFloat((sumHistorical / history.length).toFixed(2));

    const latencyDeltaMs = parseFloat((liveP95LatencyMs - historicalBaselineMs).toFixed(2));
    const rawRatio = historicalBaselineMs > 0 ? liveP95LatencyMs / historicalBaselineMs : 1.0;
    const driftRatio = parseFloat(rawRatio.toFixed(3));

    // Calculate DriftScore (0.000 to 1.000)
    let driftScore = 0.0;
    if (driftRatio > 1.0) {
      driftScore = Math.min(1.0, parseFloat((driftRatio - 1.0).toFixed(3)));
    }

    let driftLevel: 'NO_DRIFT' | 'SLIGHT_DRIFT' | 'MODERATE_DRIFT' | 'CRITICAL_DRIFT' = 'NO_DRIFT';
    let recommendation = 'Performance matches historical baseline. No action required.';

    if (driftScore >= 0.70) {
      driftLevel = 'CRITICAL_DRIFT';
      recommendation = `Critical latency regression detected (+${(driftScore * 100).toFixed(1)}% above baseline). Initiate rollback or profile database queries.`;
    } else if (driftScore >= 0.40) {
      driftLevel = 'MODERATE_DRIFT';
      recommendation = `Moderate latency drift (+${(driftScore * 100).toFixed(1)}% above baseline). Monitor downstream dependencies and memory leaks.`;
    } else if (driftScore >= 0.15) {
      driftLevel = 'SLIGHT_DRIFT';
      recommendation = `Slight latency increase (+${(driftScore * 100).toFixed(1)}% above baseline). Within acceptable variance threshold.`;
    }

    const forecast = this.forecastFutureDrift(historicalBaselineMs, liveP95LatencyMs, history, 3, 50.0);

    return {
      serviceId,
      liveP95LatencyMs: parseFloat(liveP95LatencyMs.toFixed(2)),
      historicalBaselineMs,
      latencyDeltaMs,
      driftRatio,
      driftScore,
      driftLevel,
      historicalDeployments: [
        ...history,
        { version: 'Live (v2.1.0)', evaluatedAt: 'Current', p95LatencyMs: liveP95LatencyMs }
      ],
      recommendation,
      forecast,
    };
  }
}

