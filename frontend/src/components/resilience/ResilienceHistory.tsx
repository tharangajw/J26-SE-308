import React, { useState } from 'react';
import { PageContainer } from '../layout/PageContainer';
import {
  Shield, TrendingUp, TrendingDown, Activity, AlertTriangle,
  CheckCircle2, Filter, Download, Flame, Zap, Clock,
  BarChart2, RefreshCw, Brain, Server
} from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine
} from 'recharts';

// ─── Static R-Score History Records ────────────────────────────────────────────
// Each entry = one evaluation snapshot with full 8-metric breakdown + activity log
const RSCORE_HISTORY = [
  {
    date: '2026-08-01', rscore: 62.5, maturity: 'Developing',
    availability: 98.1, cpu: 74, memory: 71, errorRate: 2.8, restarts: 1, mttr: 16, latency: 62, failover: 80,
    chaosEvent: null, status: 'WARNING',
    activity: { type: 'SYSTEM', title: 'Baseline Evaluation', desc: 'Initial cluster telemetry baseline established.' }
  },
  {
    date: '2026-08-04', rscore: 75.0, maturity: 'Mature',
    availability: 99.4, cpu: 65, memory: 68, errorRate: 0.8, restarts: 1, mttr: 13, latency: 55, failover: 80,
    chaosEvent: null, status: 'HEALTHY',
    activity: { type: 'HEAL', title: 'Self-Healing Triggered', desc: 'Pod restart recovered user-service after OOMKill.' }
  },
  {
    date: '2026-08-07', rscore: 50.0, maturity: 'Developing',
    availability: 95.2, cpu: 88, memory: 79, errorRate: 3.5, restarts: 3, mttr: 21, latency: 110, failover: 65,
    chaosEvent: 'HIGH_CPU', status: 'CRITICAL',
    activity: { type: 'INJECT', title: 'Chaos: CPU Stress Injected', desc: 'HIGH_CPU fault injected on order-service. R-Score dropped to 50.' }
  },
  {
    date: '2026-08-10', rscore: 87.5, maturity: 'Mature',
    availability: 99.7, cpu: 52, memory: 61, errorRate: 0.4, restarts: 0, mttr: 11, latency: 38, failover: 100,
    chaosEvent: null, status: 'HEALTHY',
    activity: { type: 'HEAL', title: 'Full Cluster Recovery', desc: 'CPU fault cleared. All 7 R-Score rules passing except Latency.' }
  },
  {
    date: '2026-08-13', rscore: 62.5, maturity: 'Developing',
    availability: 99.1, cpu: 61, memory: 82, errorRate: 0.6, restarts: 0, mttr: 12, latency: 42, failover: 100,
    chaosEvent: 'HIGH_MEMORY', status: 'WARNING',
    activity: { type: 'INJECT', title: 'Chaos: Memory Pressure', desc: 'HIGH_MEMORY fault on book-service. Memory threshold breached (82%).' }
  },
  {
    date: '2026-08-16', rscore: 75.0, maturity: 'Mature',
    availability: 99.6, cpu: 48, memory: 63, errorRate: 0.3, restarts: 0, mttr: 10, latency: 31, failover: 100,
    chaosEvent: null, status: 'HEALTHY',
    activity: { type: 'AI_RECOMMEND', title: 'AI Insight: HPA Tuning', desc: 'Recommended increasing memory limits. R-Score recovered to 75.' }
  },
  {
    date: '2026-08-19', rscore: 37.5, maturity: 'Initial',
    availability: 91.4, cpu: 45, memory: 58, errorRate: 8.2, restarts: 4, mttr: 28, latency: 85, failover: 65,
    chaosEvent: 'CASCADING_FAILURE', status: 'CRITICAL',
    activity: { type: 'INJECT', title: 'Chaos: Cascading Outage', desc: 'Cascading failure across API Gateway + User Service. FRSR: 65%.' }
  },
  {
    date: '2026-08-22', rscore: 87.5, maturity: 'Mature',
    availability: 99.8, cpu: 42, memory: 60, errorRate: 0.2, restarts: 0, mttr: 10, latency: 29, failover: 100,
    chaosEvent: null, status: 'HEALTHY',
    activity: { type: 'HEAL', title: 'Cascading Failure Resolved', desc: 'Full self-healing complete. Pod replicas restored. MTTR: 28s.' }
  },
  {
    date: '2026-08-25', rscore: 87.5, maturity: 'Mature',
    availability: 99.9, cpu: 38, memory: 57, errorRate: 0.1, restarts: 0, mttr: 9, latency: 26, failover: 100,
    chaosEvent: null, status: 'HEALTHY',
    activity: { type: 'RULE_ALERT', title: 'SLA Rule Evaluation Passed', desc: 'Resilience score 87.5/100 — 7 of 8 rules passing. Latency borderline.' }
  },
  {
    date: '2026-08-28', rscore: 75.0, maturity: 'Mature',
    availability: 99.2, cpu: 44, memory: 62, errorRate: 1.4, restarts: 0, mttr: 14, latency: 55, failover: 100,
    chaosEvent: 'API_ERROR', status: 'WARNING',
    activity: { type: 'INJECT', title: 'Chaos: API Error Spike', desc: 'HTTP 500 injection on gateway. Error rate exceeded 1% threshold.' }
  },
  {
    date: '2026-09-01', rscore: 100.0, maturity: 'Optimized',
    availability: 99.95, cpu: 35, memory: 54, errorRate: 0.1, restarts: 0, mttr: 8, latency: 22, failover: 100,
    chaosEvent: null, status: 'HEALTHY',
    activity: { type: 'SYSTEM', title: 'Peak Resilience Achieved', desc: 'All 8 R-Score rules passing. System at 100/100 — Optimized maturity level.' }
  },
  {
    date: '2026-09-04', rscore: 87.5, maturity: 'Mature',
    availability: 99.7, cpu: 41, memory: 59, errorRate: 0.3, restarts: 0, mttr: 11, latency: 48, failover: 100,
    chaosEvent: 'LATENCY', status: 'HEALTHY',
    activity: { type: 'INJECT', title: 'Chaos: Network Latency', desc: 'Latency fault on order-service. Avg latency exceeded 50ms threshold.' }
  },
  {
    date: '2026-09-07', rscore: 100.0, maturity: 'Optimized',
    availability: 99.9, cpu: 33, memory: 52, errorRate: 0.1, restarts: 0, mttr: 9, latency: 24, failover: 100,
    chaosEvent: null, status: 'HEALTHY',
    activity: { type: 'AI_RECOMMEND', title: 'AI Insight: Circuit Breaker', desc: 'Latency circuit breakers configured. System returned to Optimized.' }
  },
  {
    date: '2026-09-10', rscore: 100.0, maturity: 'Optimized',
    availability: 99.95, cpu: 31, memory: 50, errorRate: 0.08, restarts: 0, mttr: 8, latency: 21, failover: 100,
    chaosEvent: null, status: 'HEALTHY',
    activity: { type: 'SYSTEM', title: 'Sustained Optimal Resilience', desc: 'Fourth consecutive evaluation at 100/100. All SLOs met.' }
  },
];

