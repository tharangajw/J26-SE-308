import { useState, useEffect, useRef } from 'react';
import { VerdictPopup } from '../components/VerdictPopup';
import type { WebhookResult } from '../components/VerdictPopup';
import {
  GitMerge,
  GitPullRequest,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Box,
  Layers,
  Calculator,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ServerOff,
  Terminal
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from 'recharts';

interface PRItem {
  id: string;
  title: string;
  services: string[];
  commitFreq: number;
  coDeployRate: number;
  couplingIndex: number;
  status: string;
  time: string;
}

interface HistoryItem {
  name: string;
  couplingIndex: number;
  commitFreq: number;
  coDeploy: number;
}

interface ServiceDistItem {
  name: string;
  couplingIndex: number;
  color: string;
}

export const Phase1Dashboard = () => {
  const [currentCoupling, setCurrentCoupling] = useState<number>(0);
  const [currentCommitFreq, setCurrentCommitFreq] = useState<number>(0);
  const [currentCoDeploy, setCurrentCoDeploy] = useState<number>(0);
  const [prs, setPrs] = useState<PRItem[]>([]);
  const [filterMode, setFilterMode] = useState<'coupledOnly' | 'all'>('coupledOnly');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [services, setServices] = useState<ServiceDistItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [liveLogs, setLiveLogs] = useState<{
    sessionId: number;
    prNumber: number | null;
    repo: string | null;
    sha: string | null;
    status: string;
    result?: WebhookResult | null;
    logs: { time: string; level: string; message: string }[];
  }>({ sessionId: 0, prNumber: null, repo: null, sha: null, status: 'idle', logs: [] });
  const [showVerdict, setShowVerdict] = useState(false);
  const lastSeenSession = useRef<number | null>(null);
  const itemsPerPage = 5;

  const displayedPRs = filterMode === 'coupledOnly'
    ? prs.filter(p => (p.coDeployRate > 0) || (p.services && p.services.length > 1) || (p.couplingIndex > 0.4))
    : prs;

  const totalPages = Math.max(1, Math.ceil(displayedPRs.length / itemsPerPage));
  const paginatedPRs = displayedPRs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterMode]);

  const fetchData = async () => {
    setRetrying(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/phase1/dashboard');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setBackendConnected(true);
      setCurrentCoupling(data.averages?.couplingIndex ?? 0);
      setCurrentCommitFreq(data.averages?.commitFreq ?? 0);
      setCurrentCoDeploy(data.averages?.coDeployRate ?? 0);
      setPrs(data.recentPRs || []);
      setHistory(data.history || []);
      setServices(data.serviceDist || []);
      if (data.liveLogs) {
        setLiveLogs(data.liveLogs);
        const ll = data.liveLogs;
        if (lastSeenSession.current === null) {
          // First load: don't pop up for an already-finished old session
          lastSeenSession.current = ll.status === 'completed' ? ll.sessionId : -1;
        }
        if (ll.status === 'completed' && ll.result && ll.sessionId !== lastSeenSession.current) {
          lastSeenSession.current = ll.sessionId;
          setShowVerdict(true);
        }
      }
    } catch {
      setBackendConnected(false);
      setCurrentCoupling(0);
      setCurrentCommitFreq(0);
      setCurrentCoDeploy(0);
      setPrs([]);
      setHistory([]);
      setServices([]);
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleDismissLogs = async () => {
    try {
      await fetch('http://127.0.0.1:8000/api/live-logs/clear?phase=phase1', { method: 'POST' });
    } catch {
      // ignore
    }
    setLiveLogs(prev => ({ ...prev, logs: [], status: 'idle' }));
  };

  const highestCoupledService = [...services].sort((a, b) => b.couplingIndex - a.couplingIndex)[0];
  const lowestCoupledService = [...services].sort((a, b) => a.couplingIndex - b.couplingIndex)[0];

  return (
    <div className="h-full bg-background text-text-primary p-4 lg:p-6 overflow-y-auto">
      {showVerdict && liveLogs.result && (
        <VerdictPopup
          result={liveLogs.result}
          phase="phase1"
          prNumber={liveLogs.prNumber}
          sha={liveLogs.sha}
          onClose={() => setShowVerdict(false)}
        />
      )}
      {/* ── Header ── */}
      <div className="flex flex-wrap lg:flex-nowrap justify-between items-center bg-surface border border-border rounded-xl p-4 shadow-sm mb-6 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-cicd/10 border border-brand-cicd/20 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.15)]">
            <GitMerge className="text-brand-cicd w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-text-primary tracking-wide">
              Coupling Assessor <span className="text-brand-cicd border border-brand-cicd/30 bg-brand-cicd/10 px-2 py-0.5 rounded text-xs ml-2 font-mono">Phase 1</span>
            </h1>
            <p className="text-[10px] text-text-muted uppercase tracking-widest mt-1">
              Pre-Build Static Analysis &amp; Repository Mining
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm bg-surface-secondary/50 px-6 py-2 rounded-lg border border-border/50">
          <div className="flex gap-2 items-center">
            <span className="text-text-muted">Target:</span>
            <span className="flex items-center gap-1.5 font-mono text-text-primary"><Box className="w-3.5 h-3.5 text-brand-cicd" /> rp-core-product</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-text-muted">Window:</span>
            <span className="flex items-center gap-1.5 font-mono text-text-primary"><Clock className="w-3.5 h-3.5 text-text-muted" /> 30 Days</span>
          </div>
        </div>

        <div className="flex items-center gap-4 border-l border-border pl-4">
          {backendConnected ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
              <span className="text-xs font-semibold">Listening</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-400">
              <div className="w-2 h-2 rounded-full bg-rose-400" />
              <span className="text-xs font-semibold">Disconnected</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Backend Disconnected State ── */}
      {backendConnected === false && (
        <div className="bg-rose-500/5 border border-rose-500/30 rounded-xl p-8 mb-6 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <ServerOff className="w-6 h-6 text-rose-400" />
          </div>
          <div className="space-y-1 max-w-lg">
            <h2 className="text-base font-bold text-text-primary">
              C-Score Backend Engine is Not Connected
            </h2>
            <p className="text-xs text-text-secondary leading-relaxed">
              Unable to reach <code className="text-rose-400 font-mono">http://127.0.0.1:8000/api/phase1/dashboard</code>. Phase 1 displays strictly live backend data. Please start the FastAPI server (<code className="font-mono text-text-primary">uvicorn app.main:app --reload</code>) to view repository coupling metrics.
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={retrying}
            className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? 'Checking Connection...' : 'Retry Backend Connection'}
          </button>
        </div>
      )}

      {/* ── Live Backend Data Content ── */}
      {backendConnected && (
        <>
          {liveLogs.logs.length > 0 && (
            <div className="bg-surface border border-brand-cicd/40 rounded-xl p-4 mb-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-border/60">
                <div className="flex items-center gap-2.5">
                  <Terminal className="w-4 h-4 text-brand-cicd" />
                  <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
                    Live Phase 1 Webhook Execution Stream
                  </span>
                  {liveLogs.prNumber && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-brand-cicd/10 text-brand-cicd border border-brand-cicd/30">
                      PR #{liveLogs.prNumber} ({liveLogs.sha})
                    </span>
                  )}
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border flex items-center gap-1.5 ${
                    liveLogs.status === 'running'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${liveLogs.status === 'running' ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
                    {liveLogs.status === 'running' ? 'ANALYZING' : 'COMPLETED'}
                  </span>
                </div>
                <button
                  onClick={handleDismissLogs}
                  className="text-[11px] font-mono text-text-muted hover:text-text-primary px-2.5 py-1 rounded bg-surface-secondary/60 hover:bg-surface-secondary border border-border/50 transition-colors"
                >
                  Dismiss Logs
                </button>
              </div>
              <div className="bg-black/60 rounded-lg p-3 border border-border/50 font-mono text-xs space-y-1.5 max-h-44 overflow-y-auto">
                {liveLogs.logs.map((entry, i) => (
                  <div key={i} className="flex items-start gap-2.5 leading-relaxed">
                    <span className="text-text-muted shrink-0">[{entry.time}]</span>
                    <span className={
                      entry.level === 'error'
                        ? 'text-rose-400 font-semibold'
                        : entry.level === 'warn'
                        ? 'text-amber-400'
                        : entry.level === 'success'
                        ? 'text-emerald-400 font-semibold'
                        : entry.level === 'webhook'
                        ? 'text-brand-cicd font-semibold'
                        : 'text-text-primary'
                    }>
                      {entry.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* ── Left Main (8 cols) ── */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Top 3 KPI cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Coupling Index */}
              <div className="bg-surface border border-border rounded-xl p-5 relative overflow-hidden flex flex-col">
                <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-2">Global Coupling Index</div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-3xl font-bold text-brand-cicd tracking-wide">{currentCoupling.toFixed(3)}</div>
                </div>
                <div className="h-12 w-full -ml-2 mb-2 mt-auto">
                  {history.length > 0 && (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={history.slice(-4)}>
                        <Line type="monotone" dataKey="couplingIndex" stroke="#3B82F6" strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="text-xs bg-surface-secondary/80 px-3 py-1.5 rounded-full border border-border/50 text-text-secondary font-medium inline-flex self-start">
                  Target: &lt; 0.500
                </div>
                <div className="absolute -right-4 -bottom-4 opacity-5">
                  <Layers className="w-32 h-32 text-brand-cicd" />
                </div>
              </div>

              {/* Commit Frequency */}
              <div className="bg-surface border border-border rounded-xl p-5 flex flex-col">
                <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-2">Avg Commit Frequency</div>
                <div className="text-3xl font-bold text-indigo-400 mb-1">{currentCommitFreq}</div>
                <div className="text-xs text-text-muted mb-4">commits / service (30d)</div>
                
                <div className="mt-auto pt-4 border-t border-border/50">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-text-secondary">Risk Level</span>
                    <span className="text-yellow-400 font-medium">{currentCommitFreq > 15 ? 'High' : currentCommitFreq > 8 ? 'Moderate' : 'Low'}</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${Math.min(100, (currentCommitFreq / 24) * 100)}%` }} />
                  </div>
                </div>
              </div>

              {/* Co-Deploy Rate */}
              <div className="bg-surface border border-border rounded-xl p-5 flex flex-col">
                <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-2">Co-Deploy Rate</div>
                <div className="text-3xl font-bold text-emerald-400 mb-1">{currentCoDeploy}%</div>
                <div className="text-xs text-text-muted mb-4">multi-service commits</div>
                
                <div className="mt-auto pt-4 border-t border-border/50">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-text-secondary">Risk Level</span>
                    <span className={currentCoDeploy > 50 ? 'text-rose-400 font-medium' : 'text-emerald-400 font-medium'}>
                      {currentCoDeploy > 50 ? 'High Coupling' : 'Healthy'}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-secondary rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${currentCoDeploy > 50 ? 'bg-rose-400' : 'bg-emerald-400'}`} style={{ width: `${Math.min(100, currentCoDeploy)}%` }} />
                  </div>
                </div>
              </div>

            </div>

            {/* Metric Trends Chart */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">Extraction Metrics Over Time</div>
                  <div className="text-xs text-text-muted mt-0.5">Tracking Commit Frequency and Co-Deploy patterns from Backend DB</div>
                </div>
                <div className="flex gap-4 text-[10px] text-text-secondary">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-indigo-400" /> Commit Freq</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-400" /> Co-Deploy Rate</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-brand-cicd" /> Coupling Index</span>
                </div>
              </div>
              
              <div className="h-64 w-full">
                {history.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#252C35" vertical={false} />
                      <XAxis dataKey="name" stroke="#5E6875" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="left" stroke="#5E6875" fontSize={10} tickLine={false} axisLine={false} width={30} />
                      <YAxis yAxisId="right" orientation="right" stroke="#5E6875" fontSize={10} tickLine={false} axisLine={false} width={30} />
                      <RechartsTooltip contentStyle={{ background: '#1a1f27', border: '1px solid #2d3748', borderRadius: 8, fontSize: 11 }} />
                      <Line yAxisId="left" type="monotone" dataKey="commitFreq" stroke="#818cf8" strokeWidth={2} dot={{ r: 4 }} name="Commits (30d)" />
                      <Line yAxisId="right" type="monotone" dataKey="coDeploy" stroke="#34d399" strokeWidth={2} dot={{ r: 4 }} name="Co-Deploy" />
                      <Line yAxisId="right" type="monotone" dataKey="couplingIndex" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4 }} name="Coupling Idx" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-text-muted border border-dashed border-border/50 rounded-lg">
                    No historical PR runs recorded in backend database yet.
                  </div>
                )}
              </div>
            </div>
            
            {/* PR Webhook Feed */}
            <div className="bg-surface border border-border rounded-xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-border/50 flex flex-wrap justify-between items-center bg-surface-secondary/30 gap-3">
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold flex items-center gap-2">
                    <GitPullRequest className="w-4 h-4 text-brand-cicd" /> Recent PR Assessments
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-background p-1 rounded-lg border border-border text-xs">
                  <button
                    onClick={() => setFilterMode('coupledOnly')}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      filterMode === 'coupledOnly' 
                        ? 'bg-brand-cicd/20 text-brand-cicd font-semibold' 
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Coupled PRs Only
                  </button>
                  <button
                    onClick={() => setFilterMode('all')}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      filterMode === 'all' 
                        ? 'bg-surface-secondary text-text-primary font-semibold' 
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    All PRs ({prs.length})
                  </button>
                </div>
              </div>
              <div className="divide-y divide-border/50">
                {paginatedPRs.map((pr, idx) => (
                  <div key={idx} className="p-5 hover:bg-surface-secondary/20 transition-colors flex items-center justify-between">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-text-muted">{pr.id}</span>
                        <span className="font-medium text-sm text-text-primary">{pr.title}</span>
                        {pr.status === 'Passed' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> PASSED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> BLOCKED
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-text-secondary">
                        <div className="flex items-center gap-1">
                          <Box className="w-3 h-3" /> 
                          {pr.services.join(', ')}
                        </div>
                        <div className="flex items-center gap-1 text-text-muted">
                          <Clock className="w-3 h-3" /> {pr.time}
                        </div>
                      </div>
                    </div>
                      
                    <div className="flex items-center gap-6 text-right">
                      <div className="hidden sm:block">
                        <div className="text-[10px] text-text-muted uppercase mb-1">Commit Freq</div>
                        <div className="font-mono text-indigo-400">{pr.commitFreq}</div>
                      </div>
                      <div className="hidden sm:block">
                        <div className="text-[10px] text-text-muted uppercase mb-1">Co-Deploy</div>
                        <div className="font-mono text-emerald-400">{(pr.coDeployRate * 100).toFixed(0)}%</div>
                      </div>
                      <div className="bg-surface-secondary/50 p-2 rounded border border-border/50 w-24">
                        <div className="text-[10px] text-text-muted uppercase mb-1 text-center">Coupling Idx</div>
                        <div className={`font-mono font-bold text-center ${pr.couplingIndex > 0.5 ? 'text-rose-400' : 'text-text-primary'}`}>
                          {pr.couplingIndex.toFixed(3)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {displayedPRs.length === 0 && (
                  <div className="p-8 text-center text-text-muted text-xs">
                    No matching PR assessments found in the backend database.
                  </div>
                )}
              </div>

              {/* Pagination Controls */}
              {displayedPRs.length > itemsPerPage && (
                <div className="p-3 border-t border-border/50 bg-surface-secondary/20 flex items-center justify-between text-xs text-text-secondary">
                  <span className="text-[11px] text-text-muted font-mono">
                    Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, displayedPRs.length)} of {displayedPRs.length} PRs
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

          </div>

          {/* ── Right Sidebar (4 cols) ── */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Formula Card */}
            <div className="bg-brand-cicd/5 border border-brand-cicd/20 rounded-xl p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-cicd/10 blur-2xl rounded-full translate-x-8 -translate-y-8" />
              <div className="flex items-center gap-2 mb-4 relative z-10">
                <Calculator className="w-5 h-5 text-brand-cicd" />
                <div className="text-[10px] text-brand-cicd uppercase tracking-wider font-bold">Calculation Logic</div>
              </div>
              
              <div className="relative z-10 mb-3 p-3.5 rounded-lg bg-black/50 border border-brand-cicd/20 font-mono space-y-2">
                <div className="text-[10px] text-text-muted uppercase tracking-wider">Logical Coupling Index (CI):</div>
                <div className="text-xs text-yellow-200 font-bold bg-surface/50 p-2 rounded border border-border/40">
                  CI = (0.5 × norm_freq) + (0.5 × co_deploy_rate)
                </div>
                <div className="text-[10px] text-text-muted pt-1 space-y-1">
                  <div>• <span className="text-text-secondary">norm_freq</span> = min(commit_freq / 24.0, 1.0)</div>
                  <div>• <span className="text-text-secondary">co_deploy_rate</span> = multi_service_commits / total_commits</div>
                </div>
              </div>

              <div className="relative z-10 mb-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] font-mono flex items-center justify-between">
                <span className="text-amber-300 font-medium">CI &gt; 0.50 Threshold:</span>
                <span className="text-amber-400 font-bold">Soft Advisory Warning</span>
              </div>
              
              <p className="text-xs text-text-secondary leading-relaxed relative z-10 mb-4">
                Phase 1 static analysis extracts metrics directly from the GitHub API. High coupling index indicates architectural friction and deployment entanglement.
              </p>
            </div>

            {/* Service Coupling Distribution */}
            <div className="bg-surface border border-border rounded-xl p-5 flex flex-col">
              <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-4">Service Coupling Distribution</div>
              
              {services.length > 0 ? (
                <div className="space-y-4">
                  {[...services].sort((a, b) => b.couplingIndex - a.couplingIndex).map((s, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-mono text-text-primary">{s.name}</span>
                        <span className="font-mono" style={{ color: s.color }}>{s.couplingIndex.toFixed(3)}</span>
                      </div>
                      <div className="h-2 w-full bg-surface-secondary rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, s.couplingIndex * 100)}%`, background: s.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-text-muted py-4 text-center">
                  No service coupling records found in backend.
                </div>
              )}
            </div>
            
            {/* Dynamic Architectural Insights from Backend Data */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-4">Architectural Insights</div>
              {services.length > 0 ? (
                <div className="space-y-3">
                  {highestCoupledService && highestCoupledService.couplingIndex > 0.5 && (
                    <div className="flex gap-3 items-start border border-rose-500/20 bg-rose-500/5 p-3 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <div className="text-xs font-bold text-text-primary mb-1">High Entanglement Detected</div>
                        <div className="text-[10px] text-text-secondary">
                          <span className="font-mono text-rose-400">{highestCoupledService.name}</span> has a Coupling Index of <span className="font-mono text-rose-400">{highestCoupledService.couplingIndex.toFixed(3)}</span> (&gt; 0.500 threshold).
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {lowestCoupledService && (
                    <div className="flex gap-3 items-start border border-green-500/20 bg-green-500/5 p-3 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <div className="text-xs font-bold text-text-primary mb-1">Lowest Coupled Service</div>
                        <div className="text-[10px] text-text-secondary">
                          <span className="font-mono text-green-400">{lowestCoupledService.name}</span> maintains a Coupling Index of <span className="font-mono text-green-400">{lowestCoupledService.couplingIndex.toFixed(3)}</span>.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-text-muted py-2 text-center">
                  Evaluate a Pull Request to generate live insights.
                </div>
              )}
            </div>

          </div>
        </div>
        </>
      )}
    </div>
  );
};
