// Controlled demo faults exercise telemetry gaps without taking Prometheus down.
import { Skull, RefreshCw, Activity, CheckCircle, XCircle, Radio, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useChaosContext } from '../../context/ChaosContext';
import { TelemetryService } from '../../services/telemetry';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

interface ChaosPanelProps {
  onExperimentRun?: (expId: string) => void;
}

export default function ChaosPanel({ onExperimentRun: _onExperimentRun }: ChaosPanelProps) {
  const { activeChaosEvent, chaosHistory } = useChaosContext();
  const [running, setRunning] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [services, setServices] = useState<string[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);

  const runTelemetryGap = async (faultType: 'TRACE_GAP' | 'LOG_GAP' | 'METRIC_GAP' | 'SERVICE_DOWN' | 'LATENCY_SPIKE' | 'ERROR_SPIKE', serviceId = 'all') => {
    setRunning(faultType);
    setMessage('');
    try {
      const response = await fetch('/api/observability/chaos/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faultType, serviceId, duration: 40 }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setMessage(`${faultType.replace('_', ' ')} active for ${serviceId === 'all' ? 'all services' : serviceId}. CCI/O-Score will refresh within 2 seconds.`);
    } catch (error) {
      setMessage(`Experiment failed: ${error instanceof Error ? error.message : 'backend unavailable'}`);
    } finally {
      setRunning(null);
    }
  };

  const openServicePicker = async () => {
    setLoadingServices(true);
    setMessage('Discovering available services...');
    try {
      const discovered = await TelemetryService.discoverServices();
      const liveServices = discovered.applicationServices.length > 0
        ? discovered.applicationServices
        : ['api-gateway', 'order-service', 'payment-service', 'book-service', 'user-service'];
      setServices([...new Set(liveServices)].sort());
      setServicePickerOpen(true);
      setMessage('Select a service to disable for the controlled experiment.');
    } catch {
      setServices(['api-gateway', 'order-service', 'payment-service', 'book-service', 'user-service']);
      setServicePickerOpen(true);
      setMessage('Live discovery unavailable; showing the project service catalog.');
    } finally {
      setLoadingServices(false);
    }
  };

  const clearTelemetryGap = async () => {
    await fetch('/api/observability/chaos/clear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    setMessage('Telemetry restored. Waiting for the next live score refresh.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Skull className="h-4 w-4 text-rose-400" /> Chaos Engineering Lab
          </h3>
          <p className="mt-1 text-text-secondary">Monitoring active chaos faults injected from the Fault Tolerance suite.</p>
        </div>
        {activeChaosEvent && activeChaosEvent.status.includes('Active Fault') && (
          <div className="inline-flex items-center gap-2 font-medium text-rose-300">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Experiment running: {activeChaosEvent.type}
          </div>
        )}
      </div>

      <Card className="border-cyan-500/30 bg-cyan-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-cyan-300">
            <ShieldAlert className="h-4 w-4" /> Research CCI / O-Score Experiments
          </CardTitle>
          <p className="text-xs text-text-secondary">Create a reversible telemetry blind spot. The live calculation refreshes every 2 seconds.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button disabled={!!running} onClick={() => runTelemetryGap('TRACE_GAP')} className="rounded-md border border-indigo-400/40 px-3 py-2 text-xs text-indigo-300 hover:bg-indigo-400/10 disabled:opacity-50"><Radio className="mr-1 inline h-3.5 w-3.5" />Drop Jaeger Trace</button>
            <button disabled={!!running} onClick={() => runTelemetryGap('LOG_GAP')} className="rounded-md border border-cyan-400/40 px-3 py-2 text-xs text-cyan-300 hover:bg-cyan-400/10 disabled:opacity-50">Drop Loki Log</button>
            <button disabled={!!running} onClick={() => runTelemetryGap('METRIC_GAP')} className="rounded-md border border-orange-400/40 px-3 py-2 text-xs text-orange-300 hover:bg-orange-400/10 disabled:opacity-50">Drop Prometheus Metric</button>
            <button disabled={!!running || loadingServices} onClick={openServicePicker} className="rounded-md border border-rose-400/40 px-3 py-2 text-xs text-rose-300 hover:bg-rose-400/10 disabled:opacity-50">{loadingServices ? 'Loading Services...' : 'Disable Service'}</button>
            <button disabled={!!running} onClick={() => runTelemetryGap('LATENCY_SPIKE')} className="rounded-md border border-amber-400/40 px-3 py-2 text-xs text-amber-300 hover:bg-amber-400/10 disabled:opacity-50">Latency Spike</button>
            <button disabled={!!running} onClick={() => runTelemetryGap('ERROR_SPIKE')} className="rounded-md border border-red-400/40 px-3 py-2 text-xs text-red-300 hover:bg-red-400/10 disabled:opacity-50">Error Spike</button>
            <button onClick={clearTelemetryGap} className="rounded-md border border-emerald-400/40 px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-400/10">Restore Telemetry</button>
          </div>
          {servicePickerOpen && (
            <div className="rounded-md border border-rose-400/30 bg-rose-400/5 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-rose-300">Choose service to disable</p>
              <div className="flex flex-wrap gap-2">
                {services.map((service) => (
                  <button key={service} disabled={!!running} onClick={() => { setServicePickerOpen(false); runTelemetryGap('SERVICE_DOWN', service); }} className="rounded-md border border-border bg-surface-secondary/50 px-3 py-2 font-mono text-xs text-text-secondary hover:border-rose-400/50 hover:text-rose-300 disabled:opacity-50">
                    {service}
                  </button>
                ))}
              </div>
              <button onClick={() => setServicePickerOpen(false)} className="mt-3 text-xs text-text-muted hover:text-text-secondary">Cancel</button>
            </div>
          )}
          {message && <p className="text-xs text-text-secondary">{message}</p>}
          <p className="text-[11px] text-text-muted">Recommended demo: baseline → Drop Jaeger Trace → show Blind Spot + lower CCI/O-Score → Restore Telemetry.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="max-h-[400px] space-y-3 overflow-y-auto">
          {chaosHistory.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-text-muted">
              <Skull className="mb-3 h-8 w-8 opacity-30" />
              <p className="text-sm">No recent experiments</p>
            </div>
          ) : (
            chaosHistory.map((hist) => (
              <div key={hist.id} className="rounded-md border border-border/80 bg-surface-secondary/30 p-3 text-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-text-primary">{hist.experiment_type}</span>
                  {hist.status === 'completed' ? <CheckCircle className="h-4 w-4 text-emerald-400" /> :
                   hist.status === 'failed' ? <XCircle className="h-4 w-4 text-rose-400" /> :
                   <Activity className="h-4 w-4 animate-pulse text-cyan-400" />}
                </div>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  {new Date(hist.started_at).toLocaleTimeString()}
                </p>
                <p className="font-mono text-xs leading-relaxed text-text-secondary">
                  {hist.message}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
