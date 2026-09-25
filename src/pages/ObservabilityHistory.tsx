import React, { useState } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import {
  Activity, Clock, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, Filter, Download, Database, Radio, Network,
  ShieldAlert, BarChart2
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine, BarChart, Bar
} from 'recharts';
import { OBS_AHP } from '../lib/ahpEngine';

/* ─── Extended history data ──────────────────────────────────────────────────── */
const FULL_HISTORY = [
  { date: '2026-05-01', oscore: 72.1, cci: 78,  metrics: 0.91, traces: 0.88, logs: 0.93, blindSpots: 3, errorRate: 3.8,  latency: 210, status: 'WARNING'  },
  { date: '2026-05-04', oscore: 74.8, cci: 80,  metrics: 0.92, traces: 0.89, logs: 0.94, blindSpots: 2, errorRate: 3.2,  latency: 195, status: 'WARNING'  },
  { date: '2026-05-07', oscore: 78.3, cci: 83,  metrics: 0.93, traces: 0.91, logs: 0.95, blindSpots: 1, errorRate: 2.8,  latency: 175, status: 'WARNING'  },
  { date: '2026-05-10', oscore: 80.2, cci: 85,  metrics: 0.94, traces: 0.92, logs: 0.96, blindSpots: 1, errorRate: 2.4,  latency: 158, status: 'HEALTHY'  },
  { date: '2026-05-13', oscore: 79.6, cci: 84,  metrics: 0.93, traces: 0.91, logs: 0.95, blindSpots: 2, errorRate: 2.6,  latency: 165, status: 'WARNING'  },
  { date: '2026-05-16', oscore: 82.0, cci: 87,  metrics: 0.95, traces: 0.93, logs: 0.97, blindSpots: 0, errorRate: 2.0,  latency: 148, status: 'HEALTHY'  },
  { date: '2026-05-19', oscore: 81.5, cci: 86,  metrics: 0.94, traces: 0.93, logs: 0.96, blindSpots: 0, errorRate: 2.1,  latency: 152, status: 'HEALTHY'  },
  { date: '2026-05-22', oscore: 63.2, cci: 68,  metrics: 0.82, traces: 0.78, logs: 0.90, blindSpots: 5, errorRate: 6.1,  latency: 320, status: 'CRITICAL' },
  { date: '2026-05-25', oscore: 75.4, cci: 79,  metrics: 0.93, traces: 0.89, logs: 0.94, blindSpots: 2, errorRate: 3.0,  latency: 185, status: 'WARNING'  },
  { date: '2026-05-28', oscore: 83.7, cci: 88,  metrics: 0.95, traces: 0.94, logs: 0.97, blindSpots: 0, errorRate: 1.9,  latency: 140, status: 'HEALTHY'  },
  { date: '2026-05-31', oscore: 84.1, cci: 89,  metrics: 0.96, traces: 0.94, logs: 0.97, blindSpots: 0, errorRate: 1.8,  latency: 136, status: 'HEALTHY'  },
  { date: '2026-06-03', oscore: 84.6, cci: 89,  metrics: 0.96, traces: 0.95, logs: 0.98, blindSpots: 0, errorRate: 1.7,  latency: 132, status: 'HEALTHY'  },
  { date: '2026-06-06', oscore: 82.9, cci: 87,  metrics: 0.95, traces: 0.93, logs: 0.97, blindSpots: 1, errorRate: 2.1,  latency: 145, status: 'HEALTHY'  },
  { date: '2026-06-09', oscore: 85.1, cci: 90,  metrics: 0.96, traces: 0.95, logs: 0.98, blindSpots: 0, errorRate: 1.6,  latency: 128, status: 'HEALTHY'  },
  { date: '2026-06-12', oscore: 85.1, cci: 91,  metrics: 0.97, traces: 0.95, logs: 0.98, blindSpots: 0, errorRate: 1.6,  latency: 126, status: 'HEALTHY'  },
  { date: '2026-06-13', oscore: 87.4, cci: 92,  metrics: 0.98, traces: 0.95, logs: 0.99, blindSpots: 1, errorRate: 1.4,  latency: 120, status: 'HEALTHY'  },
];

const INCIDENTS = [
  { date: '2026-05-22', title: 'Jaeger Trace Outage', severity: 'CRITICAL', impact: '-24.3 pts', resolved: true, resolvedIn: '4h 12m', cause: 'Jaeger collector pod OOMKilled; trace ID propagation dropped to 78%.' },
  { date: '2026-05-07', title: 'Loki Log Ingestion Lag', severity: 'WARNING',  impact: '-6.2 pts',  resolved: true, resolvedIn: '1h 38m', cause: 'Loki ingestion fell behind during traffic spike; 2 blind spots detected.' },
  { date: '2026-05-01', title: 'Prometheus Scrape Gaps', severity: 'WARNING',  impact: '-3.5 pts',  resolved: true, resolvedIn: '45m',    cause: 'Service discovery misconfiguration caused 3 scrape targets to be missed.' },
];

