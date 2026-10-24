import React from 'react';
import { ShieldAlert, ShieldCheck, X } from 'lucide-react';

export interface WebhookResult {
  service: string;
  cscore: number;
  threshold: number;
  decision: 'HIGH_RISK' | 'LOW_RISK' | string;
  couplingIndex?: number;
  commitFreq?: number;
  coDeployRate?: number;
  apiChanges?: number;
  downstreamCount?: number;
  blastRadius?: number;
}

interface VerdictPopupProps {
  result: WebhookResult;
  phase: 'phase1' | 'phase2';
  prNumber: number | null;
  sha: string | null;
  onClose: () => void;
}

export const VerdictPopup: React.FC<VerdictPopupProps> = ({ result, phase, prNumber, sha, onClose }) => {
  const high = result.decision === 'HIGH_RISK';

  const metrics =
    phase === 'phase1'
      ? [
          { label: 'Coupling Index', value: result.couplingIndex?.toFixed(3) ?? '-' },
          { label: 'Commit Freq', value: result.commitFreq ?? '-' },
          { label: 'Co-Deploy Rate', value: result.coDeployRate !== undefined ? `${Math.round(result.coDeployRate * 100)}%` : '-' },
        ]
      : [
          { label: 'Breaking APIs', value: result.apiChanges ?? '-' },
          { label: 'Consumers', value: result.downstreamCount ?? '-' },
          { label: 'Blast Radius', value: result.blastRadius ?? '-' },
        ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`relative w-full max-w-md rounded-2xl border bg-surface p-6 shadow-2xl text-center space-y-4 ${
          high ? 'border-rose-500/50 shadow-rose-500/20' : 'border-emerald-500/50 shadow-emerald-500/20'
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-secondary transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div
          className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center border ${
            high ? 'bg-rose-500/10 border-rose-500/30' : 'bg-emerald-500/10 border-emerald-500/30'
          }`}
        >
          {high ? <ShieldAlert className="w-8 h-8 text-rose-400" /> : <ShieldCheck className="w-8 h-8 text-emerald-400" />}
        </div>

        <div>
          <div className="text-[11px] font-mono text-text-muted uppercase tracking-wider">
            PR #{prNumber} {sha ? `(${sha})` : ''} • {result.service}
          </div>
          <h2 className={`text-2xl font-bold tracking-wide mt-1 ${high ? 'text-rose-400' : 'text-emerald-400'}`}>
            {high ? 'HIGH RISK' : 'LOW RISK'}
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            {high ? 'Pipeline ABORTED — Pull Request blocked.' : 'Pipeline PASSED — Safe to proceed.'}
          </p>
        </div>

        <div className="rounded-xl bg-background/70 border border-border/60 py-3">
          <div className="text-[10px] uppercase text-text-muted tracking-wider">Final C-Score</div>
          <div className={`text-4xl font-bold font-mono ${high ? 'text-rose-400' : 'text-emerald-400'}`}>
            {result.cscore}
          </div>
          <div className="text-[11px] font-mono text-text-muted mt-0.5">
            Threshold: &gt; {result.threshold} = HIGH RISK
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {metrics.map(m => (
            <div key={m.label} className="rounded-lg bg-surface-secondary/50 border border-border/50 p-2">
              <div className="text-[9px] uppercase text-text-muted">{m.label}</div>
              <div className="font-mono font-bold text-sm text-text-primary mt-0.5">{m.value}</div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className={`w-full py-2 rounded-lg text-xs font-semibold border transition-colors ${
            high
              ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/40'
              : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/40'
          }`}
        >
          OK
        </button>
      </div>
    </div>
  );
};
