export interface HistoricalDeploymentPoint {
  deploymentId: string;
  timestamp: number;
  baselineP95Ms: number;
}

export interface PredictedDeploymentPoint {
  step: number;
  label: string;
  predictedP95Ms: number;
  lowerBoundMs: number;
  upperBoundMs: number;
}

export interface DriftForecastResult {
  trendSlopeMsPerDeployment: number;
  trendDirection: 'DEGRADING_RAPIDLY' | 'DEGRADING_STEADY' | 'STABLE' | 'IMPROVING';
  predictedDeployments: PredictedDeploymentPoint[];
  estimatedDeploymentsToSLABreach: number | null;
  predictedNextDriftScore: number;
  proactiveWarning: string;
}

export interface DriftAnalysisResult {
  serviceId: string;
  currentP95Ms: number;
  historicalBaselineP95Ms: number;
  driftDeltaMs: number;
  driftPercentage: number;
  driftScore: number; // Normalized 0.0 (no degradation) to 1.0 (severe drift)
  sensitivityWindowDays: number;
  forecast?: DriftForecastResult;
}

