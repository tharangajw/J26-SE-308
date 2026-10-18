import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Cpu,
  HardDrive,
  Zap,
  CheckCircle2,
  TriangleAlert,
  XCircle,
  RefreshCw,
  Server,
  Clock,
  BarChart3,
  GitBranch,
  TrendingUp,
  Sparkles,
  Database,
  Layers,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';

interface MaturityTierInfo {
  level: number;
  tier: string;
  shortLabel: string;
  summary: string;
}

interface ServiceEvaluation {
  serviceId: string;
  hasTelemetry: boolean;
  pScore: number;
  maturityTier: MaturityTierInfo;
  signals: {
    driftScore: number;
    driftLevel: string;
    liveP95LatencyMs: number;
    historicalBaselineMs: number;
    fanOutScore: number;
    fanOutLevel: string;
    directFanOutCount: number;
    maxDependencyDepth: number;
    isApiGateway: boolean;
    attenuationFactor: number;
    anomalyScore: number;
    isAnomaly: boolean;
    prefiltered: boolean;
  };
  penalties: {
    driftPenaltyPts: number;
    fanOutPenaltyPts: number;
    anomalyPenaltyPts: number;
    totalPenaltyPts: number;
  };
  rawMetrics: {
    cpuUsageMillicores: number;
    memoryUsageMB: number;
    avgResponseTimeMs: number;
    p95LatencyMs: number;
    rps: number;
  };
}

interface RecommendationItem {
  ruleId: string;
  serviceId: string;
  category: 'DATABASE_INDEXING' | 'REDIS_CACHING' | 'CONTAINER_BASE_IMAGE';
  title: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  effort: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  expectedPScoreImprovement: string;
  triggerEvidence: string;
}

interface PythonPScoreResponse {
  engine: string;
  evaluatedAt: number;
  evaluationLatencyMs: number;
  overallPScore: number;
  maturityTier: MaturityTierInfo;
  weights: {
    drift: number;
    fanout: number;
    anomaly: number;
  };
  clusterSubScores: {
    driftHealthScore: number;
    fanOutHealthScore: number;
    anomalyHealthScore: number;
    avgDriftPenalty: number;
    avgFanOutPenalty: number;
    avgAnomalyPenalty: number;
  };
  serviceEvaluations: ServiceEvaluation[];
  recommendations: RecommendationItem[];
}

