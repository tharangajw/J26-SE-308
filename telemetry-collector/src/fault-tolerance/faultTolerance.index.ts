
// Fault Tolerance Module — Barrel Export
// Import everything from here:
//   import { FaultToleranceCollector, computeRScore, ... }
//     from './fault-tolerance/faultTolerance.index';

// All TypeScript interfaces and types
export * from './faultTolerance.types';

// R-Score calculation engine
export { computeRScore } from './faultTolerance.rScore';

// Self-healing effectiveness collector and calculator
export { SelfHealingCollector, computeSelfHealingScore } from './faultTolerance.selfHealing';
export type { K8sSelfHealingInput } from './faultTolerance.selfHealing';

// Chaos experiment recorder
export {
  recordChaosInjection,
  recordChaosRecovery,
  recordChaosFailure,
  getActiveExperiment,
  getCompletedExperiments,
  computeFaultRecoverySuccessRate,
  computeAvgRecoveryTimeSec,
} from './faultTolerance.chaos';

// Main orchestrator collector
export { FaultToleranceCollector } from './faultTolerance.collector';
