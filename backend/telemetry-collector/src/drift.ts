import fs from 'node:fs';
import path from 'node:path';

export interface HistoricalDeploymentRecord {
  version: string;
  evaluatedAt: string;
  p95LatencyMs: number;
  timestampMs?: number;
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
  hasTelemetry?: boolean;
  liveP95LatencyMs: number;
  historicalBaselineMs: number;
  latencyDeltaMs: number;
  driftRatio: number;      // e.g. 1.25 = 25% increase
  driftScore: number;      // 0.000 (ideal) to 1.000 (critical drift)
  driftLevel: 'NO_DRIFT' | 'SLIGHT_DRIFT' | 'MODERATE_DRIFT' | 'CRITICAL_DRIFT' | 'NO_DATA';
  historicalDeployments: HistoricalDeploymentRecord[];
  recommendation: string;
  forecast?: DriftForecastResult;
}

export class HistoricalDriftAnalyzer {
  private baselineHistory: Map<string, HistoricalDeploymentRecord[]> = new Map();
  private storageFilePath: string;
  private static readonly MIN_SNAPSHOT_INTERVAL_MS = 30 * 1000; // Record new baseline checkpoint every 30s
  private static readonly MAX_HISTORY_PER_SERVICE = 15;

  constructor(storageFilePath?: string) {
    this.storageFilePath =
      storageFilePath || path.resolve(process.cwd(), 'data', 'drift-baselines.json');
    this.loadPersistedBaselines();
  }

  private loadPersistedBaselines(): void {
    try {
      if (fs.existsSync(this.storageFilePath)) {
        const raw = fs.readFileSync(this.storageFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          for (const [serviceId, records] of Object.entries(parsed)) {
            if (Array.isArray(records)) {
              const valid = records.filter(
                (r: any) =>
                  r &&
                  typeof r.p95LatencyMs === 'number' &&
                  Number.isFinite(r.p95LatencyMs) &&
                  r.p95LatencyMs > 0
              );
              if (valid.length > 0) {
                this.baselineHistory.set(serviceId.toLowerCase(), valid);
              }
            }
          }
        }
      }
    } catch {
      // Ignore read errors on cold start
    }
  }

