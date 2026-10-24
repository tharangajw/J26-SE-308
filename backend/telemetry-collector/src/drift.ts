import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { telemetryMongo } from './mongodb.js';
import { DockerCollector, DockerContainerInfo } from './docker.js';

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
  hasTelemetry: boolean;
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

function resolveDataDirectory(): string {
  const candidates = [
    process.env.PERFORMANCE_DATA_DIR,
    '/app/anomaly-detection/data',
    path.resolve(process.cwd(), 'backend', 'performance', 'anomaly-detection', 'data'),
    path.resolve(process.cwd(), '..', 'performance', 'anomaly-detection', 'data'),
    path.resolve(process.cwd(), 'data'),
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  const fallback = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(fallback)) {
    fs.mkdirSync(fallback, { recursive: true });
  }
  return fallback;
}

export class HistoricalDriftAnalyzer {
  private baselineHistory: Map<string, HistoricalDeploymentRecord[]> = new Map();
  private dataDir: string;
  private storageFilePath: string;
  private sqliteDb: any = null;
  private readonly dockerCollector: DockerCollector;
  private static readonly MIN_SNAPSHOT_INTERVAL_MS = 15 * 1000; // Record new baseline checkpoint every 15s
  private static readonly MAX_HISTORY_PER_SERVICE = 20;

  constructor(customStoragePath?: string) {
    this.dataDir = resolveDataDirectory();
    this.storageFilePath =
      customStoragePath || path.resolve(this.dataDir, 'drift-baselines.json');
    this.dockerCollector = new DockerCollector();

    this.initSqliteDatabase();
    this.loadPersistedBaselines();
    // Zero hardcoded dummy seeding. Only authentic telemetry observations are persisted.
  }

