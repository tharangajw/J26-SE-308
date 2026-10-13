import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Server,
  TrendingDown,
  TrendingUp,
  Zap,
  Info,
  ServerCrash,
  Search,
  Radio,
  Plus
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
  ReferenceLine
} from 'recharts';
import { TelemetryService } from '../services/telemetry';

interface HistoricalDeployment {
  version: string;
  evaluatedAt: string;
  p95LatencyMs: number;
}

interface PredictedDeployment {
  version: string;
  evaluatedAt: string;
  predictedP95Ms: number;
  lowerBoundMs: number;
  upperBoundMs: number;
}

interface DriftForecast {
  trendSlopeMsPerRelease: number;
  trendDirection: 'DEGRADING_RAPIDLY' | 'DEGRADING_STEADY' | 'STABLE' | 'IMPROVING';
  predictedDeployments: PredictedDeployment[];
  estimatedDeploymentsToSLABreach: number | null;
  predictedNextDriftScore: number;
  proactiveWarning: string;
}

interface ServiceDriftAnalysis {
  serviceId: string;
  liveP95LatencyMs: number;
  historicalBaselineMs: number;
  latencyDeltaMs: number;
  driftRatio: number;
  driftScore: number;
  driftLevel: 'NO_DRIFT' | 'SLIGHT_DRIFT' | 'MODERATE_DRIFT' | 'CRITICAL_DRIFT' | 'NO_DATA';
  hasTelemetry?: boolean;
  historicalDeployments: HistoricalDeployment[];
  recommendation: string;
  forecast?: DriftForecast;
}

interface TelemetryPhase3Response {
  pipeline: string;
  requestedServices: string[];
  evaluatedAt: number;
  historicalDriftAnalysis: ServiceDriftAnalysis[];
}

interface DiscoveredServicesState {
  prometheusJobs: string[];
  jaegerServices: string[];
  applicationServices: string[];
  infrastructureServices: string[];
  allServices: string[];
}

