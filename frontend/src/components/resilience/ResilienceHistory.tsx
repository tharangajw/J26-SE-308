import React, { useEffect, useMemo, useState } from 'react';
import { PageContainer } from '../layout/PageContainer';
import { Shield, TrendingUp, TrendingDown, Activity, Download, Flame, Clock, BarChart2 } from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';

interface HistoryRecord {
  timestamp: string;
  score: number;
  maturity: string;
  cpu: number;
  memory: number;
  availability: number;
  latency: number;
  errorRate: number;
  restarts: number;
  mttr: number;
  failoverSuccess: number;
  chaosEvent: string | null;
}

interface ChaosExperiment {
  experimentName: string;
  serviceId: string;
  serviceName: string;
  faultType: string;
  engine: string;
  injectedAt: string;
  durationSec: number;
  injectedLatencyMs?: number;
  injectedErrorRatePercent?: number;
  status: 'RUNNING' | 'RECOVERED' | 'INTERRUPTED';
  completedAt?: string;
  recoveryTimeSec?: number;
  scoreBefore: number;
  scoreDuring?: number;
  scoreAfter?: number;
  availabilityBefore: number;
  availabilityDuring?: number;
  availabilityAfter?: number;
  latencyDuring?: number;
  errorRateDuring?: number;
}

