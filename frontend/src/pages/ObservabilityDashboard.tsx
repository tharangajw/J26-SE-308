import {
  Activity,
  Database,
  Eye,
  Radio,
  Server,
  TriangleAlert,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Link } from 'react-router-dom';
import { useTelemetry } from '../context/TelemetryContext';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import KubernetesDiscoveryPanel from '../components/resilience/KubernetesDiscoveryPanel';

const formatMetric = (value: number | null | undefined, suffix = '') =>
  typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)}${suffix}` : '—';

export const ObservabilityDashboard = () => {
  const { telemetry, oScore, cciIndex, history } = useTelemetry();
  const chartData = history.map((record) => ({
    time: new Date(record.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    oscore: record.oscore,
    cci: record.cci,
  }));
  const sources = telemetry?.sources;
  const availability = telemetry?.availability;

  const pillars = [
    { key: 'prometheus', label: 'Metrics', provider: 'Prometheus', connected: sources?.prometheus, hasData: availability?.metrics, icon: Database, color: '#fb923c' },
    { key: 'jaeger', label: 'Traces', provider: 'Jaeger', connected: sources?.jaeger, hasData: availability?.traces, icon: Radio, color: '#818cf8' },
    { key: 'loki', label: 'Logs', provider: 'Loki', connected: sources?.loki, hasData: availability?.logs, icon: Server, color: '#22d3ee' },
  ];

  return (
    <PageContainer className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-brand-obs">
            <Eye className="h-6 w-6" /> Observability Engine
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Live signals and evidence from the configured microservices environment.
          </p>
        </div>
        <Link
          to="/dimensions/observability/detail"
          className="rounded-md border border-border bg-surface-secondary/40 px-3 py-2 text-xs font-medium text-text-primary hover:bg-surface-secondary"
        >
          Open telemetry explorer
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-text-muted">O-Score</p>
            <p className="mt-2 font-mono text-3xl font-semibold text-brand-obs">
              {telemetry ? `${oScore.toFixed(1)} / 100` : '—'}
            </p>
            <p className="mt-1 text-xs text-text-secondary">{telemetry?.calculation.status ?? 'Waiting for telemetry'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-text-muted">CCI Index</p>
            <p className="mt-2 font-mono text-3xl font-semibold text-cyan-300">
              {telemetry ? `${cciIndex}%` : '—'}
            </p>
            <p className="mt-1 text-xs text-text-secondary">Correlated observed events</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-text-muted">Blind Spots</p>
            <p className="mt-2 flex items-center gap-2 font-mono text-3xl font-semibold text-amber-300">
              {telemetry?.calculation.blindSpotCount ?? '—'}
              {(telemetry?.calculation.blindSpotCount ?? 0) > 0 && <TriangleAlert size={18} />}
            </p>
            <p className="mt-1 text-xs text-text-secondary">Missing signal or correlation evidence</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-text-muted">p95 Request Latency</p>
            <p className="mt-2 font-mono text-3xl font-semibold text-text-primary">
              {formatMetric(telemetry?.metrics.p95Latency, ' ms')}
            </p>
            <p className="mt-1 text-xs text-text-secondary">Only shown when a matching histogram exists</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {pillars.map(({ key, label, provider, connected, hasData, icon: Icon, color }) => (
          <Card key={key}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <Icon size={18} style={{ color }} />
                <div>
                  <p className="text-sm font-medium text-text-primary">{label}</p>
                  <p className="text-xs text-text-muted">{provider}</p>
                </div>
              </div>
              <span className={`text-xs ${connected ? 'text-emerald-400' : 'text-rose-400'}`}>
                {connected ? (hasData ? 'Live data' : 'Connected · no data') : 'Unavailable'}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
            <Activity className="h-4 w-4 text-brand-obs" /> Live score history
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#252C35" vertical={false} />
                  <XAxis dataKey="time" stroke="#5E6875" fontSize={11} />
                  <YAxis domain={[0, 100]} stroke="#5E6875" fontSize={11} />
                  <RechartsTooltip contentStyle={{ background: '#10141A', border: '1px solid #252C35', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="oscore" name="O-Score" stroke="#10B981" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="cci" name="CCI" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-text-muted">
              No live score history has been collected yet.
            </p>
          )}
        </CardContent>
      </Card>

      <KubernetesDiscoveryPanel />
    </PageContainer>
  );
};
