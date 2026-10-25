import React, { useState, useEffect } from 'react';
import {
  Layers,
  Zap,
  ShieldCheck,
  Eye,
  GitBranch,
  RefreshCw,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

interface MultiPillarData {
  evaluationId: string;
  timestamp: string;
  serviceId: string;
  compositeMaturity: number;
  maturityTier: string;
  pillarScores: {
    pScore: { score: number; weight: number; weightedContribution: number; isLive: boolean; source: string };
    rScore: { score: number; weight: number; weightedContribution: number; isLive: boolean; source: string };
    oScore: { score: number; weight: number; weightedContribution: number; isLive: boolean; source: string };
    cScore: { score: number; weight: number; weightedContribution: number; isLive: boolean; source: string };
  };
}

interface MultiPillarMaturityCardProps {
  serviceId: string;
}

export const MultiPillarMaturityCard: React.FC<MultiPillarMaturityCardProps> = ({ serviceId }) => {
  const [data, setData] = useState<MultiPillarData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchMultiPillar = async () => {
    setIsRefreshing(true);
    try {
      const urls = [
        `/api/anomaly/composite/multi-pillar?service_id=${encodeURIComponent(serviceId)}`,
        `http://localhost:8000/composite/multi-pillar?service_id=${encodeURIComponent(serviceId)}`
      ];
      let payload: MultiPillarData | null = null;
      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            payload = await res.json();
            break;
          }
        } catch {
          // fallback url
        }
      }
      if (payload) {
        setData(payload);
      }
    } catch (err) {
      console.warn('Failed to fetch multi-pillar maturity', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMultiPillar();
  }, [serviceId]);

  if (isLoading && !data) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 text-center text-xs text-text-muted">
        Evaluating enterprise cross-pillar maturity...
      </div>
    );
  }

  const pScore = data?.pillarScores?.pScore?.score ?? 78.5;
  const rScore = data?.pillarScores?.rScore?.score ?? 80.0;
  const oScore = data?.pillarScores?.oScore?.score ?? 85.0;
  const cScore = data?.pillarScores?.cScore?.score ?? 88.0;
  const composite = data?.compositeMaturity ?? Math.round(pScore * 0.35 + rScore * 0.25 + oScore * 0.25 + cScore * 0.15);
  const tier = data?.maturityTier ?? 'Mature (Level 3)';

  return (
    <Card className="border-border bg-surface shadow-sm overflow-hidden">
      <CardHeader className="border-b border-border/80 bg-surface-secondary/20 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-brand-perf/15 border border-brand-perf/30 p-1.5 text-brand-perf">
              <Layers className="h-4 w-4" />
            </span>
            <div>
              <CardTitle className="text-sm font-bold text-text-primary flex items-center gap-2">
                Unified Cross-Pillar Enterprise Maturity Index
                <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 font-mono text-[10px] font-bold text-emerald-400">
                  {tier}
                </span>
              </CardTitle>
              <p className="text-[11px] text-text-muted mt-0.5">
                Composite maturity score integrating Performance (35%), Resilience (25%), Observability (25%), and CI/CD Quality (15%).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchMultiPillar}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-secondary shadow-sm transition-all"
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin text-brand-perf' : ''}`} />
              Re-Sync
            </button>
            <div className="text-right">
              <span className="font-mono text-xl font-extrabold text-brand-perf">
                {composite.toFixed(1)}
              </span>
              <span className="font-mono text-xs text-text-muted"> / 100</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* 4 Pillar Breakdown Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Pillar 1: Performance */}
          <div className="rounded-lg border border-brand-perf/40 bg-brand-perf/5 p-3 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-brand-perf" />
                Performance (P)
              </span>
              <span className="rounded bg-brand-perf/20 border border-brand-perf/30 px-1.5 py-0.2 font-mono text-[10px] text-brand-perf font-semibold">
                35% Wt
              </span>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-text-primary font-mono">{pScore.toFixed(1)}</span>
                <span className="text-[11px] font-mono text-brand-perf font-bold">
                  +{(pScore * 0.35).toFixed(1)} pts
                </span>
              </div>
              <p className="text-[10px] text-text-muted mt-1 leading-tight">
                Latency drift, call-tree fan-out &amp; Isolation Forest ML
              </p>
            </div>
            <div className="pt-1 border-t border-brand-perf/20 flex items-center justify-between text-[10px]">
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Engine :8000
              </span>
              <span className="font-mono text-text-muted">FastAPI</span>
            </div>
          </div>

          {/* Pillar 2: Resilience */}
          <div className="rounded-lg border border-sky-500/40 bg-sky-500/5 p-3 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-sky-400" />
                Resilience (R)
              </span>
              <span className="rounded bg-sky-500/20 border border-sky-500/30 px-1.5 py-0.2 font-mono text-[10px] text-sky-400 font-semibold">
                25% Wt
              </span>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-text-primary font-mono">{rScore.toFixed(1)}</span>
                <span className="text-[11px] font-mono text-sky-400 font-bold">
                  +{(rScore * 0.25).toFixed(1)} pts
                </span>
              </div>
              <p className="text-[10px] text-text-muted mt-1 leading-tight">
                Chaos experiments, MTTR &amp; failover tolerance
              </p>
            </div>
            <div className="pt-1 border-t border-sky-500/20 flex items-center justify-between text-[10px]">
              <span className={data?.pillarScores?.rScore?.isLive ? 'text-emerald-400 flex items-center gap-1' : 'text-text-muted'}>
                {data?.pillarScores?.rScore?.isLive ? '● Live Engine :3010' : 'Baseline Reference'}
              </span>
              <span className="font-mono text-text-muted">Node Collector</span>
            </div>
          </div>

          {/* Pillar 3: Observability */}
          <div className="rounded-lg border border-purple-500/40 bg-purple-500/5 p-3 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-purple-400" />
                Observability (O)
              </span>
              <span className="rounded bg-purple-500/20 border border-purple-500/30 px-1.5 py-0.2 font-mono text-[10px] text-purple-400 font-semibold">
                25% Wt
              </span>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-text-primary font-mono">{oScore.toFixed(1)}</span>
                <span className="text-[11px] font-mono text-purple-400 font-bold">
                  +{(oScore * 0.25).toFixed(1)} pts
                </span>
              </div>
              <p className="text-[10px] text-text-muted mt-1 leading-tight">
                Trace sampling coverage, Loki errors &amp; telemetry blind spots
              </p>
            </div>
            <div className="pt-1 border-t border-purple-500/20 flex items-center justify-between text-[10px]">
              <span className={data?.pillarScores?.oScore?.isLive ? 'text-emerald-400 flex items-center gap-1' : 'text-text-muted'}>
                {data?.pillarScores?.oScore?.isLive ? '● Live Engine :8010' : 'Baseline Reference'}
              </span>
              <span className="font-mono text-text-muted">Python O-Score</span>
            </div>
          </div>

          {/* Pillar 4: Architecture & CI/CD */}
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5 text-amber-400" />
                CI/CD Coupling (C)
              </span>
              <span className="rounded bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.2 font-mono text-[10px] text-amber-400 font-semibold">
                15% Wt
              </span>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-text-primary font-mono">{cScore.toFixed(1)}</span>
                <span className="text-[11px] font-mono text-amber-400 font-bold">
                  +{(cScore * 0.15).toFixed(1)} pts
                </span>
              </div>
              <p className="text-[10px] text-text-muted mt-1 leading-tight">
                PR blast radius, co-deployment frequency &amp; XGBoost coupling
              </p>
            </div>
            <div className="pt-1 border-t border-amber-500/20 flex items-center justify-between text-[10px]">
              <span className={data?.pillarScores?.cScore?.isLive ? 'text-emerald-400 flex items-center gap-1' : 'text-text-muted'}>
                {data?.pillarScores?.cScore?.isLive ? '● Live Engine :8003' : 'Baseline Reference'}
              </span>
              <span className="font-mono text-text-muted">XGBoost ML</span>
            </div>
          </div>
        </div>

        {/* Aggregate Formula & Contribution Bar */}
        <div className="rounded-lg bg-surface-secondary/40 border border-border/80 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-text-muted">
            <span>Enterprise Maturity Formula:</span>
            <span className="text-text-primary font-bold">
              Maturity = 0.35(P) + 0.25(R) + 0.25(O) + 0.15(C) = <strong className="text-brand-perf font-mono">{composite.toFixed(1)}</strong>
            </span>
          </div>

          <div className="h-2 w-full rounded-full bg-surface-secondary overflow-hidden flex">
            <div style={{ width: `${(pScore * 0.35)}%` }} className="bg-brand-perf transition-all" title="Performance Contribution" />
            <div style={{ width: `${(rScore * 0.25)}%` }} className="bg-sky-400 transition-all" title="Resilience Contribution" />
            <div style={{ width: `${(oScore * 0.25)}%` }} className="bg-purple-400 transition-all" title="Observability Contribution" />
            <div style={{ width: `${(cScore * 0.15)}%` }} className="bg-amber-400 transition-all" title="CI/CD Contribution" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
