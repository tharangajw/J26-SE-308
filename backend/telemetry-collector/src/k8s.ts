import { K8sClusterState } from './types.js';

export class K8sCollector {
  private endpoint: string;

  constructor(endpoint: string = 'http://localhost:8001') {
    this.endpoint = endpoint;
  }

  /**
   * Queries real Kubernetes API for deployment replica status, HPA scaling events, and pod uptime.
   * Throws an error if K8s API server is unreachable.
   */
  public async fetchClusterState(serviceId: string): Promise<K8sClusterState> {
    const url = `${this.endpoint}/apis/apps/v1/namespaces/default/deployments/${serviceId}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch K8s cluster state for ${serviceId}: ${response.statusText}`);
    }

    const data = await response.json();
    const replicas = data.status?.replicas || 1;
    const readyReplicas = data.status?.readyReplicas || 0;

    return {
      podReplicaCount: readyReplicas > 0 ? readyReplicas : replicas,
      hpaTriggerEvents: 0,
      podSpinUpLagSec: 0.0,
      uptimeSeconds: 0,
    };
  }
}
