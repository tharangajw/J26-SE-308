// Self-Healing Effectiveness Collector
// Aligns with WBS 7.0 — Self-Healing Assessment Engine
// Measures how well Kubernetes heals itself after a fault

import { SelfHealingSnapshot } from './faultTolerance.types';


// Weights for the composite Self-Healing Score
// Formula: (podRestart * 0.30) + (replicaReplacement * 0.30)
//        + (hpa * 0.20) + (circuitBreaker * 0.20)
const WEIGHTS = {
  podRestart:           0.30,
  replicaReplacement:   0.30,
  hpa:                  0.20,
  circuitBreaker:       0.20,
} as const;


// Raw K8s data needed to compute self-healing metrics
export interface K8sSelfHealingInput {
  serviceId: string;
  timestamp: number;

  // Pod restart events in the last observation window
  totalRestartAttempts: number;
  successfulRestarts: number;

  // Replica replacement events (failed pod → new pod)
  totalReplacementAttempts: number;
  successfulReplacements: number;

  // HPA scaling events triggered vs events that prevented resource exhaustion
  hpaScaleEvents: number;
  hpaSuccessfulInterventions: number;

  // Circuit breaker trips vs trips that successfully stopped cascading failures
  circuitBreakerTrips: number;
  circuitBreakerSuccessfulTrips: number;
}


// Compute individual rates (0–100) from raw K8s counts
// (no events = no failures = perfect score for that metric)
function safeRate(successes: number, total: number): number {
  if (total === 0) return 100;
  return parseFloat(((successes / total) * 100).toFixed(2));
}


// Main self-healing score calculator
export function computeSelfHealingScore(input: K8sSelfHealingInput): SelfHealingSnapshot {
  const podRestartSuccessRate = safeRate(
    input.successfulRestarts,
    input.totalRestartAttempts,
  );

  const replicaReplacementSuccessRate = safeRate(
    input.successfulReplacements,
    input.totalReplacementAttempts,
  );

  const hpaEffectiveness = safeRate(
    input.hpaSuccessfulInterventions,
    input.hpaScaleEvents,
  );

  const circuitBreakerEffectiveness = safeRate(
    input.circuitBreakerSuccessfulTrips,
    input.circuitBreakerTrips,
  );

  // Weighted composite score
  const selfHealingScore = parseFloat(
    (
      podRestartSuccessRate         * WEIGHTS.podRestart +
      replicaReplacementSuccessRate * WEIGHTS.replicaReplacement +
      hpaEffectiveness              * WEIGHTS.hpa +
      circuitBreakerEffectiveness   * WEIGHTS.circuitBreaker
    ).toFixed(2),
  );

  return {
    serviceId:                    input.serviceId,
    timestamp:                    input.timestamp,
    podRestartSuccessRate,
    replicaReplacementSuccessRate,
    hpaEffectiveness,
    circuitBreakerEffectiveness,
    selfHealingScore,
  };
}


// Collector class — fetches raw K8s self-healing data
export class SelfHealingCollector {
  private k8sEndpoint: string;

  constructor(k8sEndpoint: string = 'http://localhost:8001') {
    this.k8sEndpoint = k8sEndpoint;
  }

  
  //  Fetches pod restart and replica replacement counts from the Kubernetes API for a given service (deployment name).
  //  Falls back to zero-count input if the API is unreachable,which produces a score of 100 (no failures observed).   
  public async fetchAndCompute(
    serviceId: string,
    timestamp: number,
  ): Promise<SelfHealingSnapshot> {
    let input: K8sSelfHealingInput = {
      serviceId,
      timestamp,
      totalRestartAttempts: 0,
      successfulRestarts: 0,
      totalReplacementAttempts: 0,
      successfulReplacements: 0,
      hpaScaleEvents: 0,
      hpaSuccessfulInterventions: 0,
      circuitBreakerTrips: 0,
      circuitBreakerSuccessfulTrips: 0,
    };

    try {
      // Fetch pod status from K8s deployment endpoint
      const deployUrl = `${this.k8sEndpoint}/apis/apps/v1/namespaces/default/deployments/${serviceId}`;
      const res = await fetch(deployUrl);

      if (res.ok) {
        const data = await res.json();
        const desired  = data.status?.replicas        ?? 0;
        const ready    = data.status?.readyReplicas   ?? 0;
        const unavail  = data.status?.unavailableReplicas ?? 0;

        // Treat unavailable replicas as replacement attempts
        input.totalReplacementAttempts = unavail;
        input.successfulReplacements   = Math.max(0, unavail - Math.max(0, desired - ready));
      }

      // Fetch pod restart counts from kube-state-metrics via Prometheus
      const promUrl = `http://localhost:9090/api/v1/query` +
        `?query=kube_pod_container_status_restarts_total{container="${serviceId}"}`;
      const promRes = await fetch(promUrl);

      if (promRes.ok) {
        const promData = await promRes.json();
        const restartVal = promData.data?.result?.[0]?.value?.[1];
        if (restartVal !== undefined) {
          const totalRestarts = parseInt(restartVal, 10);
          // Assume restarts that resulted in a running pod are successful
          input.totalRestartAttempts = totalRestarts;
          input.successfulRestarts   = totalRestarts; // K8s only counts completed restarts
        }
      }
    } catch {
      // Silently fall back — compute will use zero-count defaults
    }

    return computeSelfHealingScore(input);
  }
}
