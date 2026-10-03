import { HistoricalDriftService } from '../src/drift';
import { HistoricalDeploymentPoint } from '../src/types';

function testDriftAnalysis() {
  console.log('--- Testing Drift Analysis Module ---');
  const service = new HistoricalDriftService(14);

  const history: HistoricalDeploymentPoint[] = [
    { deploymentId: 'dep-1', timestamp: Date.now() - 86400000 * 3, baselineP95Ms: 100 },
    { deploymentId: 'dep-2', timestamp: Date.now() - 86400000 * 2, baselineP95Ms: 110 },
    { deploymentId: 'dep-3', timestamp: Date.now() - 86400000 * 1, baselineP95Ms: 105 },
  ];

  // Baseline average = 105ms
  const resultNormal = service.analyzeDrift('order-service', 110, history);
  console.assert(resultNormal.driftScore < 0.2, 'Normal drift score should be low');

  const resultDegraded = service.analyzeDrift('order-service', 210, history);
  console.assert(resultDegraded.driftScore === 1.0, 'Degraded drift score should cap at 1.0');

  console.log('[OK] Drift Analysis tests passed successfully!');
  console.log('Degraded test result:', resultDegraded);
}

testDriftAnalysis();
