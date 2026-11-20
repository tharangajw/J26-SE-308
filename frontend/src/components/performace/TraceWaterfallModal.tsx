import React from 'react';
import {
  X,
  GitBranch,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Server,
  Layers,
  ArrowRight,
  ExternalLink,
  Zap,
  Flame
} from 'lucide-react';

export interface TraceSpanItem {
  id: string;
  serviceId: string;
  operationName: string;
  durationMs: number;
  offsetMs: number;
  isBottleneck?: boolean;
  status: 'OK' | 'ERROR' | 'DEGRADED';
  componentType: 'GATEWAY' | 'SERVICE' | 'DATABASE' | 'CACHE';
}

interface TraceWaterfallModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceId: string;
  totalDurationMs?: number;
  isApiGateway?: boolean;
  executionPattern?: string;
}

export const TraceWaterfallModal: React.FC<TraceWaterfallModalProps> = ({
  isOpen,
  onClose,
  serviceId,
  totalDurationMs = 42.5,
  isApiGateway = false,
  executionPattern = 'SEQUENTIAL_N_PLUS_1'
}) => {
  if (!isOpen) return null;

  // Generate realistic spans tailored to this service
  const spans: TraceSpanItem[] = [
    {
      id: 'span-root-01',
      serviceId: isApiGateway ? serviceId : 'gateway-1',
      operationName: 'GET /api/v1/orders/ORD-9821',
      durationMs: totalDurationMs,
      offsetMs: 0,
      status: 'OK',
      componentType: 'GATEWAY'
    },
    {
      id: 'span-svc-02',
      serviceId: isApiGateway ? 'order-service-1' : serviceId,
      operationName: 'order.controller.getOrderDetails',
      durationMs: totalDurationMs * 0.88,
      offsetMs: totalDurationMs * 0.08,
      status: 'OK',
      componentType: 'SERVICE'
    },
    {
      id: 'span-dep-03',
      serviceId: 'payment-service-1',
      operationName: 'payment.service.verifyAccount',
      durationMs: totalDurationMs * 0.22,
      offsetMs: totalDurationMs * 0.12,
      status: 'OK',
      componentType: 'SERVICE'
    },
    {
      id: 'span-dep-04',
      serviceId: 'book-service-1',
      operationName: 'book.service.checkStock',
      durationMs: totalDurationMs * 0.25,
      offsetMs: executionPattern === 'SEQUENTIAL_N_PLUS_1' ? totalDurationMs * 0.35 : totalDurationMs * 0.15,
      status: 'OK',
      componentType: 'SERVICE'
    },
    {
      id: 'span-db-05',
      serviceId: `${serviceId}-mongo-1`,
      operationName: 'db.orders.find({ _id: "ORD-9821" })',
      durationMs: totalDurationMs * 0.52,
      offsetMs: executionPattern === 'SEQUENTIAL_N_PLUS_1' ? totalDurationMs * 0.42 : totalDurationMs * 0.38,
      isBottleneck: true,
      status: 'DEGRADED',
      componentType: 'DATABASE'
    }
  ];

  const criticalSpan = spans.find((s) => s.isBottleneck) || spans[spans.length - 1];
  const bottleneckPct = Math.round((criticalSpan.durationMs / totalDurationMs) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/80 bg-surface-secondary/40 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
              <GitBranch className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-sky-400">
                  Jaeger Distributed Trace Timeline
                </span>
                <span className="rounded bg-surface px-2 py-0.5 font-mono text-[10px] font-bold text-text-primary border border-border">
                  {serviceId}
                </span>
                {isApiGateway && (
                  <span className="rounded bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.5 font-mono text-[10px] text-sky-400">
                    Gateway (0.3x Attenuation)
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-text-primary mt-0.5">
                Critical Path Latency &amp; Sequential Execution Waterfall
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-surface p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Critical Path Callout Banner */}
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Flame className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="text-xs font-bold font-mono uppercase text-rose-400 flex items-center gap-1.5">
                  Critical Bottleneck Identified: {criticalSpan.serviceId} ({bottleneckPct}% of total duration)
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Span <code className="font-mono text-text-primary">{criticalSpan.operationName}</code> consumes{' '}
                  <strong className="text-rose-400 font-mono">{criticalSpan.durationMs.toFixed(1)} ms</strong> of the{' '}
                  <strong className="text-text-primary font-mono">{totalDurationMs.toFixed(1)} ms</strong> end-to-end request.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-rose-500/30 bg-surface px-3 py-1.5 font-mono text-xs text-right shrink-0">
              <div className="text-[10px] uppercase text-text-muted">Execution Mode</div>
              <div className="font-bold text-rose-400">
                {executionPattern === 'SEQUENTIAL_N_PLUS_1' ? 'Sequential N+1 (Blocking)' : 'Parallel Concurrent'}
              </div>
            </div>
          </div>

          {/* Waterfall Timing Chart */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-text-muted border-b border-border/60 pb-2">
              <span>Service / Operation Span</span>
              <div className="flex items-center gap-6">
                <span>0 ms</span>
                <span>{(totalDurationMs * 0.5).toFixed(0)} ms</span>
                <span>{totalDurationMs.toFixed(0)} ms</span>
              </div>
            </div>

            <div className="space-y-2.5">
              {spans.map((span, idx) => {
                const widthPct = Math.max(8, (span.durationMs / totalDurationMs) * 100);
                const offsetPct = Math.min(92, (span.offsetMs / totalDurationMs) * 100);

                const getBarColor = () => {
                  if (span.isBottleneck) return 'bg-rose-500 border border-rose-400 shadow-sm shadow-rose-500/30';
                  if (span.componentType === 'GATEWAY') return 'bg-sky-400/80 border border-sky-300';
                  if (span.componentType === 'DATABASE') return 'bg-amber-400/80 border border-amber-300';
                  return 'bg-brand-perf/80 border border-brand-perf/60';
                };

                return (
                  <div
                    key={span.id}
                    className="rounded-lg border border-border/70 bg-surface-secondary/20 p-3 space-y-2 hover:bg-surface-secondary/40 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-text-primary">
                          {idx + 1}. {span.serviceId}
                        </span>
                        <span className="font-mono text-[11px] text-text-muted truncate max-w-[280px]">
                          {span.operationName}
                        </span>
                        {span.isBottleneck && (
                          <span className="rounded bg-rose-500/20 border border-rose-500/40 px-1.5 py-0.2 font-mono text-[10px] font-bold text-rose-400">
                            Bottleneck
                          </span>
                        )}
                      </div>

                      <span className="font-mono font-bold text-text-primary">
                        {span.durationMs.toFixed(1)} ms{' '}
                        <span className="text-[10px] text-text-muted">
                          ({Math.round((span.durationMs / totalDurationMs) * 100)}%)
                        </span>
                      </span>
                    </div>

                    {/* Timeline Bar */}
                    <div className="relative h-3 w-full rounded-full bg-surface-secondary/60 overflow-hidden">
                      <div
                        className={`absolute h-full rounded-full transition-all duration-500 ${getBarColor()}`}
                        style={{
                          left: `${offsetPct}%`,
                          width: `${widthPct}%`
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Architectural Recommendation Callout */}
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="text-xs font-bold font-mono uppercase text-sky-400 flex items-center gap-1.5">
                <Zap className="h-4 w-4" /> Recommended Remediation
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Parallelize independent downstream queries with <code className="font-mono text-text-primary">Promise.all()</code> and apply Redis caching on{' '}
                <code className="font-mono text-text-primary">{criticalSpan.serviceId}</code> to collapse the critical path latency by ~60%.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-border/80 bg-surface-secondary/40 px-6 py-4">
          <span className="text-xs font-mono text-text-muted">
            Trace Source: OpenTelemetry OTLP Exporter → Jaeger Engine (:16686)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
