import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTelemetry } from '../context/TelemetryContext';
import { PageContainer } from '../components/layout/PageContainer';
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
import { calculateOScore } from '../lib/ahpEngine';

const ScoreRing = ({ score }: { score: number }) => {
  const color = score >= 80 ? '#34d399' : score >= 50 ? '#fbbf24' : '#f43f5e';
  const dashArray = 2 * Math.PI * 60;
  const dashOffset = dashArray * (1 - score / 100);

  return (
    <div className="obs-score-ring-wrapper">
      <svg width="160" height="160" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="80" cy="80" r="60" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
        <circle cx="80" cy="80" r="60" fill="none"
          stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={dashArray} strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1s ease-out', filter: `drop-shadow(0 0 10px ${color}80)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black" style={{ color }}>{score.toFixed(1)}</span>
        <span className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">/ 100</span>
      </div>
    </div>
  );
};

const MetricCard = ({ icon, title, value, description, source, isAlert = false }: any) => {
  const sourceColor = source === 'prometheus' ? '#f97316' : source === 'jaeger' ? '#818cf8' : '#22d3ee';
  
  return (
    <div className={`obs-glass obs-metric-card obs-lift ${isAlert ? 'border-rose-500/50 bg-rose-500/5' : ''}`}>
      <div className="obs-card-glow" style={{ background: isAlert ? '#f43f5e' : sourceColor }} />
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-slate-300 font-medium text-sm">{title}</h3>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold border`} 
              style={{ color: sourceColor, borderColor: `${sourceColor}40`, backgroundColor: `${sourceColor}10` }}>
          {source}
        </span>
      </div>
      <div className="relative z-10">
        <h2 className={`text-3xl font-black ${isAlert ? 'text-rose-400' : 'text-white'}`}>{value}</h2>
        <p className="text-xs text-slate-500 mt-2 font-medium">{description}</p>
      </div>
    </div>
  );
};

const SourceBadge = ({ name, status }: { name: string, status: string }) => {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700">
      <div className={`w-2 h-2 rounded-full ${status === 'live' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-rose-500 animate-pulse'}`} />
      <span className="text-xs font-semibold text-slate-300">{name}</span>
    </div>
  );
};

