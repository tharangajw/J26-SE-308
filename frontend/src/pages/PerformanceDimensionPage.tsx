import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Cpu,
  HardDrive,
  Zap,
  CheckCircle2,
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
  ShieldCheck,
  Scale,
  Gauge,
  Play,
  RotateCcw,
  Sliders,
  Camera,
  AlertTriangle
} from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';

interface MaturityTierInfo {
  level: number;
  tier: string;
  shortLabel: string;
  summary: string;
}

interface ApdexAndTailInfo {
  tailLatencyRatio: number;
  apdexScore: number;
  apdexRating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  apdexThresholdMs: number;
}

interface FeatureAttributionsInfo {
  cpuPercent: number;
  memoryPercent: number;
  latencyPercent: number;
  errorPercent: number;
  dominantDriver: string;
}

interface ServiceEvaluation {
  serviceId: string;
  hasTelemetry: boolean;
  pScore: number;
  maturityTier: MaturityTierInfo;
  apdexAndTail?: ApdexAndTailInfo;
  signals: {
    driftScore: number;
    driftLevel: string;
    liveP95LatencyMs: number;
    historicalBaselineMs: number;
    fanOutScore: number;
    fanOutLevel: string;
    directFanOutCount: number;
    maxDependencyDepth: number;
    executionPattern?: 'SINGLE' | 'PARALLEL_CONCURRENT' | 'HYBRID_WATERFALL' | 'SEQUENTIAL_N_PLUS_1';
    sequentialRatio?: number;
    isApiGateway: boolean;
    attenuationFactor: number;
    anomalyScore: number;
    isAnomaly: boolean;
    prefiltered: boolean;
    featureAttributions?: FeatureAttributionsInfo;
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
    p99LatencyMs?: number;
    rps: number;
  };
}

interface RecommendationItem {
  id?: string;
  ruleId: string;
  serviceId: string;
  category: 'DATABASE_INDEXING' | 'REDIS_CACHING' | 'CONTAINER_BASE_IMAGE';
  title: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  effort: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  expectedPScoreImprovement: string;
  projectedServiceDeltaPts?: number;
  projectedClusterDeltaPts?: number;
  triggerEvidence: string;
}

interface AHPValidationInfo {
  weights: {
    drift: number;
    fanout: number;
    anomaly: number;
  };
  normalizedWeights?: {
    drift: number;
    fanout: number;
    anomaly: number;
  };
  pairwiseMatrix: number[][];
  labels: string[];
  lambdaMax: number;
  consistencyIndex: number;
  consistencyIndexCI?: number;
  randomIndex: number;
  randomIndexRI?: number;
  consistencyRatio: number;
  consistencyRatioCR?: number;
  isConsistent: boolean;
}

interface PScoreHistoryPoint {
  timestamp: number;
  overallPScore: number;
  driftHealthScore: number;
  fanOutHealthScore: number;
  anomalyHealthScore: number;
  tierLevel: number;
}

interface BaselineSnapshot {
  capturedAt: string;
  overallPScore: number;
  tierLabel: string;
  projectedScore?: number;
  serviceScores: Record<string, number>;
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
  ahpValidation?: AHPValidationInfo;
  clusterSubScores: {
    driftHealthScore: number;
    fanOutHealthScore: number;
    anomalyHealthScore: number;
    avgDriftPenalty: number;
    avgFanOutPenalty: number;
    avgAnomalyPenalty: number;
    avgApdexScore?: number;
    avgTailLatencyRatio?: number;
  };
  pScoreHistory?: PScoreHistoryPoint[];
  serviceEvaluations: ServiceEvaluation[];
  recommendations: RecommendationItem[];
}

interface WeightPreset {
  id: string;
  label: string;
  drift: number;
  fanout: number;
  anomaly: number;
  a12: number;
  a13: number;
  a23: number;
  description: string;
}

const SAATY_SCALE_OPTIONS: { value: number; label: string }[] = [
  { value: 0.2, label: '1/5 (0.20) — Strongly Inferior' },
  { value: 0.3333, label: '1/3 (0.33) — Moderately Inferior' },
  { value: 0.5, label: '1/2 (0.50) — Slightly Inferior' },
  { value: 1, label: '1 (1.00) — Equal Importance' },
  { value: 2, label: '2 (2.00) — Slightly Preferred' },
  { value: 3, label: '3 (3.00) — Moderately Preferred' },
  { value: 5, label: '5 (5.00) — Strongly Preferred' },
  { value: 7, label: '7 (7.00) — Very Strongly Preferred' },
  { value: 9, label: '9 (9.00) — Extremely Preferred' }
];

