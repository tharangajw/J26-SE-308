import { Skull, RefreshCw, Activity, CheckCircle, XCircle } from 'lucide-react';
import { useChaosContext } from '../../context/ChaosContext';

export default function ChaosPanel() {
  const { activeChaosEvent, chaosHistory } = useChaosContext();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="obs-glass p-6 mb-6 flex justify-between items-center bg-rose-500/5 border-rose-500/20">
        <div>
          <h2 className="text-xl font-bold text-rose-400 flex items-center gap-2">
            <Skull className="w-6 h-6" />
            Chaos Engineering Lab
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Monitoring active chaos faults injected from the Fault Tolerance suite.
          </p>
        </div>
        {activeChaosEvent && activeChaosEvent.status.includes('Active Fault') && (
          <div className="flex items-center gap-3 px-4 py-2 bg-rose-500/20 text-rose-300 rounded-full border border-rose-500/30 font-medium animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Experiment Running: {activeChaosEvent.type}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-medium text-slate-300 mb-4">Recent Activity</h3>
        <div className="obs-glass p-4 h-[400px] overflow-y-auto space-y-3">
          {chaosHistory.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-10">No recent experiments</p>
          ) : (
            chaosHistory.map(hist => (
              <div key={hist.id} className="bg-slate-900/50 p-3 rounded-lg border border-white/5 text-sm">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-slate-300">{hist.experiment_type}</span>
                  {hist.status === 'completed' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> :
                   hist.status === 'failed' ? <XCircle className="w-4 h-4 text-rose-500" /> :
                   <Activity className="w-4 h-4 text-sky-400 animate-pulse" />}
                </div>
                <p className="text-xs text-slate-500 mb-2">
                  {new Date(hist.started_at).toLocaleTimeString()}
                </p>
                <p className="text-xs text-slate-400 bg-black/30 p-2 rounded">
                  {hist.message}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
