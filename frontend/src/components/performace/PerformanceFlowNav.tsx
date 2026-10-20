import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ServerCog,
  Activity,
  TrendingUp,
  GitMerge,
  ShieldAlert,
  Zap,
  ArrowRight,
  ArrowLeft,
  Server,
  Plus,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { TelemetryService } from '../../services/telemetry';

export type PerformanceStepId =
  | 'collection'
  | 'drift'
  | 'fanout'
  | 'anomaly'
  | 'pscore';

interface StepDefinition {
  id: PerformanceStepId;
  stepBadge: string;
  shortTitle: string;
  fullTitle: string;
  subtitle: string;
  path: string;
  weightBadge?: string;
  nextDataFlowText: string;
  icon: React.ReactNode;
}

export const PERFORMANCE_PIPELINE_STEPS: StepDefinition[] = [
  {
    id: 'collection',
    stepBadge: 'Step 1',
    shortTitle: 'Telemetry Collection',
    fullTitle: 'Step 1: Multi-Source Raw Telemetry Collection',
    subtitle: 'Discover active containers & scrape Prometheus, Jaeger, Loki & Docker cgroup metrics',
    path: '/dimensions/performance/collection',
    nextDataFlowText:
      'Container snapshots are aligned on a 5s UTC grid and Min-Max normalized via Python Pandas to feed Step 2A, 2B, and 2C.',
    icon: <ServerCog className="h-4 w-4" />,
  },
  {
    id: 'drift',
    stepBadge: 'Step 2A',
    shortTitle: 'Latency Drift',
    fullTitle: 'Step 2A: Historical Latency Drift & OLS Forecast',
    subtitle: 'Evaluate P95 latency regression against historical release baselines',
    path: '/dimensions/performance/drift',
    weightBadge: '40% Weight',
    nextDataFlowText:
      'Normalized Drift Penalty (40% AHP weight) is forwarded alongside Call-Tree Fan-Out (Step 2B) to the Composite P-Score Engine.',
    icon: <TrendingUp className="h-4 w-4" />,
  },
  {
    id: 'fanout',
    stepBadge: 'Step 2B',
    shortTitle: 'Call-Tree Fan-Out',
    fullTitle: 'Step 2B: Service Fan-Out & Gateway Attenuation',
    subtitle: 'Analyze distributed trace DAG depth, synchronous N+1 calls & 0.3x API Gateway factor',
    path: '/dimensions/performance/fanout',
    weightBadge: '40% Weight',
    nextDataFlowText:
      'Attenuated Fan-Out Penalty (40% AHP weight) is combined with Isolation Forest ML Anomaly detection (Step 2C).',
    icon: <GitMerge className="h-4 w-4" />,
  },
  {
    id: 'anomaly',
    stepBadge: 'Step 2C',
    shortTitle: 'ML Anomaly Engine',
    fullTitle: 'Step 2C: Isolation Forest ML & 90s Startup Filter',
    subtitle: 'Unsupervised 4D anomaly inference with Cao & Long 90s warmup suppression & XAI',
    path: '/dimensions/performance/anomaly',
    weightBadge: '20% Weight',
    nextDataFlowText:
      'All three penalties — Drift (40%), Fan-Out (40%), and ML Anomaly (20%) — converge in Step 3 to compute the Composite P-Score.',
    icon: <ShieldAlert className="h-4 w-4" />,
  },
  {
    id: 'pscore',
    stepBadge: 'Step 3',
    shortTitle: 'Composite P-Score',
    fullTitle: 'Step 3: Composite P-Score, AHP Validator & Remediation Simulator',
    subtitle: 'Synthesize weighted penalties into the final P-Score maturity tier & simulate architectural fixes',
    path: '/dimensions/performance',
    nextDataFlowText:
      'Closed-loop cycle: Re-collect telemetry in Step 1 after applying Redis caching, DB indexing, or container tuning to benchmark actual P-Score gains.',
    icon: <Zap className="h-4 w-4" />,
  },
];

