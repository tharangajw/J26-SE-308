import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Server } from 'lucide-react';
import { TelemetryService } from '../../services/telemetry';
import type { ServiceDiscovery } from '../../services/telemetry';
import './KubernetesDiscoveryPanel.css';

const SOURCE_LABELS: Record<string, string> = {
  prometheus: 'Prometheus',
  loki: 'Loki',
  jaeger: 'Jaeger',
  kubernetes: 'Kubernetes',
};

export default function KubernetesDiscoveryPanel() {
  const [discovery, setDiscovery] = useState<ServiceDiscovery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDiscovery(await TelemetryService.getServiceDiscovery());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Service discovery failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="k8s-discovery-panel" aria-label="Live service discovery">
      <header className="k8s-discovery-header">
        <div>
          <h3><Server size={16} /> Live service discovery</h3>
          <p>Services reported by the configured telemetry backends and Kubernetes API.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} aria-label="Refresh service discovery">
          <RefreshCw size={14} className={loading ? 'k8s-discovery-spinning' : ''} />
          {loading ? 'Refreshing' : 'Refresh'}
        </button>
      </header>

      {error && <p className="k8s-discovery-error" role="alert">{error}</p>}

      {discovery && (
        <>
          <div className="k8s-discovery-sources">
            {Object.entries(discovery.sources).map(([name, source]) => (
              <div className="k8s-discovery-source" key={name}>
                <span className={`k8s-discovery-dot ${source.connected ? 'is-connected' : ''}`} />
                <span>{SOURCE_LABELS[name] ?? name}</span>
                <strong>{source.configured ? (source.connected ? (name === 'loki' ? 'Ready' : `${source.count} found`) : 'Unavailable') : 'Not configured'}</strong>
                {source.error && <span className="k8s-discovery-source-error" title={source.error}>Details</span>}
              </div>
            ))}
          </div>

          {Object.values(discovery.sources).some((source) => source.error) && (
            <details className="k8s-discovery-errors">
              <summary>Integration status details</summary>
              {Object.entries(discovery.sources)
                .filter(([, source]) => source.error || source.workloadsError)
                .map(([name, source]) => (
                  <p key={name}>
                    <strong>{SOURCE_LABELS[name] ?? name}:</strong> {source.error || source.workloadsError}
                  </p>
                ))}
            </details>
          )}

          {discovery.services.length === 0 ? (
            <p className="k8s-discovery-empty">
              No services discovered yet. Configure a reachable telemetry backend or Kubernetes read-only access.
            </p>
          ) : (
            <div className="k8s-discovery-table-wrap">
              <table className="k8s-discovery-table">
                <thead>
                  <tr><th>Service</th><th>Namespace</th><th>Discovered from</th><th>Ports</th></tr>
                </thead>
                <tbody>
                  {discovery.services.map((service) => (
                    <tr key={`${service.namespace ?? ''}/${service.name}`}>
                      <td className="k8s-discovery-service-name">{service.name}</td>
                      <td>{service.namespace ?? '—'}</td>
                      <td>{service.sources.map((source) => SOURCE_LABELS[source] ?? source).join(', ')}</td>
                      <td>{service.ports?.map((port) => `${port.name ? `${port.name}: ` : ''}${port.port ?? '—'}/${port.protocol ?? 'TCP'}`).join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {discovery.workloads.length > 0 && (
            <div className="k8s-discovery-table-wrap">
              <h4 className="k8s-discovery-subheading">Kubernetes deployments</h4>
              <table className="k8s-discovery-table">
                <thead>
                  <tr><th>Deployment</th><th>Namespace</th><th>Ready / Desired</th></tr>
                </thead>
                <tbody>
                  {discovery.workloads.map((workload) => (
                    <tr key={`${workload.namespace ?? ''}/${workload.name}`}>
                      <td className="k8s-discovery-service-name">{workload.name}</td>
                      <td>{workload.namespace ?? '—'}</td>
                      <td className={workload.readyReplicas < workload.desiredReplicas ? 'k8s-discovery-degraded' : ''}>
                        {workload.readyReplicas} / {workload.desiredReplicas}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="k8s-discovery-updated">
            Updated {new Date(discovery.discoveredAt).toLocaleTimeString()}
          </p>
        </>
      )}
    </section>
  );
}