import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  GitBranch,
  History,
  Info,
  Layers,
  Play,
  RefreshCw,
  Server,
  ShieldAlert,
  Sliders,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Area,
  AreaChart,
  ComposedChart
} from 'recharts';
import { TelemetryService } from '../services/telemetry';

interface HistoricalPoint {
  deploymentId: string;
  version: string;
  timestamp: string;
  baselineP95Ms: number;
}

interface PredictedPoint {
  step: number;
  label: string;
  timestamp: string;
  predictedP95Ms: number;
  lowerBoundMs: number;
  upperBoundMs: number;
}

export const DriftAnalysisPage: React.FC = () => {
  const [selectedService, setSelectedService] = useState<string>('order-service');
  const [sensitivityDays, setSensitivityDays] = useState<number>(14);
  const [currentP95Ms, setCurrentP95Ms] = useState<number>(135.0);
  const [slaThresholdMs, setSlaThresholdMs] = useState<number>(160.0);
  const [forecastSteps, setForecastSteps] = useState<number>(3);
  const [liveServices, setLiveServices] = useState<string[]>(['order-service', 'payment-service', 'user-service', 'api-gateway']);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Discover live services
  const discoverServices = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const jaegerData = await TelemetryService.fetchJaegerTraces();
      if (jaegerData && Array.isArray(jaegerData.data) && jaegerData.data.length > 0) {
        const filtered = jaegerData.data.filter((s: string) => s !== 'jaeger-query');
        if (filtered.length > 0) {
          setLiveServices(filtered);
        }
      }
    } catch {
      // fallback
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    discoverServices();
  }, [discoverServices]);

  // Historical deployment baseline data
  const historicalDeployments: HistoricalPoint[] = useMemo(() => {
    const baseLatency = selectedService === 'api-gateway' ? 45 : selectedService === 'order-service' ? 85 : 60;
    return [
      { deploymentId: 'dep-v1.2.0', version: 'v1.2.0', timestamp: '14d ago', baselineP95Ms: baseLatency - 5 },
      { deploymentId: 'dep-v1.2.1', version: 'v1.2.1', timestamp: '10d ago', baselineP95Ms: baseLatency + 2 },
      { deploymentId: 'dep-v1.2.2', version: 'v1.2.2', timestamp: '7d ago', baselineP95Ms: baseLatency - 2 },
      { deploymentId: 'dep-v1.2.3', version: 'v1.2.3', timestamp: '4d ago', baselineP95Ms: baseLatency + 6 },
      { deploymentId: 'dep-v1.2.4', version: 'v1.2.4', timestamp: '1d ago', baselineP95Ms: baseLatency + 1 },
    ];
  }, [selectedService]);

  // Calculate Moving Average Baseline P95
  const historicalBaseline = useMemo(() => {
    if (historicalDeployments.length === 0) return 100.0;
    const sum = historicalDeployments.reduce((acc, h) => acc + h.baselineP95Ms, 0);
    return parseFloat((sum / historicalDeployments.length).toFixed(1));
  }, [historicalDeployments]);

  // Drift Analysis Calculations (Phase 3 Formula)
  const driftDeltaMs = parseFloat((currentP95Ms - historicalBaseline).toFixed(1));
  const driftPercentage = parseFloat((historicalBaseline > 0 ? (driftDeltaMs / historicalBaseline) * 100 : 0).toFixed(1));
  const rawScore = driftPercentage > 0 ? driftPercentage / 100.0 : 0.0;
  const driftScore = parseFloat(Math.min(1.0, Math.max(0.0, rawScore)).toFixed(3));
  const pScorePenalty = parseFloat((driftScore * 40.0).toFixed(1)); // 40% weight in Scoring Engine

  // Predictive Trend & Future Drift Forecasting (OLS Regression)
  const forecastData = useMemo(() => {
    const points = [...historicalDeployments.map((d) => d.baselineP95Ms), currentP95Ms];
    const n = points.length;

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += points[i];
      sumXY += i * points[i];
      sumXX += i * i;
    }

    const meanX = sumX / n;
    const meanY = sumY / n;
    const denominator = sumXX - sumX * meanX;
    const slope = denominator !== 0 ? (sumXY - sumX * meanY) / denominator : 0;
    const intercept = meanY - slope * meanX;

    let ssResiduals = 0;
    for (let i = 0; i < n; i++) {
      const pred = slope * i + intercept;
      ssResiduals += Math.pow(points[i] - pred, 2);
    }
    const standardError = n > 2 ? Math.sqrt(ssResiduals / (n - 2)) : 3.0;

    const predictions: PredictedPoint[] = [];
    for (let step = 1; step <= forecastSteps; step++) {
      const futureX = n - 1 + step;
      const predVal = Math.max(5.0, slope * futureX + intercept);
      const margin = 1.96 * standardError * Math.sqrt(1 + 1 / n + Math.pow(futureX - meanX, 2) / (denominator || 1));

      predictions.push({
        step,
        label: `Forecast +${step}`,
        timestamp: `+${step} Release`,
        predictedP95Ms: parseFloat(predVal.toFixed(1)),
        lowerBoundMs: parseFloat(Math.max(5.0, predVal - margin).toFixed(1)),
        upperBoundMs: parseFloat((predVal + margin).toFixed(1)),
      });
    }

    // Trend Direction
    let trendDirection: 'DEGRADING_RAPIDLY' | 'DEGRADING_STEADY' | 'STABLE' | 'IMPROVING' = 'STABLE';
    if (slope > 3.0) trendDirection = 'DEGRADING_RAPIDLY';
    else if (slope > 0.3) trendDirection = 'DEGRADING_STEADY';
    else if (slope < -0.3) trendDirection = 'IMPROVING';
    else trendDirection = 'STABLE';

    // Time to SLA Breach
    let estimatedDeploymentsToBreach: number | null = null;
    if (currentP95Ms >= slaThresholdMs) {
      estimatedDeploymentsToBreach = 0;
    } else if (slope > 0.05) {
      const steps = (slaThresholdMs - currentP95Ms) / slope;
      estimatedDeploymentsToBreach = Math.max(1, Math.ceil(steps));
    }

    const nextPredicted = predictions[0]?.predictedP95Ms ?? currentP95Ms;
    const nextDelta = nextPredicted - historicalBaseline;
    const nextRatio = historicalBaseline > 0 ? nextDelta / historicalBaseline : 0;
    const predictedNextDriftScore = parseFloat(Math.min(1.0, Math.max(0.0, nextRatio)).toFixed(3));

    return {
      slope: parseFloat(slope.toFixed(2)),
      intercept: parseFloat(intercept.toFixed(2)),
      predictions,
      trendDirection,
      estimatedDeploymentsToBreach,
      predictedNextDriftScore,
    };
  }, [historicalDeployments, currentP95Ms, forecastSteps, slaThresholdMs, historicalBaseline]);

  // Combined chart data (Historical + Live + Future Forecast)
  const chartData = useMemo(() => {
    const historicalPoints = historicalDeployments.map((d) => ({
      label: d.version,
      timestamp: d.timestamp,
      historicalBaseline: historicalBaseline,
      deploymentP95: d.baselineP95Ms,
      liveP95: null as number | null,
      forecastP95: null as number | null,
      lowerBound: null as number | null,
      upperBound: null as number | null,
    }));

    const livePoint = {
      label: 'Live Active',
      timestamp: 'Current',
      historicalBaseline: historicalBaseline,
      deploymentP95: null,
      liveP95: currentP95Ms,
      forecastP95: currentP95Ms, // Anchor forecast line to live point
      lowerBound: currentP95Ms,
      upperBound: currentP95Ms,
    };

    const futurePoints = forecastData.predictions.map((p) => ({
      label: p.label,
      timestamp: p.timestamp,
      historicalBaseline: historicalBaseline,
      deploymentP95: null,
      liveP95: null,
      forecastP95: p.predictedP95Ms,
      lowerBound: p.lowerBoundMs,
      upperBound: p.upperBoundMs,
    }));

    return [...historicalPoints, livePoint, ...futurePoints];
  }, [historicalDeployments, historicalBaseline, currentP95Ms, forecastData.predictions]);

  const getDriftSeverity = () => {
    if (driftScore <= 0.15) return { label: 'Healthy (No Significant Drift)', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
    if (driftScore <= 0.45) return { label: 'Moderate Degradation', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
    return { label: 'Severe Latency Drift', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' };
  };

  const severity = getDriftSeverity();

  return (
    <PageContainer className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-perf">Phase 3: Core Signal & Predictive Sub-Module</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Historical Drift & Predictive Trend Analyzer</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary">
            Compares live telemetry P95 latency against moving-average historical baselines and leverages Ordinary Least Squares (OLS) regression to predict future latency drift and preemptive SLA violations.
          </p>
        </div>
        <button
          type="button"
          onClick={discoverServices}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-secondary/40 px-3.5 py-2 text-xs font-medium text-text-primary hover:bg-surface-secondary disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-brand-perf' : ''}`} />
          {isRefreshing ? 'Scanning...' : 'Refresh Live Telemetry'}
        </button>
      </div>

      {/* Target Microservice, Baseline, & Predictive Forecasting Controls */}
      <Card>
        <CardHeader className="border-b border-border/60 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
              <Server className="h-4 w-4 text-brand-perf" /> Active Microservice & Predictive Engine Settings
            </CardTitle>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">Sensitivity Window:</span>
                <select
                  value={sensitivityDays}
                  onChange={(e) => setSensitivityDays(Number(e.target.value))}
                  className="rounded-md border border-border bg-surface-secondary/40 px-2.5 py-1 font-mono text-xs text-text-primary outline-none focus:ring-1 focus:ring-brand-perf"
                >
                  <option value={7}>7 Days</option>
                  <option value={14}>14 Days (Standard)</option>
                  <option value={30}>30 Days</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">Forecast Horizon:</span>
                <select
                  value={forecastSteps}
                  onChange={(e) => setForecastSteps(Number(e.target.value))}
                  className="rounded-md border border-border bg-surface-secondary/40 px-2.5 py-1 font-mono text-xs text-text-primary outline-none focus:ring-1 focus:ring-brand-perf"
                >
                  <option value={2}>+2 Releases</option>
                  <option value={3}>+3 Releases (Default)</option>
                  <option value={5}>+5 Releases</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">SLA Threshold:</span>
                <input
                  type="number"
                  value={slaThresholdMs}
                  onChange={(e) => setSlaThresholdMs(Number(e.target.value))}
                  className="w-20 rounded-md border border-border bg-surface-secondary/40 px-2 py-1 font-mono text-xs text-text-primary outline-none focus:ring-1 focus:ring-brand-perf text-right"
                />
                <span className="text-xs text-text-muted font-mono">ms</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-2.5">
            {liveServices.map((svc) => (
              <button
                key={svc}
                type="button"
                onClick={() => {
                  setSelectedService(svc);
                  if (svc === 'order-service') {
                    setCurrentP95Ms(135);
                    setSlaThresholdMs(160);
                  } else if (svc === 'api-gateway') {
                    setCurrentP95Ms(48);
                    setSlaThresholdMs(70);
                  } else {
                    setCurrentP95Ms(82);
                    setSlaThresholdMs(110);
                  }
                }}
                className={`rounded-lg border px-3 py-1.5 font-mono text-xs transition-all ${
                  selectedService === svc
                    ? 'border-brand-perf bg-brand-perf/15 font-semibold text-brand-perf shadow-sm'
                    : 'border-border bg-surface-secondary/30 text-text-secondary hover:text-text-primary'
                }`}
              >
                {svc}
              </button>
            ))}
          </div>

          {/* Live Latency Simulation Slider */}
          <div className="rounded-lg border border-border/60 bg-surface-secondary/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                <Sliders className="h-3.5 w-3.5 text-brand-perf" /> Live P95 Latency Simulation / Override
              </span>
              <span className="font-mono text-sm font-bold text-brand-perf">{currentP95Ms} ms</span>
            </div>
            <input
              type="range"
              min={30}
              max={300}
              step={1}
              value={currentP95Ms}
              onChange={(e) => setCurrentP95Ms(Number(e.target.value))}
              className="w-full accent-brand-perf cursor-pointer"
            />
            <div className="mt-1 flex justify-between text-[10px] font-mono text-text-muted">
              <span>30 ms (Ultra-fast)</span>
              <span>Historical Baseline: {historicalBaseline} ms</span>
              <span>SLA Limit: {slaThresholdMs} ms</span>
              <span>300 ms (Severe Degradation)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Proactive Forecasting Banner Alert */}
      <div
        className={`flex items-start gap-3 rounded-lg border p-4 ${
          forecastData.estimatedDeploymentsToBreach === 0
            ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
            : forecastData.estimatedDeploymentsToBreach !== null && forecastData.estimatedDeploymentsToBreach <= 3
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
            : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
        }`}
      >
        <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <div className="font-semibold uppercase tracking-wider">
            {forecastData.estimatedDeploymentsToBreach === 0
              ? 'SLA Breach Active'
              : forecastData.estimatedDeploymentsToBreach !== null && forecastData.estimatedDeploymentsToBreach <= 3
              ? `Proactive Warning: SLA Breach Predicted in ~${forecastData.estimatedDeploymentsToBreach} Deployment(s)`
              : 'Predictive Horizon Stable'}
          </div>
          <p className="text-text-secondary text-[11px] leading-relaxed">
            {forecastData.estimatedDeploymentsToBreach === 0
              ? `Current live P95 latency (${currentP95Ms}ms) has already breached the SLA target of ${slaThresholdMs}ms. Rollback or performance tuning required.`
              : forecastData.estimatedDeploymentsToBreach !== null && forecastData.estimatedDeploymentsToBreach <= 3
              ? `Latency is degrading at a rate of +${forecastData.slope} ms per release. Based on linear trend projection, P95 latency will exceed ${slaThresholdMs}ms in the next release cycle.`
              : `Latency trend velocity is ${forecastData.slope > 0 ? `+${forecastData.slope}` : `${forecastData.slope}`} ms/release. Service remains safely below the ${slaThresholdMs}ms SLA threshold for the forecasted horizon.`}
          </p>
        </div>
      </div>

      {/* Real-time & Predictive Drift Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-surface-secondary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Historical Baseline P95
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-bold text-text-primary">{historicalBaseline} <span className="text-sm font-normal text-text-muted">ms</span></div>
            <p className="mt-1 text-xs text-text-muted">Moving average of 5 deployments</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-secondary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Live Current P95
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-bold text-brand-perf">{currentP95Ms} <span className="text-sm font-normal text-text-muted">ms</span></div>
            <p className="mt-1 text-xs text-text-muted">Active snapshot latency</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-secondary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Trend Velocity (Slope)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`flex items-center gap-1.5 font-mono text-2xl font-bold ${forecastData.slope > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {forecastData.slope > 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              {forecastData.slope > 0 ? `+${forecastData.slope}` : forecastData.slope} <span className="text-sm font-normal text-text-muted">ms/rel</span>
            </div>
            <p className="mt-1 text-xs text-text-muted">{forecastData.trendDirection.replace('_', ' ')}</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-secondary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Predicted Next Drift Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`font-mono text-2xl font-bold ${forecastData.predictedNextDriftScore > 0.4 ? 'text-rose-400' : 'text-cyan-400'}`}>
              {forecastData.predictedNextDriftScore}
            </div>
            <p className="mt-1 text-xs text-text-muted">
              Next P95: ~{forecastData.predictions[0]?.predictedP95Ms ?? currentP95Ms} ms
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Historical Deployment Trend & Predictive Curve Chart */}
      <Card>
        <CardHeader className="border-b border-border/60 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
              <Activity className="h-4 w-4 text-brand-perf" /> Historical Baseline vs Live P95 vs Predictive Forecast Curve
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${severity.bg} ${severity.color}`}>
                {severity.label}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-mono text-purple-400">
                <Sparkles className="h-3 w-3" /> OLS Forecast ({forecastSteps} steps)
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="label" stroke="#888" fontSize={11} />
                <YAxis stroke="#888" fontSize={11} unit="ms" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '6px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

                {/* Moving Average Baseline */}
                <ReferenceLine
                  y={historicalBaseline}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  label={{ value: `Baseline (${historicalBaseline}ms)`, fill: '#10b981', fontSize: 11, position: 'top' }}
                />

                {/* SLA Threshold Limit Line */}
                <ReferenceLine
                  y={slaThresholdMs}
                  stroke="#ef4444"
                  strokeDasharray="3 3"
                  label={{ value: `SLA Limit (${slaThresholdMs}ms)`, fill: '#ef4444', fontSize: 11, position: 'insideTopRight' }}
                />

                {/* Historical baseline deployments */}
                <Line
                  type="monotone"
                  dataKey="deploymentP95"
                  name="Historical Deployments P95"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#38bdf8' }}
                  connectNulls
                />

                {/* Live active latency */}
                <Line
                  type="monotone"
                  dataKey="liveP95"
                  name="Live Active Latency P95"
                  stroke="#f43f5e"
                  strokeWidth={3}
                  dot={{ r: 7, fill: '#f43f5e' }}
                  connectNulls
                />

                {/* Predicted Future Curve */}
                <Line
                  type="monotone"
                  dataKey="forecastP95"
                  name="Predicted Future Latency P95"
                  stroke="#a855f7"
                  strokeWidth={2.5}
                  strokeDasharray="5 5"
                  dot={{ r: 5, fill: '#a855f7' }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Predictive Forecast Breakdown Table */}
      <Card>
        <CardHeader className="border-b border-border/60 pb-3">
          <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
            <Compass className="h-4 w-4 text-purple-400" /> Proactive Drift Forecast & SLA Risk Matrix
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-border text-text-muted">
                <tr>
                  <th className="pb-2">Forecast Horizon</th>
                  <th className="pb-2">Time Horizon</th>
                  <th className="pb-2 text-right">Predicted P95 (ms)</th>
                  <th className="pb-2 text-right">95% Confidence Interval</th>
                  <th className="pb-2 text-right">Drift vs Baseline</th>
                  <th className="pb-2 text-center">SLA Compliance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-text-secondary">
                {forecastData.predictions.map((p) => {
                  const delta = parseFloat((p.predictedP95Ms - historicalBaseline).toFixed(1));
                  const isBreach = p.predictedP95Ms >= slaThresholdMs;
                  const isUpperBreach = p.upperBoundMs >= slaThresholdMs;

                  return (
                    <tr key={p.step} className="hover:bg-surface-secondary/30">
                      <td className="py-2.5 text-purple-400 font-semibold flex items-center gap-1.5">
                        <ArrowRight className="h-3 w-3" /> {p.label}
                      </td>
                      <td className="py-2.5 text-text-muted">{p.timestamp}</td>
                      <td className="py-2.5 text-right font-medium text-text-primary">{p.predictedP95Ms} ms</td>
                      <td className="py-2.5 text-right text-text-muted">
                        [{p.lowerBoundMs} ms - {p.upperBoundMs} ms]
                      </td>
                      <td className={`py-2.5 text-right ${delta > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {delta > 0 ? `+${delta} ms` : `${delta} ms`}
                      </td>
                      <td className="py-2.5 text-center">
                        {isBreach ? (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-2 py-0.5 text-[11px] font-semibold text-rose-400">
                            <AlertTriangle className="h-3 w-3" /> Breach Expected
                          </span>
                        ) : isUpperBreach ? (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
                            <AlertTriangle className="h-3 w-3" /> Risk in Upper Bound
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> SLA Compliant
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Historical Deployments Breakdown Table */}
      <Card>
        <CardHeader className="border-b border-border/60 pb-3">
          <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
            <History className="h-4 w-4 text-brand-perf" /> Historical Deployments Baseline Log
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-border text-text-muted">
                <tr>
                  <th className="pb-2">Deployment ID</th>
                  <th className="pb-2">Release Version</th>
                  <th className="pb-2">Recorded At</th>
                  <th className="pb-2 text-right">Baseline P95 (ms)</th>
                  <th className="pb-2 text-right">Deviation from Mean</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-text-secondary">
                {historicalDeployments.map((d) => {
                  const dev = parseFloat((d.baselineP95Ms - historicalBaseline).toFixed(1));
                  return (
                    <tr key={d.deploymentId} className="hover:bg-surface-secondary/30">
                      <td className="py-2.5 text-text-primary">{d.deploymentId}</td>
                      <td className="py-2.5 text-cyan-400">{d.version}</td>
                      <td className="py-2.5 text-text-muted">{d.timestamp}</td>
                      <td className="py-2.5 text-right font-medium text-text-primary">{d.baselineP95Ms} ms</td>
                      <td className={`py-2.5 text-right ${dev > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {dev > 0 ? `+${dev} ms` : `${dev} ms`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
};