// ─── Chaos fault type labels ────────────────────────────────────────────────────
const FAULT_LABELS: Record<string, string> = {
  HIGH_CPU: 'CPU Stress',
  HIGH_MEMORY: 'Memory Pressure',
  CASCADING_FAILURE: 'Cascading Outage',
  API_ERROR: 'API Error Spike',
  LATENCY: 'Network Latency',
  SERVICE_DOWN: 'Service Outage',
  RATE_LIMIT: 'Rate Limit',
};

// ─── Helpers ────────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getStatusStyle(status: string) {
  if (status === 'HEALTHY')  return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  if (status === 'WARNING')  return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  if (status === 'CRITICAL') return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
}

function getMaturityStyle(m: string) {
  if (m === 'Optimized')  return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  if (m === 'Mature')     return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
  if (m === 'Developing') return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'INJECT':       return <Flame className="w-4 h-4 text-rose-400 shrink-0" />;
    case 'HEAL':         return <RefreshCw className="w-4 h-4 text-emerald-400 shrink-0" />;
    case 'AI_RECOMMEND': return <Brain className="w-4 h-4 text-purple-400 shrink-0" />;
    case 'RULE_ALERT':   return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
    default:             return <Server className="w-4 h-4 text-slate-400 shrink-0" />;
  }
}