export const DriftAnalysisPage: React.FC = () => {
  const [data, setData] = useState<TelemetryPhase3Response | null>(null);
  const [discovered, setDiscovered] = useState<DiscoveredServicesState | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [customServices, setCustomServices] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Dynamic Service Discovery & Drift Fetching
  const fetchTelemetry = useCallback(async (serviceToSelect?: string) => {
    setIsRefreshing(true);
    try {
      // 1. Dynamic Service Discovery from Prometheus & Jaeger
      const discoveryResult = await TelemetryService.discoverServices();
      setDiscovered(discoveryResult);

      // Determine candidate services to inspect:
      // (a) Any user-added custom services
      // (b) Application microservices discovered from Prometheus/Jaeger
      // (c) If no application services exist, include infrastructure targets so user can view live metrics
      const candidateServices = new Set<string>();

      customServices.forEach((s) => candidateServices.add(s));
      discoveryResult.applicationServices.forEach((s) => candidateServices.add(s));

      if (serviceToSelect) {
        candidateServices.add(serviceToSelect);
      }

      if (candidateServices.size === 0) {
        // Fallback to discovered infrastructure services (e.g. telemetry-collector)
        discoveryResult.infrastructureServices.forEach((s) => candidateServices.add(s));
      }

      const servicesToQuery = Array.from(candidateServices);
      if (servicesToQuery.length === 0) {
        throw new Error('No services discovered in Prometheus (:9090) or Jaeger (:16686).');
      }

      // 2. Fetch Drift Analysis from backend collector
      const queryParam = encodeURIComponent(servicesToQuery.join(','));
      let response: Response;
      try {
        response = await fetch(`/api/telemetry/phase3?services=${queryParam}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      } catch {
        response = await fetch(`http://localhost:8787/api/telemetry/phase3?services=${queryParam}`);
      }

      if (!response.ok) {
        throw new Error(`Telemetry Collector responded with status ${response.status}`);
      }

      const json: TelemetryPhase3Response = await response.json();
      if (!json || !Array.isArray(json.historicalDriftAnalysis) || json.historicalDriftAnalysis.length === 0) {
        throw new Error('Telemetry collector returned no drift analysis data');
      }

      setData(json);
      setError(null);
      setLastRefreshed(new Date());

      // Select target service
      setSelectedServiceId((prev) => {
        if (serviceToSelect && json.historicalDriftAnalysis.some((s) => s.serviceId === serviceToSelect)) {
          return serviceToSelect;
        }
        const availableIds = json.historicalDriftAnalysis.map((s) => s.serviceId);
        if (prev && availableIds.includes(prev)) return prev;
        return availableIds[0] || null;
      });
    } catch (err: any) {
      setError(err?.message || 'Unable to connect to telemetry collector or Prometheus/Jaeger');
      setData(null);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [customServices]);

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(() => fetchTelemetry(), 10000);
    return () => clearInterval(interval);
  }, [fetchTelemetry]);

  // Handle adding custom service to inspect
  const handleAddCustomService = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (!customServices.includes(trimmed)) {
      setCustomServices((prev) => [...prev, trimmed]);
    }
    setCustomInput('');
    fetchTelemetry(trimmed);
  };

  const currentServiceAnalysis = useMemo(() => {
    if (!data || !selectedServiceId) return null;
    return data.historicalDriftAnalysis.find((s) => s.serviceId === selectedServiceId) || null;
  }, [data, selectedServiceId]);

  // Transform data for unified chart
  const chartData = useMemo(() => {
    if (!currentServiceAnalysis) return [];

    const baseline = currentServiceAnalysis.historicalBaselineMs;
    const history = currentServiceAnalysis.historicalDeployments || [];
    const forecast = currentServiceAnalysis.forecast?.predictedDeployments || [];

    const historicalPoints = history
      .filter((h) => !h.version.toLowerCase().startsWith('live'))
      .map((h) => ({
        release: h.version,
        date: h.evaluatedAt,
        actualLatency: h.p95LatencyMs,
        forecastLatency: null as number | null,
        baseline: baseline,
        type: 'Historical',
      }));

    const livePoint = {
      release: 'Live Active',
      date: 'Current',
      actualLatency: currentServiceAnalysis.liveP95LatencyMs,
      forecastLatency: currentServiceAnalysis.liveP95LatencyMs,
      baseline: baseline,
      type: 'Live Active',
    };

    const futurePoints = forecast.map((f) => ({
      release: f.version.replace(' (Forecast)', ''),
      date: f.evaluatedAt,
      actualLatency: null as number | null,
      forecastLatency: f.predictedP95Ms,
      baseline: baseline,
      type: 'Forecast',
    }));

    return [...historicalPoints, livePoint, ...futurePoints];
  }, [currentServiceAnalysis]);

  const getDriftBadge = (level: ServiceDriftAnalysis['driftLevel'] | undefined) => {
    switch (level) {
      case 'NO_DRIFT':
        return {
          label: 'Healthy (No Drift)',
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        };
      case 'SLIGHT_DRIFT':
        return {
          label: 'Slight Drift',
          color: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
          icon: <Info className="h-4 w-4 text-sky-400" />
        };
      case 'MODERATE_DRIFT':
        return {
          label: 'Moderate Degradation',
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
          icon: <AlertTriangle className="h-4 w-4 text-amber-400" />
        };
      case 'CRITICAL_DRIFT':
        return {
          label: 'Critical Regression',
          color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
          icon: <AlertTriangle className="h-4 w-4 text-rose-400" />
        };
      case 'NO_DATA':
        return {
          label: 'No Telemetry Data',
          color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30',
          icon: <AlertTriangle className="h-4 w-4 text-zinc-400" />
        };
      default:
        return {
          label: 'Unknown',
          color: 'text-text-muted bg-surface-secondary border-border',
          icon: <Activity className="h-4 w-4" />
        };
    }
  };

  const getTrendBadge = (direction: DriftForecast['trendDirection'] | undefined) => {
    switch (direction) {
      case 'IMPROVING':
        return { label: 'Improving', color: 'text-emerald-400', icon: <TrendingDown className="h-4 w-4 text-emerald-400" /> };
      case 'STABLE':
        return { label: 'Stable', color: 'text-sky-400', icon: <Activity className="h-4 w-4 text-sky-400" /> };
      case 'DEGRADING_STEADY':
        return { label: 'Degrading Steadily', color: 'text-amber-400', icon: <TrendingUp className="h-4 w-4 text-amber-400" /> };
      case 'DEGRADING_RAPIDLY':
        return { label: 'Degrading Rapidly', color: 'text-rose-400', icon: <TrendingUp className="h-4 w-4 text-rose-400" /> };
      default:
        return { label: 'Insufficient Data', color: 'text-text-muted', icon: <Activity className="h-4 w-4" /> };
    }
  };

  // 1. Loading State
  if (isLoading && !data) {
    return (
      <PageContainer className="space-y-6">
        <div className="flex h-96 flex-col items-center justify-center space-y-4 rounded-xl border border-border bg-surface p-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-brand-perf" />
          <h2 className="text-lg font-medium text-text-primary">Discovering Cluster Services...</h2>
          <p className="max-w-md text-sm text-text-secondary">
            Querying Prometheus (/api/v1/label/job/values) and Jaeger (/api/services) for active microservices.
          </p>
        </div>
      </PageContainer>
    );
  }

  // 2. Offline / Error State (No fake fallback)
  if (error || !data || !currentServiceAnalysis) {
    return (
      <PageContainer className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Historical Drift & Predictive Trend Analyzer
            </h1>
            <p className="text-sm text-text-secondary">
              Real-time latency baseline tracking and predictive SLA drift forecasting.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchTelemetry()}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-secondary px-3.5 py-2 text-xs font-medium text-text-primary hover:bg-surface-secondary/80 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-brand-perf' : ''}`} />
            Retry Discovery
          </button>
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/5 p-12 text-center">
          <ServerCrash className="h-12 w-12 text-rose-400" />
          <h3 className="mt-4 text-lg font-semibold text-rose-300">Telemetry Services Unreachable</h3>
          <p className="mt-2 max-w-lg text-sm text-text-secondary leading-relaxed">
            {error || 'Unable to discover active services from Prometheus (:9090), Jaeger (:16686) or Telemetry Collector (:8787).'}
          </p>
          <div className="mt-6 rounded-lg border border-border bg-surface p-4 text-left font-mono text-xs text-text-secondary">
            <p className="font-semibold text-text-primary">Verify that your telemetry containers are running:</p>
            <p className="mt-1 text-emerald-400">docker compose up -d prometheus jaeger telemetry-collector</p>
          </div>
          <button
            type="button"
            onClick={() => fetchTelemetry()}
            disabled={isRefreshing}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-perf px-4 py-2 text-xs font-semibold text-white hover:bg-brand-perf/90"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Now
          </button>
        </div>
      </PageContainer>
    );
  }

  const driftBadge = getDriftBadge(currentServiceAnalysis.driftLevel);
  const trendBadge = getTrendBadge(currentServiceAnalysis.forecast?.trendDirection);
  const isDegrading = currentServiceAnalysis.latencyDeltaMs > 0;

  return (
    <PageContainer className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Historical Drift & Predictive Trend Analyzer
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Dynamic Discovery Active
            </span>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            Continuously discovers active microservices from Prometheus and Jaeger, evaluates historical baseline drift, and forecasts SLA breaches.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <Clock className="h-3 w-3" />
              {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={() => fetchTelemetry()}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-secondary px-3.5 py-2 text-xs font-medium text-text-primary hover:bg-surface-secondary/80 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-brand-perf' : ''}`} />
            Refresh Discovery
          </button>
        </div>
      </div>

      {/* Dynamic Discovery Telemetry Sources Bar */}
      <div className="rounded-lg border border-border/80 bg-surface-secondary/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-emerald-400" />
              <span className="font-semibold text-text-primary">Prometheus Jobs:</span>
              <span className="font-mono text-emerald-400">
                {discovered?.prometheusJobs?.length ? discovered.prometheusJobs.join(', ') : 'None'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-sky-400" />
              <span className="font-semibold text-text-primary">Jaeger Services:</span>
              <span className="font-mono text-sky-400">
                {discovered?.jaegerServices?.length ? discovered.jaegerServices.join(', ') : 'None'}
              </span>
            </div>
          </div>

          {/* Quick Input to inspect any specific service */}
          <form onSubmit={handleAddCustomService} className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Inspect specific service..."
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                className="w-52 rounded-md border border-border bg-surface pl-8 pr-3 py-1 text-xs font-mono text-text-primary placeholder:text-text-muted focus:border-brand-perf focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-md bg-brand-perf/20 border border-brand-perf/40 px-2.5 py-1 text-xs font-medium text-brand-perf hover:bg-brand-perf/30"
            >
              <Plus className="h-3 w-3" />
              Inspect
            </button>
          </form>
        </div>
      </div>

      {/* Discovered Service Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider mr-2 flex items-center gap-1.5">
          <Server className="h-3.5 w-3.5 text-brand-perf" /> Active Services:
        </span>
        {data.historicalDriftAnalysis.map((service) => {
          const isSelected = selectedServiceId === service.serviceId;
          const isApp = discovered?.applicationServices.includes(service.serviceId);
          const isCustom = customServices.includes(service.serviceId);
          return (
            <div
              key={service.serviceId}
              className={`inline-flex items-center rounded-lg border font-mono text-xs font-medium transition-all ${
                isSelected
                  ? 'border-brand-perf bg-brand-perf/15 text-brand-perf shadow-sm'
                  : 'border-border bg-surface text-text-secondary hover:text-text-primary hover:border-border/80'
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedServiceId(service.serviceId)}
                className="px-3 py-1.5"
              >
                {service.serviceId}
                {isApp && (
                  <span className="ml-1.5 rounded bg-emerald-500/20 text-emerald-400 px-1 py-0.2 text-[9px]">
                    APP
                  </span>
                )}
              </button>
              {isCustom && (
                <button
                  type="button"
                  title="Remove from inspect list"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCustomServices((prev) => prev.filter((s) => s !== service.serviceId));
                  }}
                  className="pr-2 pl-0.5 text-text-muted hover:text-rose-400 font-bold"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* When the service has no telemetry data */}
      {(!currentServiceAnalysis.hasTelemetry && currentServiceAnalysis.driftLevel === 'NO_DATA') ||
      (currentServiceAnalysis.liveP95LatencyMs === 0 && currentServiceAnalysis.historicalBaselineMs === 0) ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/5 p-12 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-400" />
          <h3 className="mt-4 text-base font-semibold text-text-primary">
            No Telemetry Data Found for "{currentServiceAnalysis.serviceId}"
          </h3>
          <p className="mt-2 max-w-lg text-xs leading-relaxed text-text-secondary">
            This service is not currently emitting metrics to Prometheus (:9090) or traces to Jaeger (:16686).
            No live P95 latency measurements or historical deployment baselines exist for this target.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-text-muted mr-1">
              Active cluster targets:
            </span>
            {discovered?.allServices?.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSelectedServiceId(s)}
                className="rounded border border-border bg-surface px-2.5 py-1 font-mono text-[11px] text-text-primary hover:border-brand-perf"
              >
                {s}
              </button>
            )) || <span className="text-xs text-text-muted">None</span>}
          </div>
        </div>
      ) : (
        <>
          {/* 4 Focused KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* 1. Live Latency */}
            <Card className="bg-surface border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-text-muted">
                  <span className="text-xs font-medium uppercase tracking-wider">Live P95 Latency</span>
                  <Activity className="h-4 w-4 text-brand-perf" />
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold tracking-tight text-text-primary font-mono">
                    {currentServiceAnalysis.liveP95LatencyMs.toFixed(1)}
                  </span>
                  <span className="text-sm font-medium text-text-muted">ms</span>
                </div>
                <p className="mt-1 text-xs text-text-secondary">Current active response time from telemetry</p>
              </CardContent>
            </Card>

        {/* 2. Historical Baseline */}
        <Card className="bg-surface border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-text-muted">
              <span className="text-xs font-medium uppercase tracking-wider">Historical Baseline</span>
              <Clock className="h-4 w-4 text-sky-400" />
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tracking-tight text-text-primary font-mono">
                {currentServiceAnalysis.historicalBaselineMs.toFixed(1)}
              </span>
              <span className="text-sm font-medium text-text-muted">ms</span>
            </div>
            <p className="mt-1 text-xs text-text-secondary">Moving average baseline of past deployments</p>
          </CardContent>
        </Card>

        {/* 3. Latency Drift Status */}
        <Card className="bg-surface border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-text-muted">
              <span className="text-xs font-medium uppercase tracking-wider">Drift Status</span>
              <Zap className="h-4 w-4 text-brand-perf" />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${driftBadge.color}`}>
                {driftBadge.icon}
                {driftBadge.label}
              </span>
            </div>
            <p className="mt-2 text-xs font-mono text-text-secondary">
              Delta: <span className={isDegrading ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                {isDegrading ? '+' : ''}{currentServiceAnalysis.latencyDeltaMs.toFixed(1)} ms
              </span>{' '}
              ({isDegrading ? '+' : ''}{((currentServiceAnalysis.driftScore) * 100).toFixed(1)}%)
            </p>
          </CardContent>
        </Card>

        {/* 4. Forecast Trajectory */}
        <Card className="bg-surface border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-text-muted">
              <span className="text-xs font-medium uppercase tracking-wider">Forecast Trajectory</span>
              {trendBadge.icon}
            </div>
            <div className="mt-3">
              <span className={`text-base font-bold ${trendBadge.color}`}>
                {trendBadge.label}
              </span>
            </div>
            <p className="mt-1 text-xs text-text-secondary">
              {currentServiceAnalysis.forecast?.estimatedDeploymentsToSLABreach !== null &&
              currentServiceAnalysis.forecast?.estimatedDeploymentsToSLABreach !== undefined
                ? `Breach in ~${currentServiceAnalysis.forecast.estimatedDeploymentsToSLABreach} release(s)`
                : 'Within acceptable SLA limits'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Trend & Prediction Chart */}
      <Card className="bg-surface border-border">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold text-text-primary">
                Latency Progression & Future Horizon
              </CardTitle>
              <p className="text-xs text-text-secondary mt-1">
                Historical deployments (solid blue) → Live active latency (highlighted) → Predicted releases (dashed orange)
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-400" />
                <span className="text-text-secondary">Historical Latency</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand-perf" />
                <span className="text-text-secondary">Future Forecast</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-0.5 w-3 bg-zinc-500" />
                <span className="text-text-secondary">Baseline ({currentServiceAnalysis.historicalBaselineMs}ms)</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252C35" />
                <XAxis
                  dataKey="release"
                  stroke="#5E6875"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  stroke="#5E6875"
                  fontSize={12}
                  unit="ms"
                  domain={['dataMin - 5', 'dataMax + 10']}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#10141A',
                    borderColor: '#252C35',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#F1F5F9'
                  }}
                  formatter={(value: any, name?: any) => {
                    if (value === null || value === undefined) return ['', ''];
                    const label = name === 'actualLatency' ? 'Actual Latency' : name === 'forecastLatency' ? 'Predicted Latency' : String(name || '');
                    return [`${Number(value).toFixed(1)} ms`, label];
                  }}
                />
                <Legend verticalAlign="top" height={36} />
                <ReferenceLine
                  y={currentServiceAnalysis.historicalBaselineMs}
                  stroke="#71717A"
                  strokeDasharray="4 4"
                  label={{
                    value: `Baseline: ${currentServiceAnalysis.historicalBaselineMs}ms`,
                    fill: '#A1A1AA',
                    fontSize: 11,
                    position: 'insideBottomRight'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="actualLatency"
                  name="Actual P95 Latency"
                  stroke="#38BDF8"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#38BDF8', strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="forecastLatency"
                  name="Forecasted Latency"
                  stroke="#F97316"
                  strokeWidth={2.5}
                  strokeDasharray="5 5"
                  dot={{ r: 4, fill: '#F97316', strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Diagnostic & Warning Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="bg-surface border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-text-primary">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Engine Diagnostic
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-text-secondary">
            {currentServiceAnalysis.recommendation}
          </CardContent>
        </Card>

        <Card className="bg-surface border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-text-primary">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Proactive Trend Advisory
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-text-secondary">
            {currentServiceAnalysis.forecast?.proactiveWarning || 'No warning generated.'}
          </CardContent>
        </Card>
      </div>

      {/* Deployment Table */}
      <Card className="bg-surface border-border">
        <CardHeader className="border-b border-border/60 pb-3">
          <CardTitle className="text-sm font-semibold text-text-primary">
            Deployment Latency Records ({currentServiceAnalysis.serviceId})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-surface-secondary/50 text-text-muted border-b border-border/60 uppercase">
                <tr>
                  <th className="px-5 py-3 font-medium">Release</th>
                  <th className="px-5 py-3 font-medium">Evaluation Date</th>
                  <th className="px-5 py-3 font-medium">P95 Latency</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Variance vs Baseline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-text-secondary">
                {currentServiceAnalysis.historicalDeployments.map((h, i) => {
                  const isLive = h.version.toLowerCase().startsWith('live');
                  const diff = h.p95LatencyMs - currentServiceAnalysis.historicalBaselineMs;
                  return (
                    <tr key={`hist-${i}`} className={isLive ? 'bg-brand-perf/5 text-text-primary' : ''}>
                      <td className="px-5 py-3 font-semibold">{h.version}</td>
                      <td className="px-5 py-3 text-text-muted">{h.evaluatedAt}</td>
                      <td className="px-5 py-3 font-semibold text-text-primary">
                        {h.p95LatencyMs.toFixed(1)} ms
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold ${
                          isLive ? 'bg-brand-perf/20 text-brand-perf' : 'bg-surface-secondary text-text-secondary'
                        }`}>
                          {isLive ? 'LIVE ACTIVE' : 'HISTORICAL'}
                        </span>
                      </td>
                      <td className={`px-5 py-3 ${diff > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {diff > 0 ? `+${diff.toFixed(1)} ms` : `${diff.toFixed(1)} ms`}
                      </td>
                    </tr>
                  );
                })}

                {currentServiceAnalysis.forecast?.predictedDeployments.map((f, i) => {
                  const diff = f.predictedP95Ms - currentServiceAnalysis.historicalBaselineMs;
                  return (
                    <tr key={`pred-${i}`} className="bg-surface-secondary/20">
                      <td className="px-5 py-3 font-semibold text-brand-perf">{f.version}</td>
                      <td className="px-5 py-3 text-text-muted">{f.evaluatedAt}</td>
                      <td className="px-5 py-3 font-semibold text-brand-perf">
                        {f.predictedP95Ms.toFixed(1)} ms
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-block rounded bg-brand-perf/10 text-brand-perf px-2 py-0.5 text-[10px] font-semibold">
                          PREDICTED
                        </span>
                      </td>
                      <td className={`px-5 py-3 ${diff > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        +{diff.toFixed(1)} ms
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </>
      )}
    </PageContainer>
  );
};