function getStatusStyle(status: string) {
  if (status === 'HEALTHY')  return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  if (status === 'WARNING')  return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  if (status === 'CRITICAL') return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs space-y-1 shadow-xl">
      <div className="font-bold text-slate-200 mb-2">{formatDate(label)}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-6" style={{ color: p.color }}>
          <span>{p.name}</span>
          <span className="font-mono font-bold">{typeof p.value === 'number' && p.value < 2 ? `${(p.value * 100).toFixed(1)}%` : p.value}</span>
        </div>
      ))}
    </div>
  );
};

/* ─── Main Component ─────────────────────────────────────────────────────────── */
export const ObservabilityHistory: React.FC = () => {
  const [filter, setFilter] = useState<'ALL' | 'HEALTHY' | 'WARNING' | 'CRITICAL'>('ALL');
  const [chartMode, setChartMode] = useState<'oscore' | 'pillars' | 'blindspots'>('oscore');

  const filtered = filter === 'ALL' ? FULL_HISTORY : FULL_HISTORY.filter(r => r.status === filter);

  const avgScore   = (FULL_HISTORY.reduce((a, r) => a + r.oscore, 0) / FULL_HISTORY.length).toFixed(1);
  const bestScore  = Math.max(...FULL_HISTORY.map(r => r.oscore)).toFixed(1);
  const worstScore = Math.min(...FULL_HISTORY.map(r => r.oscore)).toFixed(1);
  const totalBlindSpots = FULL_HISTORY.reduce((a, r) => a + r.blindSpots, 0);

  /* Export CSV */
  const handleExport = () => {
    const header = 'Date,O-Score,CCI,Metrics%,Traces%,Logs%,BlindSpots,ErrorRate%,Latency(ms),Status';
    const rows = FULL_HISTORY.map(r =>
      `${r.date},${r.oscore},${r.cci},${(r.metrics * 100).toFixed(1)},${(r.traces * 100).toFixed(1)},${(r.logs * 100).toFixed(1)},${r.blindSpots},${r.errorRate},${r.latency},${r.status}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'observability-history.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageContainer>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-emerald-400 to-cyan-400 flex items-center gap-3">
            <Activity className="w-7 h-7 text-indigo-400" />
            O-Score Full History
          </h1>
          <p className="text-sm text-slate-400 mt-1">Complete AHP-weighted observability score timeline — {FULL_HISTORY.length} evaluations</p>
        </div>
        <button
          onClick={handleExport}
          className="obs-btn-primary text-sm"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Avg O-Score', value: avgScore, sub: 'All-time average', icon: <BarChart2 className="w-5 h-5 text-indigo-400" />, color: 'text-indigo-400' },
          { label: 'Best Score',  value: bestScore,  sub: 'Peak observability', icon: <TrendingUp className="w-5 h-5 text-emerald-400" />, color: 'text-emerald-400' },
          { label: 'Worst Score', value: worstScore, sub: 'Lowest recorded',    icon: <TrendingDown className="w-5 h-5 text-rose-400" />, color: 'text-rose-400' },
          { label: 'Blind Spots', value: totalBlindSpots, sub: 'Total detected', icon: <ShieldAlert className="w-5 h-5 text-amber-400" />, color: 'text-amber-400' },
        ].map(c => (
          <div key={c.label} className="obs-glass p-5 obs-lift">
            <div className="flex items-center gap-2 mb-3">{c.icon}<span className="text-slate-400 text-xs font-medium">{c.label}</span></div>
            <div className={`text-3xl font-black ${c.color} font-mono`}>{c.value}</div>
            <div className="text-xs text-slate-500 mt-1">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── AHP Weights reminder banner ── */}
      <div className="obs-glass p-4 mb-6 flex flex-wrap items-center gap-6 text-xs border-indigo-500/20 bg-indigo-500/5">
        <span className="text-indigo-400 font-bold uppercase tracking-widest">AHP Weights (Saaty)</span>
        {OBS_AHP.labels.map((l, i) => {
          const colors = ['text-orange-400', 'text-indigo-400', 'text-cyan-400'];
          return (
            <span key={l} className={`flex items-center gap-1.5 font-mono ${colors[i]}`}>
              {i === 0 && <Database className="w-3.5 h-3.5" />}
              {i === 1 && <Network className="w-3.5 h-3.5" />}
              {i === 2 && <Radio className="w-3.5 h-3.5" />}
              {l.split(' ')[0]}: <strong>{(OBS_AHP.weights[i] * 100).toFixed(1)}%</strong>
            </span>
          );
        })}
        <span className="ml-auto text-slate-500">CR = {OBS_AHP.consistencyRatio.toFixed(4)} &lt; 0.10 ✓</span>
      </div>

      {/* ── Chart Tabs + Chart ── */}
      <div className="obs-glass p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h2 className="text-base font-bold text-slate-200">Score Timeline</h2>
          <div className="flex gap-2">
            {(['oscore', 'pillars', 'blindspots'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setChartMode(mode)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  chartMode === mode
                    ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-300'
                    : 'bg-slate-800/50 border border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {mode === 'oscore' ? 'O-Score & CCI' : mode === 'pillars' ? 'Pillar Coverage' : 'Blind Spots'}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          {chartMode === 'oscore' ? (
            <AreaChart data={FULL_HISTORY} margin={{ left: -10, right: 10 }}>
              <defs>
                <linearGradient id="gradOs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradCci" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={d => d.slice(5)} />
              <YAxis domain={[55, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <ReferenceLine y={80} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: 'Min threshold', position: 'right', fill: '#f43f5e', fontSize: 10 }} />
              <Area type="monotone" dataKey="oscore" name="O-Score" stroke="#818cf8" strokeWidth={2} fill="url(#gradOs)" dot={{ fill: '#818cf8', r: 3 }} activeDot={{ r: 5 }} />
              <Area type="monotone" dataKey="cci" name="CCI Index" stroke="#34d399" strokeWidth={1.5} strokeDasharray="4 2" fill="url(#gradCci)" dot={false} />
            </AreaChart>
          ) : chartMode === 'pillars' ? (
            <LineChart data={FULL_HISTORY} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={d => d.slice(5)} />
              <YAxis domain={[0.7, 1]} tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line type="monotone" dataKey="metrics" name={`Metrics (${(OBS_AHP.weights[0]*100).toFixed(1)}%)`} stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="traces"  name={`Traces (${(OBS_AHP.weights[1]*100).toFixed(1)}%)`}  stroke="#818cf8" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="logs"    name={`Logs (${(OBS_AHP.weights[2]*100).toFixed(1)}%)`}    stroke="#22d3ee" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          ) : (
            <BarChart data={FULL_HISTORY} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="blindSpots" name="Blind Spots" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* ── Incident Log ── */}
      <div className="obs-glass p-6 mb-6">
        <h2 className="text-base font-bold text-slate-200 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" /> Notable Incidents
        </h2>
        <div className="space-y-3">
          {INCIDENTS.map((inc, i) => (
            <div key={i} className={`p-4 rounded-xl border flex flex-wrap md:flex-nowrap gap-4 items-start ${
              inc.severity === 'CRITICAL' ? 'border-rose-500/30 bg-rose-500/5' : 'border-amber-500/30 bg-amber-500/5'
            }`}>
              <div className="shrink-0 mt-0.5">
                {inc.severity === 'CRITICAL'
                  ? <AlertTriangle className="w-5 h-5 text-rose-400" />
                  : <AlertTriangle className="w-5 h-5 text-amber-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-bold text-sm text-slate-200">{inc.title}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase ${getStatusStyle(inc.severity)}`}>{inc.severity}</span>
                  {inc.resolved && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">RESOLVED</span>}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{inc.cause}</p>
              </div>
              <div className="shrink-0 text-right space-y-1">
                <div className="text-xs text-slate-500 font-mono">{formatDate(inc.date)}</div>
                <div className="text-xs font-bold text-rose-400">{inc.impact}</div>
                {inc.resolved && <div className="text-xs text-emerald-400">↩ {inc.resolvedIn}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Full Data Table ── */}
      <div className="obs-glass p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-400" /> All Evaluations
          </h2>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            {(['ALL', 'HEALTHY', 'WARNING', 'CRITICAL'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all border ${
                  filter === f
                    ? f === 'HEALTHY' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : f === 'WARNING' ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : f === 'CRITICAL' ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                      : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
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
                {['Date', 'O-Score', 'CCI', 'Metrics', 'Traces', 'Logs', 'Blind Spots', 'Error Rate', 'p95 Latency', 'Status'].map(h => (
                  <th key={h} className="text-left py-3 px-3 text-slate-500 uppercase tracking-wider font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={i} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-3 font-mono text-slate-300 whitespace-nowrap">{formatDate(row.date)}</td>
                  <td className="py-3 px-3 font-mono font-bold text-indigo-300">{row.oscore}</td>
                  <td className="py-3 px-3 font-mono text-emerald-400">{row.cci}</td>
                  <td className="py-3 px-3 font-mono text-orange-400">{(row.metrics * 100).toFixed(1)}%</td>
                  <td className="py-3 px-3 font-mono text-indigo-400">{(row.traces * 100).toFixed(1)}%</td>
                  <td className="py-3 px-3 font-mono text-cyan-400">{(row.logs * 100).toFixed(1)}%</td>
                  <td className="py-3 px-3 font-mono">
                    <span className={`font-bold ${row.blindSpots === 0 ? 'text-emerald-400' : row.blindSpots >= 3 ? 'text-rose-400' : 'text-amber-400'}`}>
                      {row.blindSpots}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-300">{row.errorRate}%</td>
                  <td className="py-3 px-3 font-mono text-slate-300">{row.latency} ms</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getStatusStyle(row.status)}`}>
                      {row.status === 'HEALTHY' && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                      {row.status !== 'HEALTHY' && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                      {row.status}
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
        <div className="mt-3 text-xs text-slate-600">Showing {filtered.length} of {FULL_HISTORY.length} evaluations</div>
      </div>
    </PageContainer>
  );
};