function getActivityBorder(type: string) {
  switch (type) {
    case 'INJECT':       return 'border-rose-500/30 bg-rose-500/5';
    case 'HEAL':         return 'border-emerald-500/30 bg-emerald-500/5';
    case 'AI_RECOMMEND': return 'border-purple-500/30 bg-purple-500/5';
    case 'RULE_ALERT':   return 'border-amber-500/30 bg-amber-500/5';
    default:             return 'border-slate-700 bg-slate-800/30';
  }
}

function getRScoreColor(score: number) {
  if (score >= 88) return '#10b981'; // emerald — Optimized
  if (score >= 75) return '#3b82f6'; // blue — Mature
  if (score >= 50) return '#f59e0b'; // amber — Developing
  return '#f43f5e';                  // rose — Initial
}

// ─── Custom Tooltip ─────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const row = RSCORE_HISTORY.find(r => r.date === label);
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 text-xs space-y-2 shadow-2xl min-w-[200px]">
      <div className="font-bold text-slate-200 border-b border-slate-700 pb-2 mb-2">{formatDate(label)}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-6" style={{ color: p.color }}>
          <span>{p.name}</span>
          <span className="font-mono font-bold">{p.value}</span>
        </div>
      ))}
      {row?.chaosEvent && (
        <div className="mt-2 pt-2 border-t border-slate-700 text-rose-400 flex items-center gap-1">
          <Flame className="w-3 h-3" />
          <span>Chaos: {FAULT_LABELS[row.chaosEvent] ?? row.chaosEvent}</span>
        </div>
      )}
      {row && (
        <div className={`mt-1 px-2 py-0.5 rounded-full border text-[10px] font-bold inline-block ${getMaturityStyle(row.maturity)}`}>
          {row.maturity}
        </div>
      )}
    </div>
  );
};

