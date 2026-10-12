import React, { useState } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import {
  Activity, Clock, TrendingUp, TrendingDown, TriangleAlert,
  CheckCircle2, Filter, Download, Database, Radio, Network,
  ShieldAlert, BarChart3
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine, BarChart, Bar
} from 'recharts';
import { OBS_AHP } from '../lib/ahpEngine';
import { useTelemetry } from '../context/TelemetryContext';

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
  if (status === 'HEALTHY')  return 'text-emerald-400';
  if (status === 'WARNING')  return 'text-amber-400';
  if (status === 'CRITICAL') return 'text-rose-400';
  return 'text-text-muted';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="space-y-1 rounded-md border border-border bg-surface p-3 text-xs shadow-sm">
      <div className="mb-2 font-medium text-text-primary">{formatDate(label)}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-6" style={{ color: p.color }}>
          <span>{p.name}</span>
          <span className="font-mono">{typeof p.value === 'number' && p.value < 2 ? `${(p.value * 100).toFixed(1)}%` : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export const ObservabilityHistory: React.FC = () => {
  const { history: liveHistory, cciIndex } = useTelemetry();
  const [filter, setFilter] = useState<'ALL' | 'HEALTHY' | 'WARNING' | 'CRITICAL'>('ALL');
  const [chartMode, setChartMode] = useState<'oscore' | 'pillars' | 'blindspots'>('oscore');

  const combinedHistory = [...FULL_HISTORY, ...liveHistory];
  const filtered = filter === 'ALL' ? combinedHistory : combinedHistory.filter(r => r.status === filter);

  const avgScore = combinedHistory.length > 0 ? (combinedHistory.reduce((a, r) => a + r.oscore, 0) / combinedHistory.length).toFixed(1) : "0";
  const bestScore = combinedHistory.length > 0 ? Math.max(...combinedHistory.map(r => r.oscore)).toFixed(1) : "0";
  const worstScore = combinedHistory.length > 0 ? Math.min(...combinedHistory.map(r => r.oscore)).toFixed(1) : "0";
  const totalBlindSpots = combinedHistory.reduce((a, r) => a + r.blindSpots, 0);

  const handleExport = () => {
    const header = 'Date,O-Score,CCI,Metrics%,Traces%,Logs%,BlindSpots,ErrorRate%,Latency(ms),Status';
    const rows = combinedHistory.map(r =>
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
    <PageContainer className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-brand-obs">
            <Activity className="h-6 w-6 text-brand-obs" />
            O-Score History
          </h2>
          <p className="mt-1 text-sm text-text-secondary">Complete AHP-weighted observability score timeline — {combinedHistory.length} evaluations</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-secondary/40 px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-secondary"
        >
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Avg O-Score', value: avgScore, sub: 'All-time average', icon: BarChart3, color: 'text-brand-obs' },
          { label: 'Best Score',  value: bestScore,  sub: 'Peak observability', icon: TrendingUp, color: 'text-emerald-400' },
          { label: 'Worst Score', value: worstScore, sub: 'Lowest recorded',    icon: TrendingDown, color: 'text-rose-400' },
          { label: 'Blind Spots', value: totalBlindSpots, sub: 'Total detected', icon: ShieldAlert, color: 'text-amber-400' },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className="border-border bg-surface-secondary/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">{c.label}</span>
                  <Icon className={`h-4 w-4 ${c.color}`} />
                </div>
                <div className={`mt-2 font-mono text-2xl font-semibold ${c.color}`}>{c.value}</div>
                <p className="mt-1 text-[11px] text-text-muted">{c.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center justify-between rounded-md border border-border bg-surface-secondary/20 px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Current CCI Index</span>
        <span className="font-mono text-2xl font-semibold text-brand-obs">{cciIndex}%</span>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 p-4 text-xs">
          <span className="font-semibold uppercase tracking-widest text-text-secondary">AHP Weights</span>
          {OBS_AHP.labels.map((l, i) => {
            const colors = ['text-orange-400', 'text-indigo-400', 'text-cyan-400'];
            return (
              <span key={l} className={`flex items-center gap-1.5 font-mono ${colors[i]}`}>
                {i === 0 && <Database className="h-3.5 w-3.5" />}
                {i === 1 && <Network className="h-3.5 w-3.5" />}
                {i === 2 && <Radio className="h-3.5 w-3.5" />}
                {l.split(' ')[0]}: <strong>{(OBS_AHP.weights[i] * 100).toFixed(1)}%</strong>
              </span>
            );
          })}
          <span className="ml-auto text-text-muted">CR = {OBS_AHP.consistencyRatio.toFixed(4)} &lt; 0.10</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Score Timeline</CardTitle>
            <div className="flex gap-2">
              {(['oscore', 'pillars', 'blindspots'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setChartMode(mode)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    chartMode === mode
                      ? 'border-brand-obs/60 bg-brand-obs/10 text-brand-obs'
                      : 'border-border bg-surface-secondary/40 text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {mode === 'oscore' ? 'O-Score & CCI' : mode === 'pillars' ? 'Pillar Coverage' : 'Blind Spots'}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            {chartMode === 'oscore' ? (
              <AreaChart data={combinedHistory} margin={{ left: -10, right: 10 }}>
                <defs>
                  <linearGradient id="gradOs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradCci" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#252C35" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#5E6875' }} tickFormatter={d => d.slice(5)} />
                <YAxis domain={[55, 100]} tick={{ fontSize: 10, fill: '#5E6875' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <ReferenceLine y={80} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: 'Min threshold', position: 'right', fill: '#f43f5e', fontSize: 10 }} />
                <Area type="monotone" dataKey="oscore" name="O-Score" stroke="#10B981" strokeWidth={2} fill="url(#gradOs)" />
                <Area type="monotone" dataKey="cci" name="CCI Index" stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="4 2" fill="url(#gradCci)" />
              </AreaChart>
            ) : chartMode === 'pillars' ? (
              <LineChart data={combinedHistory} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252C35" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#5E6875' }} tickFormatter={d => d.slice(5)} />
                <YAxis domain={[0.7, 1]} tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 10, fill: '#5E6875' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="metrics" name={`Metrics (${(OBS_AHP.weights[0]*100).toFixed(1)}%)`} stroke="#f97316" strokeWidth={2} />
                <Line type="monotone" dataKey="traces"  name={`Traces (${(OBS_AHP.weights[1]*100).toFixed(1)}%)`}  stroke="#818cf8" strokeWidth={2} />
                <Line type="monotone" dataKey="logs"    name={`Logs (${(OBS_AHP.weights[2]*100).toFixed(1)}%)`}    stroke="#22d3ee" strokeWidth={2} />
              </LineChart>
            ) : (
              <BarChart data={combinedHistory} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252C35" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#5E6875' }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: '#5E6875' }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="blindSpots" name="Blind Spots" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
            <TriangleAlert className="h-4 w-4 text-amber-400" /> Notable Incidents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {INCIDENTS.map((inc) => (
            <div key={inc.title} className={`flex flex-wrap items-start gap-4 rounded-md border p-4 md:flex-nowrap ${
              inc.severity === 'CRITICAL' ? 'border-rose-500/30 bg-rose-500/5' : 'border-amber-500/30 bg-amber-500/5'
            }`}>
              <TriangleAlert className={`mt-0.5 h-4 w-4 shrink-0 ${inc.severity === 'CRITICAL' ? 'text-rose-400' : 'text-amber-400'}`} />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">{inc.title}</span>
                  <span className={`text-[10px] font-medium uppercase ${getStatusStyle(inc.severity)}`}>{inc.severity}</span>
                  {inc.resolved && <span className="text-[10px] font-medium uppercase text-emerald-400">Resolved</span>}
                </div>
                <p className="text-xs leading-relaxed text-text-secondary">{inc.cause}</p>
              </div>
              <div className="shrink-0 space-y-1 text-right">
                <div className="font-mono text-xs text-text-muted">{formatDate(inc.date)}</div>
                <div className="text-xs font-semibold text-rose-400">{inc.impact}</div>
                {inc.resolved && <div className="text-xs text-emerald-400">{inc.resolvedIn}</div>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
              <Clock className="h-4 w-4 text-brand-obs" /> All Evaluations
            </CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-text-muted" />
              {(['ALL', 'HEALTHY', 'WARNING', 'CRITICAL'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                    filter === f
                      ? f === 'HEALTHY' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                        : f === 'WARNING' ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                        : f === 'CRITICAL' ? 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                        : 'border-brand-obs/60 bg-brand-obs/10 text-brand-obs'
                      : 'border-border bg-surface-secondary/40 text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border">
                  {['Date', 'O-Score', 'CCI', 'Metrics', 'Traces', 'Logs', 'Blind Spots', 'Error Rate', 'p95 Latency', 'Status'].map(h => (
                    <th key={h} className="whitespace-nowrap px-3 py-3 text-left font-medium uppercase tracking-wider text-text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr key={`${row.date}-${i}`} className="border-b border-border/60 hover:bg-surface-secondary/30">
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-text-secondary">{formatDate(row.date)}</td>
                    <td className="px-3 py-3 font-mono font-semibold text-brand-obs">{row.oscore}</td>
                    <td className="px-3 py-3 font-mono text-cyan-400">{row.cci}</td>
                    <td className="px-3 py-3 font-mono text-orange-400">{(row.metrics * 100).toFixed(1)}%</td>
                    <td className="px-3 py-3 font-mono text-indigo-400">{(row.traces * 100).toFixed(1)}%</td>
                    <td className="px-3 py-3 font-mono text-cyan-400">{(row.logs * 100).toFixed(1)}%</td>
                    <td className="px-3 py-3 font-mono">
                      <span className={row.blindSpots === 0 ? 'text-emerald-400' : row.blindSpots >= 3 ? 'text-rose-400' : 'text-amber-400'}>
                        {row.blindSpots}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono text-text-secondary">{row.errorRate}%</td>
                    <td className="px-3 py-3 font-mono text-text-secondary">{row.latency} ms</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium uppercase ${getStatusStyle(row.status)}`}>
                        {row.status === 'HEALTHY' ? <CheckCircle2 className="h-3 w-3" /> : <TriangleAlert className="h-3 w-3" />}
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="py-10 text-center text-text-muted">No records match the selected filter.</div>
            )}
          </div>
          <div className="mt-3 text-xs text-text-muted">Showing {filtered.length} of {combinedHistory.length} evaluations</div>
        </CardContent>
      </Card>
    </PageContainer>
  );
};