  private persistBaselines(): void {
    try {
      const dir = path.dirname(this.storageFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const serializable: Record<string, HistoricalDeploymentRecord[]> = {};
      for (const [key, records] of this.baselineHistory.entries()) {
        serializable[key] = records;
      }
      fs.writeFileSync(this.storageFilePath, JSON.stringify(serializable, null, 2), 'utf-8');
    } catch {
      // Ignore write errors in read-only environments
    }
  }

  private recordSnapshotIfNeeded(sId: string, liveP95LatencyMs: number): HistoricalDeploymentRecord[] {
    const existing = this.baselineHistory.get(sId) || [];
    if (liveP95LatencyMs <= 0) {
      return existing;
    }

    const now = Date.now();
    const lastRecord = existing[existing.length - 1];
    const lastTs = lastRecord?.timestampMs ?? 0;

    // Prior snapshots used as historical baseline before recording the current observation
    const priorHistory = [...existing];

    if (!lastRecord || now - lastTs >= HistoricalDriftAnalyzer.MIN_SNAPSHOT_INTERVAL_MS) {
      const nextIdx = existing.length + 1;
      const isoTime = new Date(now).toISOString().replace('T', ' ').slice(0, 19);
      const newEntry: HistoricalDeploymentRecord = {
        version: `Snapshot #${nextIdx}`,
        evaluatedAt: isoTime,
        p95LatencyMs: parseFloat(liveP95LatencyMs.toFixed(2)),
        timestampMs: now,
      };
      const updated = [...existing, newEntry];
      if (updated.length > HistoricalDriftAnalyzer.MAX_HISTORY_PER_SERVICE) {
        updated.splice(0, updated.length - HistoricalDriftAnalyzer.MAX_HISTORY_PER_SERVICE);
      }
      this.baselineHistory.set(sId, updated);
      this.persistBaselines();
    }

    return priorHistory.length > 0 ? priorHistory : this.baselineHistory.get(sId) || [];
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
        proactiveWarning: 'Collecting initial telemetry snapshots for trend forecasting.',
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
    const standardError = n > 2 ? Math.sqrt(ssResiduals / (n - 2)) : 0.0;

    const predictedDeployments: PredictedDeploymentRecord[] = [];
    for (let step = 1; step <= forecastSteps; step++) {
      const futureX = n - 1 + step;
      const predictedVal = Math.max(0.5, slope * futureX + intercept);
      const margin = 1.96 * standardError * Math.sqrt(1 + 1 / n + Math.pow(futureX - meanX, 2) / (denominator || 1));

      predictedDeployments.push({
        version: `Forecast +${step}`,
        evaluatedAt: `+${step} Window`,
        predictedP95Ms: parseFloat(predictedVal.toFixed(2)),
        lowerBoundMs: parseFloat(Math.max(0.5, predictedVal - margin).toFixed(2)),
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
      proactiveWarning = `PROACTIVE ALERT: Upward trajectory (+${slope.toFixed(2)}ms/window) will breach SLA (${slaThresholdMs}ms) in ~${estimatedDeploymentsToSLABreach} window(s).`;
    } else if (trendDirection === 'DEGRADING_STEADY' || trendDirection === 'DEGRADING_RAPIDLY') {
      proactiveWarning = `CAUTION: Progressive latency drift detected (+${slope.toFixed(2)}ms per window). Investigate resource saturation.`;
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
   * Calculates moving average P95 latency baseline from persisted real historical snapshots
   * and compares live P95 latency to compute DriftScore.
   */
  public analyzeDrift(serviceId: string, liveP95LatencyMs: number): DriftAnalysisResult {
    const sId = serviceId.trim().toLowerCase();
    const persistedHistory = this.recordSnapshotIfNeeded(sId, liveP95LatencyMs);

    // If the service has no persisted baseline history and no live telemetry, it has NO DATA!
    if (persistedHistory.length === 0 && liveP95LatencyMs <= 0) {
      return {
        serviceId,
        hasTelemetry: false,
        liveP95LatencyMs: 0,
        historicalBaselineMs: 0,
        latencyDeltaMs: 0,
        driftRatio: 0,
        driftScore: 0,
        driftLevel: 'NO_DATA',
        historicalDeployments: [],
        recommendation: `No active telemetry metrics or traces found in Prometheus or Jaeger for '${serviceId}'.`,
      };
    }

    // Compute moving average of real persisted historical P95 baseline latencies
    const sumHistorical = persistedHistory.reduce((acc, r) => acc + r.p95LatencyMs, 0);
    const historicalBaselineMs = parseFloat((sumHistorical / persistedHistory.length).toFixed(2));

    const effectiveLiveMs = liveP95LatencyMs > 0 ? liveP95LatencyMs : historicalBaselineMs;
    const latencyDeltaMs = parseFloat((effectiveLiveMs - historicalBaselineMs).toFixed(2));
    const rawRatio = historicalBaselineMs > 0 ? effectiveLiveMs / historicalBaselineMs : 1.0;
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

    const forecast = this.forecastFutureDrift(historicalBaselineMs, effectiveLiveMs, persistedHistory, 3, 50.0);

    return {
      serviceId,
      hasTelemetry: true,
      liveP95LatencyMs: parseFloat(effectiveLiveMs.toFixed(2)),
      historicalBaselineMs,
      latencyDeltaMs,
      driftRatio,
      driftScore,
      driftLevel,
      historicalDeployments: [
        ...persistedHistory,
        {
          version: 'Live (Current)',
          evaluatedAt: new Date().toISOString().replace('T', ' ').slice(11, 19),
          p95LatencyMs: parseFloat(effectiveLiveMs.toFixed(2)),
        },
      ],
      recommendation,
      forecast,
    };
  }
}