// ─── Page Component ─────────────────────────────────────────────────────────────
export const ResilienceHistory: React.FC = () => {
  const [filter, setFilter] = useState<'ALL' | 'HEALTHY' | 'WARNING' | 'CRITICAL'>('ALL');
  const [actFilter, setActFilter] = useState<'ALL' | 'INJECT' | 'HEAL' | 'AI_RECOMMEND' | 'RULE_ALERT' | 'SYSTEM'>('ALL');
  const [chartMode, setChartMode] = useState<'rscore' | 'metrics' | 'rules'>('rscore');

  const filtered = filter === 'ALL' ? RSCORE_HISTORY : RSCORE_HISTORY.filter(r => r.status === filter);
  const actFiltered = actFilter === 'ALL' ? RSCORE_HISTORY : RSCORE_HISTORY.filter(r => r.activity.type === actFilter);

  const avgScore   = (RSCORE_HISTORY.reduce((a, r) => a + r.rscore, 0) / RSCORE_HISTORY.length).toFixed(1);
  const bestScore  = Math.max(...RSCORE_HISTORY.map(r => r.rscore));
  const worstScore = Math.min(...RSCORE_HISTORY.map(r => r.rscore));
  const chaosCount = RSCORE_HISTORY.filter(r => r.chaosEvent).length;

  // CSV export
  const handleExport = () => {
    const header = 'Date,R-Score,Maturity,Availability,CPU%,Memory%,ErrorRate%,Restarts,MTTR(s),Latency(ms),Failover%,ChaosEvent,Status,ActivityType,ActivityTitle';
    const rows = RSCORE_HISTORY.map(r =>
      `${r.date},${r.rscore},${r.maturity},${r.availability},${r.cpu},${r.memory},${r.errorRate},${r.restarts},${r.mttr},${r.latency},${r.failover},${r.chaosEvent ?? ''},${r.status},${r.activity.type},"${r.activity.title}"`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'resilience-rscore-history.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageContainer>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-orange-400 to-amber-400 flex items-center gap-3">
            <Shield className="w-7 h-7 text-rose-400" />
            R-Score Full History
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Complete resilience score timeline with chaos events & activity log.
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg hover:bg-rose-500/20 transition-all"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Avg R-Score',      value: avgScore,             sub: 'All-time average',      icon: <BarChart2 className="w-5 h-5 text-rose-400" />,    color: 'text-rose-400'    },
          { label: 'Best Score',       value: `${bestScore}`,       sub: 'Peak resilience',        icon: <TrendingUp className="w-5 h-5 text-emerald-400" />, color: 'text-emerald-400' },
          { label: 'Worst Score',      value: `${worstScore}`,      sub: 'Lowest recorded',        icon: <TrendingDown className="w-5 h-5 text-amber-400" />, color: 'text-amber-400'   },
          { label: 'Chaos Experiments',value: `${chaosCount}`,      sub: 'Total fault injections', icon: <Flame className="w-5 h-5 text-orange-400" />,       color: 'text-orange-400'  },
        ].map(c => (
          <div key={c.label} className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-5 hover:border-slate-600 transition-all">
            <div className="flex items-center gap-2 mb-3">{c.icon}<span className="text-slate-400 text-xs font-medium">{c.label}</span></div>
            <div className={`text-3xl font-black ${c.color} font-mono`}>{c.value}</div>
            <div className="text-xs text-slate-500 mt-1">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Chart ── */}
      <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
            <Activity className="w-5 h-5 text-rose-400" /> Score Timeline
          </h2>
          <div className="flex gap-2">
            {(['rscore', 'metrics', 'rules'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setChartMode(mode)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  chartMode === mode
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {mode === 'rscore' ? 'R-Score Trend' : mode === 'metrics' ? 'Metric Breakdown' : 'Rule Pass Rates'}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          {chartMode === 'rscore' ? (
            <AreaChart data={RSCORE_HISTORY} margin={{ left: -10, right: 10 }}>
              <defs>
                <linearGradient id="gradRs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={d => d.slice(5)} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <ReferenceLine y={88} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'Optimized (88)', position: 'right', fill: '#10b981', fontSize: 10 }} />
              <ReferenceLine y={75} stroke="#3b82f6" strokeDasharray="4 4" label={{ value: 'Mature (75)',    position: 'right', fill: '#3b82f6', fontSize: 10 }} />
              <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Developing (50)',position: 'right', fill: '#f59e0b', fontSize: 10 }} />
              <Area type="monotone" dataKey="rscore" name="R-Score" stroke="#f43f5e" strokeWidth={2.5} fill="url(#gradRs)" dot={{ fill: '#f43f5e', r: 4 }} activeDot={{ r: 6 }} />
            </AreaChart>
          ) : chartMode === 'metrics' ? (
            <LineChart data={RSCORE_HISTORY} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line type="monotone" dataKey="cpu"       name="CPU %"        stroke="#f97316" strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="memory"    name="Memory %"     stroke="#a78bfa" strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="errorRate" name="Error Rate %"  stroke="#f43f5e" strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="latency"   name="Latency (ms)" stroke="#22d3ee" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          ) : (
            <BarChart data={RSCORE_HISTORY} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={d => d.slice(5)} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="availability"  name="Availability %"   fill="#10b981" radius={[3,3,0,0]} />
              <Bar dataKey="failover"      name="Failover %"       fill="#3b82f6" radius={[3,3,0,0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* ── Activity Log (every event with R-Score result) ── */}
      <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" /> Activity Log — Every Event & R-Score Result
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            {(['ALL', 'INJECT', 'HEAL', 'AI_RECOMMEND', 'RULE_ALERT', 'SYSTEM'] as const).map(f => (
              <button
                key={f}
                onClick={() => setActFilter(f)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all border ${
                  actFilter === f
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {f === 'AI_RECOMMEND' ? 'AI' : f === 'RULE_ALERT' ? 'ALERT' : f}
              </button>
            ))}
          </div>
        </div>

        {/* Added custom scrollbar and max height for ~5 records limit */}
        <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}>
          {[...actFiltered].reverse().map((row, i) => (
            <div key={i} className={`p-4 rounded-xl border flex flex-wrap md:flex-nowrap gap-4 items-start ${getActivityBorder(row.activity.type)}`}>
              {/* Icon */}
              <div className="shrink-0 mt-0.5">{getActivityIcon(row.activity.type)}</div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-bold text-sm text-slate-200">{row.activity.title}</span>
                  {row.chaosEvent && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
                      {FAULT_LABELS[row.chaosEvent]}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{row.activity.desc}</p>
              </div>

              {/* R-Score Result */}
              <div className="shrink-0 text-right space-y-1.5 min-w-[110px]">
                <div className="text-xs text-slate-500 font-mono flex items-center gap-1 justify-end">
                  <Clock className="w-3 h-3" /> {formatDate(row.date)}
                </div>
                <div className="font-mono font-black text-xl" style={{ color: getRScoreColor(row.rscore) }}>
                  {row.rscore}
                  <span className="text-xs font-normal text-slate-500"> / 100</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold inline-block ${getMaturityStyle(row.maturity)}`}>
                  {row.maturity}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs text-slate-600">Showing {actFiltered.length} of {RSCORE_HISTORY.length} events</div>
      </div>

      {/* ── Full Data Table ── */}
      <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-400" /> All Evaluations — 8-Metric Breakdown
          </h2>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            {(['ALL', 'HEALTHY', 'WARNING', 'CRITICAL'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all border ${
                  filter === f
                    ? f === 'HEALTHY'  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : f === 'WARNING'  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : f === 'CRITICAL' ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                    : 'bg-slate-700/50 border-slate-600 text-slate-200'
                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-700">
                {['Date', 'R-Score', 'Maturity', 'Avail.', 'CPU', 'Mem', 'Err Rate', 'Restarts', 'MTTR', 'Latency', 'Failover', 'Chaos Event', 'Status'].map(h => (
                  <th key={h} className="text-left py-3 px-3 text-slate-500 uppercase tracking-wider font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...filtered].reverse().map((row, i) => (
                <tr key={i} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-3 font-mono text-slate-300 whitespace-nowrap">{formatDate(row.date)}</td>
                  <td className="py-3 px-3 font-mono font-black" style={{ color: getRScoreColor(row.rscore) }}>{row.rscore}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getMaturityStyle(row.maturity)}`}>{row.maturity}</span>
                  </td>
                  <td className="py-3 px-3 font-mono text-emerald-400">{row.availability}%</td>
                  <td className={`py-3 px-3 font-mono ${row.cpu >= 70 ? 'text-rose-400' : 'text-slate-300'}`}>{row.cpu}%</td>
                  <td className={`py-3 px-3 font-mono ${row.memory >= 75 ? 'text-rose-400' : 'text-slate-300'}`}>{row.memory}%</td>
                  <td className={`py-3 px-3 font-mono ${row.errorRate >= 1 ? 'text-rose-400' : 'text-slate-300'}`}>{row.errorRate}%</td>
                  <td className={`py-3 px-3 font-mono ${row.restarts >= 2 ? 'text-rose-400' : 'text-slate-300'}`}>{row.restarts}</td>
                  <td className={`py-3 px-3 font-mono ${row.mttr >= 15 ? 'text-rose-400' : 'text-slate-300'}`}>{row.mttr}s</td>
                  <td className={`py-3 px-3 font-mono ${row.latency >= 50 ? 'text-rose-400' : 'text-slate-300'}`}>{row.latency}ms</td>
                  <td className={`py-3 px-3 font-mono ${row.failover < 100 ? 'text-amber-400' : 'text-slate-300'}`}>{row.failover}%</td>
                  <td className="py-3 px-3">
                    {row.chaosEvent
                      ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold whitespace-nowrap">{FAULT_LABELS[row.chaosEvent]}</span>
                      : <span className="text-slate-600">—</span>
                    }
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getStatusStyle(row.status)}`}>
                      {row.status === 'HEALTHY'
                        ? <><CheckCircle2 className="w-3 h-3 inline mr-1" />{row.status}</>
                        : <><AlertTriangle className="w-3 h-3 inline mr-1" />{row.status}</>
                      }
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-10 text-slate-500">No records match the selected filter.</div>
          )}
        </div>
        <div className="mt-3 text-xs text-slate-600">Showing {filtered.length} of {RSCORE_HISTORY.length} evaluations · Red = threshold breached</div>
      </div>
    </PageContainer>
  );
};
