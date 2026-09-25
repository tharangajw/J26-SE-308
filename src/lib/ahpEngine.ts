/**
 * AHP (Analytic Hierarchy Process) Engine
 * Saaty's method for deriving priority weights from a pairwise comparison matrix.
 *
 * Pillars:
 *   0 → Metrics Coverage (Prometheus)
 *   1 → Trace Propagation (Jaeger)
 *   2 → Log Structural Integrity (Loki)
 *
 * Pairwise Matrix (Saaty scale 1-9):
 *   Metrics vs Traces : 1   (equally important)
 *   Metrics vs Logs   : 1.2 (Metrics slightly preferred over Logs)
 *   Traces  vs Logs   : 1.2 (Traces  slightly preferred over Logs)
 *
 * This produces weights ≈ 35.3% / 35.3% / 29.4%  (CI < 0.10 → consistent)
 */

export interface AHPResult {
  /** Raw pairwise comparison matrix */
  matrix: number[][];
  /** Column-normalised matrix */
  normalisedMatrix: number[][];
  /** Final priority weight vector (sums to 1) */
  weights: number[];
  /** Labels for each criterion */
  labels: string[];
  /** λ_max  (principal eigen-value approximation) */
  lambdaMax: number;
  /** Consistency Index  CI = (λ_max - n) / (n - 1) */
  consistencyIndex: number;
  /** Random Consistency Index for n=3 */
  randomIndex: number;
  /** Consistency Ratio  CR = CI / RI  (must be < 0.10) */
  consistencyRatio: number;
  /** true when CR < 0.10 */
  isConsistent: boolean;
}

/** Saaty RI table (n = 1 … 10) */
const RI: Record<number, number> = {
  1: 0.00, 2: 0.00, 3: 0.58, 4: 0.90, 5: 1.12,
  6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49,
};

/**
 * Runs the full AHP calculation for an n×n upper-triangular pairwise matrix.
 * @param matrix  Full n×n matrix (a[i][j] = importance of i over j; a[j][i] = 1/a[i][j])
 * @param labels  Criterion names
 */
export function runAHP(matrix: number[][], labels: string[]): AHPResult {
  const n = matrix.length;

  // 1 – Column sums
  const colSums = Array.from({ length: n }, (_, j) =>
    matrix.reduce((acc, row) => acc + row[j], 0)
  );

  // 2 – Normalised matrix
  const normalisedMatrix = matrix.map(row =>
    row.map((val, j) => val / colSums[j])
  );

  // 3 – Priority weight vector (row averages of normalised matrix)
  const weights = normalisedMatrix.map(row => row.reduce((a, b) => a + b, 0) / n);

  // 4 – λ_max  (weighted sum vector ÷ weights)
  const weightedSumVector = matrix.map((row, _i) =>
    row.reduce((acc, val, j) => acc + val * weights[j], 0)
  );
  const lambdaMax = weightedSumVector.reduce((acc, val, i) => acc + val / weights[i], 0) / n;

  // 5 – CI and CR
  const consistencyIndex = (lambdaMax - n) / (n - 1);
  const randomIndex = RI[n] ?? 1.49;
  const consistencyRatio = consistencyIndex / randomIndex;
  const isConsistent = consistencyRatio < 0.10;

  return {
    matrix,
    normalisedMatrix,
    weights,
    labels,
    lambdaMax,
    consistencyIndex,
    consistencyRatio,
    randomIndex,
    isConsistent,
  };
}

// ─── Observability-specific AHP configuration ────────────────────────────────

const PILLAR_LABELS = [
  'Metrics Coverage (Prometheus)',
  'Trace Propagation (Jaeger)',
  'Log Structural Integrity (Loki)',
];

/**
 * Pairwise comparison matrix for the 3 telemetry pillars.
 *
 * Rationale (Saaty scale):
 *   • Metrics & Traces are equally critical for real-time alerting → 1
 *   • Both Metrics and Traces are marginally more important than Logs for
 *     anomaly detection speed → 1.2 (between "equal" and "weakly preferred")
 */
const PILLAR_MATRIX: number[][] = [
  //  Metrics  Traces   Logs
  [1,       1,       1.2],   // Metrics row
  [1,       1,       1.2],   // Traces  row
  [1 / 1.2, 1 / 1.2, 1  ],   // Logs    row
];

/** Pre-computed AHP result for the observability pillars */
export const OBS_AHP: AHPResult = runAHP(PILLAR_MATRIX, PILLAR_LABELS);

/**
 * Calculates the O-Score using AHP-derived weights.
 *
 * @param metricsCoverage      0–1   (from Prometheus)
 * @param tracePropagation     0–1   (from Jaeger)
 * @param logStructuralIntegrity 0–1 (from Loki)
 * @param blindSpotCount       integer ≥ 0
 * @param penaltyPerBlindSpot  default 2 pts
 * @returns O-Score (0–100)
 */
export function calculateOScore(
  metricsCoverage: number,
  tracePropagation: number,
  logStructuralIntegrity: number,
  blindSpotCount: number,
  penaltyPerBlindSpot = 2,
): number {
  const [wM, wT, wL] = OBS_AHP.weights;
  const raw = (metricsCoverage * wM + tracePropagation * wT + logStructuralIntegrity * wL) * 100;
  const penalty = Math.min(blindSpotCount * penaltyPerBlindSpot, 15); // cap at 15 pts
  return Math.max(0, raw - penalty);
}
