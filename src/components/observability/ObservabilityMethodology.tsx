import { useState } from 'react';
import { OBS_AHP } from '../../lib/ahpEngine';
import { 
  Activity, 
  Database, 
  Gauge, 
  Layers3, 
  Network, 
  Radio, 
  ShieldAlert, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  FileCode2, 
  Zap, 
  Wrench, 
  HelpCircle,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

export const ObservabilityMethodology: React.FC = () => {
  const [selectedStage, setSelectedStage] = useState<number>(1);

  const stages = [
    {
      id: 1,
      name: '1. Ingestion',
      subtitle: '3-Pillar Telemetry Scrapes',
      icon: Database,
      color: 'border-orange-500 text-orange-400 bg-orange-500/10',
      desc: 'Prometheus metrics, Loki structured logs, and Jaeger distributed trace spans are gathered continuously.',
    },
    {
      id: 2,
      name: '2. CCI Correlation',
      subtitle: '±2s Timestamp Matching',
      icon: Activity,
      color: 'border-cyan-500 text-cyan-400 bg-cyan-500/10',
      desc: 'Correlates 5xx HTTP error spikes in metrics with corresponding log stack traces and trace span IDs.',
    },
    {
      id: 3,
      name: '3. O-Score & Penalty',
      subtitle: 'Blind Spot Deductions',
      icon: Gauge,
      color: 'border-emerald-500 text-emerald-400 bg-emerald-500/10',
      desc: `AHP-weighted O-Score: (Metrics×${(OBS_AHP.weights[0]*100).toFixed(1)}% + Traces×${(OBS_AHP.weights[1]*100).toFixed(1)}% + Logs×${(OBS_AHP.weights[2]*100).toFixed(1)}%) × 100 − Blind Spot Penalty (−2 pts each, capped at −15).`,
    },
    {
      id: 4,
      name: '4. AI RCA Engine',
      subtitle: 'Root Cause Diagnosis',
      icon: Sparkles,
      color: 'border-purple-500 text-purple-400 bg-purple-500/10',
      desc: 'AA-ICME AI engine analyzes correlated event graphs to isolate exact service & code line bottlenecks.',
    },
    {
      id: 5,
      name: '5. Remediation',
      subtitle: 'Automated Fix Scripts',
      icon: Wrench,
      color: 'border-rose-500 text-rose-400 bg-rose-500/10',
      desc: 'Generates and executes shell/ansible remediation runbooks to resolve anomalies and restore system health.',
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Hero Header */}
      <Card className="border-brand-obs/30 bg-brand-obs/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-obs/10 blur-3xl rounded-full translate-x-1/3 -translate-y-1/3 pointer-events-none" />
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-xl font-bold">
              <Gauge className="h-6 w-6 text-brand-obs" /> Real-Time Observability Engine Pipeline
            </CardTitle>
            <span className="px-3 py-1 rounded-full bg-brand-obs/20 border border-brand-obs/40 text-brand-obs text-xs font-mono font-bold">
              End-to-End Pipeline Active
            </span>
          </div>
          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-text-secondary">
            Follow the complete diagrammatic workflow of how our Observability Engine ingests OpenTelemetry streams, calculates the <strong className="text-text-primary">O-Score</strong> & <strong className="text-text-primary">CCI Correlation Index</strong>, detects <strong className="text-rose-400">Blind Spots</strong>, diagnoses root causes via <strong className="text-purple-400">AI RCA</strong>, and executes automated <strong className="text-rose-400">Remediation Scripts</strong>.
          </p>
        </CardHeader>

        {/* 5-Stage Interactive Pipeline Flow */}
        <CardContent className="pt-4 border-t border-border/60">
          <div className="text-xs uppercase font-bold tracking-wider text-text-muted mb-4">
            Interactive Calculation & Remediation Pipeline (Click any stage)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {stages.map((stage) => {
              const Icon = stage.icon;
              const isSelected = selectedStage === stage.id;
              return (
                <button
                  key={stage.id}
                  onClick={() => setSelectedStage(stage.id)}
                  className={`p-4 rounded-xl border transition-all text-left flex flex-col justify-between cursor-pointer ${
                    isSelected 
                      ? `${stage.color} ring-2 ring-brand-obs/50 shadow-lg scale-[1.02]` 
                      : 'border-border bg-surface-secondary/40 hover:bg-surface-secondary/80 text-text-secondary'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-background/60">
                      STEP {stage.id}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-text-primary mb-1">{stage.name}</div>
                    <div className="text-[11px] text-text-muted font-medium">{stage.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Stage Detail Box */}
          <div className="mt-4 p-4 rounded-xl bg-surface border border-border/60 flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-brand-obs shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-obs">
                {stages[selectedStage - 1].name} — Detailed Logic
              </h4>
              <p className="text-xs text-text-secondary leading-relaxed mt-1">
                {stages[selectedStage - 1].desc}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── DIAGRAM: Telemetry Convergence & CCI Correlation ── */}
      <Card className="border-border bg-surface overflow-hidden">
        <CardHeader className="border-b border-border/60">
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="h-5 w-5 text-cyan-400" /> Diagram: 3-Pillar Convergence & Correlation Architecture
          </CardTitle>
          <p className="text-xs text-text-muted mt-1">
            Visualizing how Prometheus, Loki, and Jaeger telemetry streams converge inside the ±2s correlation window.
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="relative p-6 bg-surface-secondary/30 rounded-2xl border border-border/60 overflow-x-auto">
            
            <div className="min-w-[700px] grid grid-cols-12 gap-4 items-center">
              
              {/* Left Column: 3 Telemetry Sources */}
              <div className="col-span-4 space-y-3">
                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-orange-400" />
                    <div>
                      <div className="text-xs font-bold text-orange-300">Prometheus Metrics</div>
                      <div className="text-[10px] text-slate-400">CPU, Memory, P95, RPS</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-orange-500/20 text-orange-300">STREAM 1</span>
                </div>

                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-cyan-400" />
                    <div>
                      <div className="text-xs font-bold text-cyan-300">Loki Logs</div>
                      <div className="text-[10px] text-slate-400">Structured 5xx Logs</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">STREAM 2</span>
                </div>

                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Network className="w-4 h-4 text-indigo-400" />
                    <div>
                      <div className="text-xs font-bold text-indigo-300">Jaeger Traces</div>
                      <div className="text-[10px] text-slate-400">Multi-Service Trace IDs</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">STREAM 3</span>
                </div>
              </div>

              {/* Center Connectors (Arrows) */}
              <div className="col-span-2 flex flex-col items-center justify-center gap-4">
                <ArrowRight className="w-6 h-6 text-slate-500 animate-pulse" />
                <div className="text-[10px] font-mono text-center text-slate-400">
                  Ingestion<br/>Window
                </div>
              </div>

              {/* Central Engine Box */}
              <div className="col-span-6 p-5 rounded-2xl bg-slate-900 border-2 border-brand-obs/50 shadow-2xl relative">
                <div className="absolute -top-3 right-4 px-3 py-0.5 rounded-full bg-brand-obs text-slate-950 font-black text-[10px] uppercase tracking-wider">
                  CCI Correlation Core
                </div>
                
                <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" /> Time-Window Correlation (±2s)
                </h4>
                
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="p-2 rounded bg-slate-800/80 border border-slate-700/80 flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Metrics 5xx Spike</span>
                    <span className="font-mono text-[10px] text-emerald-400">t = 12:42:18</span>
                  </div>
                  <div className="p-2 rounded bg-slate-800/80 border border-slate-700/80 flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Log Error Stacktrace</span>
                    <span className="font-mono text-[10px] text-emerald-400">t = 12:42:19 (Δt +1s)</span>
                  </div>
                  <div className="p-2 rounded bg-slate-800/80 border border-slate-700/80 flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Jaeger Trace Span ID</span>
                    <span className="font-mono text-[10px] text-emerald-400">t = 12:42:18 (Δt 0s)</span>
                  </div>
                </div>

                <div className="mt-4 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold text-center">
                  ✓ 100% Correlated Event (CCI Match) — 0 Penalty Deducted
                </div>
              </div>

            </div>

          </div>
        </CardContent>
      </Card>

      {/* ── FORMULA & WEIGHT CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* ── AHP Weight Card ── */}
        <Card className="border-border bg-surface">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
              <Layers3 className="w-4 h-4 text-emerald-400" /> AHP Telemetry Pillar Weighting
            </CardTitle>
            <p className="text-xs text-text-muted mt-1">
              Weights derived via Analytic Hierarchy Process (Saaty's Method). CR &lt; 0.10 → Judgements Consistent.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Pairwise Comparison Matrix */}
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-text-muted mb-2">Pairwise Comparison Matrix (Saaty Scale)</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="p-2 text-left text-text-muted font-medium border border-border/40 bg-surface-secondary/60"></th>
                      {OBS_AHP.labels.map(l => (
                        <th key={l} className="p-2 text-center text-text-secondary font-bold border border-border/40 bg-surface-secondary/60 whitespace-nowrap">{l.split(' ')[0]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {OBS_AHP.matrix.map((row, i) => (
                      <tr key={i}>
                        <td className="p-2 font-bold text-text-secondary border border-border/40 bg-surface-secondary/40 whitespace-nowrap">{OBS_AHP.labels[i].split(' ')[0]}</td>
                        {row.map((val, j) => (
                          <td key={j} className={`p-2 text-center font-mono border border-border/40 ${
                            i === j ? 'bg-slate-800/80 text-slate-400' :
                            val > 1  ? 'bg-emerald-500/10 text-emerald-400' :
                            val < 1  ? 'bg-rose-500/10 text-rose-400' :
                                       'bg-surface text-slate-300'
                          }`}>
                            {Number.isInteger(val) ? val : val.toFixed(3)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* AHP-Derived Priority Weights */}
            <div className="space-y-3">
              <div className="text-[10px] uppercase tracking-widest font-bold text-text-muted mb-1">AHP-Derived Priority Weights</div>
              {OBS_AHP.labels.map((label, i) => {
                const pct = OBS_AHP.weights[i] * 100;
                const colors = ['text-orange-400 bg-orange-400', 'text-indigo-400 bg-indigo-400', 'text-cyan-400 bg-cyan-400'];
                const [textCls, barCls] = colors[i].split(' ');
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span className={`font-bold ${textCls}`}>{label}</span>
                      <span className="font-mono text-slate-300">{pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full ${barCls} transition-all duration-700`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Consistency Stats */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { label: 'λ_max (Principal Eigenvalue)', value: OBS_AHP.lambdaMax.toFixed(4) },
                { label: 'CI (Consistency Index)', value: OBS_AHP.consistencyIndex.toFixed(4) },
                { label: 'RI (Random Index, n=3)', value: OBS_AHP.randomIndex.toFixed(2) },
                { label: 'CR (Consistency Ratio)', value: OBS_AHP.consistencyRatio.toFixed(4) },
              ].map(({ label, value }) => (
                <div key={label} className="p-2 rounded bg-surface-secondary/50 border border-border/40 flex justify-between gap-2">
                  <span className="text-text-muted">{label}</span>
                  <span className="font-mono font-bold text-text-primary">{value}</span>
                </div>
              ))}
            </div>

            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold ${
              OBS_AHP.isConsistent
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}>
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {OBS_AHP.isConsistent
                ? `Judgements Consistent (CR = ${OBS_AHP.consistencyRatio.toFixed(4)} < 0.10) ✓`
                : `Inconsistent judgements detected (CR = ${OBS_AHP.consistencyRatio.toFixed(4)} ≥ 0.10) — review matrix`}
            </div>

            {/* O-Score Formula */}
            <div className="p-3 bg-surface-secondary/60 rounded-lg border border-border/50 text-xs text-text-muted leading-relaxed font-mono">
              O-Score = (Metrics × {OBS_AHP.weights[0].toFixed(4)} + Traces × {OBS_AHP.weights[1].toFixed(4)} + Logs × {OBS_AHP.weights[2].toFixed(4)}) × 100 − Penalty
            </div>
          </CardContent>
        </Card>

        {/* Blind Spot Penalty Rule */}
        <Card className="border-border bg-surface">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
              <AlertTriangle className="w-4 h-4 text-rose-400" /> Blind Spot Penalty Logic
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-rose-400">Penalty per Blind Spot</div>
                <div className="text-xs text-slate-400 mt-0.5">Missing trace or log entry during an error spike</div>
              </div>
              <div className="text-2xl font-black text-rose-400 font-mono">-2 pts</div>
            </div>

            <div className="text-xs text-text-secondary space-y-2">
              <div className="flex items-center justify-between p-2 rounded bg-surface-secondary/50">
                <span>0 Blind Spots</span>
                <span className="font-bold text-emerald-400 font-mono">0 pts penalty</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-surface-secondary/50">
                <span>3 Blind Spots</span>
                <span className="font-bold text-amber-400 font-mono">-6 pts penalty</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-surface-secondary/50">
                <span>8+ Blind Spots</span>
                <span className="font-bold text-rose-400 font-mono">-15 pts (Max Penalty Cap)</span>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* ── DIAGRAM: AI RCA & Automated Remediation Flow ── */}
      <Card className="border-border bg-surface">
        <CardHeader className="border-b border-border/60">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-5 w-5 text-rose-400" /> End-to-End Diagram: AI RCA to Automated Remediation Workflow
          </CardTitle>
          <p className="text-xs text-text-muted mt-1">
            How correlated telemetry anomalies trigger AI Root Cause Analysis and generate executable fix scripts.
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
            
            {/* Step 1 */}
            <div className="p-4 rounded-xl bg-surface-secondary border border-border flex flex-col justify-between relative">
              <div className="text-[10px] font-mono font-bold text-amber-400 mb-2">STAGE 1: ANOMALY DETECTED</div>
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h4 className="text-xs font-bold text-text-primary">5xx Error Spike</h4>
              </div>
              <p className="text-[11px] text-text-muted mb-3 leading-relaxed">
                Prometheus metrics detect HTTP error rate exceeding 5% on <code>payment-service</code>.
              </p>
              <div className="text-[10px] font-mono bg-background p-2 rounded text-slate-300 border border-border/50">
                Status: Flagged
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-4 rounded-xl bg-surface-secondary border border-border flex flex-col justify-between relative">
              <div className="text-[10px] font-mono font-bold text-cyan-400 mb-2">STAGE 2: CCI CORRELATION</div>
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-5 h-5 text-cyan-400" />
                <h4 className="text-xs font-bold text-text-primary">Span & Log Lookup</h4>
              </div>
              <p className="text-[11px] text-text-muted mb-3 leading-relaxed">
                CCI engine retrieves trace <code>#tr-8942</code> and Loki log lines within ±2s window.
              </p>
              <div className="text-[10px] font-mono bg-background p-2 rounded text-cyan-400 border border-border/50">
                Correlation: 100%
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 flex flex-col justify-between relative">
              <div className="text-[10px] font-mono font-bold text-purple-400 mb-2">STAGE 3: AI RCA ENGINE</div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h4 className="text-xs font-bold text-purple-300">Root Cause Isolated</h4>
              </div>
              <p className="text-[11px] text-text-muted mb-3 leading-relaxed">
                AI diagnoses: Database Connection Pool Exhaustion inside <code>payment-db</code>.
              </p>
              <div className="text-[10px] font-mono bg-background p-2 rounded text-purple-300 border border-border/50">
                Confidence: 94%
              </div>
            </div>

            {/* Step 4 */}
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/40 flex flex-col justify-between relative">
              <div className="text-[10px] font-mono font-bold text-rose-400 mb-2">STAGE 4: AUTOMATED FIX</div>
              <div className="flex items-center gap-2 mb-3">
                <FileCode2 className="w-5 h-5 text-rose-400" />
                <h4 className="text-xs font-bold text-rose-300">Remediation Runbook</h4>
              </div>
              <p className="text-[11px] text-text-muted mb-3 leading-relaxed">
                Generates executable script to expand DB pool & restart pod replica.
              </p>
              <div className="text-[10px] font-mono bg-slate-950 p-2 rounded text-emerald-400 border border-emerald-500/40 font-bold flex items-center gap-1">
                <Zap className="w-3 h-3" /> Auto-Execute Ready
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Code Shell Snippet Preview for Remediation */}
      <Card className="border-border bg-slate-950 overflow-hidden">
        <div className="p-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono font-bold text-slate-200">remediation_runbook.sh (AI Generated Fix)</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            Executable Shell Script
          </span>
        </div>
        <div className="p-5 font-mono text-xs text-slate-300 overflow-x-auto space-y-1.5 leading-relaxed">
          <div className="text-slate-500">#!/usr/bin/env bash</div>
          <div className="text-slate-500"># AA-ICME Auto-Remediation for Connection Pool Exhaustion</div>
          <div className="text-emerald-400">kubectl scale deployment/payment-service --replicas=5 -n production</div>
          <div className="text-cyan-400">kubectl set env deployment/payment-service DB_POOL_MAX=100 -n production</div>
          <div className="text-slate-400">echo "Remediation executed successfully. Re-evaluating O-Score..."</div>
        </div>
      </Card>

    </div>
  );
};
