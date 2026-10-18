import { Skull, RefreshCw, Activity, CheckCircle, XCircle } from 'lucide-react';
import { useChaosContext } from '../../context/ChaosContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

interface ChaosPanelProps {
  onExperimentRun?: (expId: string) => void;
}

export default function ChaosPanel({ onExperimentRun: _onExperimentRun }: ChaosPanelProps) {
  const { activeChaosEvent, chaosHistory } = useChaosContext();

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
