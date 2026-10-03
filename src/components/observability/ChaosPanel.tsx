import { Skull, RefreshCw, Activity, CheckCircle, XCircle } from 'lucide-react';
import { useChaosContext } from '../../context/ChaosContext';

interface ChaosPanelProps {
  onExperimentRun?: (expId: string) => void;
}

export default function ChaosPanel({ onExperimentRun: _onExperimentRun }: ChaosPanelProps) {
  const { activeChaosEvent, chaosHistory } = useChaosContext();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="obs-glass obs-lift p-6 mb-6 flex justify-between items-center bg-gradient-to-r from-rose-500/10 to-fuchsia-500/5 border-rose-500/20 shadow-lg shadow-rose-900/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-rose-500/10 via-transparent to-transparent opacity-50 pointer-events-none"></div>
        <div className="relative z-10">
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-rose-400 to-fuchsia-300 flex items-center gap-2">
            <Skull className="w-6 h-6 text-rose-400 drop-shadow-md" />
            Chaos Engineering Lab
          </h2>
          <p className="text-sm text-slate-300/80 mt-1">
            Monitoring active chaos faults injected from the Fault Tolerance suite.
          </p>
        </div>
        {activeChaosEvent && activeChaosEvent.status.includes('Active Fault') && (
          <div className="relative z-10 flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-rose-500/20 to-rose-600/20 text-rose-200 rounded-full border border-rose-500/30 font-medium animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.3)]">
            <RefreshCw className="w-4 h-4 animate-spin text-rose-300" />
            Experiment Running: {activeChaosEvent.type}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-medium text-slate-300 mb-4">Recent Activity</h3>
        <div className="obs-glass p-4 h-[400px] overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {chaosHistory.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
              <Skull className="w-8 h-8 mb-3 opacity-20" />
              <p className="text-sm">No recent experiments</p>
            </div>
          ) : (
            chaosHistory.map((hist, i) => (
              <div key={hist.id} className="group relative bg-gradient-to-r from-slate-900/80 to-slate-800/50 p-4 rounded-xl border border-white/5 text-sm hover:border-white/10 transition-colors shadow-inner overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-rose-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-slate-200 tracking-wide">{hist.experiment_type}</span>
                  {hist.status === 'completed' ? <CheckCircle className="w-4 h-4 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" /> :
                   hist.status === 'failed' ? <XCircle className="w-4 h-4 text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]" /> :
                   <Activity className="w-4 h-4 text-sky-400 animate-pulse drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]" />}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider bg-black/40 px-2 py-0.5 rounded-full border border-white/5">
                    {new Date(hist.started_at).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-xs text-slate-400 bg-black/40 p-2.5 rounded-lg border border-white/5 font-mono leading-relaxed">
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
