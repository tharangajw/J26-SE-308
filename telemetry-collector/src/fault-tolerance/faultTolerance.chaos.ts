
// Chaos Experiment Recorder

import { ChaosExperimentRecord, ChaosFaultType } from './faultTolerance.types';

// In-memory store for active and completed chaos experiments
const _activeExperiments = new Map<string, ChaosExperimentRecord>();
const _completedExperiments: ChaosExperimentRecord[] = [];


// Start recording a new chaos experiment
export function recordChaosInjection(
  experimentId: string,
  faultType: ChaosFaultType,
  targetService: string,
  rScoreBefore: number,
): ChaosExperimentRecord {
  const record: ChaosExperimentRecord = {
    experimentId,
    faultType,
    targetService,
    injectedAt: Date.now(),
    resolvedAt: null,
    recoveryTimeSec: null,
    availabilityImpactPercent: 0,
    rScoreBefore,
    rScoreAfter: null,
    recovered: false,
    faultRecoverySuccessRate: 0,
  };

  _activeExperiments.set(experimentId, record);
  return record;
}

// Update an active experiment when recovery is detected
export function recordChaosRecovery(
  experimentId: string,
  rScoreAfter: number,
  availabilityImpactPercent: number,
): ChaosExperimentRecord | null {
  const record = _activeExperiments.get(experimentId);
  if (!record) return null;

  const now = Date.now();
  const recoveryTimeSec = parseFloat(
    ((now - record.injectedAt) / 1000).toFixed(1),
  );

  const updated: ChaosExperimentRecord = {
    ...record,
    resolvedAt: now,
    recoveryTimeSec,
    availabilityImpactPercent: parseFloat(availabilityImpactPercent.toFixed(2)),
    rScoreAfter,
    recovered: true,
    // FRSR = successful recovery / total experiment run
    faultRecoverySuccessRate: 100,
  };

  _activeExperiments.delete(experimentId);
  _completedExperiments.push(updated);
  return updated;
}

// Mark experiment as failed to recover (timeout / manual stop)
export function recordChaosFailure(
  experimentId: string,
  availabilityImpactPercent: number,
): ChaosExperimentRecord | null {
  const record = _activeExperiments.get(experimentId);
  if (!record) return null;

  const updated: ChaosExperimentRecord = {
    ...record,
    resolvedAt: Date.now(),
    recoveryTimeSec: null,
    availabilityImpactPercent: parseFloat(availabilityImpactPercent.toFixed(2)),
    rScoreAfter: null,
    recovered: false,
    faultRecoverySuccessRate: 0,
  };

  _activeExperiments.delete(experimentId);
  _completedExperiments.push(updated);
  return updated;
}

// Get the currently active experiment for a service (if any)
export function getActiveExperiment(
  targetService: string,
): ChaosExperimentRecord | null {
  for (const record of _activeExperiments.values()) {
    if (record.targetService === targetService) return record;
  }
  return null;
}

// Get all completed chaos experiments (for history/reporting)
export function getCompletedExperiments(): ChaosExperimentRecord[] {
  return [..._completedExperiments];
}

// Compute Fault Recovery Success Rate across all experiments
export function computeFaultRecoverySuccessRate(): number {
  const total = _completedExperiments.length;
  if (total === 0) return 100; // no experiments run = no failures
  const recovered = _completedExperiments.filter((e) => e.recovered).length;
  return parseFloat(((recovered / total) * 100).toFixed(2));
}

// Average recovery time across successfully recovered experiments
export function computeAvgRecoveryTimeSec(): number {
  const recovered = _completedExperiments.filter(
    (e) => e.recovered && e.recoveryTimeSec !== null,
  );
  if (recovered.length === 0) return 0;
  const total = recovered.reduce((s, e) => s + (e.recoveryTimeSec ?? 0), 0);
  return parseFloat((total / recovered.length).toFixed(1));
}
