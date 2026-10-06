export interface HistoricalDeploymentPoint {
  deploymentId: string;
  timestamp: number;
  baselineP95Ms: number;
}

export interface DriftAnalysisResult {
  serviceId: string;
  currentP95Ms: number;
  historicalBaselineP95Ms: number;
  driftDeltaMs: number;
  driftPercentage: number;
  driftScore: number; // Normalized 0.0 (no degradation) to 1.0 (severe drift)
  sensitivityWindowDays: number;
}
