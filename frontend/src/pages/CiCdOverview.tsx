import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitMerge,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Network,
  Cpu,
  Layers,
  ArrowRight,
  ExternalLink,
  Clock,
  Box,
  Activity,
  Zap,
  Server,
  RefreshCw,
  GitPullRequest
} from 'lucide-react';

interface PRRecord {
  id: string;
  title: string;
  services: string[];
  commitFreq?: number;
  coDeployRate?: number;
  couplingIndex?: number;
  apiChanges?: number;
  downstreamCount?: number;
  blastRadius?: number;
  status: 'Passed' | 'Blocked';
  time: string;
  cscore?: number;
}

export const CiCdOverview: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  
  // Aggregated Stats
  const [phase1Avg, setPhase1Avg] = useState({ couplingIndex: 0, commitFreq: 0, coDeployRate: 0 });
  const [phase2Avg, setPhase2Avg] = useState({ blastRadius: 0, apiChanges: 0 });
  const [recentPRs, setRecentPRs] = useState<PRRecord[]>([]);
  const [passRate, setPassRate] = useState<number>(100);

  const fetchDashboardData = async () => {
    try {
      const [res1, res2] = await Promise.all([
        fetch('http://127.0.0.1:8000/api/phase1/dashboard').catch(() => null),
        fetch('http://127.0.0.1:8000/api/phase2/dashboard').catch(() => null),
      ]);

      let prs1: PRRecord[] = [];
      let prs2: PRRecord[] = [];

      if (res1 && res1.ok) {
        const data1 = await res1.json();
        if (data1.averages) setPhase1Avg(data1.averages);
        prs1 = data1.recentPRs || [];
      }

      if (res2 && res2.ok) {
        const data2 = await res2.json();
        if (data2.averages) setPhase2Avg(data2.averages);
        prs2 = data2.recentPRs || [];
      }

      // Merge PR runs by PR id or index
      const combinedMap = new Map<string, PRRecord>();

      prs1.forEach(p => {
        combinedMap.set(p.id, { ...p });
      });

      prs2.forEach(p => {
        if (combinedMap.has(p.id)) {
          const existing = combinedMap.get(p.id)!;
          combinedMap.set(p.id, {
            ...existing,
            apiChanges: p.apiChanges,
            downstreamCount: p.downstreamCount,
            blastRadius: p.blastRadius,
            status: p.status === 'Blocked' || existing.status === 'Blocked' ? 'Blocked' : 'Passed'
          });
        } else {
          combinedMap.set(p.id, { ...p });
        }
      });

      const mergedPRs = Array.from(combinedMap.values());
      setRecentPRs(mergedPRs);

      if (mergedPRs.length > 0) {
        const passedCount = mergedPRs.filter(p => p.status === 'Passed').length;
        setPassRate(Math.round((passedCount / mergedPRs.length) * 100));
      }

      setLastRefreshed(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error('Error loading CI/CD Overview data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full bg-background text-text-primary p-4 lg:p-6 overflow-y-auto space-y-6">
      
      {/* ── Top Header Banner ── */}
      <div className="flex flex-wrap lg:flex-nowrap justify-between items-center bg-surface border border-border rounded-xl p-5 shadow-sm gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-primary/10 border border-brand-primary/20 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.15)]">
            <GitMerge className="text-brand-primary w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-xl text-text-primary tracking-wide">CI/CD Governance & Gatekeeper</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-brand-primary/10 border border-brand-primary/30 text-brand-primary">
                C-Score Pipeline
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-1">
              Tri-Phase Continuous Architectural Risk Governance (Pre-Build • Build • Runtime)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-secondary border border-border/60 text-xs">
            <Box className="w-4 h-4 text-brand-primary" />
            <span className="text-text-muted">Target:</span>
            <span className="font-mono font-medium text-text-primary">rp-core-product</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            GitHub App Live
          </div>

          <button
            onClick={() => { setLoading(true); fetchDashboardData(); }}
            className="p-2 rounded-lg bg-surface-secondary hover:bg-surface-secondary/80 border border-border text-text-secondary hover:text-text-primary transition-colors"
            title="Refresh pipeline metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── KPI Overview Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Gate Pass Rate */}
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs uppercase font-semibold tracking-wider">Gatekeeper Pass Rate</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-400">
              {passRate}%
            </div>
          </div>
          <div className="mt-3 text-[11px] text-text-muted">
            {recentPRs.length} total Pull Requests evaluated
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 2: Phase 1 Coupling */}
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs uppercase font-semibold tracking-wider">Avg Coupling Index</span>
              <GitPullRequest className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-3xl font-bold font-mono text-blue-400">
              {phase1Avg.couplingIndex}
            </div>
          </div>
          <div className="mt-3 text-[11px] text-text-muted flex items-center justify-between">
            <span>Co-Deploy Rate: <b className="text-text-primary">{phase1Avg.coDeployRate}%</b></span>
            <span className="text-blue-400">Phase 1</span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 3: Phase 2 Blast Radius */}
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs uppercase font-semibold tracking-wider">Avg Blast Radius</span>
              <Network className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-3xl font-bold font-mono text-purple-400">
              {phase2Avg.blastRadius}
            </div>
          </div>
          <div className="mt-3 text-[11px] text-text-muted flex items-center justify-between">
            <span>Breaking Changes: <b className="text-text-primary">{phase2Avg.apiChanges}</b></span>
            <span className="text-purple-400">Phase 2</span>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-purple-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 4: AI Decision Engine */}
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between text-text-muted mb-2">
              <span className="text-xs uppercase font-semibold tracking-wider">AI Inference Engine</span>
              <Cpu className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <span>XGBoost</span>
              <span className="text-xs font-mono font-normal text-amber-400 border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 rounded">
                Threshold: 60
              </span>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-emerald-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Guardrails & Overrides Active
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
            className="group cursor-pointer bg-surface-secondary/40 hover:bg-surface-secondary/70 border border-border hover:border-blue-500/40 rounded-xl p-5 transition-all flex flex-col justify-between relative"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                  PHASE 1
                </span>
                <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Online
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-text-primary group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                  Pre-Build: Decoupling Assessor
                </h3>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                  Extracts Git commit frequencies and multi-service co-deployment rates via GitHub API to calculate logical coupling.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-background/60 border border-border/50 text-xs font-mono space-y-1 text-text-secondary">
                <div className="flex justify-between">
                  <span>Commit Freq (30d):</span>
                  <span className="text-text-primary font-bold">{phase1Avg.commitFreq}</span>
                </div>
                <div className="flex justify-between">
                  <span>Co-Deploy Rate:</span>
                  <span className="text-text-primary font-bold">{phase1Avg.coDeployRate}%</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-blue-400 group-hover:translate-x-0.5 transition-transform">
              <span>Inspect Phase 1 Assessor</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Phase 2 Card */}
          <div 
            onClick={() => navigate('/phase2/blast-radius')}
            className="group cursor-pointer bg-surface-secondary/40 hover:bg-surface-secondary/70 border border-border hover:border-purple-500/40 rounded-xl p-5 transition-all flex flex-col justify-between relative"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded">
                  PHASE 2
                </span>
                <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Online
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-text-primary group-hover:text-purple-400 transition-colors flex items-center gap-1.5">
                  Build: Blast Radius Assessor
                </h3>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                  Performs AST diffing with <code>oasdiff</code> on OpenAPI specs and maps impact against downstream consumer services.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-background/60 border border-border/50 text-xs font-mono space-y-1 text-text-secondary">
                <div className="flex justify-between">
                  <span>Breaking Changes:</span>
                  <span className="text-text-primary font-bold">{phase2Avg.apiChanges}</span>
                </div>
                <div className="flex justify-between">
                  <span>Calculated Blast:</span>
                  <span className="text-text-primary font-bold">{phase2Avg.blastRadius}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-purple-400 group-hover:translate-x-0.5 transition-transform">
              <span>Inspect Phase 2 Assessor</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Phase 3 Card */}
          <div className="bg-surface-secondary/40 border border-border rounded-xl p-5 flex flex-col justify-between relative">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                  PHASE 3
                </span>
                <span className="flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                  <Activity className="w-3.5 h-3.5" /> Stream Ready
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-text-primary flex items-center gap-1.5">
                  Runtime: Telemetry & ML Gate
                </h3>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                  Ingests OpenTelemetry metrics (Pod restarts, CPU spikes, error rates) and evaluates risk using trained XGBoost model.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-background/60 border border-border/50 text-xs font-mono space-y-1 text-text-secondary">
                <div className="flex justify-between">
                  <span>Telemetry Ingestion:</span>
                  <span className="text-emerald-400 font-semibold">Active (SQLite DB)</span>
                </div>
                <div className="flex justify-between">
                  <span>XGBoost Features:</span>
                  <span className="text-text-primary font-bold">10 Vector Inputs</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-text-muted">
              <span>Telemetry Ingestion Port: 8000</span>
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
          </div>

        </div>
      </div>

      {/* ── Recent Pull Request Assessments (Live Aggregation) ── */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border/60 flex items-center justify-between bg-surface-secondary/20">
          <div className="flex items-center gap-2">
            <GitPullRequest className="w-4 h-4 text-brand-primary" />
            <h3 className="font-semibold text-sm text-text-primary">Recent Automated PR Decisions</h3>
          </div>
          <span className="text-xs text-text-muted font-mono">
            Auto-refreshes every 10s
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-[11px] text-text-muted uppercase tracking-wider bg-surface-secondary/40 font-semibold">
                <th className="py-3 px-4">Pull Request</th>
                <th className="py-3 px-4">Service</th>
                <th className="py-3 px-4">Phase 1 (Coupling)</th>
                <th className="py-3 px-4">Phase 2 (Blast Radius)</th>
                <th className="py-3 px-4">Decision</th>
                <th className="py-3 px-4 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono">
              {recentPRs.map((pr, idx) => (
                <tr key={idx} className="hover:bg-surface-secondary/20 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 font-sans font-medium text-text-primary">
                      <span className="font-mono text-xs text-text-muted">{pr.id}</span>
                      <span>{pr.title}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-surface-secondary border border-border/50 text-text-secondary text-[11px]">
                      {pr.services ? pr.services.join(', ') : 'service'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-text-secondary">
                    {pr.couplingIndex !== undefined ? (
                      <div>
                        <span className={pr.couplingIndex > 0.5 ? 'text-rose-400 font-bold' : 'text-blue-400 font-semibold'}>
                          Idx: {pr.couplingIndex}
                        </span>
                        <span className="text-text-muted text-[10px] ml-1.5">
                          ({pr.coDeployRate ? `${Math.round(pr.coDeployRate * 100)}%` : '0%'} co-deploy)
                        </span>
                      </div>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-text-secondary">
                    {pr.blastRadius !== undefined ? (
                      <div>
                        <span className={pr.blastRadius > 0 ? 'text-purple-400 font-bold' : 'text-text-muted'}>
                          Radius: {pr.blastRadius}
                        </span>
                        <span className="text-text-muted text-[10px] ml-1.5">
                          ({pr.apiChanges || 0} breaking changes)
                        </span>
                      </div>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
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
                  <td className="py-3 px-4 text-right text-text-muted text-[11px] font-sans">
                    {pr.time}
                  </td>
                </tr>
              ))}

              {recentPRs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-text-muted font-sans text-xs">
                    No PR assessments found. Open a Pull Request on <code>rp-core-product</code> to trigger the pipeline!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Research Methodology Context Card for Viva ── */}
      <div className="bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-amber-500/5 border border-border/70 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-primary">
            <Layers className="w-4 h-4 text-brand-primary" />
            <span>Shift-Left Architectural Governance Methodology</span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed max-w-3xl">
            By shifting architectural assessment into the CI/CD pipeline, the C-Score engine intercepts high logical coupling (Phase 1) and breaking interface modifications (Phase 2) before code touches staging environments, preventing systemic microservice failures.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

    </div>
  );
};