const FAULT_LABELS: Record<string, string> = {
  HIGH_CPU: 'CPU Stress', HIGH_MEMORY: 'Memory Pressure', CASCADING_FAILURE: 'Cascading Outage',
  API_ERROR: 'API Error Spike', LATENCY: 'Network Latency', SERVICE_DOWN: 'Service Outage', RATE_LIMIT: 'Rate Limit'
};
function normalizeTimestamp(value: string): string {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();

  // Older backend instances stored a time-only locale string, such as "11:45:47 AM".
  const timeOnly = value.match(/^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
  if (timeOnly) {
    let hours = Number(timeOnly[1]) % 12;
    if (timeOnly[4].toUpperCase() === 'PM') hours += 12;
    const today = new Date();
    today.setHours(hours, Number(timeOnly[2]), Number(timeOnly[3]), 0);
    return today.toISOString();
  }
  return value;
}

const formatDate = (value: unknown) => {
  if (typeof value !== 'string') return String(value ?? '');
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};
const formatChartTime = (value: unknown) => {
  if (typeof value !== 'string') return String(value ?? '');
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleTimeString();
};
const statusFor = (score: number) => score >= 75 ? 'HEALTHY' : score >= 50 ? 'WARNING' : 'CRITICAL';

export const ResilienceHistory: React.FC = () => {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [experiments, setExperiments] = useState<ChaosExperiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'HEALTHY' | 'WARNING' | 'CRITICAL'>('ALL');
  const [chartMode, setChartMode] = useState<'rscore' | 'metrics' | 'rules'>('rscore');

  useEffect(() => {
    let active = true;
    const loadHistory = async () => {
      try {
        const response = await fetch('http://localhost:3010/api/resilience/history?limit=500');
        if (!response.ok) throw new Error(`History request failed (${response.status}).`);
        const data = await response.json() as { history?: HistoryRecord[]; count?: number };
        if (active) {
          const normalizedRecords = (Array.isArray(data.history) ? data.history : [])
            .map(record => ({ ...record, timestamp: normalizeTimestamp(record.timestamp) }))
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
          setRecords(normalizedRecords);
          setTotalRecords(Number.isFinite(data.count) ? Number(data.count) : normalizedRecords.length);
          setError('');
          setLoading(false);
        }
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Unable to load R-Score history.');
          setLoading(false);
        }
      }
    };
    void loadHistory();
    const timer = window.setInterval(loadHistory, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    let active = true;
    const loadExperiments = async () => {
      try {
        const response = await fetch('http://localhost:3010/api/resilience/chaos-history');
        if (!response.ok) return;
        const data = await response.json() as { experiments?: ChaosExperiment[] };
        if (active) setExperiments(Array.isArray(data.experiments) ? data.experiments : []);
      } catch {
        // Retry on the next poll if the resilience backend is restarting.
      }
    };
    void loadExperiments();
    const timer = window.setInterval(loadExperiments, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const chartRows = useMemo(() => records.map(record => ({
    ...record,
    date: record.timestamp,
    rscore: record.score,
    failover: record.failoverSuccess,
    status: statusFor(record.score)
  })), [records]);
  const visibleRows = filter === 'ALL' ? chartRows : chartRows.filter(row => row.status === filter);
  const average = records.length ? (records.reduce((sum, row) => sum + row.score, 0) / records.length).toFixed(1) : '—';
  const best = records.length ? Math.max(...records.map(row => row.score)) : '—';
  const worst = records.length ? Math.min(...records.map(row => row.score)) : '—';
  const chaosSamples = experiments.length;

  const exportCsv = () => {
    const header = 'Timestamp,R-Score,Maturity,Availability,CPU,Memory,Error Rate,Restarts,MTTR,Latency,Failover,Active Chaos';
    const rows = records.map(row => [row.timestamp, row.score, row.maturity, row.availability, row.cpu, row.memory,
      row.errorRate, row.restarts, row.mttr, row.latency, row.failoverSuccess, row.chaosEvent ?? ''].join(','));
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'resilience-rscore-history.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-orange-400 to-amber-400 flex items-center gap-3">
            <Shield className="w-7 h-7 text-rose-400" /> R-Score Full History
          </h1>
          <p className="text-sm text-slate-400 mt-1">Showing the latest 500 resilience snapshots; refreshes every 30 seconds.</p>
        </div>
        <button onClick={exportCsv} disabled={!records.length} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg hover:bg-rose-500/20 disabled:opacity-40">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>
      <div className="text-xs text-slate-500 mb-4">Showing {records.length} of {totalRecords} recorded snapshots</div>
      {loading && <p className="text-sm text-slate-400 mb-4">Loading R-Score history…</p>}
      {error && <p className="text-sm text-rose-400 mb-4">{error} Make sure the resilience backend is running.</p>}
      {!loading && !error && !records.length && <p className="text-sm text-slate-400 mb-4">No snapshots have been recorded yet. The backend will collect the first snapshot shortly.</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Avg R-Score', value: average, sub: 'All recorded snapshots', icon: <BarChart2 className="w-5 h-5 text-rose-400" /> },
          { label: 'Best Score', value: String(best), sub: 'Peak resilience', icon: <TrendingUp className="w-5 h-5 text-emerald-400" /> },
          { label: 'Lowest Score', value: String(worst), sub: 'Minimum recorded', icon: <TrendingDown className="w-5 h-5 text-amber-400" /> },
          { label: 'Chaos Experiments', value: String(chaosSamples), sub: 'Recorded injections', icon: <Flame className="w-5 h-5 text-orange-400" /> }
        ].map(card => <div key={card.label} className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">{card.icon}<span className="text-slate-400 text-xs">{card.label}</span></div>
          <div className="text-3xl font-black text-slate-100 font-mono">{card.value}</div><div className="text-xs text-slate-500 mt-1">{card.sub}</div>
        </div>)}
      </div>

      <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <h2 className="text-base font-bold text-slate-200 flex items-center gap-2"><Flame className="w-5 h-5 text-orange-400" /> Chaos Experiment Results</h2>
          <span className="text-xs text-slate-500">{experiments.length} experiments</span>
        </div>
        <p className="text-xs text-slate-500 mb-4">Shows the injected duration, latency and error-rate settings, plus measured R-Score and system metrics before, during, and after each experiment.</p>
        {experiments.length === 0 ? <p className="text-sm text-slate-400">No backend-recorded chaos experiments yet. Inject a fault from the Chaos Engineering page to start this history.</p> : (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-900"><tr className="border-b border-slate-700">
                {['Started', 'Fault / Target', 'Injection Settings', 'Measured Result (before → during → after)', 'Recovery', 'Status'].map(label => <th key={label} className="text-left py-3 px-3 text-slate-500 uppercase whitespace-nowrap">{label}</th>)}
              </tr></thead>
              <tbody>{[...experiments].reverse().map(experiment => <tr key={experiment.experimentName + experiment.injectedAt} className="border-b border-slate-800/60 align-top hover:bg-slate-800/30">
                <td className="py-3 px-3 whitespace-nowrap text-slate-300">{formatDate(experiment.injectedAt)}</td>
                <td className="py-3 px-3"><strong className="text-orange-300">{FAULT_LABELS[experiment.faultType] ?? experiment.faultType}</strong><div className="text-slate-500 mt-1">{experiment.serviceName}</div><div className="text-slate-600">{experiment.engine}</div></td>
                <td className="py-3 px-3 whitespace-nowrap text-slate-300"><div>Duration: {experiment.durationSec}s</div><div>Latency: {experiment.injectedLatencyMs != null ? String(experiment.injectedLatencyMs) + 'ms' : '—'}</div><div>Error rate: {experiment.injectedErrorRatePercent != null ? String(experiment.injectedErrorRatePercent) + '%' : '—'}</div></td>
                <td className="py-3 px-3 text-slate-300"><div>R-Score: {experiment.scoreBefore} → {experiment.scoreDuring ?? '—'} → {experiment.scoreAfter ?? '—'}</div><div>Availability: {experiment.availabilityBefore}% → {experiment.availabilityDuring ?? '—'}% → {experiment.availabilityAfter ?? '—'}%</div><div>During: {experiment.latencyDuring ?? '—'}ms latency, {experiment.errorRateDuring ?? '—'}% errors</div></td>
                <td className="py-3 px-3 whitespace-nowrap text-slate-300">{experiment.recoveryTimeSec != null ? String(experiment.recoveryTimeSec) + 's' : experiment.completedAt ? 'Recovered' : '—'}</td>
                <td className="py-3 px-3 whitespace-nowrap"><span className={experiment.status === 'RECOVERED' ? 'text-emerald-400' : experiment.status === 'RUNNING' ? 'text-amber-400' : 'text-slate-400'}>{experiment.status}</span></td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-bold text-slate-200 flex items-center gap-2"><Activity className="w-5 h-5 text-rose-400" /> Score Timeline</h2>
          <div className="flex gap-2">{(['rscore', 'metrics', 'rules'] as const).map(mode => <button key={mode} onClick={() => setChartMode(mode)} className={`px-3 py-1.5 rounded-lg text-xs border ${chartMode === mode ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
            {mode === 'rscore' ? 'R-Score' : mode === 'metrics' ? 'CPU & Memory' : 'Availability & Failover'}
          </button>)}</div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          {chartMode === 'rscore' ? <AreaChart data={chartRows}><defs><linearGradient id="rscoreFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} /><stop offset="95%" stopColor="#f43f5e" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" /><XAxis dataKey="date" tickFormatter={formatChartTime} tick={{ fontSize: 10, fill: '#64748b' }} /><YAxis domain={[0, 100]} /><Tooltip labelFormatter={formatDate} /><ReferenceLine y={75} stroke="#3b82f6" strokeDasharray="4 4" /><Area type="monotone" dataKey="rscore" name="R-Score" stroke="#f43f5e" fill="url(#rscoreFill)" /></AreaChart>
            : chartMode === 'metrics' ? <LineChart data={chartRows}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" /><XAxis dataKey="date" tickFormatter={formatChartTime} tick={{ fontSize: 10, fill: '#64748b' }} /><YAxis /><Tooltip labelFormatter={formatDate} /><Legend /><Line dataKey="cpu" name="CPU %" stroke="#f97316" dot={false} /><Line dataKey="memory" name="Memory %" stroke="#a78bfa" dot={false} /></LineChart>
              : <BarChart data={chartRows}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" /><XAxis dataKey="date" tickFormatter={formatChartTime} tick={{ fontSize: 10, fill: '#64748b' }} /><YAxis domain={[0, 100]} /><Tooltip labelFormatter={formatDate} /><Legend /><Bar dataKey="availability" name="Availability %" fill="#10b981" /><Bar dataKey="failover" name="Failover %" fill="#3b82f6" /></BarChart>}
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-bold text-slate-200 flex items-center gap-2"><Clock className="w-5 h-5 text-slate-400" /> Recorded Evaluations</h2>
          <div className="flex gap-2">{(['ALL', 'HEALTHY', 'WARNING', 'CRITICAL'] as const).map(value => <button key={value} onClick={() => setFilter(value)} className={`px-3 py-1 rounded-md text-xs border ${filter === value ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{value}</button>)}</div>
        </div>
        <div className="max-h-[420px] overflow-auto"><table className="w-full text-xs border-collapse"><thead className="sticky top-0 z-10 bg-slate-900"><tr className="border-b border-slate-700">{['Timestamp', 'R-Score', 'Maturity', 'Avail.', 'CPU', 'Mem', 'Err Rate', 'Restarts', 'MTTR', 'Latency', 'Failover', 'Active Chaos', 'Status'].map(label => <th key={label} className="text-left py-3 px-3 text-slate-500 uppercase whitespace-nowrap">{label}</th>)}</tr></thead>
          <tbody>{[...visibleRows].reverse().map((row, index) => <tr key={`${row.timestamp}-${index}`} className="border-b border-slate-800/60 hover:bg-slate-800/30"><td className="py-3 px-3 font-mono text-slate-300 whitespace-nowrap">{formatDate(row.timestamp)}</td><td className="py-3 px-3 font-mono font-black text-rose-300">{row.score}</td><td className="py-3 px-3 text-slate-300">{row.maturity}</td><td className="py-3 px-3">{row.availability}%</td><td className="py-3 px-3">{row.cpu}%</td><td className="py-3 px-3">{row.memory}%</td><td className="py-3 px-3">{row.errorRate}%</td><td className="py-3 px-3">{row.restarts}</td><td className="py-3 px-3">{row.mttr}s</td><td className="py-3 px-3">{row.latency}ms</td><td className="py-3 px-3">{row.failoverSuccess}%</td><td className="py-3 px-3">{row.chaosEvent ? FAULT_LABELS[row.chaosEvent] ?? row.chaosEvent : '—'}</td><td className="py-3 px-3">{statusFor(row.score)}</td></tr>)}</tbody>
        </table></div>
        <div className="mt-3 text-xs text-slate-600">Showing {visibleRows.length} of {records.length} saved snapshots.</div>
      </div>
    </PageContainer>
  );
};
