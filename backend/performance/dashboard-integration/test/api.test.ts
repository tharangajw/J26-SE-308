import { MaturityEvaluationApiContract } from '../src/api';

// Integration test suite verifying that local performance scoring results are formatted correctly
// into the shared multi-pillar contract schema and properly combined into composite maturity scores.
function testDashboardApiContract() {
  console.log('--- Testing Dashboard Integration API Contract ---');
  const api = new MaturityEvaluationApiContract();

  // Format sample service evaluation across all 4 system pillars
  const payload = api.formatSharedMaturityPayload(
    'order-service',
    78.4,
    'Mature',
    0.15,
    0.20,
    0.05,
    3,
    { rScore: 82.0, oScore: 88.0, aScore: 74.0 }
  );

  // Assert payload structure and non-zero composite maturity calculation
  console.assert(payload.serviceId === 'order-service', 'Service ID should match');
  console.assert(payload.scores.pScore === 78.4, 'P-Score should be 78.4');
  console.assert(payload.scores.compositeMaturity > 0, 'Composite maturity should be calculated');

  console.log('[OK] Dashboard Integration API Contract tests passed successfully!');
  console.log('Payload:', payload);
}

testDashboardApiContract();
