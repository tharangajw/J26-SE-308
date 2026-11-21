// Detailed explorer for live metrics, logs, traces, CCI, RCA, and remediation.
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTelemetry } from '../context/TelemetryContext';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardContent } from '../components/ui/Card';
import { AlertCircle, Database, Server, BarChart2, ShieldCheck, Radio, Zap, GitBranch, Activity, Calculator } from 'lucide-react';

import TabNav from '../components/observability/TabNav';
import ScoreHistory from '../components/observability/ScoreHistory';
import MetricsDashboard from '../components/observability/MetricsDashboard';
import LogsDashboard from '../components/observability/LogsDashboard';
import TracesDashboard from '../components/observability/TracesDashboard';
import CCIPanel from '../components/observability/CCIPanel';
import RCAPanel from '../components/observability/RCAPanel';
import RemediationPanel from '../components/observability/RemediationPanel';
import ChaosPanel from '../components/observability/ChaosPanel';
import KubernetesDiscoveryPanel from '../components/resilience/KubernetesDiscoveryPanel';
import { ObservabilityMethodology } from '../components/observability/ObservabilityMethodology';

const MetricCard = ({ icon, title, value, description, source, isAlert = false }: any) => {
  const sourceColor =
    source === 'prometheus' ? 'text-orange-400 border-orange-400/30 bg-orange-400/10' :
    source === 'jaeger' ? 'text-indigo-400 border-indigo-400/30 bg-indigo-400/10' :
    'text-cyan-400 border-cyan-400/30 bg-cyan-400/10';

  return (
    <Card className={`h-full ${isAlert ? 'border-rose-500/40 bg-rose-500/5' : 'border-border bg-surface-secondary/20'}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">{title}</span>
          </div>
          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${sourceColor}`}>
            {source}
          </span>
        </div>
        <div className={`mt-3 font-mono text-2xl font-semibold ${isAlert ? 'text-rose-400' : 'text-text-primary'}`}>{value}</div>
        <p className="mt-1 text-[11px] text-text-muted">{description}</p>
      </CardContent>
    </Card>
  );
};

