import React, { useState, useEffect, useRef } from 'react';
import { VerdictPopup } from '../components/VerdictPopup';
import { ServiceDependencyGraph } from '../components/ServiceDependencyGraph';
import type { WebhookResult } from '../components/VerdictPopup';
import {
  Network,
  GitPullRequest,
  CheckCircle2,
  XCircle,
  Clock,
  Box,
  Calculator,
  Zap,
  Layers,
  TrendingUp,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ServerOff,
  Terminal
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

export const Phase2Dashboard = () => {
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [avgBlast, setAvgBlast] = useState(0);
  const [avgApiChanges, setAvgApiChanges] = useState(0);
  const [allPrs, setAllPrs] = useState<any[]>([]);
  const [relevantPrs, setRelevantPrs] = useState<any[]>([]);
  const [filterMode, setFilterMode] = useState<'contractOnly' | 'all'>('all');
  const [history, setHistory] = useState<any[]>([]);
  const [serviceExposure, setServiceExposure] = useState<any[]>([]);
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
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

  const fetchData = async () => {
    setRetrying(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/phase2/dashboard');
      if (response.ok) {
        const data = await response.json();
        setBackendConnected(true);
        setAvgBlast(data.averages.blastRadius);
        setAvgApiChanges(data.averages.apiChanges);
        setAllPrs(data.allPRs || data.recentPRs || []);
        setRelevantPrs(data.relevantPRs || []);
        setHistory(data.history || []);
        setServiceExposure(data.serviceExposure || []);
        setGraph(data.graph || { nodes: [], edges: [] });
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
      } else {
        setBackendConnected(false);
        setAllPrs([]);
        setRelevantPrs([]);
        setHistory([]);
        setServiceExposure([]);
        setGraph({ nodes: [], edges: [] });
      }
    } catch (error) {
      setBackendConnected(false);
      setAllPrs([]);
      setRelevantPrs([]);
      setHistory([]);
      setServiceExposure([]);
      setGraph({ nodes: [], edges: [] });
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
      await fetch('http://127.0.0.1:8000/api/live-logs/clear?phase=phase2', { method: 'POST' });
    } catch {
      // ignore
    }
    setLiveLogs(prev => ({ ...prev, logs: [], status: 'idle' }));
  };

  const [syncing, setSyncing] = useState(false);

  const handleSyncArchitecture = async () => {
    setSyncing(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/phase2/sync-architecture', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        alert(`Discovered ${data.dependencies_discovered} dependencies directly from ${data.repo}'s docker-compose.yml!`);
        fetchData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(false);
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Determine which PRs to display based on the filter
  // Blast-radius relevant = changes an API contract OR touches a service that has downstream consumers
  // (so PASSED runs on consumer-facing services are shown too, not just blocked ones)
  const contractPrs = allPrs.filter(p => p.hasContractChange || p.apiChanges > 0 || p.blastRadius > 0 || p.downstreamCount > 0);
  const displayedPRs = filterMode === 'contractOnly' ? contractPrs : allPrs;

  const totalPages = Math.max(1, Math.ceil(displayedPRs.length / itemsPerPage));
  const paginatedPRs = displayedPRs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterMode]);

  return (
    <div className="h-full bg-background text-text-primary p-4 lg:p-6 overflow-y-auto space-y-6">
      {showVerdict && liveLogs.result && (
        <VerdictPopup
          result={liveLogs.result}
          phase="phase2"
          prNumber={liveLogs.prNumber}
          sha={liveLogs.sha}
          onClose={() => setShowVerdict(false)}
        />
      )}
      {/* ── Header ── */}
      <div className="flex flex-wrap lg:flex-nowrap justify-between items-center bg-surface border border-border rounded-xl p-4 shadow-sm gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.15)]">
            <Network className="text-purple-400 w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-text-primary tracking-wide">Blast Radius Assessor</h1>
              <span className="text-purple-400 border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 rounded text-xs font-mono">
                Phase 2
              </span>
            </div>
            <p className="text-[11px] text-text-muted uppercase tracking-widest mt-1">
              OpenAPI AST Diffing • Service Dependency Impact • Guardrail Aborts
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm bg-surface-secondary/50 px-5 py-2 rounded-lg border border-border/50">
          <div className="flex gap-2 items-center">
            <span className="text-text-muted">Target:</span>
            <span className="flex items-center gap-1.5 font-mono text-text-primary">
              <Box className="w-3.5 h-3.5 text-purple-400" /> rp-core-product
            </span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-text-muted">Engine:</span>
            <span className="font-mono text-xs text-text-primary">oasdiff CLI</span>
          </div>
        </div>

        <div className="flex items-center gap-4 border-l border-border pl-4">
          <button
            onClick={handleSyncArchitecture}
            disabled={syncing || !backendConnected}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-xs font-semibold transition-colors disabled:opacity-50"
            title="Auto-scan repository docker-compose to discover dependencies"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Scanning Repo...' : 'Scan Architecture'}
          </button>

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

      {/* ── Backend Disconnected Notice ── */}
      {backendConnected === false && (
        <div className="bg-surface border border-rose-500/30 rounded-xl p-10 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <ServerOff className="w-7 h-7 text-rose-400" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-base font-bold text-text-primary">C-Score Backend Engine is Not Connected</h2>
            <p className="text-xs text-text-secondary leading-relaxed">
              Unable to reach the Phase 2 Blast Radius API at <code className="text-purple-400 font-mono">http://127.0.0.1:8000/api/phase2/dashboard</code>. Start the FastAPI backend server to view real-time OpenAPI contract diffs and service dependency blast radius data.
            </p>
          </div>
          <div>
            <button
              onClick={fetchData}
              disabled={retrying}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 border border-purple-500/30 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
              {retrying ? 'Connecting...' : 'Retry Backend Connection'}
            </button>
          </div>
        </div>
      )}

      {backendConnected && (
        <>
          {liveLogs.logs.length > 0 && (
            <div className="bg-surface border border-purple-500/40 rounded-xl p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-border/60">
                <div className="flex items-center gap-2.5">
                  <Terminal className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
                    Live Phase 2 Webhook Execution Stream
                  </span>
                  {liveLogs.prNumber && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30">
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
                        ? 'text-purple-400 font-semibold'
                        : 'text-text-primary'
                    }>
                      {entry.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Top KPI Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface border border-border rounded-xl p-4 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-2">Avg Blast Radius</div>
                <div className="text-3xl font-bold font-mono text-purple-400 tracking-wide">{avgBlast}</div>
              </div>
              <div className="text-xs text-text-muted mt-3">Downstream Consumers x API Changes</div>
              <div className="absolute -right-3 -bottom-3 opacity-10">
                <Zap className="w-20 h-20 text-purple-400" />
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-4 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-2">Breaking API Changes</div>
                <div className="text-3xl font-bold font-mono text-rose-400 mb-1">{avgApiChanges}</div>
              </div>
              <div className="text-xs text-text-muted mt-3">Average detected per Pull Request</div>
              <div className="absolute -right-3 -bottom-3 opacity-10">
                <AlertTriangle className="w-20 h-20 text-rose-400" />
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-2">Dependency Registry</div>
                <div className="text-3xl font-bold font-mono text-indigo-400">{graph.edges.length}</div>
              </div>
              <div className="text-xs text-text-muted mt-3">Active Inter-Service Dependencies</div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-2">Guardrail Enforcement</div>
                <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  Auto-Abort Trigger Active
                </div>
              </div>
              <div className="text-[11px] text-text-muted mt-3">Blocks PR if Blast Radius &gt; 0</div>
            </div>
          </div>

          {/* ── Visual Analytics (Phase 2 Charts) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Chart 1: Blast Radius & Breaking Changes Trend (8 cols) */}
            <div className="lg:col-span-8 bg-surface border border-border rounded-xl p-5 flex flex-col">
              <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-purple-400" /> Blast Radius &amp; API Impact History
                  </h3>
                  <p className="text-xs text-text-secondary mt-0.5">Tracking blast radius index and breaking changes across recent PR runs</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-purple-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-400" /> Blast Radius
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-400" /> Breaking Changes
                  </span>
                </div>
              </div>

              <div className="h-64 w-full">
                {history.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history}>
                      <defs>
                        <linearGradient id="blastGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0}/>
                        </linearGradient>
                        <linearGradient id="apiGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                      <XAxis dataKey="name" stroke="#737373" fontSize={10} interval={0} tickFormatter={(v: string) => v.split(" ")[0] + " " + v.split(" ")[1]} />
                      <YAxis stroke="#737373" fontSize={11} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px', fontSize: '12px' }}
                      />
                      <Area isAnimationActive={false} type="monotone" dataKey="blastRadius" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#blastGrad)" name="Blast Radius" />
                      <Area isAnimationActive={false} type="monotone" dataKey="apiChanges" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#apiGrad)" name="Breaking Changes" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-text-muted border border-dashed border-border rounded-lg">
                    No blast radius history recorded in backend yet.
                  </div>
                )}
              </div>
            </div>

            {/* Chart 2: Downstream Exposure by Service (4 cols) */}
            <div className="lg:col-span-4 bg-surface border border-border rounded-xl p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-1">
                  <Layers className="w-4 h-4 text-indigo-400" /> Downstream Exposure
                </h3>
                <p className="text-xs text-text-secondary mb-4">Consumer dependency counts per service provider</p>

                <div className="h-56 w-full">
                  {serviceExposure.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={serviceExposure} layout="vertical" margin={{ left: 10, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
                        <XAxis type="number" stroke="#737373" fontSize={11} allowDecimals={false} />
                        <YAxis type="category" dataKey="service" stroke="#a3a3a3" fontSize={11} width={90} />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px', fontSize: '12px' }}
                        />
                        <Bar dataKey="downstreamConsumers" fill="#6366f1" radius={[0, 4, 4, 0]} name="Downstream Callers">
                          {serviceExposure.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.downstreamConsumers > 1 ? '#f43f5e' : entry.downstreamConsumers === 1 ? '#a855f7' : '#10b981'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-text-muted border border-dashed border-border rounded-lg">
                      No service dependencies registered yet. Click &quot;Scan Architecture&quot; above.
                    </div>
                  )}
                </div>
              </div>
              <div className="text-[11px] text-text-muted border-t border-border/50 pt-2 text-center">
                Higher downstream callers = Greater blast risk upon breaking API changes
              </div>
            </div>

          </div>

          {/* ── PR Feed with Dedicated Phase 2 Filter ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left: PR Assessment Table (8 cols) */}
            <div className="lg:col-span-8 bg-surface border border-border rounded-xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-border/60 flex flex-wrap justify-between items-center bg-surface-secondary/30 gap-3">
                <div className="flex items-center gap-2">
                  <GitPullRequest className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-semibold text-text-primary">Recent Blast Radius Assessments</h3>
                </div>

                {/* User Filter Controls */}
                <div className="flex items-center gap-1.5 bg-background p-1 rounded-lg border border-border text-xs">
                  <button
                    onClick={() => setFilterMode('contractOnly')}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      filterMode === 'contractOnly' 
                        ? 'bg-purple-500/20 text-purple-400 font-semibold' 
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    API Contract Changes Only ({contractPrs.length})
                  </button>
                  <button
                    onClick={() => setFilterMode('all')}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      filterMode === 'all' 
                        ? 'bg-surface-secondary text-text-primary font-semibold' 
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    All PRs ({allPrs.length})
                  </button>
                </div>
              </div>

              <div className="divide-y divide-border/40">
                {paginatedPRs.map((pr: any, idx: number) => (
                  <div key={idx} className="p-4 hover:bg-surface-secondary/20 transition-colors flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-text-muted">{pr.id}</span>
                        <span className="font-medium text-sm text-text-primary">{pr.title}</span>
                        {pr.status === 'Passed' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1 font-mono">
                            <CheckCircle2 className="w-3 h-3" /> PASSED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1 font-mono">
                            <XCircle className="w-3 h-3" /> BLOCKED
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-text-secondary">
                        <div className="flex items-center gap-1">
                          <Box className="w-3 h-3" /> 
                          {pr.services ? pr.services.join(', ') : 'service'}
                        </div>
                        <div className="flex items-center gap-1 text-text-muted">
                          <Clock className="w-3 h-3" /> {pr.time}
                        </div>
                      </div>
                    </div>
                      
                    <div className="flex items-center gap-5 text-right">
                      <div>
                        <div className="text-[10px] text-text-muted uppercase mb-0.5">Downstream Callers</div>
                        <div className="font-mono text-indigo-400 text-xs font-semibold">{pr.downstreamCount || 0}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-text-muted uppercase mb-0.5">Breaking APIs</div>
                        <div className={`font-mono text-xs font-semibold ${pr.apiChanges > 0 ? 'text-rose-400' : 'text-text-muted'}`}>
                          {pr.apiChanges || 0}
                        </div>
                      </div>
                      <div className="bg-surface-secondary/60 px-3 py-1.5 rounded-lg border border-border/50 min-w-[5rem] text-center">
                        <div className="text-[9px] text-text-muted uppercase mb-0.5">Blast Radius</div>
                        <div className={`font-mono font-bold text-sm ${pr.blastRadius > 0 ? 'text-rose-400' : 'text-purple-400'}`}>
                          {pr.blastRadius || 0}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {displayedPRs.length === 0 && (
                  <div className="p-8 text-center text-text-muted text-xs">
                    No matching PR assessments found in the backend database. Open a Pull Request on <code>rp-core-product</code> with OpenAPI changes!
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

            {/* Right: Architectural Formulas & Registry Graph (4 cols) ── */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              
              {/* Formula Card */}
              <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-2xl rounded-full translate-x-8 -translate-y-8" />
                <div className="flex items-center gap-2 mb-3 relative z-10">
                  <Calculator className="w-4 h-4 text-purple-400" />
                  <div className="text-xs text-purple-400 uppercase tracking-wider font-bold">Calculation Logic</div>
                </div>
                
                <div className="relative z-10 mb-3 p-3.5 rounded-lg bg-black/50 border border-purple-500/20 font-mono space-y-2">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider">Systemic Blast Radius (BR):</div>
                  <div className="text-xs text-yellow-200 font-bold bg-surface/50 p-2 rounded border border-border/40">
                    BR = api_changes × downstream_consumers
                  </div>
                  <div className="text-[10px] text-text-muted pt-1 space-y-1">
                    <div>• <span className="text-text-secondary">api_changes</span> = Breaking diff count via oasdiff</div>
                    <div>• <span className="text-text-secondary">downstream_consumers</span> = Consuming services count</div>
                  </div>
                </div>

                <div className="relative z-10 mb-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] font-mono flex items-center justify-between">
                  <span className="text-rose-300 font-medium">BR &gt; 0 Hard Guardrail:</span>
                  <span className="text-rose-400 font-bold">PR Abort (C-Score = 98.0)</span>
                </div>
                
                <p className="text-xs text-text-secondary leading-relaxed relative z-10">
                  Phase 2 uses <code>oasdiff</code> to detect breaking contract modifications between the PR branch and <code>main</code>. It cross-references the Service Registry to assess systemic failure blast radius.
                </p>
              </div>

              {/* Graph Nodes Breakdown */}
              <div className="bg-surface border border-border rounded-xl p-5 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-text-muted uppercase tracking-wider font-semibold">Service Registry Links</div>
                  <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                    {graph.nodes.length} Nodes
                  </span>
                </div>
                
                <div>
                  {graph.edges.length > 0 ? (
                    <ServiceDependencyGraph nodes={graph.nodes} edges={graph.edges} />
                  ) : (
                    <div className="text-center text-xs text-text-muted py-4">
                      No dependencies registered in database.
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-border/50 text-[11px] text-text-muted flex items-center justify-between">
                  <span>Database Table:</span>
                  <code className="text-text-primary font-mono">service_registry</code>
                </div>
              </div>

            </div>

          </div>
        </>
      )}
    </div>
  );
};
