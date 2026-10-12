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
import { ObservabilityMethodology } from '../components/observability/ObservabilityMethodology';

import { INITIAL_MOCK_HISTORY, INITIAL_MOCK_DATA, INITIAL_MOCK_CCI } from '../components/observability/mockData';

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

export const Observability: React.FC = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isCalculationView = pathname.endsWith('/calculation');
  const routeTab = pathname.endsWith('/cci-audit') ? 'cci' : pathname.endsWith('/ai-analysis') ? 'rca' : pathname.endsWith('/remediation') ? 'remediation' : 'overview';
  const isAiAnalysisView = routeTab === 'rca';
  const { telemetry, oScore, cciIndex, history: liveHistory } = useTelemetry();

  const [activeTab, setActiveTab] = useState(routeTab);
  const [rcaReport, setRcaReport] = useState<any>(null);

  const [mockData, setMockData] = useState(INITIAL_MOCK_DATA);
  const [mockCci, setMockCci] = useState(INITIAL_MOCK_CCI);
  const [mockHistory, setMockHistory] = useState(INITIAL_MOCK_HISTORY);

  useEffect(() => {
    if (!isCalculationView) setActiveTab(routeTab);
  }, [isCalculationView, routeTab]);
  const chartHistory = liveHistory.map(record => ({
    timestamp: record.date,
    oscore: record.oscore,
    cci_index: record.cci,
    blind_spot_count: record.blindSpots,
  }));

  useEffect(() => {
    if (!telemetry) return;

    setMockData(prev => ({
      ...prev,
      oscore: telemetry.calculation.oScore,
      details: {
        ...prev.details,
        metrics_coverage_rate: telemetry.sources.prometheus ? 1 : 0,
        system_error_rate: telemetry.traces.errorRate / 100,
        service_latency_p95_ms: telemetry.traces.latency,
        service_count: telemetry.traces.serviceCount,
        log_structural_integrity: telemetry.sources.loki ? 1 : 0,
        log_error_count: telemetry.logs.errorCount,
        trace_id_propagation_rate: telemetry.sources.jaeger ? 1 : 0,
        avg_trace_duration_ms: telemetry.traces.latency,
      },
    }));

    setMockCci(telemetry.calculation.cciData);
  }, [telemetry, oScore, cciIndex]);

  const handleChaosExperiment = (expId: string) => {
    let newData = JSON.parse(JSON.stringify(mockData));
    let newCci = JSON.parse(JSON.stringify(mockCci));
    let newHistory = [...mockHistory];

    if (expId === 'exp-1') {
      newData.oscore = 62.4;
      newData.details.service_count = 5;
      newData.details.system_error_rate = 0.15;
      newCci.cci_index = 75;
      newCci.blind_spots.push({ timestamp_utc: new Date().toISOString(), has_metric: true, has_trace: false, has_log: true, missing_pillars: ['Jaeger Trace'] });
    } else if (expId === 'exp-2') {
      newData.oscore = 75.1;
      newData.details.service_latency_p95_ms = 850.5;
      newData.details.system_error_rate = 0.30;
    } else if (expId === 'exp-3') {
      newData.oscore = 45.0;
      newData.details.system_error_rate = 0.45;
      newCci.cci_index = 50;
      newCci.blind_spots.push({ timestamp_utc: new Date().toISOString(), has_metric: false, has_trace: true, has_log: false, missing_pillars: ['Prometheus Metric', 'Loki Log'] });
    }

    newHistory.push({
      timestamp: new Date().toISOString(),
      oscore: newData.oscore,
      cci_index: newCci.cci_index,
      blind_spot_count: newCci.blind_spots.length
    });

    setMockData(newData);
    setMockCci(newCci);
    setMockHistory(newHistory.slice(-20));

    setTimeout(() => {
      setMockData(INITIAL_MOCK_DATA);
      setMockCci(INITIAL_MOCK_CCI);
    }, 40000);
  };

  const d = mockData.details;
  const maturityLabel = oScore >= 80 ? 'Proactive' : oScore >= 50 ? 'Intermediate' : 'Reactive';

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
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SourceBadge name="Prometheus" status={telemetry?.sources.prometheus ? 'live' : 'offline'} />
          <SourceBadge name="Loki" status={telemetry?.sources.loki ? 'live' : 'offline'} />
          <SourceBadge name="Jaeger" status={telemetry?.sources.jaeger ? 'live' : 'offline'} />
          {!isCalculationView && (
            <div className="text-right">
              <div className="font-mono text-4xl font-semibold text-brand-obs">
                {oScore.toFixed(0)}
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
                    <div className="mt-3 font-mono text-5xl font-semibold text-brand-obs">{oScore.toFixed(1)}</div>
                    <p className="mt-2 text-xs text-text-muted">/ 100 · {maturityLabel} maturity</p>
                    {mockCci.blind_spots.length > 0 && (
                      <div className="mt-5 flex items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                        <AlertCircle className="h-4 w-4" />
                        Penalty: -{mockData.scoring_weights.blind_spot_penalty} pts for blind spots
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="lg:col-span-2">
                  <ScoreHistory history={chartHistory.length ? chartHistory : mockHistory} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard icon={<Database className="h-4 w-4 text-emerald-400" />} title="Metrics Coverage" value={`${(d.metrics_coverage_rate * 100).toFixed(0)}%`} description="Healthy scrape targets" source="prometheus" />
                <MetricCard icon={<AlertCircle className="h-4 w-4 text-rose-400" />} title="HTTP Error Rate" value={`${(d.system_error_rate * 100).toFixed(2)}%`} description="5xx responses (5m)" source="prometheus" isAlert={d.system_error_rate > 0.05} />
                <MetricCard icon={<Server className="h-4 w-4 text-amber-400" />} title="p95 Latency" value={`${d.service_latency_p95_ms.toFixed(1)} ms`} description="95th percentile request duration" source="prometheus" isAlert={d.service_latency_p95_ms > 1000} />
                <MetricCard icon={<BarChart2 className="h-4 w-4 text-cyan-400" />} title="Active Services" value={d.service_count} description="Instrumented services" source="jaeger" />
                <MetricCard icon={<ShieldCheck className="h-4 w-4 text-brand-obs" />} title="Log Integrity" value={`${(d.log_structural_integrity * 100).toFixed(0)}%`} description="Structured level labels" source="loki" />
                <MetricCard icon={<Radio className="h-4 w-4 text-rose-400" />} title="Log Errors (15m)" value={d.log_error_count.toLocaleString()} description="Error-level log lines" source="loki" isAlert={d.log_error_count > 100} />
                <MetricCard icon={<Zap className="h-4 w-4 text-amber-400" />} title="Trace Propagation" value={`${(d.trace_id_propagation_rate * 100).toFixed(0)}%`} description="Multi-service traces" source="jaeger" />
                <MetricCard icon={<GitBranch className="h-4 w-4 text-cyan-400" />} title="Avg Trace Duration" value={`${d.avg_trace_duration_ms.toFixed(1)} ms`} description="End-to-end trace length" source="jaeger" />
              </div>
            </div>
          )}

          {activeTab === 'metrics' && <MetricsDashboard data={mockData} />}
          {activeTab === 'logs' && <LogsDashboard data={mockData} />}
          {activeTab === 'traces' && <TracesDashboard data={mockData} />}
          {activeTab === 'cci' && <CCIPanel cciData={{ ...mockCci, cci_index: cciIndex }} />}
          {activeTab === 'rca' && <RCAPanel cciData={{ ...mockCci, cci_index: cciIndex }} onRcaComplete={(report: any) => { setRcaReport(report); navigate('/dimensions/observability/remediation'); }} />}
          {activeTab === 'remediation' && <RemediationPanel rcaReport={rcaReport} />}
          {activeTab === 'chaos' && <ChaosPanel onExperimentRun={handleChaosExperiment} />}
        </>
      )}
    </PageContainer>
  );
};