export const Observability: React.FC = () => {
  const { pathname } = useLocation();
  const isCalculationView = pathname.endsWith('/calculation');
  const { oScore } = useTelemetry();

  const [activeTab, setActiveTab] = useState('overview');
  const [rcaReport, setRcaReport] = useState<any>(null);

  const [mockData, setMockData] = useState(INITIAL_MOCK_DATA);
  const [mockCci, setMockCci] = useState(INITIAL_MOCK_CCI);
  const [mockHistory, setMockHistory] = useState(INITIAL_MOCK_HISTORY);

  // Real-time fluctuation effect
  useEffect(() => {
    const interval = setInterval(() => {
      setMockData(prev => {
        const latVar = (Math.random() - 0.5) * 8;
        const metricsVar = (Math.random() - 0.5) * 0.01;
        const tracesVar  = (Math.random() - 0.5) * 0.01;
        const logsVar    = (Math.random() - 0.5) * 0.005;

        const newMetrics = Math.min(1, Math.max(0.5, prev.details.metrics_coverage_rate + metricsVar));
        const newTraces  = Math.min(1, Math.max(0.5, prev.details.trace_id_propagation_rate + tracesVar));
        const newLogs    = Math.min(1, Math.max(0.5, prev.details.log_structural_integrity + logsVar));

        const blindSpotCount = mockCci.blind_spots.length;
        const newOScore = calculateOScore(newMetrics, newTraces, newLogs, blindSpotCount, prev.scoring_weights.blind_spot_penalty);

        return {
          ...prev,
          oscore: newOScore,
          details: {
            ...prev.details,
            metrics_coverage_rate: newMetrics,
            trace_id_propagation_rate: newTraces,
            log_structural_integrity: newLogs,
            service_latency_p95_ms: Math.max(10, prev.details.service_latency_p95_ms + latVar)
          }
        };
      });

      setMockCci(prev => {
        const cciVar = (Math.random() - 0.5) * 0.8;
        let newCci = prev.cci_index + cciVar;
        if (newCci > 100) newCci = 100;
        if (newCci < 10) newCci = 10;
        
        return {
          ...prev,
          cci_index: newCci
        };
      });
    }, 3500);
    return () => clearInterval(interval);
  }, []);

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
  
  return (
    <PageContainer>
      {/* App Header */}
      <header className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 drop-shadow-sm flex items-center gap-3">
            <Activity className="w-8 h-8 text-indigo-400" />
            Observability Engine
          </h1>
          <p className="text-sm text-slate-400 mt-1 font-medium">Real-Time Telemetry Correlation & AI Analysis</p>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1.5 rounded-full flex items-center gap-2 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400`}>
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
              <span className="text-sm font-medium">Live</span>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              <SourceBadge name="Prometheus" status="live" />
              <SourceBadge name="Loki"       status="live" />
              <SourceBadge name="Jaeger"     status="live" />
            </div>
          </div>
        </div>
      </header>

      {isCalculationView ? (
        <main className="w-full max-w-7xl z-10 space-y-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calculator className="w-5 h-5 text-brand-obs" /> How we calculate the O-Score
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Review the parameters, cross-pillar correlation weights, and penalty deductions behind the current score.
            </p>
          </div>
          <ObservabilityMethodology />
        </main>
      ) : (
        <>
          {/* Navigation */}
          <div className="w-full max-w-7xl z-10 mb-8">
            <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
          </div>

          {/* Main Content Area */}
          <main className="w-full max-w-7xl z-10">
            {activeTab === 'overview' && (
              <div className="space-y-8 obs-fade-up">
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* O-Score */}
                  <div className="lg:col-span-1 obs-glass p-8 flex flex-col items-center justify-center obs-lift relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <h2 className="text-xl font-medium text-slate-300 mb-6">Real-Time O-Score</h2>
                    <ScoreRing score={oScore} />
                    
                    {mockCci.blind_spots.length > 0 && (
                      <div className="mt-6 px-4 py-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-sm flex items-center gap-2 font-medium">
                        <AlertCircle className="w-4 h-4" />
                        Penalty: -{mockData.scoring_weights.blind_spot_penalty} pts for blind spots
                      </div>
                    )}
                  </div>

                  {/* History Chart */}
                  <div className="lg:col-span-2 flex flex-col justify-end">
                    <ScoreHistory history={mockHistory} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <MetricCard icon={<Database className="w-5 h-5 text-emerald-400" />} title="Metrics Coverage" value={`${(d.metrics_coverage_rate * 100).toFixed(0)}%`} description="Healthy scrape targets" source="prometheus" />
                  <MetricCard icon={<AlertCircle className="w-5 h-5 text-rose-400" />} title="HTTP Error Rate" value={`${(d.system_error_rate * 100).toFixed(2)}%`} description="5xx responses (5m)" source="prometheus" isAlert={d.system_error_rate > 0.05} />
                  <MetricCard icon={<Server className="w-5 h-5 text-amber-400" />} title="p95 Latency" value={`${d.service_latency_p95_ms.toFixed(1)} ms`} description="95th percentile request duration" source="prometheus" isAlert={d.service_latency_p95_ms > 1000} />
                  <MetricCard icon={<BarChart2 className="w-5 h-5 text-sky-400" />} title="Active Services" value={d.service_count} description="Instrumented services" source="jaeger" />
                  
                  <MetricCard icon={<ShieldCheck className="w-5 h-5 text-blue-400" />} title="Log Integrity" value={`${(d.log_structural_integrity * 100).toFixed(0)}%`} description="Structured level labels" source="loki" />
                  <MetricCard icon={<Radio className="w-5 h-5 text-rose-400" />} title="Log Errors (15m)" value={d.log_error_count.toLocaleString()} description="Error-level log lines" source="loki" isAlert={d.log_error_count > 100} />
                  <MetricCard icon={<Zap className="w-5 h-5 text-purple-400" />} title="Trace Propagation" value={`${(d.trace_id_propagation_rate * 100).toFixed(0)}%`} description="Multi-service traces" source="jaeger" />
                  <MetricCard icon={<GitBranch className="w-5 h-5 text-teal-400" />} title="Avg Trace Duration" value={`${d.avg_trace_duration_ms.toFixed(1)} ms`} description="End-to-end trace length" source="jaeger" />
                </div>
              </div>
            )}

            {activeTab === 'metrics' && (
              <div className="obs-fade-up">
                <MetricsDashboard data={mockData} />
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="obs-fade-up">
                <LogsDashboard data={mockData} />
              </div>
            )}

            {activeTab === 'traces' && (
              <div className="obs-fade-up">
                <TracesDashboard data={mockData} />
              </div>
            )}

            {activeTab === 'cci' && (
              <div className="obs-fade-up">
                <CCIPanel cciData={mockCci} />
              </div>
            )}

            {activeTab === 'rca' && (
              <div className="obs-fade-up">
                <RCAPanel cciData={mockCci} onRcaComplete={(report: any) => { setRcaReport(report); setActiveTab('remediation'); }} />
              </div>
            )}

            {activeTab === 'remediation' && (
              <div className="obs-fade-up">
                <RemediationPanel rcaReport={rcaReport} />
              </div>
            )}

            {activeTab === 'chaos' && (
              <div className="obs-fade-up">
                <ChaosPanel onExperimentRun={handleChaosExperiment} />
              </div>
            )}
          </main>
        </>
      )}
    </PageContainer>
  );
};
