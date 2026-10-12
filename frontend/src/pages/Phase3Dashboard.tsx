import React, { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  Server,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Box,
  Flame,
  RotateCcw,
  Zap,
  Layers,
  Sparkles,
  RefreshCw,
  GitPullRequest
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

interface ServiceRuntime {
  service: string;
  podRestarts: number;
  cpuSpikePct: number;
  memSpikePct: number;
  errorRatePct: number;
  maxCallDepth: number;
  syncCallCount: number;
  status: 'Healthy' | 'Degraded';
}

interface TelemetrySummary {
  totalPodRestarts: number;
  avgCpuSpike: number;
  avgErrorRate: number;
  overallRuntimeStatus: 'NOMINAL' | 'WARNING' | 'CRITICAL';
}

export const Phase3Dashboard: React.FC = () => {
  const [services, setServices] = useState<ServiceRuntime[]>([]);
  const [summary, setSummary] = useState<TelemetrySummary>({
    totalPodRestarts: 0,
    avgCpuSpike: 0,
    avgErrorRate: 0,
    overallRuntimeStatus: 'NOMINAL'
  });
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchTelemetry = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/phase3/dashboard');
      if (res.ok) {
        const data = await res.json();
        setServices(data.services || []);
        if (data.summary) setSummary(data.summary);
      }
    } catch (err) {
      console.error('Failed to load Phase 3 telemetry:', err);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 6000);
    return () => clearInterval(interval);
  }, []);

  const triggerSimulation = async (preset: string, targetService = 'order-service') => {
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/telemetry/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_name: targetService, preset })
      });
      if (res.ok) {
        const data = await res.json();
        setActionMsg(`Telemetry updated: ${preset.toUpperCase()} on ${targetService}`);
        fetchTelemetry();
        setTimeout(() => setActionMsg(null), 4000);
      }
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full bg-background text-text-primary p-4 lg:p-6 overflow-y-auto space-y-6">
      
      {/* ── Header ── */}
      <div className="flex flex-wrap lg:flex-nowrap justify-between items-center bg-surface border border-border rounded-xl p-4 shadow-sm gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.15)]">
            <Activity className="text-amber-400 w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-text-primary tracking-wide">Runtime Telemetry &amp; ML Gatekeeper</h1>
              <span className="text-amber-400 border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 rounded text-xs font-mono">
                Phase 3
              </span>
            </div>
            <p className="text-[11px] text-text-muted uppercase tracking-widest mt-1">
              OpenTelemetry Spans • Container Lifecycle • XGBoost Inference
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm bg-surface-secondary/50 px-5 py-2 rounded-lg border border-border/50">
          <div className="flex gap-2 items-center">
            <span className="text-text-muted">Target:</span>
            <span className="flex items-center gap-1.5 font-mono text-text-primary">
              <Box className="w-3.5 h-3.5 text-amber-400" /> rp-core-product
            </span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-text-muted">Collector:</span>
            <span className="font-mono text-xs text-text-primary">OTLP / Prometheus</span>
          </div>
        </div>

        <div className="flex items-center gap-4 border-l border-border pl-4">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${
            summary.overallRuntimeStatus === 'CRITICAL'
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
              : summary.overallRuntimeStatus === 'WARNING'
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              summary.overallRuntimeStatus === 'CRITICAL' ? 'bg-rose-400 animate-ping' : 'bg-emerald-400 animate-pulse'
            }`} />
            <span>{summary.overallRuntimeStatus} STATE</span>
          </div>
        </div>
      </div>

      {actionMsg && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs flex items-center justify-between animate-fadeIn">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> {actionMsg}
          </span>
          <span className="text-[10px] text-text-muted font-mono">Synced with SQLite DB</span>
        </div>
      )}

      {/* ── Top 4 KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Pod Restarts */}
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-2">Total Pod Restarts</div>
            <div className={`text-3xl font-bold font-mono tracking-wide ${summary.totalPodRestarts > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {summary.totalPodRestarts}
            </div>
          </div>
          <div className="text-xs text-text-muted mt-3">Kubernetes Container CrashLoopBackOff Count</div>
          <div className="absolute -right-3 -bottom-3 opacity-10">
            <Server className="w-20 h-20 text-rose-400" />
          </div>
        </div>

        {/* Avg CPU Spike */}
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-2">Avg CPU Spike Pressure</div>
            <div className="text-3xl font-bold font-mono text-amber-400 tracking-wide">
              {summary.avgCpuSpike}%
            </div>
          </div>
          <div className="mt-3">
            <div className="h-1.5 w-full bg-surface-secondary rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  summary.avgCpuSpike > 70 ? 'bg-rose-500' : 'bg-amber-400'
                }`} 
                style={{ width: `${Math.min(100, summary.avgCpuSpike)}%` }} 
              />
            </div>
          </div>
        </div>

        {/* HTTP Error Rate */}
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-2">Runtime Error Rate</div>
            <div className={`text-3xl font-bold font-mono tracking-wide ${summary.avgErrorRate > 2 ? 'text-rose-400' : 'text-blue-400'}`}>
              {summary.avgErrorRate}%
            </div>
          </div>
          <div className="text-xs text-text-muted mt-3">HTTP 5xx / 4xx Failure Percentage</div>
        </div>

        {/* AI Gatekeeper Verdict */}
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-2">ML Gatekeeper Bias</div>
            <div className="text-sm font-bold text-text-primary flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-brand-primary" />
              <span>XGBoost Step-Function</span>
            </div>
          </div>
          <div className="text-[11px] text-text-muted mt-3">
            Heavily weights <b className="text-rose-400">pod_restarts</b> &gt; 0 as critical deployment failure
          </div>
        </div>

      </div>

      {/* ── Main Section: Service Matrix & Simulation Deck ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Service Runtime Health Matrix (8 cols) */}
        <div className="lg:col-span-8 bg-surface border border-border rounded-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border/60 flex items-center justify-between bg-surface-secondary/30">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-text-primary">Microservice Runtime Health Matrix</h3>
            </div>
            <span className="text-xs text-text-muted font-mono">Live Readings</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-[11px] text-text-muted uppercase tracking-wider bg-surface-secondary/40 font-semibold">
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Restarts</th>
                  <th className="py-3 px-4">CPU / RAM</th>
                  <th className="py-3 px-4">Trace Depth</th>
                  <th className="py-3 px-4">Sync Calls</th>
                  <th className="py-3 px-4 text-right">Error Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                {services.map((s, idx) => (
                  <tr key={idx} className="hover:bg-surface-secondary/20 transition-colors">
                    <td className="py-3 px-4 font-sans font-medium text-text-primary">
                      <div className="flex items-center gap-2">
                        <Box className="w-3.5 h-3.5 text-text-muted" />
                        <span>{s.service}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {s.status === 'Healthy' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-sans font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Nominal
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-sans font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <AlertTriangle className="w-3 h-3" /> Degraded
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-bold ${s.podRestarts > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {s.podRestarts}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-text-secondary">
                      {s.cpuSpikePct}% / {s.memSpikePct}%
                    </td>
                    <td className="py-3 px-4 text-indigo-400">
                      Depth: {s.maxCallDepth}
                    </td>
                    <td className="py-3 px-4 text-purple-400">
                      Sync: {s.syncCallCount}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={s.errorRatePct > 1 ? 'text-rose-400 font-bold' : 'text-text-secondary'}>
                        {s.errorRatePct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Microservice Resource Utilization Chart */}
          <div className="p-4 border-t border-border/60">
            <div className="text-xs font-semibold text-text-primary mb-3 flex items-center justify-between">
              <span>CPU Spike Pressure Across Microservices</span>
              <span className="text-[10px] text-text-muted font-mono">Resource Utilization (%)</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={services} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                  <XAxis dataKey="service" stroke="#737373" fontSize={11} />
                  <YAxis stroke="#737373" fontSize={11} domain={[0, 100]} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="cpuSpikePct" radius={[4, 4, 0, 0]} name="CPU Spike %">
                    {services.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.cpuSpikePct > 70 ? '#f43f5e' : entry.cpuSpikePct > 40 ? '#f59e0b' : '#10b981'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right: Live Viva Demo Chaos Simulator (4 cols) ── */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Interactive Simulation Deck */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-2xl rounded-full translate-x-8 -translate-y-8" />
            
            <div className="relative z-10 space-y-2 mb-4">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-text-primary">Live Viva Telemetry Simulator</h3>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Trigger simulated runtime anomalies on <code>order-service</code> to demonstrate XGBoost gatekeeper decisions live during your viva presentation.
              </p>
            </div>

            <div className="relative z-10 space-y-2.5">
              <button
                onClick={() => triggerSimulation('pod_crash')}
                disabled={loading}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  <span>Simulate Pod Crash (14 Restarts)</span>
                </div>
                <span className="font-mono text-[10px] bg-rose-500/20 px-1.5 py-0.5 rounded">Fail Gate</span>
              </button>

              <button
                onClick={() => triggerSimulation('cpu_burn')}
                disabled={loading}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-semibold transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  <span>Simulate CPU Spike (94% CPU)</span>
                </div>
                <span className="font-mono text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded">Degrade</span>
              </button>

              <button
                onClick={() => triggerSimulation('cascading_failure')}
                disabled={loading}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-xs font-semibold transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4" />
                  <span>Cascading Failure (All Metrics)</span>
                </div>
                <span className="font-mono text-[10px] bg-purple-500/20 px-1.5 py-0.5 rounded">Critical</span>
              </button>

              <button
                onClick={() => triggerSimulation('healthy')}
                disabled={loading}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" />
                  <span>Restore Healthy Telemetry</span>
                </div>
                <span className="font-mono text-[10px] bg-emerald-500/20 px-1.5 py-0.5 rounded">Pass Gate</span>
              </button>
            </div>

            <div className="relative z-10 mt-4 pt-3 border-t border-border/50 text-[11px] text-text-muted text-center">
              Updates SQLite <code>telemetry</code> table instantly.
            </div>
          </div>

          {/* 10-Feature Vector Inspector */}
          <div className="bg-surface border border-border rounded-xl p-5 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">10-Feature Vector Spec</span>
              <span className="text-[10px] font-mono text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded border border-brand-primary/20">
                XGBoost ML Input
              </span>
            </div>

            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex justify-between p-1.5 rounded bg-surface-secondary/40 text-blue-400">
                <span>Phase 1 (Coupling):</span>
                <span>commit_freq, co_deploy_rate</span>
              </div>
              <div className="flex justify-between p-1.5 rounded bg-surface-secondary/40 text-purple-400">
                <span>Phase 2 (Contract):</span>
                <span>api_changes, downstream_count</span>
              </div>
              <div className="flex justify-between p-1.5 rounded bg-surface-secondary/40 text-amber-400">
                <span>Phase 3 (Runtime):</span>
                <span>pod_restarts, cpu/mem spikes, depth</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/50 text-[11px] text-text-muted">
              Model file: <code>xgboost_c_score_model.pkl</code>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
