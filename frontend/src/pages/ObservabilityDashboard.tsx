import {
  CheckCircle2,
  Activity,
  TriangleAlert,
  Database,
  Radio,
  Network,
  Sparkles,
  Clock,
  ShieldCheck,
  Eye,
  BarChart3,
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
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';

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
  { step: 1, title: 'Ingestion', subtitle: '3-Pillar Telemetry', metric: 'Coverage Rate', value: '98%', threshold: '> 90%', status: 'PASS', icon: Database, accent: 'text-orange-400', bar: 'bg-orange-400' },
  { step: 2, title: 'CCI Correlation', subtitle: '±2s Time Window', metric: 'Correlation', value: 'LIVE', threshold: '> 80%', status: 'PASS', icon: Activity, accent: 'text-cyan-400', bar: 'bg-cyan-400' },
  { step: 3, title: 'O-Score Calc', subtitle: 'Weighted + Penalty', metric: 'O-Score', value: '87.4', threshold: '> 80', status: 'PASS', icon: BarChart3, accent: 'text-brand-obs', bar: 'bg-brand-obs' },
  { step: 4, title: 'AI RCA Engine', subtitle: 'Root Cause Diagnosis', metric: 'AI Confidence', value: '94%', threshold: '> 85%', status: 'PASS', icon: Sparkles, accent: 'text-amber-400', bar: 'bg-amber-400' },
  { step: 5, title: 'Remediation', subtitle: 'Auto Fix Scripts', metric: 'Fix Status', value: 'Ready', threshold: 'Auto', status: 'HEALTHY', icon: ShieldCheck, accent: 'text-emerald-400', bar: 'bg-emerald-400' },
];