const WEIGHT_PRESETS: WeightPreset[] = [
  {
    id: 'BALANCED',
    label: 'Balanced Architecture (40/40/20)',
    drift: 0.4,
    fanout: 0.4,
    anomaly: 0.2,
    a12: 1,
    a13: 2,
    a23: 2,
    description: 'Default AHP weight distribution balancing temporal latency stability and topological fan-out.'
  },
  {
    id: 'LATENCY_CRITICAL',
    label: 'Latency-SLA Critical (55/25/20)',
    drift: 0.55,
    fanout: 0.25,
    anomaly: 0.2,
    a12: 2,
    a13: 3,
    a23: 1,
    description: 'Prioritizes OLS regression latency drift for strict P95/P99 SLA-bound payment & checkout pipelines.'
  },
  {
    id: 'MESH_HEAVY',
    label: 'High-Fan-Out Mesh (25/55/20)',
    drift: 0.25,
    fanout: 0.55,
    anomaly: 0.2,
    a12: 0.5,
    a13: 1,
    a23: 3,
    description: 'Prioritizes synchronous call-tree amplification and deep microservice dependency chains.'
  }
];

function classifyScoreToTier(pScore: number): MaturityTierInfo {
  if (pScore >= 85) {
    return {
      level: 4,
      tier: 'Level 4: Optimized (Proactive & Self-Optimizing)',
      shortLabel: 'Level 4: Optimized',
      summary: 'Sub-millisecond drift stability, well-attenuated call trees, and zero ML runtime anomalies.'
    };
  }
  if (pScore >= 70) {
    return {
      level: 3,
      tier: 'Level 3: Resilient (Observable & Stable)',
      shortLabel: 'Level 3: Resilient',
      summary: 'Healthy runtime telemetry with minor synchronous fan-out or mild temporal latency drift.'
    };
  }
  if (pScore >= 50) {
    return {
      level: 2,
      tier: 'Level 2: Managed (Emerging Bottlenecks)',
      shortLabel: 'Level 2: Managed',
      summary: 'Noticeable latency drift or unattenuated synchronous fan-out requiring caching or indexing.'
    };
  }
  return {
    level: 1,
    tier: 'Level 1: Reactive (Critical Degradation)',
    shortLabel: 'Level 1: Reactive',
    summary: 'Severe performance degradation across latency drift, deep call chains, or ML container anomalies.'
  };
}

