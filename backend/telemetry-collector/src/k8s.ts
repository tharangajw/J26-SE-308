import { K8sClusterState } from './types.js';
import { DockerCollector } from './docker.js';

export class K8sCollector {
  private endpoint: string;
  private dockerCollector: DockerCollector;

  constructor(endpoint: string = 'http://localhost:8001') {
    this.endpoint = endpoint;
    this.dockerCollector = new DockerCollector();
  }

  /**
   * Queries real Kubernetes API for deployment replica status, HPA scaling events, and pod uptime.
   * If Kubernetes API is unreachable, falls back to live Docker Engine container inspection (StartedAt).
   */
  public async fetchClusterState(serviceId: string): Promise<K8sClusterState> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 800);
      const url = `${this.endpoint}/apis/apps/v1/namespaces/default/deployments/${serviceId}`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const replicas = Number(data.status?.replicas ?? 1);
        const readyReplicas = Number(data.status?.readyReplicas ?? 0);

        const creationTs = data.metadata?.creationTimestamp ? Date.parse(data.metadata.creationTimestamp) : NaN;
        const conditions: any[] = Array.isArray(data.status?.conditions) ? data.status.conditions : [];
        const availableCond = conditions.find((c) => c.type === 'Available' || c.type === 'Progressing');
        const transitionTs = availableCond?.lastTransitionTime ? Date.parse(availableCond.lastTransitionTime) : creationTs;

        let uptimeSeconds = 0;
        if (Number.isFinite(transitionTs) && transitionTs > 0) {
          uptimeSeconds = Math.max(0, Math.round((Date.now() - transitionTs) / 1000));
        } else if (Number.isFinite(creationTs) && creationTs > 0) {
          uptimeSeconds = Math.max(0, Math.round((Date.now() - creationTs) / 1000));
        }

        let podSpinUpLagSec = 0.0;
        if (Number.isFinite(creationTs) && Number.isFinite(transitionTs) && transitionTs >= creationTs) {
          podSpinUpLagSec = parseFloat(Math.min(120, (transitionTs - creationTs) / 1000).toFixed(2));
        }

        return {
          podReplicaCount: readyReplicas > 0 ? readyReplicas : replicas,
          hpaTriggerEvents: Math.max(0, Number(data.status?.collisionCount ?? 0)),
          podSpinUpLagSec,
          uptimeSeconds,
        };
      }
    } catch {
      // K8s API unreachable — fall back to live Docker container lifecycle state
    }

    const dockerState = await this.dockerCollector.getContainerLifecycleState(serviceId);
    if (dockerState) {
      return dockerState;
    }

    throw new Error(`Failed to fetch K8s or Docker lifecycle state for ${serviceId}`);
  }
}
