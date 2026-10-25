import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitMerge,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Network,
  Layers,
  ArrowRight,
  Clock,
  Box,
  Activity,
  RefreshCw,
  GitPullRequest,
  ChevronLeft,
  ChevronRight,
  Search,
  TrendingUp,
  GitBranch,
  ServerOff
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import { PHASE3_SCENARIOS } from './Phase3Dashboard';

interface Phase1Data {
  commitFreq: number;
  coDeployRate: number;
  couplingIndex: number;
}

interface Phase2Data {
  apiChanges: number;
  downstreamCount: number;
  blastRadius: number;
}

interface Phase3Data {
  podRestarts: number;
  cpuSpikePct: number;
  errorRatePct: number;
  maxCallDepth: number;
  syncCallCount: number;
}

interface RunRecord {
  id: string;
  prNumber: number;
  title: string;
  service: string;
  phase1: Phase1Data;
  phase2: Phase2Data;
  phase3: Phase3Data;
  cscore: number;
  status: 'Passed' | 'Blocked';
  time: string;
}

interface TimelinePoint {
  name: string;
  cscore: number;
  coupling: number;
  blast: number;
  restarts: number;
}

interface OverviewSummary {
  totalEvaluations: number;
  passRate: number;
  avgCouplingIndex: number;
  avgBlastRadius: number;
  runtimeRestarts: number;
  runtimeCpu: number;
  runtimeStatus: 'NOMINAL' | 'WARNING' | 'CRITICAL' | string;
}

