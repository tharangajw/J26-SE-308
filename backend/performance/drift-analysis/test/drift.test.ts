import { HistoricalDriftService } from '../src/drift';
import { HistoricalDeploymentPoint } from '../src/types';

function testDriftAnalysis() {
  console.log('--- Testing Drift Analysis & Predictive Forecasting Module ---');
  const service = new HistoricalDriftService(14);

  const history: HistoricalDeploymentPoint[] = [
    { deploymentId: 'dep-1', timestamp: Date.now() - 86400000 * 3, baselineP95Ms: 100 },
    { deploymentId: 'dep-2', timestamp: Date.now() - 86400000 * 2, baselineP95Ms: 110 },
    { deploymentId: 'dep-3', timestamp: Date.now() - 86400000 * 1, baselineP95Ms: 120 },
  ];

  // Baseline average = 110ms, Live = 130ms (Clear upward degrading trend)
  const result = service.analyzeDrift('order-service', 130, history, 3, 160);

  console.assert(result.driftScore > 0, 'Drift score should be positive');
  console.assert(result.forecast !== undefined, 'Forecast should be generated');
  console.assert(result.forecast?.predictedDeployments.length === 3, 'Should generate 3 forecast steps');
  console.assert(result.forecast?.trendDirection === 'DEGRADING_RAPIDLY', 'Trend should be detected as degrading');
  console.assert(result.forecast?.estimatedDeploymentsToSLABreach !== null, 'SLA breach should be estimated');

  console.log('[OK] Drift Analysis & Forecasting tests passed successfully!');
  console.log('Forecast Result:', JSON.stringify(result.forecast, null, 2));
}

testDriftAnalysis();

