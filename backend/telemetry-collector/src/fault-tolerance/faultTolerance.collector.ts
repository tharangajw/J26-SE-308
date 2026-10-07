// Fault Tolerance Data Collector — Main Orchestrator
//
// Connects to:
//   • Prometheus  → http://localhost:9090  (metrics)
//   • Kubernetes  → http://localhost:8001  (pod/replica state)
//
// Collects the 8 raw metrics needed for R-Score:
//   Availability, CPU, Memory, Error Rate,
//   Restarts, MTTR, Latency, Failover Success Rate

import { FaultToleranceRawMetrics, FaultToleranceCollectedSnapshot, ClusterResilienceSummary } from './faultTolerance.types';
import { computeRScore } from './faultTolerance.rScore';
import { SelfHealingCollector } from './faultTolerance.selfHealing';
import { getActiveExperiment } from './faultTolerance.chaos';

// Prometheus query builder helpers
const buildPromQuery = (endpoint: string, query: string): string =>
  `${endpoint}/api/v1/query?query=${encodeURIComponent(query)}`;

async function fetchPromValue(url: string): Promise<number | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const val = json?.data?.result?.[0]?.value?.[1];
    return val !== undefined ? parseFloat(val) : null;
  } catch {
    return null;
  }
}

// Main Fault Tolerance Collector
export class FaultToleranceCollector {
  private prometheusEndpoint: string;
  private k8sEndpoint: string;
  private selfHealingCollector: SelfHealingCollector;

  constructor(
    prometheusEndpoint: string = 'http://localhost:9090',
    k8sEndpoint: string = 'http://localhost:8001',
  ) {
    this.prometheusEndpoint = prometheusEndpoint;
    this.k8sEndpoint = k8sEndpoint;
    this.selfHealingCollector = new SelfHealingCollector(k8sEndpoint);
  }

  // Collect all 8 raw metrics from Prometheus for one service
  private async fetchRawMetrics(serviceId: string): Promise<{
    metrics: FaultToleranceRawMetrics;
    prometheusReachable: boolean;
  }> {
    const prom = this.prometheusEndpoint;
    const ts = Date.now();

    // ------ A: Availability ------
    // `up{job="<serviceId>"}` returns 1 (online) or 0 (down)
    const availRaw = await fetchPromValue(
      buildPromQuery(prom, `up{job="${serviceId}"}`),
    );
    const availabilityPercent = availRaw !== null
      ? (availRaw === 1 ? 99.9 : 0.0)   // simplify: 1→healthy, 0→down
      : 99.9;                            // fallback if Prometheus unreachable

    // ------ C: CPU % ------
    // container_cpu_usage_seconds_total gives a rate; multiply by 100 for %
    const cpuRaw = await fetchPromValue(
      buildPromQuery(
        prom,
        `rate(container_cpu_usage_seconds_total{container="${serviceId}"}[1m]) * 100`,
      ),
    );
    const cpuPercent = cpuRaw !== null ? parseFloat(cpuRaw.toFixed(2)) : 0.0;

    // ------ M: Memory % ------
    // container_memory_working_set_bytes / container_spec_memory_limit_bytes * 100
    const memRaw = await fetchPromValue(
      buildPromQuery(
        prom,
        `container_memory_working_set_bytes{container="${serviceId}"}` +
        ` / container_spec_memory_limit_bytes{container="${serviceId}"} * 100`,
      ),
    );
    const memoryPercent = memRaw !== null ? parseFloat(memRaw.toFixed(2)) : 0.0;

    // ------ E: Error Rate % ------
    // (5xx requests / total requests) * 100 over 5 min window
    const errRaw = await fetchPromValue(
      buildPromQuery(
        prom,
        `rate(http_requests_total{job="${serviceId}",status=~"5.."}[5m])` +
        ` / rate(http_requests_total{job="${serviceId}"}[5m]) * 100`,
      ),
    );
    const errorRate = errRaw !== null ? parseFloat(errRaw.toFixed(3)) : 0.0;

    // ------ R: Pod Restarts ------
    // kube_pod_container_status_restarts_total — cumulative count
    const restartRaw = await fetchPromValue(
      buildPromQuery(
        prom,
        `kube_pod_container_status_restarts_total{container="${serviceId}"}`,
      ),
    );
    const totalRestarts = restartRaw !== null ? Math.floor(restartRaw) : 0;

    // ------ L: Latency (P95 ms) ------
    // histogram_quantile gives seconds → convert to ms
    const latRaw = await fetchPromValue(
      buildPromQuery(
        prom,
        `histogram_quantile(0.95,` +
        ` sum(rate(http_request_duration_seconds_bucket{job="${serviceId}"}[5m])) by (le))` +
        ` * 1000`,
      ),
    );
    const avgLatencyMs = latRaw !== null ? parseFloat(latRaw.toFixed(2)) : 0.0;

    // ------ F: Failover Success Rate % ------
    // readyReplicas / desiredReplicas * 100
    const readyRaw = await fetchPromValue(
      buildPromQuery(
        prom,
        `kube_deployment_status_replicas_ready{deployment="${serviceId}"}`,
      ),
    );
    const desiredRaw = await fetchPromValue(
      buildPromQuery(
        prom,
        `kube_deployment_spec_replicas{deployment="${serviceId}"}`,
      ),
    );
    const failoverSuccessRate =
      readyRaw !== null && desiredRaw !== null && desiredRaw > 0
        ? parseFloat(((readyRaw / desiredRaw) * 100).toFixed(2))
        : 100.0; // fallback: assume healthy if data unavailable

    // ------ T: MTTR (seconds) ------
    // Computed from K8s pod events — estimated via restart timing
    // Simple approximation: if restarts > 0, fetch last pod start time
    let mttrSeconds = 12.0; // baseline healthy MTTR from mockData
    try {
      const podUrl =
        `${this.k8sEndpoint}/api/v1/namespaces/default/pods` +
        `?labelSelector=app=${serviceId}&limit=1`;
      const podRes = await fetch(podUrl);
      if (podRes.ok) {
        const podData = await podRes.json();
        const pod = podData.items?.[0];
        if (pod) {
          const conditions: Array<{ type: string; lastTransitionTime: string }> =
            pod.status?.conditions ?? [];
          const ready  = conditions.find((c) => c.type === 'Ready');
          const started = pod.status?.startTime;
          if (ready?.lastTransitionTime && started) {
            const diff =
              new Date(ready.lastTransitionTime).getTime() -
              new Date(started).getTime();
            mttrSeconds = parseFloat((diff / 1000).toFixed(1));
          }
        }
      }
    } catch {
      mttrSeconds = 12.0; // fallback to baseline
    }

    const prometheusReachable = availRaw !== null;

    return {
      metrics: {
        serviceId,
        timestamp: ts,
        availabilityPercent,
        cpuPercent,
        memoryPercent,
        errorRate,
        totalRestarts,
        mttrSeconds,
        avgLatencyMs,
        failoverSuccessRate,
      },
      prometheusReachable,
    };
  }