const TimelineItem = ({ title, time, status, isLast = false }: { title: string; time: string; status: string; isLast?: boolean }) => (
  <div className="relative pl-8 pb-5 last:pb-0">
    {!isLast && <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />}
    <div className={`absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface-secondary z-10 ${status === 'success' ? 'text-emerald-400' : 'text-brand-obs'}`}>
      {status === 'success' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
    </div>
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-medium text-text-primary">{title}</div>
        <div className="mt-0.5 text-xs text-text-muted">{time}</div>
      </div>
    </div>
  </div>
);

export const ObservabilityDashboard = () => {
  const { telemetry, oScore, cciIndex, history } = useTelemetry();
  const liveChartData = history.map((record) => ({
    name: new Date(record.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    oscore: record.oscore,
    cci: record.cci,
    errorRate: record.errorRate,
  }));
  const chartData = liveChartData.length ? liveChartData : oscoreHistory;
  const maturityLabel = oScore >= 80 ? 'Proactive' : oScore >= 50 ? 'Intermediate' : 'Reactive';

  return (
    <PageContainer className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-brand-obs">
              <Eye className="h-6 w-6 text-brand-obs" /> Observability Maturity
            </h2>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            Live telemetry correlation and O-Score evaluation from Prometheus, Loki, and Jaeger.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Link
            to="/dimensions/observability/detail"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-secondary/40 px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-secondary"
          >
            Open Telemetry Explorer
          </Link>
          <div className="text-right">
            <div className="font-mono text-4xl font-semibold text-brand-obs">
              {oScore.toFixed(0)}
              <span className="text-lg text-text-muted">/100</span>
            </div>
            <div className="mt-0.5 text-xs font-medium uppercase tracking-widest text-text-secondary">
              {maturityLabel}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Connected to live telemetry sources
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono text-orange-400"><Database className="h-3.5 w-3.5" /> Prometheus</span>
          <span className="inline-flex items-center gap-1.5 font-mono text-cyan-400"><Radio className="h-3.5 w-3.5" /> Loki</span>
          <span className="inline-flex items-center gap-1.5 font-mono text-indigo-400"><Network className="h-3.5 w-3.5" /> Jaeger</span>
        </div>
        <span className="font-mono text-[11px] text-emerald-400/80">
          {telemetry ? `CPU ${telemetry.metrics.cpuUsage.toFixed(1)}%` : 'Loading...'}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border bg-surface-secondary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">System Health</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold text-text-primary">Healthy</div>
            <p className="mt-1 text-[11px] text-text-muted">O-Score {oScore.toFixed(1)} / 100</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-secondary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">O-Score</span>
              <Eye className="h-4 w-4 text-brand-obs" />
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold text-brand-obs">{oScore.toFixed(1)}</div>
            <p className="mt-1 text-[11px] text-text-muted">{oScore >= 80 ? 'Excellent observability' : oScore >= 50 ? 'Fair coverage' : 'Needs attention'}</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-secondary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">CCI Index</span>
              <Activity className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold text-text-primary">{cciIndex}%</div>
            <p className="mt-1 text-[11px] text-text-muted">Threshold: &gt; 80%</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-secondary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Blind Spots</span>
              <TriangleAlert className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold text-text-primary">{telemetry?.calculation.blindSpotCount ?? '—'}</div>
            <p className="mt-1 text-[11px] text-text-muted">Live engine-detected blind spots</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
              <BarChart3 className="h-4 w-4 text-brand-obs" /> Observability Pipeline Phases
            </CardTitle>
            <p className="mt-1 text-xs text-text-muted">Ingestion → correlation → scoring → AI remediation</p>
          </CardHeader>
          <CardContent className="space-y-5">
            {pipelinePhases.map((p) => {
              const Icon = p.icon;
              const displayValue = p.step === 2 ? `${cciIndex}%` : p.value;
              return (
                <div key={p.step} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium text-text-primary">
                      <Icon className={`h-4 w-4 ${p.accent}`} />
                      {p.title}
                      <span className="text-[11px] font-normal text-text-muted">({p.subtitle})</span>
                    </span>
                    <span className={`font-mono font-semibold ${p.accent}`}>{displayValue}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-secondary">
                    <div className={`h-full ${p.bar} transition-all duration-500`} style={{ width: '92%' }} />
                  </div>
                  <p className="text-[11px] text-text-muted">Threshold {p.threshold} · {p.status}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
              <Activity className="h-4 w-4 text-emerald-400" /> Ingestion Pipeline Execution
            </CardTitle>
            <p className="mt-1 text-xs text-text-muted">Latest collector steps from the three telemetry pillars.</p>
          </CardHeader>
          <CardContent>
            <TimelineItem title="Prometheus Metrics Scraped" time="3s ago" status="success" />
            <TimelineItem title="Loki Log Streams Ingested" time="3s ago" status="success" />
            <TimelineItem title="Jaeger Trace Spans Received" time="3s ago" status="success" />
            <TimelineItem title="CCI Correlation Engine (±2s)" time="2s ago" status="success" />
            <TimelineItem title="O-Score Computed" time="2s ago" status="success" />
            <TimelineItem title="AI RCA Engine Idle" time="Standby" status="success" />
            <TimelineItem title="Remediation Scripts Ready" time="On-demand" status="pending" isLast />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Telemetry Metrics Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex gap-4 text-[11px] text-text-secondary">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-brand-obs" /> O-Score</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-cyan-400" /> CCI Index</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-rose-400" /> Error Rate (%)</span>
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#252C35" vertical={false} />
                  <XAxis dataKey="name" stroke="#5E6875" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#5E6875" fontSize={10} tickLine={false} axisLine={false} width={25} />
                  <RechartsTooltip contentStyle={{ background: '#10141A', border: '1px solid #252C35', borderRadius: 8, fontSize: 11 }} />
                  <Line type="monotone" dataKey="oscore" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="cci" stroke="#22d3ee" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="errorRate" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Telemetry Pillar Coverage</CardTitle>
            <p className="mt-1 text-xs text-text-muted">Live coverage across metrics, traces, and logs.</p>
          </CardHeader>
          <CardContent className="space-y-5">
            {[
              { label: 'Metrics Coverage', source: 'Prometheus', value: 98, color: 'bg-orange-400', text: 'text-orange-400' },
              { label: 'Trace Propagation', source: 'Jaeger', value: 95, color: 'bg-indigo-400', text: 'text-indigo-400' },
              { label: 'Log Integrity', source: 'Loki', value: 99, color: 'bg-cyan-400', text: 'text-cyan-400' },
            ].map((p) => (
              <div key={p.label} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-text-primary">{p.label}</span>
                  <span className={`font-mono font-semibold ${p.text}`}>{p.value}% · {p.source}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-secondary">
                  <div className={`h-full ${p.color} transition-all duration-500`} style={{ width: `${p.value}%` }} />
                </div>
              </div>
            ))}
            <div className="rounded-md border border-border/80 bg-surface-secondary/30 p-3 font-mono text-[11px] text-text-muted">
              O-Score = (Metrics × 0.35 + Traces × 0.35 + Logs × 0.30) × 100 − Penalty
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-brand-obs/40 bg-brand-obs/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
              <Sparkles className="h-4 w-4 text-brand-obs" /> AI Recommendation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <h3 className="font-medium text-text-primary">Add Trace Context to payment-service</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              Missing trace propagation in <span className="font-mono text-brand-obs">payment-service</span>. Adding W3C TraceContext headers will improve CCI by <span className="font-semibold text-emerald-400">+7%</span> and close the current blind spot.
            </p>
            <Link
              to="/dimensions/observability/calculation"
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-border bg-surface-secondary/40 px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-brand-obs/60 hover:text-brand-obs"
            >
              View Calculation Logic
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Recent Alerts</CardTitle>
              <Link to="/dimensions/observability/history" className="text-xs text-brand-obs hover:underline">View all</Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { type: 'warn', title: 'Blind Spot Detected', time: '5 min ago', desc: 'payment-service — Missing Jaeger Trace' },
              { type: 'warn', title: 'Log Error Spike', time: '12 min ago', desc: 'order-service — 42 error lines in 15m' },
              { type: 'ok', title: 'RCA Resolved', time: '1 hr ago', desc: 'inventory-service — DB pool expanded' },
            ].map((alert) => (
              <div
                key={alert.title}
                className={`flex items-start gap-3 rounded-md border p-3 ${alert.type === 'ok' ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}
              >
                {alert.type === 'ok'
                  ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-medium text-text-primary">{alert.title}</div>
                    <div className="text-[11px] text-text-muted">{alert.time}</div>
                  </div>
                  <div className="mt-1 text-[11px] text-text-secondary">{alert.desc}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
              <Clock className="h-4 w-4 text-brand-obs" /> Recent O-Score Snapshots
            </CardTitle>
            <Link to="/dimensions/observability/history" className="text-xs text-brand-obs hover:underline">Full History</Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: 'Jun 13, 08:00 AM', score: 87.4, status: 'HEALTHY' },
            { label: 'Jun 12, 08:00 AM', score: 85.1, status: 'HEALTHY' },
            { label: 'Jun 11, 08:00 AM', score: 83.7, status: 'WARNING' },
          ].map((s) => (
            <div key={s.label} className="flex items-center justify-between rounded-md border border-border/80 bg-surface-secondary/30 p-3">
              <span className="font-mono text-xs text-text-secondary">{s.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-text-primary">{s.score}</span>
                <span className={`text-[10px] font-medium uppercase ${s.status === 'HEALTHY' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {s.status}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageContainer>
  );
};