const SourceBadge = ({ name, status }: { name: string; status: string }) => (
  <div className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-secondary/40 px-3 py-1.5">
    <div className={`h-2 w-2 rounded-full ${status === 'live' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
    <span className="text-xs font-medium text-text-secondary">{name}</span>
  </div>
);

const formatMilliseconds = (value: number | null | undefined): string =>
  typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)} ms` : '—';

export const Observability: React.FC = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isCalculationView = pathname.endsWith('/calculation');
  const routeTab = pathname.endsWith('/cci-audit') ? 'cci' : pathname.endsWith('/ai-analysis') ? 'rca' : pathname.endsWith('/remediation') ? 'remediation' : 'overview';
  const isAiAnalysisView = routeTab === 'rca';
  const { telemetry, oScore, cciIndex, history: liveHistory } = useTelemetry();

  const [activeTab, setActiveTab] = useState(routeTab);
  const [rcaReport, setRcaReport] = useState<any>(null);

  useEffect(() => {
    if (!isCalculationView) setActiveTab(routeTab);
  }, [isCalculationView, routeTab]);
  const chartHistory = liveHistory.map(record => ({
    timestamp: record.date,
    oscore: record.oscore,
    cci_index: record.cci,
    blind_spot_count: record.blindSpots,
  }));

  const cciData = telemetry?.calculation.cciData;
  const d = {
    metrics_coverage_rate: telemetry?.availability?.metrics ? 1 : 0,
    system_error_rate: telemetry?.traces.errorRate == null ? null : telemetry.traces.errorRate / 100,
    service_latency_p95_ms: telemetry?.metrics.p95Latency,
    service_count: telemetry?.traces.serviceCount ?? 0,
    log_structural_integrity: telemetry?.availability?.logs ? 1 : 0,
    log_error_count: telemetry?.logs.errorCount ?? 0,
    trace_id_propagation_rate: telemetry?.availability?.traces ? 1 : 0,
    avg_trace_duration_ms: telemetry?.traces.latency,
  };
  const formatPercent = (value: number | null | undefined, digits = 0) =>
    typeof value === 'number' && Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : '—';
  const maturityLabel = !telemetry ? 'Waiting for telemetry' : oScore >= 80 ? 'Proactive' : oScore >= 50 ? 'Intermediate' : 'Reactive';

  return (
    <PageContainer className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-brand-obs">
            <Activity className="h-6 w-6 text-brand-obs" />
            {isCalculationView ? 'Observability Calculation' : isAiAnalysisView ? 'AI Root-Cause Analysis' : 'Telemetry Explorer'}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {isCalculationView
              ? 'Parameters, correlation weights, and penalty deductions behind the O-Score.'
              : isAiAnalysisView
                ? 'Use Gemini or Claude to diagnose correlated telemetry and explain the likely root cause.'
                : 'Real-time telemetry correlation across Prometheus, Loki, and Jaeger.'}
          </p>
          {telemetry?.lastUpdated && (
            <p className="mt-1 text-[11px] text-emerald-400">
              Live data · updated {new Date(telemetry.lastUpdated).toLocaleTimeString()}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SourceBadge name="Prometheus" status={telemetry?.sources?.prometheus ? 'live' : 'offline'} />
          <SourceBadge name="Loki" status={telemetry?.sources?.loki ? 'live' : 'offline'} />
          <SourceBadge name="Jaeger" status={telemetry?.sources?.jaeger ? 'live' : 'offline'} />
          {!isCalculationView && (
            <div className="text-right">
              <div className="font-mono text-4xl font-semibold text-brand-obs">
                {telemetry ? oScore.toFixed(0) : '—'}
                <span className="text-lg text-text-muted">/100</span>
              </div>
              <div className="mt-0.5 text-xs font-medium uppercase tracking-widest text-text-secondary">
                {maturityLabel}
              </div>
            </div>
          )}
        </div>
      </div>

      {isCalculationView ? (
        <div className="space-y-6">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Calculator className="h-5 w-5 text-brand-obs" /> How we calculate the O-Score
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              Review the parameters, cross-pillar correlation weights, and penalty deductions behind the current score.
            </p>
          </div>
          <ObservabilityMethodology calculation={telemetry?.calculation} />
        </div>
      ) : (
        <>
          <TabNav
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab);
              navigate('/dimensions/observability/detail');
            }}
          />

          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Card className="border-brand-obs/40 bg-brand-obs/5">
                  <CardContent className="flex h-full flex-col justify-center p-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Live O-Score</p>
                    <div className="mt-3 font-mono text-5xl font-semibold text-brand-obs">{telemetry ? oScore.toFixed(1) : '—'}</div>
                    <p className="mt-2 text-xs text-text-muted">/ 100 · {maturityLabel} maturity</p>
                    {(telemetry?.calculation.blindSpotCount ?? 0) > 0 && (
                      <div className="mt-5 flex items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                        <AlertCircle className="h-4 w-4" />
                        Penalty: -{telemetry?.calculation.scoreBreakdown.blindSpotPenalty ?? 0} pts for blind spots
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="lg:col-span-2">
                  <ScoreHistory history={chartHistory} />
                </div>
              </div>

              <KubernetesDiscoveryPanel />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard icon={<Database className="h-4 w-4 text-emerald-400" />} title="Metrics Data" value={telemetry ? formatPercent(d.metrics_coverage_rate) : '—'} description="Live metric query results" source="prometheus" />
                <MetricCard icon={<AlertCircle className="h-4 w-4 text-rose-400" />} title="HTTP Error Rate" value={formatPercent(d.system_error_rate, 2)} description="5xx responses (5m)" source="prometheus" isAlert={typeof d.system_error_rate === 'number' && d.system_error_rate > 0.05} />
                <MetricCard
                  icon={<Server className="h-4 w-4 text-amber-400" />}
                  title="p95 Latency"
                  value={formatMilliseconds(d.service_latency_p95_ms)}
                  description="95th percentile request duration"
                  source="prometheus"
                  isAlert={typeof d.service_latency_p95_ms === 'number' && Number.isFinite(d.service_latency_p95_ms) && d.service_latency_p95_ms > 1000}
                />
                <MetricCard icon={<BarChart2 className="h-4 w-4 text-cyan-400" />} title="Active Services" value={telemetry?.traces.serviceCount ?? '—'} description="Services reported by Jaeger" source="jaeger" />
                <MetricCard icon={<ShieldCheck className="h-4 w-4 text-brand-obs" />} title="Log Data" value={telemetry ? formatPercent(d.log_structural_integrity) : '—'} description="Logs observed in the query window" source="loki" />
                <MetricCard icon={<Radio className="h-4 w-4 text-rose-400" />} title="Log Errors (15m)" value={telemetry?.availability?.logs ? d.log_error_count.toLocaleString() : '—'} description="Observed error-level log lines" source="loki" isAlert={telemetry?.availability?.logs === true && d.log_error_count > 100} />
                <MetricCard icon={<Zap className="h-4 w-4 text-amber-400" />} title="Traces Observed" value={telemetry ? formatPercent(d.trace_id_propagation_rate) : '—'} description="Trace samples in the query window" source="jaeger" />
                <MetricCard icon={<GitBranch className="h-4 w-4 text-cyan-400" />} title="Avg Trace Duration" value={formatMilliseconds(d.avg_trace_duration_ms)} description="End-to-end trace length" source="jaeger" />
              </div>
            </div>
          )}

          {activeTab === 'metrics' && <MetricsDashboard data={{ realtime: telemetry }} />}
          {activeTab === 'logs' && <LogsDashboard data={{ realtime: telemetry, details: d }} />}
          {activeTab === 'traces' && <TracesDashboard data={{ realtime: telemetry, details: d }} />}
          {activeTab === 'cci' && (cciData ? <CCIPanel cciData={{ ...cciData, cci_index: cciIndex }} /> : <p className="text-sm text-text-muted">Waiting for the observability engine telemetry snapshot.</p>)}
          {activeTab === 'rca' && (cciData ? <RCAPanel cciData={{ ...cciData, cci_index: cciIndex, telemetry }} onRcaComplete={(report: any) => { setRcaReport(report); navigate('/dimensions/observability/remediation'); }} /> : <p className="text-sm text-text-muted">Waiting for telemetry before root-cause analysis is available.</p>)}
          {activeTab === 'remediation' && <RemediationPanel rcaReport={rcaReport} currentTelemetry={telemetry} />}
          {activeTab === 'chaos' && <ChaosPanel />}
        </>
      )}
    </PageContainer>
  );
};