  // Collect a full snapshot for one service:
  // raw metrics → R-Score → self-healing → chaos event
  public async collectServiceSnapshot(
    serviceId: string,
  ): Promise<FaultToleranceCollectedSnapshot> {
    const ts = Date.now();

    const { metrics, prometheusReachable } = await this.fetchRawMetrics(serviceId);
    const rScore = computeRScore(metrics);

    // Self-healing — queries K8s API
    let selfHealing;
    let k8sReachable = false;
    try {
      selfHealing = await this.selfHealingCollector.fetchAndCompute(serviceId, ts);
      k8sReachable = true;
    } catch {
      selfHealing = {
        serviceId,
        timestamp: ts,
        podRestartSuccessRate: 100,
        replicaReplacementSuccessRate: 100,
        hpaEffectiveness: 100,
        circuitBreakerEffectiveness: 100,
        selfHealingScore: 100,
      };
    }

    return {
      serviceId,
      timestamp: ts,
      rawMetrics: metrics,
      rScore,
      selfHealing,
      activeChaosExperiment: getActiveExperiment(serviceId),
      sources: {
        prometheus: prometheusReachable,
        kubernetes: k8sReachable,
      },
    };
  }

  // cluster-wide resilience summary
  public async collectClusterSummary(
    serviceIds: string[],
  ): Promise<ClusterResilienceSummary> {
    const snapshots = await Promise.all(
      serviceIds.map((id) => this.collectServiceSnapshot(id)),
    );

    const scores = snapshots.map((s) => s.rScore.rScore);
    const avgRScore = scores.length
      ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
      : 0;

    const criticalServices  = snapshots.filter((s) => s.rScore.rScore < 50).map((s) => s.serviceId);
    const degradedServices  = snapshots.filter((s) => s.rScore.rScore >= 50 && s.rScore.rScore < 75).map((s) => s.serviceId);

    let overallMaturityLevel: ClusterResilienceSummary['overallMaturityLevel'] = 'Optimized';
    if (avgRScore < 50)      overallMaturityLevel = 'Initial';
    else if (avgRScore < 75) overallMaturityLevel = 'Developing';
    else if (avgRScore < 88) overallMaturityLevel = 'Mature';

    return {
      timestamp: Date.now(),
      serviceCount: serviceIds.length,
      avgRScore,
      overallMaturityLevel,
      criticalServices,
      degradedServices,
      snapshots,
    };
  }
}