export const PerformanceDimensionPage: React.FC = () => {
  const [data, setData] = useState<PythonPScoreResponse | null>(null);
  const [selectedServiceFilter, setSelectedServiceFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchCompositePScore = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const urls = ['/api/anomaly/pscore/evaluate', 'http://localhost:8000/pscore/evaluate'];
      let payload: PythonPScoreResponse | null = null;

      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            payload = await res.json();
            break;
          }
        } catch {
          // try fallback URL
        }
      }

      if (!payload) {
        throw new Error(
          'Unable to connect to Python FastAPI Composite P-Score Engine on port 8000 (/pscore/evaluate).'
        );
      }

      setData(payload);
      setErrorMsg(null);
      setLastUpdated(new Date());
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to connect to Python P-Score Engine (port 8000)');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCompositePScore();
    const interval = setInterval(fetchCompositePScore, 5000);
    return () => clearInterval(interval);
  }, [fetchCompositePScore]);

  const activeEvals = useMemo(() => {
    return (data?.serviceEvaluations || []).filter((e) => e.hasTelemetry);
  }, [data]);

  const filteredRecommendations = useMemo(() => {
    const recs = data?.recommendations || [];
    if (selectedServiceFilter === 'ALL') return recs;
    return recs.filter((r) => r.serviceId === selectedServiceFilter);
  }, [data, selectedServiceFilter]);

  const avgLatency =
    activeEvals.length > 0
      ? activeEvals.reduce((sum, s) => sum + s.rawMetrics.avgResponseTimeMs, 0) / activeEvals.length
      : 0;
  const maxP95 =
    activeEvals.length > 0
      ? Math.max(...activeEvals.map((s) => s.rawMetrics.p95LatencyMs))
      : 0;
  const avgCpu =
    activeEvals.length > 0
      ? activeEvals.reduce((sum, s) => sum + s.rawMetrics.cpuUsageMillicores, 0) / activeEvals.length
      : 0;
  const avgMemory =
    activeEvals.length > 0
      ? activeEvals.reduce((sum, s) => sum + s.rawMetrics.memoryUsageMB, 0) / activeEvals.length
      : 0;

  const getTierBadgeColor = (level?: number) => {
    switch (level) {
      case 4:
        return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400';
      case 3:
        return 'border-sky-500/40 bg-sky-500/15 text-sky-400';
      case 2:
        return 'border-amber-500/40 bg-amber-500/15 text-amber-400';
      default:
        return 'border-rose-500/40 bg-rose-500/15 text-rose-400';
    }
  };

  const getCategoryBadge = (cat: RecommendationItem['category']) => {
    switch (cat) {
      case 'DATABASE_INDEXING':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 font-mono text-[10px] font-semibold text-sky-400">
            <Database className="h-3 w-3" /> DB INDEXING
          </span>
        );
      case 'REDIS_CACHING':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
            <Layers className="h-3 w-3" /> REDIS CACHING
          </span>
        );
      case 'CONTAINER_BASE_IMAGE':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-400">
            <Cpu className="h-3 w-3" /> CONTAINER &amp; HPA
          </span>
        );
    }
  };

  return (
    <PageContainer className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-semibold tracking-tight text-brand-perf flex items-center gap-2">
              <Zap className="h-6 w-6 text-brand-perf" /> Performance Efficiency Maturity (P-Score)
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Python FastAPI Engine (:8000)
            </span>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            Composite P-Score = 100 × (1 − [0.40·Drift + 0.40·FanOut + 0.20·ML_Anomaly]) evaluated in real time from active Docker containers, Prometheus, and Jaeger.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={fetchCompositePScore}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-secondary/40 px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-secondary transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-brand-perf' : ''}`} />
            Evaluate Live P-Score
          </button>
          <div className="text-right">
            <div className="text-4xl font-mono font-bold text-brand-perf">
              {isLoading || !data ? '--' : data.overallPScore.toFixed(1)}
              <span className="text-lg text-text-muted">/100</span>
            </div>
            {data?.maturityTier && (
              <div
                className={`mt-1 inline-block rounded border px-2 py-0.5 text-[11px] font-mono font-semibold ${getTierBadgeColor(
                  data.maturityTier.level
                )}`}
              >
                {data.maturityTier.shortLabel}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Engine Status Banner */}
      {errorMsg ? (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>
              Python Engine Offline: {errorMsg}. Ensure <strong>pscore-anomaly-detection</strong> (:8000) and{' '}
              <strong>pscore-telemetry-collector</strong> (:8787) containers are running.
            </span>
          </div>
          <button
            type="button"
            onClick={fetchCompositePScore}
            className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 font-mono text-[11px]"
          >
            Retry Connection
          </button>
        </div>
      ) : (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              <strong>{data?.engine}</strong> — Monitoring {activeEvals.length} live microservices (Eval latency:{' '}
              {data?.evaluationLatencyMs ?? 0}ms).
            </span>
          </div>
          {lastUpdated && (
            <span className="font-mono text-[11px] text-emerald-400/80">
              Last evaluated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      )}

      {/* Primary Performance Metrics Summary Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border bg-surface-secondary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                Average Response Latency
              </span>
              <Clock className="h-4 w-4 text-brand-perf" />
            </div>
            <div className="mt-2 text-2xl font-mono font-semibold text-text-primary">
              {activeEvals.length > 0 ? `${avgLatency.toFixed(1)} ms` : '0 ms'}
            </div>
            <p className="mt-1 text-[11px] text-text-muted">Cluster Max P95: {maxP95.toFixed(1)} ms</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-secondary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                Container CPU Footprint
              </span>
              <Cpu className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-2 text-2xl font-mono font-semibold text-text-primary">
              {activeEvals.length > 0 ? `${avgCpu.toFixed(2)} m` : '0 m'}
            </div>
            <p className="mt-1 text-[11px] text-text-muted">Live Docker Engine cgroup CPU</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-secondary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                Container RAM Usage
              </span>
              <HardDrive className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 text-2xl font-mono font-semibold text-text-primary">
              {activeEvals.length > 0 ? `${avgMemory.toFixed(1)} MB` : '0 MB'}
            </div>
            <p className="mt-1 text-[11px] text-text-muted">Average container RSS memory</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-secondary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                Active Recommendations
              </span>
              <Sparkles className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-mono font-semibold text-text-primary">
              {data?.recommendations?.length ?? 0}
            </div>
            <p className="mt-1 text-[11px] text-text-muted">
              Across {activeEvals.length} running microservices
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content: Weighted Research Sub-Modules & Live Service P-Score Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weighted Sub-Modules Breakdown (40% Drift / 40% Fan-Out / 20% ML Anomaly) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-sm uppercase tracking-wider text-text-secondary">
              <span className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-brand-perf" /> Composite P-Score Weighted Sub-Modules
              </span>
              <span className="font-mono text-xs text-text-muted">40% / 40% / 20%</span>
            </CardTitle>
            <p className="mt-1 text-xs text-text-muted">
              Each sub-module feeds its live penalty score into the Python Composite P-Score Engine.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 1. Historical Latency Drift (40%) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <Link
                  to="/dimensions/performance/drift"
                  className="font-medium text-text-primary hover:text-brand-perf inline-flex items-center gap-1.5"
                >
                  <TrendingUp className="h-4 w-4 text-sky-400" />
                  1. Historical Latency Drift Analyzer (Weight 40%)
                  <ArrowUpRight className="h-3.5 w-3.5 text-text-muted" />
                </Link>
                <span className="font-mono text-sky-400 font-semibold">
                  {data?.clusterSubScores?.driftHealthScore ?? 100} / 100
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-secondary overflow-hidden">
                <div
                  className="h-full bg-sky-400 transition-all duration-500"
                  style={{ width: `${data?.clusterSubScores?.driftHealthScore ?? 100}%` }}
                />
              </div>
              <p className="text-[11px] text-text-muted font-mono">
                Avg Drift Penalty: {data?.clusterSubScores?.avgDriftPenalty?.toFixed(3) ?? '0.000'} (OLS regression baseline comparison)
              </p>
            </div>

            {/* 2. Service Fan-Out & Call-Tree Amplification (40%) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <Link
                  to="/dimensions/performance/fanout"
                  className="font-medium text-text-primary hover:text-brand-perf inline-flex items-center gap-1.5"
                >
                  <GitBranch className="h-4 w-4 text-brand-perf" />
                  2. Call-Tree Fan-Out &amp; Gateway Attenuation (Weight 40%)
                  <ArrowUpRight className="h-3.5 w-3.5 text-text-muted" />
                </Link>
                <span className="font-mono text-brand-perf font-semibold">
                  {data?.clusterSubScores?.fanOutHealthScore ?? 100} / 100
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-secondary overflow-hidden">
                <div
                  className="h-full bg-brand-perf transition-all duration-500"
                  style={{ width: `${data?.clusterSubScores?.fanOutHealthScore ?? 100}%` }}
                />
              </div>
              <p className="text-[11px] text-text-muted font-mono">
                Avg Attenuated Fan-Out Penalty: {data?.clusterSubScores?.avgFanOutPenalty?.toFixed(3) ?? '0.000'} (0.3x API Gateway factor)
              </p>
            </div>

            {/* 3. Isolation Forest ML Anomaly & Startup Pre-Filter (20%) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <Link
                  to="/dimensions/performance/anomaly"
                  className="font-medium text-text-primary hover:text-brand-perf inline-flex items-center gap-1.5"
                >
                  <Activity className="h-4 w-4 text-amber-400" />
                  3. Isolation Forest ML Anomaly &amp; 90s Pre-Filter (Weight 20%)
                  <ArrowUpRight className="h-3.5 w-3.5 text-text-muted" />
                </Link>
                <span className="font-mono text-amber-400 font-semibold">
                  {data?.clusterSubScores?.anomalyHealthScore ?? 100} / 100
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-secondary overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-500"
                  style={{ width: `${data?.clusterSubScores?.anomalyHealthScore ?? 100}%` }}
                />
              </div>
              <p className="text-[11px] text-text-muted font-mono">
                Avg ML Anomaly Score: {data?.clusterSubScores?.avgAnomalyPenalty?.toFixed(3) ?? '0.000'} (Scikit-Learn IsolationForest)
              </p>
            </div>

            {/* Maturity Tier Explanation */}
            {data?.maturityTier && (
              <div className="rounded-lg border border-border/80 bg-surface-secondary/30 p-3.5 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-text-primary flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    {data.maturityTier.tier}
                  </span>
                </div>
                <p className="text-xs text-text-secondary">{data.maturityTier.summary}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Per-Service Live P-Score & Penalty Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
              <Server className="h-4 w-4 text-emerald-400" /> Per-Service Live P-Score Breakdown
            </CardTitle>
            <p className="mt-1 text-xs text-text-muted">
              Individual microservice P-Scores and penalty deductions evaluated from live telemetry.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.serviceEvaluations || []).map((svc) => (
              <div
                key={svc.serviceId}
                className="rounded-lg border border-border/80 bg-surface-secondary/30 p-3.5 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-text-primary">
                      {svc.serviceId}
                    </span>
                    {svc.signals.isApiGateway && (
                      <span className="rounded bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.5 font-mono text-[10px] text-sky-400">
                        Gateway (0.3x)
                      </span>
                    )}
                    {svc.hasTelemetry ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Live
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400">
                        <XCircle className="h-3.5 w-3.5" /> Offline
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded border px-2 py-0.5 font-mono text-[10px] font-semibold ${getTierBadgeColor(
                        svc.maturityTier.level
                      )}`}
                    >
                      {svc.maturityTier.shortLabel}
                    </span>
                    <span className="font-mono text-lg font-bold text-brand-perf">
                      {svc.pScore.toFixed(1)}
                      <span className="text-xs text-text-muted">/100</span>
                    </span>
                  </div>
                </div>

                {/* Penalty Deductions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-text-secondary border-t border-border/50 pt-2">
                  <span>
                    Drift Penalty:{' '}
                    <strong className="text-sky-400">-{svc.penalties.driftPenaltyPts} pts</strong>
                  </span>
                  <span>
                    Fan-Out Penalty:{' '}
                    <strong className="text-brand-perf">
                      -{svc.penalties.fanOutPenaltyPts} pts
                    </strong>{' '}
                    ({svc.signals.directFanOutCount} calls, D{svc.signals.maxDependencyDepth})
                  </span>
                  <span>
                    ML Anomaly:{' '}
                    <strong className="text-amber-400">
                      -{svc.penalties.anomalyPenaltyPts} pts
                    </strong>
                  </span>
                </div>

                {/* Raw Container Telemetry */}
                <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-text-muted">
                  <span>CPU: {svc.rawMetrics.cpuUsageMillicores}m</span>
                  <span>RAM: {svc.rawMetrics.memoryUsageMB}MB</span>
                  <span>P95: {svc.rawMetrics.p95LatencyMs}ms</span>
                  <span>RPS: {svc.rawMetrics.rps} req/s</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Phase 5: Context-Aware Architectural Recommendations Engine */}
      <Card className="border-border">
        <CardHeader className="border-b border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-primary">
                <Sparkles className="h-4 w-4 text-brand-perf" /> Context-Aware Architectural Recommendations Engine (Phase 5)
              </CardTitle>
              <p className="mt-1 text-xs text-text-secondary">
                Actionable optimization rules dynamically triggered by Python analysis of live database spans, synchronous fan-out depth, and container resource saturation.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedServiceFilter('ALL')}
                className={`rounded-md border px-2.5 py-1 font-mono text-xs transition-colors ${
                  selectedServiceFilter === 'ALL'
                    ? 'border-brand-perf bg-brand-perf/15 text-brand-perf font-semibold'
                    : 'border-border bg-surface text-text-secondary hover:text-text-primary'
                }`}
              >
                All ({data?.recommendations?.length ?? 0})
              </button>
              {(data?.serviceEvaluations || []).map((s) => (
                <button
                  key={s.serviceId}
                  type="button"
                  onClick={() => setSelectedServiceFilter(s.serviceId)}
                  className={`rounded-md border px-2.5 py-1 font-mono text-xs transition-colors ${
                    selectedServiceFilter === s.serviceId
                      ? 'border-brand-perf bg-brand-perf/15 text-brand-perf font-semibold'
                      : 'border-border bg-surface text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {s.serviceId}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          {filteredRecommendations.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted">
              No optimization recommendations triggered for the current selection.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRecommendations.map((rec, idx) => (
                <div
                  key={`${rec.serviceId}-${rec.ruleId}-${idx}`}
                  className="rounded-lg border border-border/80 bg-surface-secondary/25 p-4 flex flex-col justify-between space-y-3 hover:border-brand-perf/40 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getCategoryBadge(rec.category)}
                        <span className="rounded bg-surface px-2 py-0.5 font-mono text-[11px] font-bold text-text-primary border border-border">
                          {rec.serviceId}
                        </span>
                      </div>
                      <span
                        className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
                          rec.impact === 'HIGH'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {rec.impact} IMPACT · {rec.effort} EFFORT
                      </span>
                    </div>

                    <h4 className="text-sm font-semibold text-text-primary">{rec.title}</h4>
                    <p className="text-xs leading-relaxed text-text-secondary">{rec.description}</p>
                  </div>

                  <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
                    <span className="text-text-muted truncate max-w-xs" title={rec.triggerEvidence}>
                      Evidence: <strong className="text-text-secondary">{rec.triggerEvidence}</strong>
                    </span>
                    <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-emerald-400 font-semibold">
                      {rec.expectedPScoreImprovement}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
};
