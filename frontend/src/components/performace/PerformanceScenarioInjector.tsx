import React from 'react';
import {
  Sparkles,
  Zap,
  Flame,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  Info
} from 'lucide-react';

export type PerformanceScenarioId = 'LIVE' | 'NOMINAL' | 'SEQUENTIAL_N_PLUS_1' | 'POD_WARMUP';

export interface ScenarioDefinition {
  id: PerformanceScenarioId;
  label: string;
  badge: string;
  badgeColor: string;
  description: string;
  icon: React.ReactNode;
}

export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'LIVE',
    label: 'Live Scraped Cluster',
    badge: 'Real-Time Telemetry',
    badgeColor: 'border-border bg-surface text-text-primary',
    description: 'Scrapes live metrics from active Prometheus (:9090), Jaeger (:16686), and Docker containers.',
    icon: <RotateCcw className="h-3.5 w-3.5 text-text-muted" />
  },
  {
    id: 'NOMINAL',
    label: 'Scenario A: Nominal Optimal Flow',
    badge: 'Optimal · Level 4',
    badgeColor: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400',
    description: 'Concurrent Promise.all calls, sub-25ms latency, Apdex 0.995, healthy RAM cgroups (P-Score ~91.5).',
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
  },
  {
    id: 'SEQUENTIAL_N_PLUS_1',
    label: 'Scenario B: Sequential N+1 DB Bottleneck',
    badge: 'Degraded · Level 2',
    badgeColor: 'border-amber-500/40 bg-amber-500/15 text-amber-400',
    description: 'Downstream blocking loops on order-service-1; latency drifts to 68ms, tail ratio spikes to 2.4x (P-Score ~63.8).',
    icon: <Flame className="h-3.5 w-3.5 text-amber-400" />
  },
  {
    id: 'POD_WARMUP',
    label: 'Scenario C: Pod Startup & 90s Grace Filter',
    badge: 'Noise Suppressed · Level 3',
    badgeColor: 'border-sky-500/40 bg-sky-500/15 text-sky-400',
    description: 'Pod uptime 45s (<90s) experiencing CPU initialization spike; 90s filter suppresses false alarm to 0 pts!',
    icon: <ShieldAlert className="h-3.5 w-3.5 text-sky-400" />
  }
];

interface PerformanceScenarioInjectorProps {
  activeScenario: PerformanceScenarioId;
  onSelectScenario: (scenarioId: PerformanceScenarioId) => void;
}

export const PerformanceScenarioInjector: React.FC<PerformanceScenarioInjectorProps> = ({
  activeScenario,
  onSelectScenario,
}) => {
  const currentScenarioDef = SCENARIOS.find((s) => s.id === activeScenario) || SCENARIOS[0];

  return (
    <div className="rounded-xl border border-brand-perf/30 bg-gradient-to-r from-surface-secondary/40 via-surface/70 to-surface-secondary/30 p-3.5 shadow-sm space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-perf/20 border border-brand-perf/40 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-brand-perf">
            <Zap className="h-3 w-3" /> Viva Demo Sandbox
          </span>
          <span className="text-xs font-bold text-text-primary">
            Live Stress &amp; Bottleneck Scenario Injector
          </span>
        </div>

        <span className="text-xs font-mono text-text-muted">
          Active: <strong className="text-brand-perf">{currentScenarioDef.label.split(':')[0]}</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {SCENARIOS.map((sc) => {
          const isActive = activeScenario === sc.id;
          return (
            <button
              key={sc.id}
              type="button"
              onClick={() => onSelectScenario(sc.id)}
              className={`rounded-lg border p-2.5 text-left transition-all flex flex-col justify-between space-y-1.5 ${
                isActive
                  ? 'border-brand-perf bg-brand-perf/15 ring-1 ring-brand-perf/50 shadow-sm'
                  : 'border-border/80 bg-surface hover:border-border hover:bg-surface-secondary/60'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5 truncate">
                  {sc.icon}
                  {sc.id === 'LIVE' ? 'Live Telemetry' : sc.label.split(':')[0]}
                </span>
                <span className={`rounded px-1.5 py-0.2 font-mono text-[9px] font-bold border ${sc.badgeColor}`}>
                  {sc.badge.split(' · ')[0]}
                </span>
              </div>
              <p className="text-[10px] text-text-muted line-clamp-2 leading-tight">
                {sc.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
