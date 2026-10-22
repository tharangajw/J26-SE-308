import React, { useState } from 'react';
import {
  Calculator,
  GitMerge,
  GitPullRequest,
  Network,
  Activity,
  Cpu,
  Layers,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  ShieldCheck,
  Code2,
  Boxes,
  HelpCircle,
  Sliders,
  Sparkles
} from 'lucide-react';

export const CiCdCalculationPage: React.FC = () => {
  // Interactive Live Calculator State
  const [commitFreq, setCommitFreq] = useState<number>(14);
  const [coDeployRate, setCoDeployRate] = useState<number>(0.71);
  const [apiChanges, setApiChanges] = useState<number>(3);
  const [downstreamCount, setDownstreamCount] = useState<number>(2);
  const [maxCallDepth, setMaxCallDepth] = useState<number>(4);
  const [syncCallCount, setSyncCallCount] = useState<number>(3);
  const [errorRatePct, setErrorRatePct] = useState<number>(4.5);
  const [podRestarts, setPodRestarts] = useState<number>(2);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'all' | 'phase1' | 'phase2' | 'phase3' | 'xgboost'>('all');

  // Phase 1 Computations
  const normFreq = Math.min(commitFreq / 24.0, 1.0);
  const couplingIndex = Number((0.5 * normFreq + 0.5 * coDeployRate).toFixed(3));
  const p1HighRisk = couplingIndex > 0.5;

  // Phase 2 Computations
  const blastRadius = apiChanges * downstreamCount;
  const p2HighRisk = blastRadius > 0;

  // Phase 3 Indicators
  const p3HighRisk = podRestarts > 0 || errorRatePct > 2.0 || maxCallDepth > 3 || syncCallCount > 4;

  // C-Score Simulation
  let simulatedScore = 12.0;
  if (p2HighRisk) {
    simulatedScore = 98.0;
  } else if (p1HighRisk) {
    simulatedScore = 95.0;
  } else if (p3HighRisk) {
    simulatedScore = Number(Math.min(99.0, 30.0 + podRestarts * 15 + errorRatePct * 5 + maxCallDepth * 4).toFixed(1));
  } else {
    simulatedScore = Number((8.0 + commitFreq * 0.5 + coDeployRate * 10).toFixed(1));
  }

  const threshold = 28.9;
  const isHighRisk = simulatedScore > threshold;

  return (
    <div className="h-full bg-background text-text-primary p-4 lg:p-6 overflow-y-auto space-y-6">
      
      {/* ── Top Header Banner ── */}
      <div className="flex flex-wrap lg:flex-nowrap justify-between items-center bg-surface border border-border rounded-xl p-5 shadow-sm gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.15)]">
            <Calculator className="text-purple-400 w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-xl text-text-primary tracking-wide">CI/CD Mathematical &amp; Calculation Logic</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-purple-500/10 border border-purple-500/30 text-purple-400">
                Phases 1, 2, 3 &amp; XGBoost Brain
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-1">
              Formal mathematical formulations, normalization criteria, algorithmic bounds &amp; ML synthesis formulas.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg border transition-colors ${
              activeTab === 'all'
                ? 'bg-purple-500/20 text-purple-400 border-purple-500/40 font-semibold'
                : 'bg-surface-secondary text-text-muted border-border hover:text-text-primary'
            }`}
          >
            All Formulas
          </button>
          <button
            onClick={() => setActiveTab('phase1')}
            className={`px-3 py-1.5 rounded-lg border transition-colors ${
              activeTab === 'phase1'
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/40 font-semibold'
                : 'bg-surface-secondary text-text-muted border-border hover:text-text-primary'
            }`}
          >
            Phase 1
          </button>
          <button
            onClick={() => setActiveTab('phase2')}
            className={`px-3 py-1.5 rounded-lg border transition-colors ${
              activeTab === 'phase2'
                ? 'bg-purple-500/20 text-purple-400 border-purple-500/40 font-semibold'
                : 'bg-surface-secondary text-text-muted border-border hover:text-text-primary'
            }`}
          >
            Phase 2
          </button>
          <button
            onClick={() => setActiveTab('phase3')}
            className={`px-3 py-1.5 rounded-lg border transition-colors ${
              activeTab === 'phase3'
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 font-semibold'
                : 'bg-surface-secondary text-text-muted border-border hover:text-text-primary'
            }`}
          >
            Phase 3
          </button>
          <button
            onClick={() => setActiveTab('xgboost')}
            className={`px-3 py-1.5 rounded-lg border transition-colors ${
              activeTab === 'xgboost'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-semibold'
                : 'bg-surface-secondary text-text-muted border-border hover:text-text-primary'
            }`}
          >
            XGBoost Brain
          </button>
        </div>
      </div>

      {/* ── Interactive Live Formula Simulation Console ── */}
      <div className="bg-surface border border-purple-500/30 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-bold text-text-primary tracking-wide">
              Live Interactive Calculation &amp; Synthesis Sandbox
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Real-time Formula Engine
            </span>
          </div>
          <span className="text-xs text-text-muted font-mono">
            Adjust sliders to evaluate Phase 1, 2, 3 values and observe dynamic C-Score output.
          </span>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
          {/* Phase 1 Sliders */}
          <div className="p-3.5 rounded-lg bg-surface-secondary/40 border border-blue-500/20 space-y-3">
            <div className="text-xs font-bold text-blue-400 font-mono flex items-center justify-between">
              <span>PHASE 1: COUPLING</span>
              <span className="text-[10px] text-text-muted">Pre-Build</span>
            </div>
            <div>
              <div className="flex justify-between text-xs text-text-secondary mb-1">
                <span>Commit Freq (30d):</span>
                <span className="font-mono font-bold text-blue-400">{commitFreq}</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                value={commitFreq}
                onChange={e => setCommitFreq(Number(e.target.value))}
                className="w-full accent-blue-400 h-1.5 bg-background rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs text-text-secondary mb-1">
                <span>Co-Deploy Rate:</span>
                <span className="font-mono font-bold text-blue-400">{(coDeployRate * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={coDeployRate}
                onChange={e => setCoDeployRate(Number(e.target.value))}
                className="w-full accent-blue-400 h-1.5 bg-background rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="pt-2 border-t border-border/40 text-xs font-mono flex justify-between items-center">
              <span className="text-text-muted">Coupling Index:</span>
              <span className={`font-bold ${couplingIndex > 0.5 ? 'text-rose-400' : 'text-blue-400'}`}>
                {couplingIndex} {couplingIndex > 0.5 && '(HIGH)'}
              </span>
            </div>
          </div>

          {/* Phase 2 Sliders */}
          <div className="p-3.5 rounded-lg bg-surface-secondary/40 border border-purple-500/20 space-y-3">
            <div className="text-xs font-bold text-purple-400 font-mono flex items-center justify-between">
              <span>PHASE 2: BLAST RADIUS</span>
              <span className="text-[10px] text-text-muted">Build AST</span>
            </div>
            <div>
              <div className="flex justify-between text-xs text-text-secondary mb-1">
                <span>Breaking API Changes:</span>
                <span className="font-mono font-bold text-purple-400">{apiChanges}</span>
              </div>
              <input
                type="range"
                min="0"
                max="6"
                value={apiChanges}
                onChange={e => setApiChanges(Number(e.target.value))}
                className="w-full accent-purple-400 h-1.5 bg-background rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs text-text-secondary mb-1">
                <span>Downstream Consumers:</span>
                <span className="font-mono font-bold text-purple-400">{downstreamCount}</span>
              </div>
              <input
                type="range"
                min="0"
                max="4"
                value={downstreamCount}
                onChange={e => setDownstreamCount(Number(e.target.value))}
                className="w-full accent-purple-400 h-1.5 bg-background rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="pt-2 border-t border-border/40 text-xs font-mono flex justify-between items-center">
              <span className="text-text-muted">Blast Radius:</span>
              <span className={`font-bold ${blastRadius > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {blastRadius} {blastRadius > 0 && '(BLOCKED)'}
              </span>
            </div>
          </div>

          {/* Phase 3 Sliders */}
          <div className="p-3.5 rounded-lg bg-surface-secondary/40 border border-amber-500/20 space-y-3">
            <div className="text-xs font-bold text-amber-400 font-mono flex items-center justify-between">
              <span>PHASE 3: RUNTIME</span>
              <span className="text-[10px] text-text-muted">Canary K8s</span>
            </div>
            <div>
              <div className="flex justify-between text-xs text-text-secondary mb-1">
                <span>Max Call Depth:</span>
                <span className="font-mono font-bold text-amber-400">{maxCallDepth} hops</span>
              </div>
              <input
                type="range"
                min="1"
                max="7"
                value={maxCallDepth}
                onChange={e => setMaxCallDepth(Number(e.target.value))}
                className="w-full accent-amber-400 h-1.5 bg-background rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs text-text-secondary mb-1">
                <span>Pod Restarts (F10):</span>
                <span className="font-mono font-bold text-rose-400">{podRestarts}</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={podRestarts}
                onChange={e => setPodRestarts(Number(e.target.value))}
                className="w-full accent-rose-400 h-1.5 bg-background rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="pt-2 border-t border-border/40 text-xs font-mono flex justify-between items-center">
              <span className="text-text-muted">Error Rate (F9):</span>
              <span className={`font-bold ${errorRatePct > 2 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {errorRatePct}%
              </span>
            </div>
          </div>

          {/* Result Card */}
          <div className={`p-4 rounded-lg border flex flex-col justify-between ${
            isHighRisk ? 'bg-rose-500/10 border-rose-500/30' : 'bg-emerald-500/10 border-emerald-500/30'
          }`}>
            <div>
              <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-wider">
                <span className={isHighRisk ? 'text-rose-400' : 'text-emerald-400'}>
                  Synthesis Verdict
                </span>
                {isHighRisk ? <ShieldAlert className="w-4 h-4 text-rose-400" /> : <ShieldCheck className="w-4 h-4 text-emerald-400" />}
              </div>
              <div className="mt-2">
                <div className="text-[10px] text-text-muted uppercase">Calculated C-Score</div>
                <div className={`text-3xl font-extrabold font-mono mt-0.5 ${
                  isHighRisk ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  {simulatedScore}
                </div>
                <div className="text-[11px] font-mono text-text-muted mt-1">
                  Threshold: <b>&gt; 28.9</b> = HIGH RISK
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-border/40">
              <div className={`text-xs font-bold font-mono px-2 py-1 rounded text-center ${
                isHighRisk ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {isHighRisk ? 'PIPELINE ABORT (BLOCK PR)' : 'PIPELINE PASS (PROCEED)'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 1: PHASE 1 CALCULATION LOGIC ── */}
      {(activeTab === 'all' || activeTab === 'phase1') && (
        <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <GitPullRequest className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-base text-text-primary">
                  Phase 1: Pre-Build Logical Coupling Calculation
                </h3>
                <p className="text-xs text-text-secondary">
                  Repository Mining &amp; Git Commit Dependency Analysis (GitHub REST API Ingestion)
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Features 1, 2 &amp; 3
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Metric 1 */}
            <div className="p-4 rounded-xl bg-surface-secondary/40 border border-border/50 space-y-2">
              <div className="text-xs font-bold text-blue-400 font-mono">1. COMMIT FREQUENCY (f1)</div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Total commits modifying the target microservice folder within a rolling 30-day window.
              </p>
              <div className="p-3 rounded-lg bg-black/40 border border-border font-mono text-xs text-yellow-200">
                F_commit = Count(Commits(service, 30d))
              </div>
              <p className="text-[11px] text-text-muted">
                Normalization: <b>norm_freq = min(F_commit / 24.0, 1.0)</b> (bounded by 24 commits/month).
              </p>
            </div>

            {/* Metric 2 */}
            <div className="p-4 rounded-xl bg-surface-secondary/40 border border-border/50 space-y-2">
              <div className="text-xs font-bold text-blue-400 font-mono">2. CO-DEPLOYMENT RATE (f2)</div>
              <p className="text-xs text-text-secondary leading-relaxed">
                The proportion of commits that touched both this service and at least one other service concurrently.
              </p>
              <div className="p-3 rounded-lg bg-black/40 border border-border font-mono text-xs text-yellow-200">
                R_co_deploy = Multi_Service_Commits / Total_Service_Commits
              </div>
              <p className="text-[11px] text-text-muted">
                High co-deployment indicates tight deployment entanglements and shared repository coupling.
              </p>
            </div>

            {/* Metric 3 */}
            <div className="p-4 rounded-xl bg-surface-secondary/40 border border-border/50 space-y-2">
              <div className="text-xs font-bold text-blue-400 font-mono">3. COUPLING INDEX (f3)</div>
              <p className="text-xs text-text-secondary leading-relaxed">
                The combined weighted logical coupling score (0.0 to 1.0) synthesized from frequency and co-deploy rate.
              </p>
              <div className="p-3 rounded-lg bg-black/40 border border-border font-mono text-xs text-yellow-200">
                Coupling_Index = (0.5 * norm_freq) + (0.5 * R_co_deploy)
              </div>
              <p className="text-[11px] text-rose-400 font-mono">
                Guardrail Rule: If Coupling_Index &gt; 0.50 ➔ Force C-Score = 95.0 (High Risk).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 2: PHASE 2 CALCULATION LOGIC ── */}
      {(activeTab === 'all' || activeTab === 'phase2') && (
        <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <Network className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h3 className="font-bold text-base text-text-primary">
                  Phase 2: Build Blast Radius Calculation
                </h3>
                <p className="text-xs text-text-secondary">
                  OpenAPI AST Semantic Diffing (oasdiff) &amp; Automated Service Registry Topology Mapping
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Features 4, 5 &amp; 6
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Metric 4 */}
            <div className="p-4 rounded-xl bg-surface-secondary/40 border border-border/50 space-y-2">
              <div className="text-xs font-bold text-purple-400 font-mono">4. BREAKING API CHANGES (f4)</div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Count of breaking changes identified between main branch and PR branch via <code>oasdiff</code>.
              </p>
              <div className="p-3 rounded-lg bg-black/40 border border-border font-mono text-xs text-yellow-200">
                N_breaking = Count(oasdiff breaking old.yaml new.yaml)
              </div>
              <p className="text-[11px] text-text-muted">
                Detected: Endpoint deletions, renamed paths, removed response fields, or new required parameters.
              </p>
            </div>

            {/* Metric 5 */}
            <div className="p-4 rounded-xl bg-surface-secondary/40 border border-border/50 space-y-2">
              <div className="text-xs font-bold text-purple-400 font-mono">5. DOWNSTREAM CONSUMERS (f5)</div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Count of downstream microservices inside the cluster that depend on and consume this service.
              </p>
              <div className="p-3 rounded-lg bg-black/40 border border-border font-mono text-xs text-yellow-200">
                D_downstream = |&#123; consumer in service_registry | provider == target &#125;|
              </div>
              <p className="text-[11px] text-text-muted">
                Dynamically discovered from <code>docker-compose.yml</code> (depends_on and environment URL links).
              </p>
            </div>

            {/* Metric 6 */}
            <div className="p-4 rounded-xl bg-surface-secondary/40 border border-border/50 space-y-2">
              <div className="text-xs font-bold text-purple-400 font-mono">6. SYSTEMIC BLAST RADIUS (f6)</div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Multiplying breaking contract modifications by the number of dependent microservice consumers.
              </p>
              <div className="p-3 rounded-lg bg-black/40 border border-border font-mono text-xs text-yellow-200">
                Blast_Radius = N_breaking * D_downstream
              </div>
              <p className="text-[11px] text-rose-400 font-mono">
                Guardrail Rule: If Blast_Radius &gt; 0 ➔ Force C-Score = 98.0 (Immediate Block).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 3: PHASE 3 CALCULATION LOGIC ── */}
      {(activeTab === 'all' || activeTab === 'phase3') && (
        <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Activity className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-base text-text-primary">
                  Phase 3: Runtime Canary Telemetry Calculation
                </h3>
                <p className="text-xs text-text-secondary">
                  OpenTelemetry Traces &amp; Prometheus Telemetry Extracted inside Kubernetes Canary Sandbox
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Features 7, 8, 9 &amp; 10
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Feature 7 */}
            <div className="p-4 rounded-xl bg-surface-secondary/40 border border-border/50 space-y-2">
              <div className="text-xs font-bold text-indigo-400 font-mono">7. MAX CALL DEPTH (f7)</div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Deepest nested microservice hop depth recorded in an OpenTelemetry distributed trace tree.
              </p>
              <div className="p-2.5 rounded-lg bg-black/40 border border-border font-mono text-xs text-yellow-200">
                Max_Depth = max(trace.depth)
              </div>
              <p className="text-[11px] text-text-muted">
                Optimal &le; 3 hops. Depth &gt; 3 indicates excessive inter-service call chain latency.
              </p>
            </div>

            {/* Feature 8 */}
            <div className="p-4 rounded-xl bg-surface-secondary/40 border border-border/50 space-y-2">
              <div className="text-xs font-bold text-purple-400 font-mono">8. SYNC CALL COUNT (f8)</div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Count of sequential synchronous HTTP blocking calls invoked within a single transaction trace.
              </p>
              <div className="p-2.5 rounded-lg bg-black/40 border border-border font-mono text-xs text-yellow-200">
                Sync_Calls = Count(span.type == "SYNC_HTTP")
              </div>
              <p className="text-[11px] text-text-muted">
                High sync call count (&gt; 4) reveals N+1 blocking query cascades and tight architectural coupling.
              </p>
            </div>

            {/* Feature 9 */}
            <div className="p-4 rounded-xl bg-surface-secondary/40 border border-border/50 space-y-2">
              <div className="text-xs font-bold text-amber-400 font-mono">9. ERROR RATE % (f9)</div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Percentage of HTTP 4xx and 5xx client and server errors recorded during synthetic Canary traffic.
              </p>
              <div className="p-2.5 rounded-lg bg-black/40 border border-border font-mono text-xs text-yellow-200">
                Error_Rate = (Total_Errors / Total_Requests) * 100
              </div>
              <p className="text-[11px] text-text-muted">
                Monitored via Prometheus cAdvisor/Ingress metrics. Rate &gt; 2% signals runtime regressions.
              </p>
            </div>

            {/* Feature 10 */}
            <div className="p-4 rounded-xl bg-surface-secondary/40 border border-border/50 space-y-2">
              <div className="text-xs font-bold text-rose-400 font-mono">10. POD RESTARTS (f10)</div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Container restart and crash events logged in Kubernetes namespace during test traffic.
              </p>
              <div className="p-2.5 rounded-lg bg-black/40 border border-border font-mono text-xs text-yellow-200">
                Restarts = kube_pod_container_status_restarts_total
              </div>
              <p className="text-[11px] text-text-muted">
                Catches Memory Leaks, OOMKilled events and CrashLoopBackOff crashes prior to Production.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 4: XGBOOST MASTER BRAIN & GUARDRAILS ── */}
      {(activeTab === 'all' || activeTab === 'xgboost') && (
        <div className="bg-surface border border-emerald-500/30 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Cpu className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-bold text-base text-text-primary">
                  Master Brain: XGBoost 10-Feature Vector Synthesis &amp; Decision Boundary
                </h3>
                <p className="text-xs text-text-secondary">
                  Machine Learning Model Inference (xgboost_c_score_model.pkl + minmax_scaler.pkl)
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              10-Feature Vector (f1 .. f10)
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left: Mathematical Process (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="p-4 rounded-xl bg-surface-secondary/40 border border-border/50 space-y-3">
                <div className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">
                  1. The 10-Feature Input Vector (X)
                </div>
                <div className="p-3 rounded-lg bg-black/50 border border-border/60 font-mono text-xs text-emerald-400 leading-relaxed overflow-x-auto">
                  X = [ commit_freq, co_deploy_rate, coupling_index,<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;api_changes, downstream_count, blast_radius,<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;max_call_depth, sync_call_count, error_rate_pct, pod_restarts ]
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface-secondary/40 border border-border/50 space-y-3">
                <div className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">
                  2. MinMax Scaling &amp; Probability Inference
                </div>
                <div className="p-3 rounded-lg bg-black/50 border border-border/60 font-mono text-xs text-text-secondary leading-relaxed">
                  X_scaled = minmax_scaler.transform([X])<br />
                  P(High_Risk) = xgboost_model.predict_proba(X_scaled)[0][1]<br />
                  C_Score = round(P(High_Risk) * 100, 2)
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface-secondary/40 border border-border/50 space-y-3">
                <div className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">
                  3. Research Proposal Guardrail Overrides (Safety Constraints)
                </div>
                <div className="p-3 rounded-lg bg-black/50 border border-border/60 font-mono text-xs space-y-1 text-text-secondary">
                  <div className="text-amber-400"># Guardrail 1: Phase 1 High Entanglement</div>
                  <div>if (coupling_index &gt; 0.50): P = max(P, 0.95)  # Force C-Score &ge; 95.0</div>
                  <div className="text-amber-400 mt-2"># Guardrail 2: Phase 2 Breaking API Blast Risk</div>
                  <div>if (blast_radius &gt; 0): P = max(P, 0.98)       # Force C-Score &ge; 98.0</div>
                </div>
              </div>
            </div>

            {/* Right: Verification & Threshold Gate (5 cols) */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
              <div className="p-5 rounded-xl bg-surface-secondary/40 border border-border/60 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-text-muted font-mono">
                  Decision Threshold Boundary
                </div>
                <div className="p-4 rounded-lg bg-black/50 border border-border flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-text-muted uppercase">Selected Cutoff</div>
                    <div className="text-3xl font-extrabold font-mono text-rose-400">&gt; 28.9</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono px-2 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
                      HIGH RISK (ABORT)
                    </span>
                    <div className="text-[11px] font-mono text-emerald-400 mt-1">
                      &le; 28.9 = LOW RISK (PASS)
                    </div>
                  </div>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  The 28.9 threshold is mathematically tuned on the validation set to optimize F1-score and prioritize recall on breaking microservice failures.
                </p>
              </div>

              {/* Colab Verified Training Stats Card */}
              <div className="p-5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 font-mono flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Colab Training Verification
                  </span>
                  <span className="text-[10px] font-mono text-text-muted">ci_cd_dataset_v2.xlsx</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 rounded bg-surface border border-border/50">
                    <span className="text-text-muted text-[10px]">ROC-AUC:</span>
                    <div className="font-bold text-emerald-400 text-sm">0.8269</div>
                  </div>
                  <div className="p-2 rounded bg-surface border border-border/50">
                    <span className="text-text-muted text-[10px]">Test Accuracy:</span>
                    <div className="font-bold text-blue-400 text-sm">78.81%</div>
                  </div>
                  <div className="p-2 rounded bg-surface border border-border/50">
                    <span className="text-text-muted text-[10px]">Dataset Size:</span>
                    <div className="font-bold text-text-primary text-sm">100,000 Rows</div>
                  </div>
                  <div className="p-2 rounded bg-surface border border-border/50">
                    <span className="text-text-muted text-[10px]">Best Iteration:</span>
                    <div className="font-bold text-purple-400 text-sm">161 Trees</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
