import React, { useState } from 'react';
import {
  Sparkles,
  Zap,
  Flame,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  Play,
  Activity,
  AlertTriangle,
  Loader2
} from 'lucide-react';

export type PerformanceScenarioId = 'LIVE' | 'NOMINAL' | 'SEQUENTIAL_N_PLUS_1' | 'POD_WARMUP' | 'TRAFFIC_SPIKE';

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
  },
  {
    id: 'TRAFFIC_SPIKE',
    label: 'Scenario D: 200 VU Traffic Spike Burst',
    badge: 'Outlier Anomaly · Level 1',
    badgeColor: 'border-rose-500/40 bg-rose-500/15 text-rose-400',
    description: 'Sudden 200 VU concurrent burst; CPU reaches 94%, P95 latency spikes to 180ms, triggering ML outlier alert (P-Score ~38.2).',
    icon: <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
  }
];

interface PerformanceScenarioInjectorProps {
  activeScenario: PerformanceScenarioId;
  onSelectScenario: (scenarioId: PerformanceScenarioId) => void;
  onRefreshLive?: () => void;
}

export const PerformanceScenarioInjector: React.FC<PerformanceScenarioInjectorProps> = ({
  activeScenario,
  onSelectScenario,
  onRefreshLive,
}) => {
  const currentScenarioDef = SCENARIOS.find((s) => s.id === activeScenario) || SCENARIOS[0];
  const [isTriggering, setIsTriggering] = useState<boolean>(false);
  const [triggerStatus, setTriggerStatus] = useState<string | null>(null);

  const handleTriggerBackendLoad = async (mode: 'spike' | 'startup' | 'normal') => {
    setIsTriggering(true);
    setTriggerStatus(`Injecting ${mode.toUpperCase()} profile into FastAPI Engine...`);
    try {
      const urls = [
        `/api/anomaly/loadtest/trigger?mode=${mode}`,
        `http://localhost:8000/loadtest/trigger?mode=${mode}`
      ];
      let ok = false;
      for (const url of urls) {
        try {
          const res = await fetch(url, { method: 'POST' });
          if (res.ok) {
            ok = true;
            break;
          }
        } catch {
          // try fallback url
        }
      }
      if (ok) {
        setTriggerStatus(`✅ ${mode.toUpperCase()} profile active on :8000! Telemetry updated.`);
        onSelectScenario(mode === 'spike' ? 'TRAFFIC_SPIKE' : mode === 'startup' ? 'POD_WARMUP' : 'LIVE');
        if (onRefreshLive) {
          setTimeout(onRefreshLive, 300);
        }
      } else {
        setTriggerStatus(`⚠️ Local simulation active (${mode})`);
        onSelectScenario(mode === 'spike' ? 'TRAFFIC_SPIKE' : mode === 'startup' ? 'POD_WARMUP' : 'LIVE');
      }
    } catch {
      setTriggerStatus(`⚠️ Simulated locally: ${mode}`);
    } finally {
      setIsTriggering(false);
      setTimeout(() => setTriggerStatus(null), 4000);
    }
  };

  return (
    <div className="rounded-xl border border-brand-perf/30 bg-gradient-to-r from-surface-secondary/40 via-surface/70 to-surface-secondary/30 p-3.5 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-perf/20 border border-brand-perf/40 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-brand-perf">
            <Zap className="h-3 w-3" /> Viva Demo Sandbox
          </span>
          <span className="text-xs font-bold text-text-primary">
            Live Stress &amp; Bottleneck Scenario Injector
          </span>
        </div>

        <div className="flex items-center gap-2">
          {triggerStatus && (
            <span className="text-[11px] font-mono font-semibold text-brand-perf bg-brand-perf/10 border border-brand-perf/30 px-2 py-0.5 rounded animate-fade-in">
              {triggerStatus}
            </span>
          )}
          <span className="text-xs font-mono text-text-muted">
            Active: <strong className="text-brand-perf">{currentScenarioDef.label.split(':')[0]}</strong>
          </span>
        </div>
      </div>

      {/* Scenario Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
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

      {/* Direct Live Cluster Traffic Injector Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/60 text-xs">
        <span className="text-text-muted font-mono text-[11px] flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-brand-perf" />
          Live Cluster Traffic Generator (Port 8000 &amp; 8787):
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={isTriggering}
            onClick={() => handleTriggerBackendLoad('spike')}
            className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 text-[11px] font-semibold text-rose-400 transition-all shadow-sm"
            title="Injects 200 VU extreme load to trigger Isolation Forest ML anomaly"
          >
            {isTriggering ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3 text-rose-400" />}
            ⚡ Inject 200 VU Traffic Spike
          </button>

          <button
            type="button"
            disabled={isTriggering}
            onClick={() => handleTriggerBackendLoad('startup')}
            className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 px-2.5 py-1 text-[11px] font-semibold text-sky-400 transition-all shadow-sm"
            title="Simulates pod cold-start (<90s) demonstrating false-positive noise suppression"
          >
            <ShieldAlert className="h-3 w-3 text-sky-400" />
            🛡️ Simulate Pod Startup (&lt;90s)
          </button>

          <button
            type="button"
            disabled={isTriggering}
            onClick={() => handleTriggerBackendLoad('normal')}
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 transition-all shadow-sm"
            title="Restores nominal baseline operational bounds"
          >
            <RotateCcw className="h-3 w-3 text-emerald-400" />
            🔄 Restore Normal Baseline
          </button>
        </div>
      </div>
    </div>
  );
};