export const PerformanceDimensionPage: React.FC = () => {
  const [data, setData] = useState<PythonPScoreResponse | null>(null);
  const [selectedServiceFilter, setSelectedServiceFilter] = useState<string>('ALL');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('BALANCED');
  const [useCustomPairwise, setUseCustomPairwise] = useState<boolean>(false);
  const [pairwiseJudgments, setPairwiseJudgments] = useState<{ a12: number; a13: number; a23: number }>({
    a12: 1,
    a13: 2,
    a23: 2
  });
  const [simulatedRecIds, setSimulatedRecIds] = useState<string[]>([]);
  const [capturedBaseline, setCapturedBaseline] = useState<BaselineSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const activePreset = useMemo(
    () => WEIGHT_PRESETS.find((p) => p.id === selectedPresetId) || WEIGHT_PRESETS[0],
    [selectedPresetId]
  );

  const fetchCompositePScore = useCallback(async () => {
    setIsRefreshing(true);
    try {
      let qs = `?w_drift=${activePreset.drift}&w_fanout=${activePreset.fanout}&w_anomaly=${activePreset.anomaly}`;
      if (useCustomPairwise) {
        qs += `&a12=${pairwiseJudgments.a12}&a13=${pairwiseJudgments.a13}&a23=${pairwiseJudgments.a23}`;
      }
      const urls = [
        `/api/anomaly/pscore/evaluate${qs}`,
        `http://localhost:8000/pscore/evaluate${qs}`
      ];
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
  }, [activePreset, useCustomPairwise, pairwiseJudgments]);

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

  const toggleSimulateRec = (recKey: string) => {
    setSimulatedRecIds((prev) =>
      prev.includes(recKey) ? prev.filter((id) => id !== recKey) : [...prev, recKey]
    );
  };

  const simulateAllFixes = () => {
    const allKeys = (data?.recommendations || []).map(
      (r) => r.id || `${r.serviceId}-${r.ruleId}`
    );
    setSimulatedRecIds(allKeys);
  };

  const resetSimulations = () => {
    setSimulatedRecIds([]);
  };

  // Closed-Loop Remediation Simulation Calculations
  const simulationSummary = useMemo(() => {
    const baseScore = data?.overallPScore ?? 0;
    const allRecs = data?.recommendations || [];
    const activeSimulatedRecs = allRecs.filter((r) =>
      simulatedRecIds.includes(r.id || `${r.serviceId}-${r.ruleId}`)
    );

    const serviceDeltaMap: Record<string, number> = {};
    for (const r of activeSimulatedRecs) {
      const delta = r.projectedServiceDeltaPts ?? 4.0;
      serviceDeltaMap[r.serviceId] = (serviceDeltaMap[r.serviceId] || 0) + delta;
    }

    const evals = data?.serviceEvaluations || [];
    let totalProjectedScore = 0;
    for (const ev of evals) {
      const gain = serviceDeltaMap[ev.serviceId] || 0;
      const proj = Math.min(100, ev.pScore + gain);
      totalProjectedScore += proj;
    }

    const projectedOverallScore =
      evals.length > 0 ? Math.min(100, totalProjectedScore / evals.length) : baseScore;
    const totalClusterGain = Math.max(0, projectedOverallScore - baseScore);
    const projectedTier = classifyScoreToTier(projectedOverallScore);

    return {
      isSimulating: activeSimulatedRecs.length > 0,
      simulatedCount: activeSimulatedRecs.length,
      baseScore,
      projectedOverallScore,
      totalClusterGain,
      projectedTier,
      serviceDeltaMap
    };
  }, [data, simulatedRecIds]);

  const handleCaptureBaseline = () => {
    if (!data) return;
    const svcMap: Record<string, number> = {};
    for (const s of data.serviceEvaluations) {
      svcMap[s.serviceId] = s.pScore;
    }
    setCapturedBaseline({
      capturedAt: new Date().toLocaleTimeString(),
      overallPScore: data.overallPScore,
      tierLabel: data.maturityTier.shortLabel,
      projectedScore: simulationSummary.isSimulating ? simulationSummary.projectedOverallScore : undefined,
      serviceScores: svcMap
    });
  };

  const avgLatency =
    activeEvals.length > 0
      ? activeEvals.reduce((sum, s) => sum + s.rawMetrics.avgResponseTimeMs, 0) / activeEvals.length
      : 0;
  const maxP95 =
    activeEvals.length > 0
      ? Math.max(...activeEvals.map((s) => s.rawMetrics.p95LatencyMs))
      : 0;
  const avgApdex =
    data?.clusterSubScores?.avgApdexScore ??
    (activeEvals.length > 0
      ? activeEvals.reduce((sum, s) => sum + (s.apdexAndTail?.apdexScore ?? 1), 0) / activeEvals.length
      : 1);
  const avgTailRatio =
    data?.clusterSubScores?.avgTailLatencyRatio ??
    (activeEvals.length > 0
      ? activeEvals.reduce((sum, s) => sum + (s.apdexAndTail?.tailLatencyRatio ?? 1.2), 0) /
        activeEvals.length
      : 1.2);
  const avgMemory =
    activeEvals.length > 0
      ? activeEvals.reduce((sum, s) => sum + s.rawMetrics.memoryUsageMB, 0) / activeEvals.length
      : 0;

  const crValue =
    data?.ahpValidation?.consistencyRatio ?? data?.ahpValidation?.consistencyRatioCR ?? 0;
  const ciValue =
    data?.ahpValidation?.consistencyIndex ?? data?.ahpValidation?.consistencyIndexCI ?? 0;
  const riValue =
    data?.ahpValidation?.randomIndex ?? data?.ahpValidation?.randomIndexRI ?? 0.58;
  const isAhpConsistent = data?.ahpValidation?.isConsistent ?? crValue < 0.1;

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

  const getExecutionPatternBadge = (
    pattern?: ServiceEvaluation['signals']['executionPattern'],
    seqRatio?: number
  ) => {
    if (!pattern || pattern === 'SINGLE') return null;
    if (pattern === 'SEQUENTIAL_N_PLUS_1') {
      return (
        <span className="rounded bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.5 font-mono text-[10px] text-rose-400">
          Sequential N+1 ({Math.round((seqRatio ?? 1) * 100)}%)
        </span>
      );
    }
    if (pattern === 'HYBRID_WATERFALL') {
      return (
        <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 font-mono text-[10px] text-amber-400">
          Hybrid Waterfall ({Math.round((seqRatio ?? 0.5) * 100)}% Seq)
        </span>
      );
    }
    return (
      <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
        Parallel (Promise.all)
      </span>
    );
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
            Composite P-Score = 100 × (1 − [{Math.round((data?.weights?.drift ?? 0.4) * 100)}%·Drift +{' '}
            {Math.round((data?.weights?.fanout ?? 0.4) * 100)}%·FanOut +{' '}
            {Math.round((data?.weights?.anomaly ?? 0.2) * 100)}%·ML_Anomaly]) with AHP validation, Apdex SLA, and XAI attribution.
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
            <div className="flex items-baseline justify-end gap-2">
              <div className="text-4xl font-mono font-bold text-brand-perf">
                {isLoading || !data ? '--' : data.overallPScore.toFixed(1)}
                <span className="text-lg text-text-muted">/100</span>
              </div>
              {simulationSummary.isSimulating && (
                <div className="flex flex-col items-end">
                  <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 rounded px-1.5 py-0.5">
                    → {simulationSummary.projectedOverallScore.toFixed(1)} (+
                    {simulationSummary.totalClusterGain.toFixed(1)} pts)
                  </span>
                </div>
              )}
            </div>
            {data?.maturityTier && (
              <div className="mt-1 flex items-center justify-end gap-1.5">
                <span
                  className={`inline-block rounded border px-2 py-0.5 text-[11px] font-mono font-semibold ${getTierBadgeColor(
                    data.maturityTier.level
                  )}`}
                >
                  {data.maturityTier.shortLabel}
                </span>
                {simulationSummary.isSimulating &&
                  simulationSummary.projectedTier.level > data.maturityTier.level && (
                    <span
                      className={`inline-block rounded border px-2 py-0.5 text-[11px] font-mono font-semibold ${getTierBadgeColor(
                        simulationSummary.projectedTier.level
                      )}`}
                    >
                      → {simulationSummary.projectedTier.shortLabel}
                    </span>
                  )}
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
              {data?.evaluationLatencyMs ?? 0}ms) | AHP Consistency Ratio:{' '}
              <strong className={isAhpConsistent ? 'text-emerald-300' : 'text-amber-300'}>
                CR = {crValue.toFixed(4)} ({isAhpConsistent ? '< 0.10 Valid' : '>= 0.10 Inconsistent'})
              </strong>
            </span>
          </div>
          {lastUpdated && (
            <span className="font-mono text-[11px] text-emerald-400/80">
              Last evaluated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      )}

      {/* Primary Performance Metrics Summary Grid (Including Apdex & Tail-Latency Amplification) */}
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
                Cluster Apdex Score (T=50ms)
              </span>
              <Gauge className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-mono font-semibold text-emerald-400">
                {avgApdex.toFixed(3)}
              </span>
              <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
                {avgApdex >= 0.94 ? 'EXCELLENT' : avgApdex >= 0.85 ? 'GOOD' : 'FAIR'}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-text-muted">
              Tail Amplification (P99/P95): <strong className="font-mono text-sky-400">{avgTailRatio.toFixed(2)}x</strong>
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-secondary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                Container RAM Footprint
              </span>
              <HardDrive className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 text-2xl font-mono font-semibold text-text-primary">
              {activeEvals.length > 0 ? `${avgMemory.toFixed(1)} MB` : '0 MB'}
            </div>
            <p className="mt-1 text-[11px] text-text-muted">Live Docker Engine cgroup RSS</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-secondary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                Remediation Simulator
              </span>
              <Sparkles className="h-4 w-4 text-brand-perf" />
            </div>
            <div className="mt-2 text-2xl font-mono font-semibold text-text-primary">
              {simulationSummary.isSimulating ? (
                <span className="text-emerald-400">
                  +{simulationSummary.totalClusterGain.toFixed(1)} pts
                </span>
              ) : (
                `${data?.recommendations?.length ?? 0} Rules`
              )}
            </div>
            <p className="mt-1 text-[11px] text-text-muted">
              {simulationSummary.isSimulating
                ? `${simulationSummary.simulatedCount} fixes simulated`
                : 'Click "Simulate Fix" below'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content: Weighted Research Sub-Modules & Live Service P-Score Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Weighted Sub-Modules + Saaty AHP Consistency Validator + Historical Trend */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-sm uppercase tracking-wider text-text-secondary">
                <span className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-brand-perf" /> Composite P-Score Weighted Sub-Modules
                </span>
                <span className="font-mono text-xs text-brand-perf">
                  {Math.round((data?.weights?.drift ?? 0.4) * 100)}% /{' '}
                  {Math.round((data?.weights?.fanout ?? 0.4) * 100)}% /{' '}
                  {Math.round((data?.weights?.anomaly ?? 0.2) * 100)}%
                </span>
              </CardTitle>
              <p className="mt-1 text-xs text-text-muted">
                Each sub-module feeds its live normalized penalty score into the Python Composite P-Score Engine.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* 1. Historical Latency Drift */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <Link
                    to="/dimensions/performance/drift"
                    className="font-medium text-text-primary hover:text-brand-perf inline-flex items-center gap-1.5"
                  >
                    <TrendingUp className="h-4 w-4 text-sky-400" />
                    1. Historical Latency Drift Analyzer (Weight {Math.round((data?.weights?.drift ?? 0.4) * 100)}%)
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

              {/* 2. Service Fan-Out & Call-Tree Amplification */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <Link
                    to="/dimensions/performance/fanout"
                    className="font-medium text-text-primary hover:text-brand-perf inline-flex items-center gap-1.5"
                  >
                    <GitBranch className="h-4 w-4 text-brand-perf" />
                    2. Call-Tree Fan-Out &amp; Gateway Attenuation (Weight {Math.round((data?.weights?.fanout ?? 0.4) * 100)}%)
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
                  Avg Attenuated Fan-Out Penalty: {data?.clusterSubScores?.avgFanOutPenalty?.toFixed(3) ?? '0.000'} (0.3x API Gateway factor + N+1 Sequential check)
                </p>
              </div>

              {/* 3. Isolation Forest ML Anomaly & Startup Pre-Filter */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <Link
                    to="/dimensions/performance/anomaly"
                    className="font-medium text-text-primary hover:text-brand-perf inline-flex items-center gap-1.5"
                  >
                    <Activity className="h-4 w-4 text-amber-400" />
                    3. Isolation Forest ML Anomaly &amp; 90s Pre-Filter (Weight {Math.round((data?.weights?.anomaly ?? 0.2) * 100)}%)
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

          {/* Analytic Hierarchy Process (AHP) Weight Justification & CR Validator */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
                  <Scale className="h-4 w-4 text-sky-400" /> Saaty&apos;s AHP Weight Justification &amp; CR Validator
                </CardTitle>
                <span
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] font-semibold border ${
                    isAhpConsistent
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                  }`}
                >
                  {isAhpConsistent ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <AlertTriangle className="h-3 w-3" />
                  )}
                  CR = {crValue.toFixed(4)} {isAhpConsistent ? '< 0.10' : '>= 0.10 (Revise)'}
                </span>
              </div>
              <p className="mt-1 text-xs text-text-muted">
                Mathematical verification of P-Score penalty weights using Saaty&apos;s 1–9 Analytic Hierarchy Process pairwise comparison matrix.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Weight Profile Selector */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase text-text-secondary">
                    <Sliders className="h-3 w-3 text-brand-perf" /> Select Architectural Weight Profile:
                  </div>
                  <button
                    type="button"
                    onClick={() => setUseCustomPairwise((prev) => !prev)}
                    className={`rounded border px-2 py-0.5 font-mono text-[10px] transition-colors ${
                      useCustomPairwise
                        ? 'border-sky-400 bg-sky-500/15 text-sky-300 font-semibold'
                        : 'border-border bg-surface-secondary/30 text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {useCustomPairwise ? 'Custom Saaty 1–9 Judgments Active' : 'Customize Pairwise (a12, a13, a23)'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {WEIGHT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setSelectedPresetId(preset.id);
                        setUseCustomPairwise(false);
                        setPairwiseJudgments({ a12: preset.a12, a13: preset.a13, a23: preset.a23 });
                      }}
                      className={`rounded-md border p-2 text-left transition-colors ${
                        !useCustomPairwise && selectedPresetId === preset.id
                          ? 'border-brand-perf bg-brand-perf/15 text-text-primary'
                          : 'border-border bg-surface-secondary/20 text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <div className="font-mono text-[11px] font-bold text-brand-perf">
                        {preset.drift * 100}% / {preset.fanout * 100}% / {preset.anomaly * 100}%
                      </div>
                      <div className="text-[11px] font-medium truncate">{preset.label.split(' (')[0]}</div>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-text-muted">{activePreset.description}</p>
              </div>

              {/* Interactive Saaty 1-9 Pairwise Judgment Controls */}
              {useCustomPairwise && (
                <div className="rounded border border-sky-500/30 bg-sky-500/5 p-3 space-y-2.5">
                  <div className="text-[11px] font-mono uppercase text-sky-400 font-semibold">
                    Saaty 1–9 Pairwise Comparisons (Test Transitivity &amp; Consistency Ratio CR)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="block font-mono text-[10px] text-text-secondary mb-1">
                        a₁₂ (Drift vs. Fan-Out)
                      </label>
                      <select
                        value={pairwiseJudgments.a12}
                        onChange={(e) =>
                          setPairwiseJudgments((p) => ({ ...p, a12: parseFloat(e.target.value) }))
                        }
                        className="w-full rounded border border-border bg-surface px-2 py-1 font-mono text-[11px] text-text-primary"
                      >
                        {SAATY_SCALE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] text-text-secondary mb-1">
                        a₁₃ (Drift vs. ML Anomaly)
                      </label>
                      <select
                        value={pairwiseJudgments.a13}
                        onChange={(e) =>
                          setPairwiseJudgments((p) => ({ ...p, a13: parseFloat(e.target.value) }))
                        }
                        className="w-full rounded border border-border bg-surface px-2 py-1 font-mono text-[11px] text-text-primary"
                      >
                        {SAATY_SCALE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] text-text-secondary mb-1">
                        a₂₃ (Fan-Out vs. ML Anomaly)
                      </label>
                      <select
                        value={pairwiseJudgments.a23}
                        onChange={(e) =>
                          setPairwiseJudgments((p) => ({ ...p, a23: parseFloat(e.target.value) }))
                        }
                        className="w-full rounded border border-border bg-surface px-2 py-1 font-mono text-[11px] text-text-primary"
                      >
                        {SAATY_SCALE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* 3x3 Pairwise Matrix & Eigenvalue Metrics */}
              {data?.ahpValidation && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="rounded border border-border/70 bg-surface-secondary/20 p-2.5">
                    <div className="text-[10px] font-mono uppercase text-text-muted mb-1.5">
                      Saaty Pairwise Matrix A = [a_ij]
                    </div>
                    <table className="w-full text-right font-mono text-[11px]">
                      <thead>
                        <tr className="text-text-muted border-b border-border/50">
                          <th className="text-left py-1">Signal</th>
                          <th className="py-1">Drift</th>
                          <th className="py-1">FanOut</th>
                          <th className="py-1">ML</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {data.ahpValidation.pairwiseMatrix.map((row, rIdx) => (
                          <tr key={rIdx}>
                            <td className="text-left py-1 font-semibold text-text-secondary">
                              {rIdx === 0 ? 'Drift' : rIdx === 1 ? 'FanOut' : 'ML'}
                            </td>
                            {row.map((val, cIdx) => (
                              <td key={cIdx} className="py-1 text-text-primary">
                                {val.toFixed(2)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="rounded border border-border/70 bg-surface-secondary/20 p-2.5 flex flex-col justify-between font-mono text-[11px] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Principal Eigenvalue (λ_max):</span>
                      <span className="text-text-primary font-bold">
                        {data.ahpValidation.lambdaMax.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Consistency Index (CI):</span>
                      <span className="text-text-primary">{ciValue.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Saaty Random Index (RI, n=3):</span>
                      <span className="text-text-primary">{riValue}</span>
                    </div>
                    <div className="flex justify-between border-t border-border/50 pt-1">
                      <span className="text-text-secondary font-semibold">Consistency Ratio (CR):</span>
                      <span className={isAhpConsistent ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {crValue.toFixed(4)} ({isAhpConsistent ? 'Consistent' : 'Inconsistent'})
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Historical P-Score Trend Timeline */}
          {data?.pScoreHistory && data.pScoreHistory.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm uppercase tracking-wider text-text-secondary">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-400" /> Persistent P-Score Historical Trend
                  </span>
                  <span className="font-mono text-[11px] text-text-muted">
                    Last {Math.min(20, data.pScoreHistory.length)} Evaluations
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <div className="h-24 flex items-end gap-1.5 pt-2 px-1 border-b border-border/60">
                  {data.pScoreHistory.slice(-20).map((pt, idx) => {
                    const heightPct = Math.max(12, Math.min(100, pt.overallPScore));
                    const barColor =
                      pt.overallPScore >= 85
                        ? 'bg-emerald-400/80'
                        : pt.overallPScore >= 70
                        ? 'bg-sky-400/80'
                        : pt.overallPScore >= 50
                        ? 'bg-amber-400/80'
                        : 'bg-rose-400/80';
                    const timeStr = new Date(pt.timestamp * 1000).toLocaleTimeString();
                    return (
                      <div
                        key={`${pt.timestamp}-${idx}`}
                        className="flex-1 flex flex-col items-center group relative"
                        title={`${timeStr} — P-Score: ${pt.overallPScore.toFixed(1)} (Tier L${pt.tierLevel})`}
                      >
                        <div
                          className={`w-full rounded-t transition-all ${barColor} group-hover:opacity-100 opacity-85`}
                          style={{ height: `${(heightPct / 100) * 80}px` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between font-mono text-[10px] text-text-muted">
                  <span>
                    Earliest:{' '}
                    {data.pScoreHistory[0]
                      ? `${data.pScoreHistory[0].overallPScore.toFixed(1)} pts`
                      : '--'}
                  </span>
                  <span>
                    Latest:{' '}
                    {data.pScoreHistory[data.pScoreHistory.length - 1]
                      ? `${data.pScoreHistory[data.pScoreHistory.length - 1].overallPScore.toFixed(1)} pts`
                      : '--'}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Per-Service Live P-Score, Apdex, Tail Ratio & XAI Feature Attribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
              <Server className="h-4 w-4 text-emerald-400" /> Per-Service Live P-Score, Apdex &amp; XAI Breakdown
            </CardTitle>
            <p className="mt-1 text-xs text-text-muted">
              Individual microservice P-Scores, Execution Pattern (Sequential N+1 vs Parallel), Apdex SLA, and XAI attribution.
            </p>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {(data?.serviceEvaluations || []).map((svc) => {
              const simDelta = simulationSummary.serviceDeltaMap[svc.serviceId] || 0;
              const projectedSvcScore = Math.min(100, svc.pScore + simDelta);
              const attr = svc.signals.featureAttributions;

              return (
                <div
                  key={svc.serviceId}
                  className="rounded-lg border border-border/80 bg-surface-secondary/30 p-3.5 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-text-primary">
                        {svc.serviceId}
                      </span>
                      {svc.signals.isApiGateway && (
                        <span className="rounded bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.5 font-mono text-[10px] text-sky-400">
                          Gateway (0.3x)
                        </span>
                      )}
                      {getExecutionPatternBadge(
                        svc.signals.executionPattern,
                        svc.signals.sequentialRatio
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
                      <div className="flex items-baseline gap-1.5 font-mono">
                        <span className="text-lg font-bold text-brand-perf">
                          {svc.pScore.toFixed(1)}
                          <span className="text-xs text-text-muted">/100</span>
                        </span>
                        {simDelta > 0 && (
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 rounded px-1.5 py-0.5">
                            → {projectedSvcScore.toFixed(1)}
                          </span>
                        )}
                      </div>
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

                  {/* Apdex & Tail-Latency Amplification Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono bg-surface/60 rounded px-2.5 py-1.5 border border-border/50">
                    <span>
                      Apdex (T=50ms):{' '}
                      <strong className="text-emerald-400">
                        {svc.apdexAndTail?.apdexScore?.toFixed(3) ?? '0.995'} (
                        {svc.apdexAndTail?.apdexRating ?? 'EXCELLENT'})
                      </strong>
                    </span>
                    <span>
                      Tail Ratio (P99/P95):{' '}
                      <strong className="text-sky-400">
                        {svc.apdexAndTail?.tailLatencyRatio?.toFixed(2) ?? '1.20'}x
                      </strong>
                    </span>
                    <span className="text-text-muted">
                      P95: {svc.rawMetrics.p95LatencyMs}ms / P99: {svc.rawMetrics.p99LatencyMs ?? 21}ms
                    </span>
                  </div>

                  {/* XAI Feature Attribution Mini Bar */}
                  {attr && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
                        <span>
                          XAI Attribution Driver:{' '}
                          <strong className="text-text-secondary">{attr.dominantDriver}</strong>
                        </span>
                        <span>
                          CPU {attr.cpuPercent}% · RAM {attr.memoryPercent}% · Lat {attr.latencyPercent}% · Err{' '}
                          {attr.errorPercent}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-surface overflow-hidden flex">
                        <div
                          className="h-full bg-cyan-400"
                          style={{ width: `${attr.cpuPercent}%` }}
                          title={`CPU: ${attr.cpuPercent}%`}
                        />
                        <div
                          className="h-full bg-amber-400"
                          style={{ width: `${attr.memoryPercent}%` }}
                          title={`Memory: ${attr.memoryPercent}%`}
                        />
                        <div
                          className="h-full bg-brand-perf"
                          style={{ width: `${attr.latencyPercent}%` }}
                          title={`Latency: ${attr.latencyPercent}%`}
                        />
                        <div
                          className="h-full bg-rose-400"
                          style={{ width: `${attr.errorPercent}%` }}
                          title={`Errors: ${attr.errorPercent}%`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Raw Container Telemetry */}
                  <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-text-muted">
                    <span>CPU: {svc.rawMetrics.cpuUsageMillicores}m</span>
                    <span>RAM: {svc.rawMetrics.memoryUsageMB}MB</span>
                    <span>Avg: {svc.rawMetrics.avgResponseTimeMs}ms</span>
                    <span>RPS: {svc.rawMetrics.rps} req/s</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Phase 5: Context-Aware Architectural Recommendations Engine + Closed-Loop Remediation Simulator */}
      <Card className="border-border">
        <CardHeader className="border-b border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-primary">
                <Sparkles className="h-4 w-4 text-brand-perf" /> Context-Aware Architectural Recommendations &amp; Closed-Loop Simulator
              </CardTitle>
              <p className="mt-1 text-xs text-text-secondary">
                Toggle <strong>Simulate Fix</strong> or click <strong>Capture Baseline Snapshot</strong> to verify Before vs. After optimization gains.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCaptureBaseline}
                className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 font-mono text-xs font-semibold text-sky-400 hover:bg-sky-500/25 transition-colors"
              >
                <Camera className="h-3 w-3" /> Capture Baseline Snapshot
              </button>
              <button
                type="button"
                onClick={simulateAllFixes}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 font-mono text-xs font-semibold text-emerald-400 hover:bg-emerald-500/25 transition-colors"
              >
                <Play className="h-3 w-3" /> Simulate All Fixes
              </button>
              {simulationSummary.isSimulating && (
                <button
                  type="button"
                  onClick={resetSimulations}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 font-mono text-xs text-text-secondary hover:text-text-primary transition-colors"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
              )}
            </div>
          </div>

          {/* Captured Baseline vs. Live Actual Benchmark Comparison */}
          {capturedBaseline && data && (
            <div className="mt-4 rounded-lg border border-sky-500/40 bg-sky-500/10 p-3.5 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-xs font-mono uppercase tracking-wider text-sky-400 font-bold">
                  Empirical Before vs. After Optimization Benchmark (Captured at {capturedBaseline.capturedAt})
                </div>
                <div className="text-xs text-text-secondary">
                  Compares captured pre-optimization baseline against live telemetry after applying Redis caching, DB indexing, or JMeter load changes.
                </div>
              </div>
              <div className="flex items-center gap-4 font-mono">
                <div className="text-right">
                  <div className="text-[10px] uppercase text-text-muted">Baseline P-Score</div>
                  <div className="text-lg font-bold text-text-primary">
                    {capturedBaseline.overallPScore.toFixed(1)}
                  </div>
                </div>
                <div className="text-sky-400 font-bold text-lg">→</div>
                <div className="text-right">
                  <div className="text-[10px] uppercase text-sky-400">Live Actual P-Score</div>
                  <div className="text-xl font-bold text-sky-400">
                    {data.overallPScore.toFixed(1)}{' '}
                    <span className="text-xs">
                      ({data.overallPScore - capturedBaseline.overallPScore >= 0 ? '+' : ''}
                      {(data.overallPScore - capturedBaseline.overallPScore).toFixed(1)} pts)
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCapturedBaseline(null)}
                  className="rounded border border-border bg-surface px-2 py-1 text-[10px] text-text-muted hover:text-text-primary"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Interactive Closed-Loop Simulation Banner */}
          {simulationSummary.isSimulating && (
            <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3.5 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold">
                  Closed-Loop What-If Remediation Projection ({simulationSummary.simulatedCount} Active Fixes)
                </div>
                <div className="text-xs text-text-secondary">
                  Applying the selected architectural optimizations attenuates synchronous fan-out, database latency drift, and container saturation.
                </div>
              </div>
              <div className="flex items-center gap-4 font-mono">
                <div className="text-right">
                  <div className="text-[10px] uppercase text-text-muted">Before P-Score</div>
                  <div className="text-lg font-bold text-text-primary">
                    {simulationSummary.baseScore.toFixed(1)}
                  </div>
                </div>
                <div className="text-emerald-400 font-bold text-lg">→</div>
                <div className="text-right">
                  <div className="text-[10px] uppercase text-emerald-400">Projected After P-Score</div>
                  <div className="text-xl font-bold text-emerald-400">
                    {simulationSummary.projectedOverallScore.toFixed(1)}{' '}
                    <span className="text-xs">
                      (+{simulationSummary.totalClusterGain.toFixed(1)} pts)
                    </span>
                  </div>
                </div>
                <span
                  className={`rounded border px-2.5 py-1 text-xs font-semibold ${getTierBadgeColor(
                    simulationSummary.projectedTier.level
                  )}`}
                >
                  {simulationSummary.projectedTier.shortLabel}
                </span>
              </div>
            </div>
          )}

          {/* Service Filter Pills */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
        </CardHeader>
        <CardContent className="p-5">
          {filteredRecommendations.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted">
              No optimization recommendations triggered for the current selection.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRecommendations.map((rec, idx) => {
                const recKey = rec.id || `${rec.serviceId}-${rec.ruleId}`;
                const isSimulated = simulatedRecIds.includes(recKey);

                return (
                  <div
                    key={`${recKey}-${idx}`}
                    className={`rounded-lg border p-4 flex flex-col justify-between space-y-3 transition-colors ${
                      isSimulated
                        ? 'border-emerald-500/60 bg-emerald-500/10'
                        : 'border-border/80 bg-surface-secondary/25 hover:border-brand-perf/40'
                    }`}
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
                      <span className="text-text-muted truncate max-w-[240px]" title={rec.triggerEvidence}>
                        Evidence: <strong className="text-text-secondary">{rec.triggerEvidence}</strong>
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-emerald-400 font-semibold">
                          {rec.expectedPScoreImprovement}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleSimulateRec(recKey)}
                          className={`rounded px-2.5 py-0.5 font-mono text-[11px] font-semibold border transition-colors ${
                            isSimulated
                              ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                              : 'border-brand-perf/50 bg-brand-perf/15 text-brand-perf hover:bg-brand-perf/25'
                          }`}
                        >
                          {isSimulated ? '✓ Simulated' : 'Simulate Fix'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
};
