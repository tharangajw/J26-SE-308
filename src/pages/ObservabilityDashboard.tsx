
import {
  CheckCircle2,
  Activity,
  AlertTriangle,
  Database,
  Radio,
  Network,
  Sparkles,
  Clock,
  ShieldCheck,
  Eye,
  BarChart2,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { Link } from 'react-router-dom';
import { useTelemetry } from '../context/TelemetryContext';
/* ── Mock Data ────────────────────────────────────────────── */
const oscoreHistory = [
  { name: 'Jun 1', oscore: 84, cci: 88, errorRate: 2.1 },
  { name: 'Jun 3', oscore: 86, cci: 90, errorRate: 1.8 },
  { name: 'Jun 5', oscore: 83, cci: 87, errorRate: 2.5 },
  { name: 'Jun 7', oscore: 88, cci: 92, errorRate: 1.4 },
  { name: 'Jun 9', oscore: 85, cci: 89, errorRate: 1.9 },
  { name: 'Jun 11', oscore: 87, cci: 91, errorRate: 2.0 },
  { name: 'Jun 13', oscore: 87, cci: 92, errorRate: 1.7 },
];

const pipelinePhases = [
  {
    step: 1,
    title: 'Ingestion',
    subtitle: '3-Pillar Telemetry',
    metric: 'Coverage Rate',
    value: '98%',
    threshold: '> 90%',
    status: 'PASS',
    icon: Database,
    accent: '#f97316',
    iconColor: 'text-orange-400',
    iconBg: 'bg-orange-500/15',
    nodeBg: 'bg-orange-500',
    cardBg: 'bg-orange-500/5',
    cardBorder: 'border-orange-500/25',
    badge: 'bg-orange-500/10 text-orange-400 border-orange-500/25',
    valueCls: 'text-orange-400',
  },
  {
    step: 2,
    title: 'CCI Correlation',
    subtitle: '±2s Time Window',
    metric: 'Correlation',
    value: '92%',
    threshold: '> 80%',
    status: 'PASS',
    icon: Activity,
    accent: '#22d3ee',
    iconColor: 'text-cyan-400',
    iconBg: 'bg-cyan-500/15',
    nodeBg: 'bg-cyan-500',
    cardBg: 'bg-cyan-500/5',
    cardBorder: 'border-cyan-500/25',
    badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25',
    valueCls: 'text-cyan-400',
  },
  {
    step: 3,
    title: 'O-Score Calc',
    subtitle: 'Weighted + Penalty',
    metric: 'O-Score',
    value: '87.4',
    threshold: '> 80',
    status: 'PASS',
    icon: BarChart2,
    accent: '#818cf8',
    iconColor: 'text-indigo-400',
    iconBg: 'bg-indigo-500/15',
    nodeBg: 'bg-indigo-500',
    cardBg: 'bg-indigo-500/5',
    cardBorder: 'border-indigo-500/25',
    badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25',
    valueCls: 'text-indigo-400',
  },
  {
    step: 4,
    title: 'AI RCA Engine',
    subtitle: 'Root Cause Diagnosis',
    metric: 'AI Confidence',
    value: '94%',
    threshold: '> 85%',
    status: 'PASS',
    icon: Sparkles,
    accent: '#a855f7',
    iconColor: 'text-purple-400',
    iconBg: 'bg-purple-500/15',
    nodeBg: 'bg-purple-500',
    cardBg: 'bg-purple-500/5',
    cardBorder: 'border-purple-500/25',
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/25',
    valueCls: 'text-purple-400',
  },
  {
    step: 5,
    title: 'Remediation',
    subtitle: 'Auto Fix Scripts',
    metric: 'Fix Status',
    value: 'Ready',
    threshold: 'Auto',
    status: 'HEALTHY',
    icon: ShieldCheck,
    accent: '#10b981',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/15',
    nodeBg: 'bg-emerald-500',
    cardBg: 'bg-emerald-500/5',
    cardBorder: 'border-emerald-500/25',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    valueCls: 'text-emerald-400',
  },
];

/* ── Timeline Item ────────────────────────────────────────── */
const TimelineItem = ({ title, time, status, icon, isLast = false }: any) => (
  <div className="relative pl-8 pb-6 last:pb-0">
    {!isLast && <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />}
    <div className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center border-2 border-background z-10 ${status === 'success' ? 'bg-green-500/20 text-green-500' : 'bg-brand-obs/20 text-brand-obs'
      }`}>
      {status === 'success' ? <CheckCircle2 className="w-4 h-4" /> : icon}
    </div>
    <div className="flex justify-between items-start">
      <div>
        <div className="text-sm font-medium text-text-primary">{title}</div>
        <div className="text-xs text-text-muted mt-0.5">{time}</div>
      </div>
      {status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
    </div>
  </div>
);

/* ── Main Component ───────────────────────────────────────── */
export const ObservabilityDashboard = () => {
  const { telemetry, oScore } = useTelemetry();

  return (
    <div className="h-full bg-background text-text-primary p-4 lg:p-6 overflow-y-auto">

      {/* ── Header ── */}
      <div className="flex flex-wrap lg:flex-nowrap justify-between items-center bg-surface border border-border rounded-xl p-4 shadow-sm mb-6 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-obs/10 border border-brand-obs/20 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.15)]">
            <Eye className="text-brand-obs w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-text-primary tracking-wide">Observability Engine</h1>
            <p className="text-[10px] text-text-muted uppercase tracking-widest">
              Real-Time Telemetry Correlation &<br />AI-Driven Root Cause Analysis
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm bg-surface-secondary/50 px-6 py-2 rounded-lg border border-border/50">
          <div className="flex gap-2 items-center">
            <span className="text-text-muted">Metrics:</span>
            <span className="flex items-center gap-1.5 font-mono text-orange-400"><Database className="w-3.5 h-3.5" /> Prometheus</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-text-muted">Logs:</span>
            <span className="flex items-center gap-1.5 font-mono text-cyan-400"><Radio className="w-3.5 h-3.5" /> Loki</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-text-muted">Traces:</span>
            <span className="flex items-center gap-1.5 font-mono text-indigo-400"><Network className="w-3.5 h-3.5" /> Jaeger</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-text-muted">CCI Window:</span>
            <span className="font-mono text-text-primary">±2s</span>
          </div>
        </div>

        <div className="flex items-center gap-4 border-l border-border pl-4">
          <div className="text-right">
            <div className="text-sm font-semibold flex items-center gap-2 justify-end">
              <Activity className="w-4 h-4 text-brand-obs" />
              O-Score: <span className="text-brand-obs">{oScore.toFixed(1)}</span>
            </div>
            <div className="text-xs text-text-muted mt-0.5">
              {telemetry ? `Live: ${telemetry.metrics.cpuUsage.toFixed(1)}% CPU` : 'Loading...'}
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span className="text-xs font-semibold">Live</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── Left Main (8 cols) ── */}
        <div className="lg:col-span-8 flex flex-col gap-6">

          {/* Top 3 KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* System Health */}
            <div className="bg-surface border border-border rounded-xl p-5 relative overflow-hidden flex flex-col justify-between">
              <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-2">System Health</div>
              <div className="flex items-center gap-3 mb-6">
                <div className="text-xl font-bold text-green-500 tracking-wide">HEALTHY</div>
                <CheckCircle2 className="text-green-500 w-6 h-6" />
              </div>
              <div className="flex items-center justify-between mt-auto z-10">
                <div className="text-xs font-medium text-text-muted flex items-center gap-1.5">
                  Blind Spots: <span className="text-yellow-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" />1</span>
                </div>
                <div className="text-xs bg-surface-secondary/80 px-3 py-1.5 rounded-full border border-border/50 text-text-secondary font-medium">
                  O-Score: <span className="text-text-primary">{oScore.toFixed(1)} / 100</span>
                </div>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-5">
                <Eye className="w-32 h-32 text-brand-obs" />
              </div>
            </div>

            {/* O-Score Gauge */}
            <div className="bg-surface border border-border rounded-xl p-5 flex flex-col items-center justify-center text-center">
              <div className="relative w-32 h-16 mt-2">
                <svg viewBox="0 0 100 50" className="w-full h-full overflow-visible">
                  <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#252C35" strokeWidth="10" strokeLinecap="round" />
                  <path d="M 10 50 A 40 40 0 0 1 78 18" fill="none" stroke="#818cf8" strokeWidth="10" strokeLinecap="round" />
                  <path d="M 78 18 A 40 40 0 0 1 85 23" fill="none" stroke="#10b981" strokeWidth="10" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-end -bottom-6">
                  <span className="text-3xl font-bold text-text-primary">{oScore.toFixed(1)}</span>
                  <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider mt-1">O-SCORE</span>
                </div>
              </div>
              <div className="mt-8 text-xs text-text-muted font-medium">Excellent Observability</div>
            </div>

            {/* CCI Index */}
            <div className="bg-surface border border-border rounded-xl p-5 flex flex-col">
              <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-2">CCI Correlation Index</div>
              <div className="text-3xl font-bold text-brand-obs mb-2">92%</div>
              <div className="h-16 w-full -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={oscoreHistory.slice(-5)}>
                    <Line type="monotone" dataKey="cci" stroke="#818cf8" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="text-[10px] text-text-muted mt-2 border-t border-border/50 pt-2">Threshold: &gt; 80%</div>
            </div>
          </div>

          {/* ══ Observability Pipeline Phases ══ */}
          <div className="bg-surface border border-border rounded-xl p-5">
            {/* Section header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">Observability Pipeline Phases</div>
                <div className="text-xs text-text-muted mt-0.5">Telemetry ingestion → correlation → scoring → AI remediation</div>
              </div>
              <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                <CheckCircle2 className="w-3 h-3" /> All Phases Passing
              </span>
            </div>

            {/* Gradient step-connector with icon nodes */}
            <div className="relative px-6 mb-6">
              {/* Background connector line */}
              <div className="absolute top-1/2 left-6 right-6 h-px -translate-y-1/2"
                style={{ background: 'linear-gradient(to right, #f97316, #22d3ee, #818cf8, #a855f7, #10b981)' }} />
              {/* Step nodes */}
              <div className="relative z-10 flex justify-between">
                {pipelinePhases.map((p) => {
                  const Icon = p.icon;
                  return (
                    <div key={p.step} className="flex flex-col items-center gap-1.5">
                      <div
                        className={`w-10 h-10 rounded-full ${p.nodeBg} flex items-center justify-center shadow-lg border-2 border-background`}
                        style={{ boxShadow: `0 0 16px ${p.accent}55` }}
                      >
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-[9px] font-mono font-bold text-text-muted">STEP {p.step}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Phase detail cards */}
            <div className="grid grid-cols-5 gap-3">
              {pipelinePhases.map((p) => {
                const Icon = p.icon;
                return (
                  <div
                    key={p.step}
                    className={`rounded-xl border p-4 flex flex-col gap-3 ${p.cardBg} ${p.cardBorder}`}
                  >
                    {/* Icon + checkmark row */}
                    <div className="flex items-center justify-between">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${p.iconBg}`}>
                        <Icon className={`w-4 h-4 ${p.iconColor}`} />
                      </div>
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    </div>

                    {/* Title / subtitle */}
                    <div>
                      <div className="text-xs font-bold text-text-primary leading-tight">{p.title}</div>
                      <div className="text-[9px] text-text-muted mt-0.5 leading-snug">{p.subtitle}</div>
                    </div>

                    {/* Thin accent divider */}
                    <div className="h-px w-full rounded" style={{ background: `${p.accent}40` }} />

                    {/* Metric */}
                    <div>
                      <div className="text-[9px] text-text-muted uppercase tracking-wider">{p.metric}</div>
                      <div className={`text-lg font-black mt-0.5 ${p.valueCls}`}>{p.value}</div>
                      <div className="text-[9px] text-text-muted">Threshold: {p.threshold}</div>
                    </div>

                    {/* Status badge */}
                    <div className={`flex items-center justify-center gap-1 text-[10px] font-bold py-1.5 rounded-lg border ${p.badge}`}>
                      <CheckCircle2 className="w-2.5 h-2.5" /> {p.status}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Metrics Over Time */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-4">Telemetry Metrics Over Time</div>
              <div className="flex gap-4 mb-4 text-[10px] text-text-secondary">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-indigo-400" /> O-Score</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-cyan-400" /> CCI Index</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-rose-400" /> Error Rate (%)</span>
              </div>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={oscoreHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#252C35" vertical={false} />
                    <XAxis dataKey="name" stroke="#5E6875" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#5E6875" fontSize={10} tickLine={false} axisLine={false} width={25} />
                    <RechartsTooltip contentStyle={{ background: '#1a1f27', border: '1px solid #2d3748', borderRadius: 8, fontSize: 11 }} />
                    <Line type="monotone" dataKey="oscore" stroke="#818cf8" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="cci" stroke="#22d3ee" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                    <Line type="monotone" dataKey="errorRate" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pillar Coverage */}
            <div className="bg-surface border border-border rounded-xl p-5 flex flex-col">
              <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-4">Telemetry Pillar Coverage (Live)</div>
              <div className="flex-1 flex flex-col justify-center gap-4 px-2">
                {[
                  { label: 'Metrics Coverage', source: 'Prometheus', value: 98, color: '#f97316' },
                  { label: 'Trace Propagation', source: 'Jaeger', value: 95, color: '#818cf8' },
                  { label: 'Log Integrity', source: 'Loki', value: 99, color: '#22d3ee' },
                ].map(p => (
                  <div key={p.label}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium text-text-primary">{p.label}</span>
                      <span className="font-mono" style={{ color: p.color }}>{p.value}% · {p.source}</span>
                    </div>
                    <div className="h-2 w-full bg-surface-secondary rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${p.value}%`, background: p.color }} />
                    </div>
                  </div>
                ))}
                <div className="mt-2 p-3 rounded-lg bg-surface-secondary/60 border border-border/50 text-[10px] font-mono text-text-muted leading-relaxed">
                  O-Score = (Metrics × 0.35 + Traces × 0.35 + Logs × 0.30) × 100 − Penalty
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── Right Sidebar (4 cols) ── */}
        <div className="lg:col-span-4 flex flex-col gap-6">

          {/* Pipeline Execution Timeline */}
          <div className="bg-surface border border-border rounded-xl p-5 flex flex-col min-h-[360px]">
            <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-6">Ingestion Pipeline Execution</div>
            <div className="space-y-0 relative px-2">
              <TimelineItem title="Prometheus Metrics Scraped" time="3s ago" status="success" icon={<Database />} />
              <TimelineItem title="Loki Log Streams Ingested" time="3s ago" status="success" icon={<Radio />} />
              <TimelineItem title="Jaeger Trace Spans Received" time="3s ago" status="success" icon={<Network />} />
              <TimelineItem title="CCI Correlation Engine (±2s)" time="2s ago" status="success" icon={<Activity />} />
              <TimelineItem title="O-Score Computed (87.4)" time="2s ago" status="success" icon={<BarChart2 />} />
              <TimelineItem title="AI RCA Engine Idle" time="Standby" status="success" icon={<Sparkles />} />
              <TimelineItem title="Remediation Scripts Ready" time="On-demand" status="pending" icon={<ShieldCheck className="w-4 h-4" />} isLast />
            </div>
          </div>

          {/* AI Recommendation */}
          <div className="bg-brand-obs/5 border border-brand-obs/20 rounded-xl p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-obs/10 blur-xl rounded-full translate-x-8 -translate-y-8" />
            <div className="flex items-center gap-2 mb-3 relative z-10">
              <Sparkles className="w-5 h-5 text-brand-obs" />
              <div className="text-[10px] text-brand-obs uppercase tracking-wider font-bold">AI Recommendation</div>
            </div>
            <div className="text-sm font-semibold text-text-primary mb-2 relative z-10">Add Trace Context to payment-service</div>
            <p className="text-xs text-text-secondary leading-relaxed mb-4 relative z-10">
              AI analysis detected missing trace propagation in <span className="font-mono text-brand-obs">payment-service</span>. Adding
              W3C TraceContext headers will improve CCI by{' '}
              <span className="text-green-400 font-bold">+7%</span> and eliminate the current blind spot.
            </p>
            <Link
              to="/dimensions/observability/calculation"
              className="relative z-10 w-full py-2 bg-brand-obs/10 hover:bg-brand-obs/20 text-brand-obs border border-brand-obs/30 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
            >
              View Calculation Logic →
            </Link>
          </div>

          {/* Recent Alerts */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">Recent Alerts</div>
              <span className="text-xs text-brand-obs cursor-pointer hover:underline">View All</span>
            </div>
            <div className="space-y-3">
              <div className="flex gap-3 items-start border border-yellow-500/20 bg-yellow-500/5 p-3 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div className="text-xs font-bold text-text-primary">Blind Spot Detected</div>
                    <div className="text-[10px] text-text-muted">5 min ago</div>
                  </div>
                  <div className="text-[10px] text-text-secondary mt-1">payment-service — Missing Jaeger Trace</div>
                </div>
              </div>
              <div className="flex gap-3 items-start border border-yellow-500/20 bg-yellow-500/5 p-3 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div className="text-xs font-bold text-text-primary">Log Error Spike</div>
                    <div className="text-[10px] text-text-muted">12 min ago</div>
                  </div>
                  <div className="text-[10px] text-text-secondary mt-1">order-service — 42 error lines in 15m</div>
                </div>
              </div>
              <div className="flex gap-3 items-start border border-green-500/20 bg-green-500/5 p-3 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div className="text-xs font-bold text-text-primary">RCA Resolved</div>
                    <div className="text-[10px] text-text-muted">1 hr ago</div>
                  </div>
                  <div className="text-[10px] text-text-secondary mt-1">inventory-service — DB pool expanded</div>
                </div>
              </div>
            </div>
          </div>

          {/* O-Score Snapshots */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">Recent O-Score Snapshots</div>
              <Link to="/dimensions/observability/history" className="text-xs text-brand-obs hover:underline">
                Full History &rarr;
              </Link>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Jun 13, 08:00 AM', score: 87.4, status: 'HEALTHY' },
                { label: 'Jun 12, 08:00 AM', score: 85.1, status: 'HEALTHY' },
                { label: 'Jun 11, 08:00 AM', score: 83.7, status: 'WARNING' },
              ].map((s, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <span className="text-xs font-mono text-text-secondary">
                    <Clock className="w-3 h-3 inline mr-1" />{s.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-text-primary font-mono">{s.score}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${s.status === 'HEALTHY' ? 'text-green-500 bg-green-500/10' : 'text-yellow-500 bg-yellow-500/10'}`}>
                      {s.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Footer ── */}
      <div className="mt-6 border-t border-border pt-4 flex justify-between items-center text-xs text-text-muted">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4" /> Observability Engine — AA-ICME
        </div>
        <div className="flex items-center gap-2 text-text-primary">
          <Activity className="w-4 h-4 text-brand-obs" /> Observability Maturity Level: <span className="font-semibold ml-1">4 — Proactive</span>
        </div>
        <div className="flex items-center gap-3">
          Prometheus · Loki · Jaeger · AI RCA <span className="w-2 h-2 rounded-full bg-green-500 ml-2" />
        </div>
      </div>

    </div>
  );
};