interface PerformanceFlowHeaderProps {
  currentStep: PerformanceStepId;
  services?: string[];
  selectedService?: string | null;
  onSelectService?: (serviceId: string) => void;
  onAddService?: (serviceId: string) => void;
  rightSlot?: React.ReactNode;
}

export const PerformanceFlowHeader: React.FC<PerformanceFlowHeaderProps> = ({
  currentStep,
  services = [],
  selectedService,
  onSelectService,
  onAddService,
  rightSlot,
}) => {
  const [customSvcInput, setCustomSvcInput] = useState('');

  const currentIdx = PERFORMANCE_PIPELINE_STEPS.findIndex((s) => s.id === currentStep);
  const activeStepDef = PERFORMANCE_PIPELINE_STEPS[currentIdx] || PERFORMANCE_PIPELINE_STEPS[0];

  const displayServices = React.useMemo(() => {
    const list = [...services];
    if (selectedService && !list.includes(selectedService)) {
      list.push(selectedService);
    }
    const storedCollected = TelemetryService.getCollectedServices();
    storedCollected.forEach((s) => {
      if (!list.includes(s)) list.push(s);
    });
    return list;
  }, [services, selectedService]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customSvcInput.trim();
    if (!trimmed) return;
    TelemetryService.setActiveService(trimmed);
    if (onAddService) {
      onAddService(trimmed);
    } else if (onSelectService) {
      onSelectService(trimmed);
    }
    setCustomSvcInput('');
  };

  return (
    <div className="space-y-3">
      {/* Horizontal End-to-End Pipeline Stepper */}
      <div className="rounded-xl border border-border bg-surface/90 p-3 shadow-sm">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-perf/15 border border-brand-perf/30 px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-brand-perf">
              <Zap className="h-3 w-3" /> Performance Engineering Pipeline
            </span>
            <span className="text-xs text-text-muted hidden sm:inline">
              Follow the end-to-end performance evaluation workflow below:
            </span>
          </div>
          <span className="font-mono text-[11px] text-text-secondary">
            Active Stage: <strong className="text-brand-perf">{activeStepDef.stepBadge}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {PERFORMANCE_PIPELINE_STEPS.map((step, idx) => {
            const isCurrent = step.id === currentStep;
            const isPast = idx < currentIdx;

            return (
              <Link
                key={step.id}
                to={step.path}
                className={`group relative flex flex-col justify-between rounded-lg border p-2.5 transition-all ${
                  isCurrent
                    ? 'border-brand-perf bg-brand-perf/15 shadow-sm ring-1 ring-brand-perf/40'
                    : isPast
                    ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50 hover:bg-emerald-500/10'
                    : 'border-border/80 bg-surface-secondary/25 hover:border-border hover:bg-surface-secondary/50'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`font-mono text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      isCurrent
                        ? 'bg-brand-perf text-slate-950'
                        : isPast
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-surface-secondary text-text-muted group-hover:text-text-secondary'
                    }`}
                  >
                    {step.stepBadge}
                  </span>
                  {step.weightBadge ? (
                    <span className="font-mono text-[9px] text-text-muted">{step.weightBadge}</span>
                  ) : isPast ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/80 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-text-muted/50 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  )}
                </div>

                <div className="mt-2 flex items-center gap-1.5">
                  <span
                    className={
                      isCurrent
                        ? 'text-brand-perf'
                        : isPast
                        ? 'text-emerald-400'
                        : 'text-text-secondary group-hover:text-text-primary'
                    }
                  >
                    {step.icon}
                  </span>
                  <span
                    className={`text-xs font-semibold truncate ${
                      isCurrent ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary'
                    }`}
                  >
                    {step.shortTitle}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Shared Active Microservice Context Bar (Shown when services or selector provided) */}
        {(services.length > 0 || onSelectService || rightSlot) && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-2.5 px-1">
            {onSelectService ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-text-muted">
                  <Server className="h-3.5 w-3.5 text-brand-perf" /> Target Service:
                </span>
                {displayServices.length === 0 ? (
                  <span className="text-xs font-mono text-text-muted">
                    Discovering cluster services...
                  </span>
                ) : (
                  displayServices.map((svcId) => {
                    const isSelected = selectedService === svcId;
                    return (
                      <button
                        key={svcId}
                        type="button"
                        onClick={() => {
                          TelemetryService.setActiveService(svcId);
                          onSelectService(svcId);
                        }}
                        className={`rounded-md border px-2.5 py-1 font-mono text-xs font-medium transition-all ${
                          isSelected
                            ? 'border-brand-perf bg-brand-perf text-slate-950 font-bold shadow-sm'
                            : 'border-border bg-surface-secondary/40 text-text-secondary hover:border-brand-perf/40 hover:text-text-primary'
                        }`}
                      >
                        {svcId}
                      </button>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <Server className="h-3.5 w-3.5 text-brand-perf" />
                <span>
                  Synced Cluster Services:{' '}
                  <strong className="font-mono text-text-primary">
                    {services.length > 0 ? services.join(', ') : 'All Discovered Microservices'}
                  </strong>
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {onSelectService && (
                <form onSubmit={handleAddSubmit} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={customSvcInput}
                    onChange={(e) => setCustomSvcInput(e.target.value)}
                    placeholder="Switch/add service..."
                    className="w-40 rounded border border-border bg-background px-2.5 py-1 font-mono text-xs text-text-primary placeholder:text-text-muted focus:border-brand-perf focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!customSvcInput.trim()}
                    className="inline-flex items-center gap-1 rounded border border-brand-perf/40 bg-brand-perf/15 px-2 py-1 text-xs font-medium text-brand-perf hover:bg-brand-perf/25 disabled:opacity-40"
                  >
                    <Plus className="h-3 w-3" /> Inspect
                  </button>
                </form>
              )}
              {rightSlot}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface PerformanceStepFooterProps {
  currentStep: PerformanceStepId;
}

export const PerformanceStepFooter: React.FC<PerformanceStepFooterProps> = ({ currentStep }) => {
  const currentIdx = PERFORMANCE_PIPELINE_STEPS.findIndex((s) => s.id === currentStep);
  const currentDef = PERFORMANCE_PIPELINE_STEPS[currentIdx] || PERFORMANCE_PIPELINE_STEPS[0];
  const prevStep = currentIdx > 0 ? PERFORMANCE_PIPELINE_STEPS[currentIdx - 1] : null;
  const nextStep =
    currentIdx < PERFORMANCE_PIPELINE_STEPS.length - 1
      ? PERFORMANCE_PIPELINE_STEPS[currentIdx + 1]
      : null;

  return (
    <div className="mt-8 rounded-xl border border-brand-perf/30 bg-surface-secondary/30 p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          {prevStep ? (
            <Link
              to={prevStep.path}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-xs font-medium text-text-secondary hover:border-border/80 hover:text-text-primary transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>
                {prevStep.stepBadge}: {prevStep.shortTitle}
              </span>
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-mono text-xs text-brand-perf">
              <Zap className="h-3.5 w-3.5" /> Pipeline Entry Point (Step 1)
            </span>
          )}
        </div>

        <p className="max-w-xl text-xs text-text-secondary md:text-center">
          <strong className="text-text-primary">Pipeline Flow: </strong>
          {currentDef.nextDataFlowText}
        </p>

        <div>
          {nextStep ? (
            <Link
              to={nextStep.path}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-perf px-4 py-2 text-xs font-semibold text-slate-950 shadow-sm hover:opacity-90 transition-opacity"
            >
              <span>
                Continue to {nextStep.stepBadge}: {nextStep.shortTitle}
              </span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <Link
              to="/dimensions/performance/collection"
              className="inline-flex items-center gap-2 rounded-lg border border-brand-perf/50 bg-brand-perf/15 px-4 py-2 text-xs font-semibold text-brand-perf hover:bg-brand-perf/25 transition-colors"
            >
              <span>Re-run Step 1: Collect New Telemetry Snapshot</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