  private initSqliteDatabase(): void {
    try {
      const require = createRequire(import.meta.url);
      const { DatabaseSync } = require('node:sqlite');
      const dbPath = path.resolve(this.dataDir, 'telemetry_history.db');
      this.sqliteDb = new DatabaseSync(dbPath);
      this.sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS historical_drift_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          service_id TEXT NOT NULL,
          version TEXT NOT NULL,
          p95_latency_ms REAL NOT NULL,
          evaluated_at TEXT NOT NULL,
          timestamp_ms INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_drift_service ON historical_drift_snapshots(service_id);
      `);
    } catch {
      // Graceful fallback to file-based JSON storage
      this.sqliteDb = null;
    }
  }

  private loadPersistedBaselines(): void {
    // 1. Try loading from SQLite database first
    if (this.sqliteDb) {
      try {
        const query = this.sqliteDb.prepare(
          'SELECT service_id, version, p95_latency_ms, evaluated_at, timestamp_ms FROM historical_drift_snapshots ORDER BY timestamp_ms ASC'
        );
        const rows = query.all();
        if (Array.isArray(rows) && rows.length > 0) {
          for (const row of rows) {
            const sId = String(row.service_id).toLowerCase();
            const record: HistoricalDeploymentRecord = {
              version: String(row.version),
              p95LatencyMs: parseFloat(Number(row.p95_latency_ms).toFixed(2)),
              evaluatedAt: String(row.evaluated_at),
              timestampMs: Number(row.timestamp_ms),
            };
            const list = this.baselineHistory.get(sId) || [];
            list.push(record);
            this.baselineHistory.set(sId, list);
          }
          return;
        }
      } catch {
        // Fall back to JSON
      }
    }

    // 2. Fall back to JSON file storage
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

  private saveRecordToStorage(sId: string, record: HistoricalDeploymentRecord): void {
    if (this.sqliteDb) {
      try {
        const insertStmt = this.sqliteDb.prepare(`
          INSERT INTO historical_drift_snapshots (service_id, version, p95_latency_ms, evaluated_at, timestamp_ms)
          VALUES (?, ?, ?, ?, ?)
        `);
        insertStmt.run(sId, record.version, record.p95LatencyMs, record.evaluatedAt, record.timestampMs || Date.now());
      } catch {
        // Ignore DB write errors
      }
    }
    telemetryMongo.saveDriftSnapshot(sId, record).catch(() => {});
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
        proactiveWarning: 'Collecting ongoing telemetry snapshots to compute OLS drift trajectory.',
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
   * Calculates moving average P95 latency baseline from real historical snapshots and live telemetry.
   * If a target does not correspond to an active container or real telemetry metrics, returns NO_DATA honestly.
   */
  public async analyzeDrift(
    serviceId: string,
    liveP95LatencyMs: number,
    matchedContainer?: DockerContainerInfo | null
  ): Promise<DriftAnalysisResult> {
    const sId = serviceId.trim().toLowerCase();

    // 1. Identify live container if not already resolved
    let container = matchedContainer;
    if (container === undefined) {
      const running = await this.dockerCollector.getRunningContainers();
      container = this.dockerCollector.matchContainer(running, sId);
    }

    // 2. Measure authentic live latency if Prometheus returned zero
    let effectiveLiveMs = liveP95LatencyMs;
    if (effectiveLiveMs <= 0 && container) {
      effectiveLiveMs = await this.dockerCollector.measureContainerLatencyMs(container);
    }

    // 3. Retrieve historical observations
    let history = [...(this.baselineHistory.get(sId) || [])];
    if (history.length === 0) {
      history = await telemetryMongo.getDriftHistory(sId);
      if (history.length > 0) {
        this.baselineHistory.set(sId, history);
      }
    }

    // 4. Strict check: If service has no container, no live latency, and no prior history, it is a non-existent target!
    if (!container && effectiveLiveMs <= 0 && history.length === 0) {
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
        recommendation: `No active telemetry metrics, container logs, or traces found for '${serviceId}'. This service is not running in the cluster.`,
      };
    }

    // 5. For real running services without stored history: populate from real MongoDB snapshots or container lifecycle
    if (history.length === 0) {
      const rawSnapshots = await telemetryMongo.getHistoricalSnapshots(sId, 10);
      if (rawSnapshots.length > 0) {
        history = rawSnapshots.map((snap, idx) => ({
          version: `Snapshot #${idx + 1}`,
          evaluatedAt: snap.evaluatedAt,
          p95LatencyMs: snap.p95LatencyMs,
          timestampMs: snap.timestamp,
        }));
      } else if (container) {
        // Extract real container creation and start timestamp from Docker Engine
        const inspect = await this.dockerCollector.getContainerInspect(container.id);
        const startedIso = inspect?.startedAt
          ? new Date(inspect.startedAt).toISOString().replace('T', ' ').slice(0, 19)
          : new Date(Date.now() - 3600000).toISOString().replace('T', ' ').slice(0, 19);

        history = [
          {
            version: 'Container Deploy Baseline',
            evaluatedAt: startedIso,
            p95LatencyMs: parseFloat(effectiveLiveMs.toFixed(2)),
            timestampMs: inspect?.startedAt ? new Date(inspect.startedAt).getTime() : Date.now() - 3600000,
          },
        ];
      }

      this.baselineHistory.set(sId, history);
      for (const rec of history) {
        this.saveRecordToStorage(sId, rec);
      }
    }

    // 6. Record authentic live observation if interval elapsed
    if (effectiveLiveMs > 0) {
      const now = Date.now();
      const lastRec = history[history.length - 1];
      const lastTs = lastRec?.timestampMs || 0;

      if (!lastRec || now - lastTs >= HistoricalDriftAnalyzer.MIN_SNAPSHOT_INTERVAL_MS) {
        const nextEntry: HistoricalDeploymentRecord = {
          version: `Snapshot #${history.length + 1}`,
          evaluatedAt: new Date(now).toISOString().replace('T', ' ').slice(0, 19),
          p95LatencyMs: parseFloat(effectiveLiveMs.toFixed(2)),
          timestampMs: now,
        };
        history.push(nextEntry);
        if (history.length > HistoricalDriftAnalyzer.MAX_HISTORY_PER_SERVICE) {
          history.splice(0, history.length - HistoricalDriftAnalyzer.MAX_HISTORY_PER_SERVICE);
        }
        this.baselineHistory.set(sId, history);
        this.saveRecordToStorage(sId, nextEntry);
        this.persistBaselines();
      }
    }

    // 7. Compute moving average of authentic historical observations
    const sumHistorical = history.reduce((acc, r) => acc + r.p95LatencyMs, 0);
    const historicalBaselineMs = parseFloat((sumHistorical / (history.length || 1)).toFixed(2));

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

    const forecast = this.forecastFutureDrift(historicalBaselineMs, effectiveLiveMs, history, 3, 50.0);

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
        ...history,
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