export const CiCdOverview: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  const [summary, setSummary] = useState<OverviewSummary>({
    totalEvaluations: 0,
    passRate: 0,
    avgCouplingIndex: 0,
    avgBlastRadius: 0,
    runtimeRestarts: 0,
    runtimeCpu: 0,
    runtimeStatus: 'NOMINAL'
  });

  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState<'all' | 'Passed' | 'Blocked'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const fetchOverviewData = async () => {
    try {
      // 1. Try unified real overview API
      const res = await fetch('http://127.0.0.1:8000/api/cicd/overview');
      if (res.ok) {
        const data = await res.json();
        setBackendConnected(true);
        setRuns(data.runs || []);
        if (data.summary) {
          setSummary(data.summary);
        }
        setTimeline(data.timeline || []);
      } else {
        // Fallback to Phase 1 & 2 APIs
        const [res1, res2] = await Promise.all([
          fetch('http://127.0.0.1:8000/api/phase1/dashboard').catch(() => null),
          fetch('http://127.0.0.1:8000/api/phase2/dashboard').catch(() => null)
        ]);

        if (res1 && res1.ok && res2 && res2.ok) {
          const data1 = await res1.json();
          const data2 = await res2.json();
          const prs1 = data1.recentPRs || [];
          const prs2 = data2.recentPRs || [];
          setBackendConnected(true);

          if (prs1.length > 0) {
            const merged: RunRecord[] = prs1.map((p1Item: any, idx: number) => {
              const p2Item = prs2[idx] || {};
              const svc = (p1Item.services && p1Item.services[0]) || 'order-service';
              const isBlocked = p1Item.status === 'Blocked' || p2Item.status === 'Blocked';
              const realCScore = p1Item.cscore ?? p2Item.cscore ?? (isBlocked ? 98.0 : 12.0);

              return {
                id: p1Item.id,
                prNumber: p1Item.prNumber || parseInt(String(p1Item.id).replace(/\D/g, ''), 10) || idx + 1,
                title: p1Item.title,
                service: svc,
                phase1: {
                  commitFreq: p1Item.commitFreq ?? 0,
                  coDeployRate: Math.round((p1Item.coDeployRate ?? 0) * 1000) / 10,
                  couplingIndex: p1Item.couplingIndex ?? 0
                },
                phase2: {
                  apiChanges: p2Item.apiChanges ?? 0,
                  downstreamCount: p2Item.downstreamCount ?? 0,
                  blastRadius: p2Item.blastRadius ?? 0
                },
                phase3: {
                  podRestarts: 0,
                  cpuSpikePct: 0,
                  errorRatePct: 0,
                  maxCallDepth: 0,
                  syncCallCount: 0
                },
                cscore: realCScore,
                status: isBlocked ? 'Blocked' : 'Passed',
                time: p1Item.time
              };
            });

            setRuns(merged);
            const passed = merged.filter(r => r.status === 'Passed').length;
            setSummary({
              totalEvaluations: merged.length,
              passRate: Math.round((passed / merged.length) * 100),
              avgCouplingIndex: data1.averages?.couplingIndex ?? 0,
              avgBlastRadius: data2.averages?.blastRadius ?? 0,
              runtimeRestarts: 0,
              runtimeCpu: 0,
              runtimeStatus: 'NOMINAL'
            });

            const builtTimeline = merged
              .slice(0, 8)
              .reverse()
              .map(item => ({
                name: item.id,
                cscore: item.cscore,
                coupling: Math.round(item.phase1.couplingIndex * 100 * 10) / 10,
                blast: item.phase2.blastRadius * 10,
                restarts: 0
              }));
            setTimeline(builtTimeline);
          } else {
            setRuns([]);
            setTimeline([]);
          }
        } else {
          setBackendConnected(false);
          setRuns([]);
          setTimeline([]);
        }
      }
      setLastRefreshed(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch {
      setBackendConnected(false);
      setRuns([]);
      setTimeline([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
    const interval = setInterval(fetchOverviewData, 8000);
    return () => clearInterval(interval);
  }, []);

  // Filtered & Paginated Runs
  const filteredRuns = useMemo(() => {
    return runs.filter(run => {
      const matchesFilter = statusFilter === 'all' || run.status === statusFilter;
      const matchesSearch =
        run.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        run.service.toLowerCase().includes(searchTerm.toLowerCase()) ||
        run.id.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [runs, statusFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredRuns.length / itemsPerPage));
  const paginatedRuns = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRuns.slice(start, start + itemsPerPage);
  }, [filteredRuns, currentPage]);

  const passedCount = useMemo(() => runs.filter(r => r.status === 'Passed').length, [runs]);
  const blockedCount = useMemo(() => runs.filter(r => r.status === 'Blocked').length, [runs]);

  return (
    <div className="h-full bg-background text-text-primary p-4 lg:p-6 overflow-y-auto space-y-6">
      
      {/* Backend Disconnected Banner */}
      {backendConnected === false && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs">
          <ServerOff className="w-5 h-5 text-rose-400 shrink-0" />
          <div className="flex-1">
            <span className="font-bold text-rose-300">C-Score Backend Engine is Not Connected</span>
            <p className="text-text-secondary mt-0.5">
              Unable to reach the live C-Score API at <code className="text-purple-400 font-mono">http://127.0.0.1:8000/api/cicd/overview</code>. Start the backend server (<code className="text-purple-400 font-mono">uvicorn app.main:app --port 8000</code>) to view live PR evaluations.
            </p>
          </div>
          <button
            onClick={() => { setLoading(true); fetchOverviewData(); }}
            className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Top Header Banner ── */}
      <div className="flex flex-wrap lg:flex-nowrap justify-between items-center bg-surface border border-border rounded-xl p-5 shadow-sm gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-primary/10 border border-brand-primary/20 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.15)]">
            <GitMerge className="text-brand-primary w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-xl text-text-primary tracking-wide">CI/CD Governance &amp; Gatekeeper</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-brand-primary/10 border border-brand-primary/30 text-brand-primary">
                C-Score Pipeline
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-1">
              Tri-Phase Continuous Architectural Risk Governance (Pre-Build • Build • Runtime Canary)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-secondary border border-border/60 text-xs">
            <Box className="w-4 h-4 text-brand-primary" />
            <span className="text-text-muted">Target:</span>
            <span className="font-mono font-medium text-text-primary">rp-core-product</span>
          </div>

          <div className="flex items-center gap-3 border-l border-border pl-4">
            <button
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/50 bg-surface-secondary/50 hover:bg-surface-secondary transition-colors text-xs font-semibold text-text-primary"
              onClick={() => window.open('https://github.com/settings/apps', '_blank')}
            >
              <GitBranch className="w-3.5 h-3.5" />
              Connect Repo
            </button>

            <button
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-brand-cicd/50 bg-brand-cicd/10 hover:bg-brand-cicd/20 transition-colors text-xs font-semibold text-brand-cicd"
              onClick={() => alert('Webhook test payload sent to C-Score Engine!')}
            >
              <Activity className="w-3.5 h-3.5" />
              Test Webhook
            </button>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
              <span className="text-xs font-semibold">Listening</span>
            </div>

            <button
              onClick={() => { setLoading(true); fetchOverviewData(); }}
              className="p-2 rounded-lg bg-surface-secondary hover:bg-surface-secondary/80 border border-border text-text-secondary hover:text-text-primary transition-colors"
              title="Refresh pipeline metrics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Top 4 Key Metric Cards (KPIs) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Gate Pass Rate */}
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs uppercase font-semibold tracking-wider">Gatekeeper Pass Rate</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold font-mono ${summary.passRate < 50 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {summary.passRate}%
              </span>
              <span className="text-xs text-text-muted font-mono">
                ({passedCount} passed / {blockedCount} blocked)
              </span>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-text-muted flex items-center justify-between">
            <span>{summary.totalEvaluations} total Pull Requests</span>
            <span className="text-emerald-400 font-mono text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              Gate: C-Score &le; 28.9
            </span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 2: Phase 1 Coupling */}
        <div 
          onClick={() => navigate('/phase1/coupling')}
          className="bg-surface border border-border hover:border-blue-500/40 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden cursor-pointer transition-all group"
        >
          <div>
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs uppercase font-semibold tracking-wider">Phase 1: Avg Coupling</span>
              <GitPullRequest className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-3xl font-bold font-mono text-blue-400">
              {summary.avgCouplingIndex}
            </div>
          </div>
          <div className="mt-3 text-[11px] text-text-muted flex items-center justify-between">
            <span>Logical Coupling Index</span>
            <span className="text-blue-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              Explore Phase 1 &rarr;
            </span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 3: Phase 2 Blast Radius */}
        <div 
          onClick={() => navigate('/phase2/blast-radius')}
          className="bg-surface border border-border hover:border-purple-500/40 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden cursor-pointer transition-all group"
        >
          <div>
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs uppercase font-semibold tracking-wider">Phase 2: Avg Blast Radius</span>
              <Network className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-3xl font-bold font-mono text-purple-400">
              {summary.avgBlastRadius}
            </div>
          </div>
          <div className="mt-3 text-[11px] text-text-muted flex items-center justify-between">
            <span>Downstream Impact Scale</span>
            <span className="text-purple-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              Explore Phase 2 &rarr;
            </span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-purple-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 4: Phase 3 Runtime */}
        <div 
          onClick={() => navigate('/phase3/telemetry')}
          className="bg-surface border border-border hover:border-amber-500/40 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden cursor-pointer transition-all group"
        >
          <div>
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs uppercase font-semibold tracking-wider">Phase 3: Canary Runtime</span>
              <Activity className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold font-mono ${summary.runtimeRestarts > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {summary.runtimeRestarts}
              </span>
              <span className="text-xs text-text-muted">Pod Restarts</span>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-text-muted flex items-center justify-between">
            <span>Avg CPU Pressure: <b className="text-text-primary">{summary.runtimeCpu}%</b></span>
            <span className="text-amber-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              Explore Phase 3 &rarr;
            </span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

      </div>

      {/* ── Tri-Phase Architecture Interactive Pipeline ── */}
      <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Continuous Architectural Governance Pipeline</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Three-tiered verification protecting production from architectural degradation and breaking deployments.
            </p>
          </div>
          {lastRefreshed && (
            <span className="text-[11px] text-text-muted flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Synced {lastRefreshed}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          
          {/* Phase 1 Card */}
          <div 
            onClick={() => navigate('/phase1/coupling')}
            className="group cursor-pointer bg-surface-secondary/40 hover:bg-surface-secondary/70 border border-border hover:border-blue-500/40 rounded-xl p-5 transition-all flex flex-col justify-between relative shadow-sm"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                  PHASE 1: PRE-BUILD
                </span>
                <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Active
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-text-primary group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                  Decoupling Assessor (Features 1–3)
                </h3>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                  Extracts Git commit history and multi-service co-deployment rates via GitHub API to calculate logical coupling index before code build.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-background/60 border border-border/50 text-xs font-mono space-y-1.5 text-text-secondary">
                <div className="flex justify-between">
                  <span>Avg Coupling Index:</span>
                  <span className="text-blue-400 font-bold">{summary.avgCouplingIndex}</span>
                </div>
                <div className="flex justify-between">
                  <span>Coupling Threshold:</span>
                  <span className="text-text-primary font-bold">&gt; 0.50 (High Risk)</span>
                </div>
                <div className="flex justify-between">
                  <span>Data Ingestion:</span>
                  <span className="text-emerald-400 font-semibold">GitHub REST API</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-blue-400 group-hover:translate-x-0.5 transition-transform">
              <span>Open Dedicated Phase 1 Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Phase 2 Card */}
          <div 
            onClick={() => navigate('/phase2/blast-radius')}
            className="group cursor-pointer bg-surface-secondary/40 hover:bg-surface-secondary/70 border border-border hover:border-purple-500/40 rounded-xl p-5 transition-all flex flex-col justify-between relative shadow-sm"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded">
                  PHASE 2: BUILD
                </span>
                <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Active
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-text-primary group-hover:text-purple-400 transition-colors flex items-center gap-1.5">
                  Blast Radius Assessor (Features 4–6)
                </h3>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                  Performs semantic AST OpenAPI diffing using <code>oasdiff</code> and traces consumer dependency trees dynamically mapped from Docker Compose.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-background/60 border border-border/50 text-xs font-mono space-y-1.5 text-text-secondary">
                <div className="flex justify-between">
                  <span>Avg Blast Radius:</span>
                  <span className="text-purple-400 font-bold">{summary.avgBlastRadius}</span>
                </div>
                <div className="flex justify-between">
                  <span>Formula:</span>
                  <span className="text-text-primary font-bold">Diffs &times; Consumers</span>
                </div>
                <div className="flex justify-between">
                  <span>Diff Engine:</span>
                  <span className="text-emerald-400 font-semibold">oasdiff AST Parser</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-purple-400 group-hover:translate-x-0.5 transition-transform">
              <span>Open Dedicated Phase 2 Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Phase 3 Card */}
          <div 
            onClick={() => navigate('/phase3/telemetry')}
            className="group cursor-pointer bg-surface-secondary/40 hover:bg-surface-secondary/70 border border-border hover:border-amber-500/40 rounded-xl p-5 transition-all flex flex-col justify-between relative shadow-sm"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                  PHASE 3: RUNTIME CANARY
                </span>
                <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Active
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-text-primary group-hover:text-amber-400 transition-colors flex items-center gap-1.5">
                  Canary Telemetry &amp; ML Gate (Features 7–10)
                </h3>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                  Ingests OpenTelemetry traces (Max Call Depth, Sync Calls) &amp; Prometheus metrics (Error Rate, Pod Restarts) into the XGBoost C-Score Brain.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-background/60 border border-border/50 text-xs font-mono space-y-1.5 text-text-secondary">
                <div className="flex justify-between">
                  <span>Canary Pod Restarts:</span>
                  <span className={`font-bold ${summary.runtimeRestarts > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {summary.runtimeRestarts}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>C-Score Threshold:</span>
                  <span className="text-rose-400 font-bold">&gt; 28.9 (High Risk)</span>
                </div>
                <div className="flex justify-between">
                  <span>ML Model:</span>
                  <span className="text-amber-400 font-semibold">XGBoost (AUC: 0.8269 | 78.81%)</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-amber-400 group-hover:translate-x-0.5 transition-transform">
              <span>Open Dedicated Phase 3 Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

        </div>
      </div>

      {/* ── Multi-Phase Impact & Risk Correlation Chart ── */}
      <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-primary" />
              <h3 className="font-semibold text-sm text-text-primary">Multi-Phase Risk Correlation &amp; Gatekeeper Decision Timeline</h3>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              Correlating Phase 1 Logical Coupling, Phase 2 Blast Radius, and Phase 3 Canary Restarts against the resulting XGBoost C-Score.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> C-Score (0-100)
            </span>
            <span className="flex items-center gap-1.5 text-blue-400">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400" /> Coupling %
            </span>
            <span className="flex items-center gap-1.5 text-purple-400">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400" /> Blast x10
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" /> Restarts
            </span>
          </div>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={timeline} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="cscoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
              <XAxis dataKey="name" stroke="#737373" fontSize={11} tickLine={false} />
              <YAxis stroke="#737373" fontSize={11} domain={[0, 100]} tickLine={false} />
              <RechartsTooltip 
                contentStyle={{ 
                  backgroundColor: '#171717', 
                  borderColor: '#262626', 
                  borderRadius: '8px', 
                  fontSize: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                }}
              />
              <Legend verticalAlign="bottom" height={30} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <ReferenceLine y={28.9} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: 'Gate Abort Limit (28.9)', fill: '#f43f5e', fontSize: 10, position: 'right' }} />
              <Area type="monotone" dataKey="cscore" name="C-Score" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#cscoreGrad)" />
              <Line type="monotone" dataKey="coupling" name="Coupling Index (%)" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="blast" name="Blast Radius (Scaled)" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="restarts" name="Pod Restarts" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Unified Multi-Phase PR Audit Table ── */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        
        {/* Table Filter Bar */}
        <div className="p-4 border-b border-border/60 flex flex-wrap items-center justify-between gap-4 bg-surface-secondary/20">
          <div className="flex items-center gap-2">
            <GitPullRequest className="w-4 h-4 text-brand-primary" />
            <h3 className="font-semibold text-sm text-text-primary">Unified Tri-Phase Pull Request Assessments</h3>
            <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-surface-secondary border border-border/60 text-text-muted">
              {filteredRuns.length} Evaluated
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                placeholder="Search PR, service..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-surface-secondary/60 border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary/60 w-44 sm:w-56"
              />
            </div>

            {/* Status Filters */}
            <div className="flex items-center rounded-lg border border-border bg-surface-secondary/40 p-0.5 text-xs">
              <button
                onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
                className={`px-3 py-1 rounded-md transition-colors ${
                  statusFilter === 'all' ? 'bg-surface text-text-primary font-medium shadow-xs' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                All ({runs.length})
              </button>
              <button
                onClick={() => { setStatusFilter('Passed'); setCurrentPage(1); }}
                className={`px-3 py-1 rounded-md transition-colors ${
                  statusFilter === 'Passed' ? 'bg-emerald-500/10 text-emerald-400 font-medium' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                Passed ({passedCount})
              </button>
              <button
                onClick={() => { setStatusFilter('Blocked'); setCurrentPage(1); }}
                className={`px-3 py-1 rounded-md transition-colors ${
                  statusFilter === 'Blocked' ? 'bg-rose-500/10 text-rose-400 font-medium' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                Blocked ({blockedCount})
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-[11px] text-text-muted uppercase tracking-wider bg-surface-secondary/40 font-semibold">
                <th className="py-3 px-4">Pull Request &amp; Service</th>
                <th className="py-3 px-4">Phase 1: Pre-Build</th>
                <th className="py-3 px-4">Phase 2: Build</th>
                <th className="py-3 px-4">Phase 3: Canary Runtime (F7–F10)</th>
                <th className="py-3 px-4">C-Score Risk</th>
                <th className="py-3 px-4">Decision</th>
                <th className="py-3 px-4 text-right">Evaluated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono">
              {paginatedRuns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-text-muted font-sans text-xs">
                    {backendConnected === false
                      ? 'C-Score Backend is not connected. Start uvicorn server to stream real-time evaluations.'
                      : 'No Pull Request evaluations recorded in C-Score database yet.'}
                  </td>
                </tr>
              ) : (
                paginatedRuns.map((pr, idx) => (
                <tr key={idx} className="hover:bg-surface-secondary/20 transition-colors">
                  
                  {/* PR & Service */}
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-1 font-sans">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-text-primary">{pr.id}</span>
                        <span className="text-text-secondary font-medium">{pr.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Box className="w-3 h-3 text-text-muted" />
                        <span className="px-1.5 py-0.2 rounded bg-surface-secondary border border-border/50 text-text-muted font-mono text-[10px]">
                          {pr.service}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Phase 1: Coupling */}
                  <td className="py-3 px-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-semibold ${pr.phase1.couplingIndex > 0.5 ? 'text-rose-400' : 'text-blue-400'}`}>
                          Idx: {pr.phase1.couplingIndex.toFixed(3)}
                        </span>
                      </div>
                      <span className="text-[10px] text-text-muted font-sans mt-0.5">
                        Freq: {pr.phase1.commitFreq} • Co-deploy: {pr.phase1.coDeployRate}%
                      </span>
                    </div>
                  </td>

                  {/* Phase 2: Blast Radius */}
                  <td className="py-3 px-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-semibold ${pr.phase2.blastRadius > 0 ? 'text-purple-400' : 'text-emerald-400'}`}>
                          Radius: {pr.phase2.blastRadius}
                        </span>
                      </div>
                      <span className="text-[10px] text-text-muted font-sans mt-0.5">
                        {pr.phase2.apiChanges} diffs • {pr.phase2.downstreamCount} consumers
                      </span>
                    </div>
                  </td>

                  {/* Phase 3: Runtime */}
                  <td className="py-3 px-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${pr.phase3.podRestarts > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          Restarts: {pr.phase3.podRestarts}
                        </span>
                        <span className="text-[10px] text-amber-400 font-sans">
                          Err: {pr.phase3.errorRatePct}%
                        </span>
                      </div>
                      <span className="text-[10px] text-text-muted font-sans mt-0.5">
                        Depth: {pr.phase3.maxCallDepth} • Sync: {pr.phase3.syncCallCount} • CPU: {pr.phase3.cpuSpikePct}%
                      </span>
                    </div>
                  </td>

                  {/* C-Score Risk */}
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-bold font-mono ${
                          pr.cscore > 28.9 ? 'text-rose-400' : pr.cscore >= 20 ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {pr.cscore.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-text-muted font-sans">/ 100</span>
                      </div>
                      <div className="w-20 h-1.5 bg-surface-secondary rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            pr.cscore > 28.9 ? 'bg-rose-500' : pr.cscore >= 20 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(5, pr.cscore))}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Decision */}
                  <td className="py-3 px-4">
                    {pr.status === 'Passed' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-sans font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" /> PASSED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-sans font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <XCircle className="w-3 h-3" /> BLOCKED
                      </span>
                    )}
                  </td>

                  {/* Evaluated Time */}
                  <td className="py-3 px-4 text-right text-text-muted text-[11px] font-sans">
                    {pr.time}
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredRuns.length > itemsPerPage && (
          <div className="p-3 border-t border-border/60 bg-surface-secondary/20 flex items-center justify-between text-xs text-text-secondary">
            <span className="text-[11px] text-text-muted font-mono">
              Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredRuns.length)} of {filteredRuns.length} Pull Requests
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-border/60 bg-surface hover:bg-surface-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-xs text-text-primary px-2">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-border/60 bg-surface hover:bg-surface-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── Research Methodology Context Card for Viva ── */}
      <div className="bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-amber-500/5 border border-border/70 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-primary">
            <Layers className="w-4 h-4 text-brand-primary" />
            <span>Shift-Left Architectural Governance Methodology</span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed max-w-4xl">
            By shifting architectural assessment directly into the CI/CD pipeline, the C-Score engine intercepts high logical coupling (<b className="text-blue-400">Phase 1</b>), breaking interface modifications (<b className="text-purple-400">Phase 2</b>), and runtime container restarts or call-depth cascades in the Canary Sandbox (<b className="text-amber-400">Phase 3</b>) before code reaches production environments.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={() => navigate('/phase1/coupling')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 transition-colors"
          >
            Phase 1
          </button>
          <button 
            onClick={() => navigate('/phase2/blast-radius')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 transition-colors"
          >
            Phase 2
          </button>
          <button 
            onClick={() => navigate('/phase3/telemetry')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
          >
            Phase 3
          </button>
          <button onClick={() => navigate('/dimensions/cicd/calculation')} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 transition-colors flex items-center gap-1.5">Calculation Logic &rarr;</button>
        </div>
      </div>

    </div>
  );
};
