import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import {
  Network,
  GitBranch,
  Layers,
  Zap,
  ShieldCheck,
  AlertTriangle,
  Clock,
  RefreshCw,
  Server,
  Search,
  Plus,
  Sliders,
  ArrowRight,
  Database,
  Cpu,
  Radio,
  ServerCrash,
  RotateCcw
} from 'lucide-react';
import { TelemetryService } from '../services/telemetry';

export interface DAGNode {
  id: string;
  serviceId: string;
  role: string;
  parentServiceId: string | null;
  childrenServiceIds: string[];
  depth: number;
  spanDurationMs: number;
  isApiGateway: boolean;
}

export interface FanOutAnalysisResult {
  serviceId: string;
  hasTelemetry?: boolean;
  telemetrySource?: 'JAEGER_TRACE' | 'DOCKER_LIVE_TOPOLOGY' | 'PROMETHEUS_LIVE' | 'NONE';
  traceId?: string;
  isApiGateway: boolean;
  directFanOutCount: number;
  maxDependencyDepth: number;
  attenuationFactor: number;
  rawFanOutPenalty: number;
  attenuatedFanOutScore: number;
  fanOutLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'NO_DATA';
  downstreamServices: string[];
  callTreeTopology: DAGNode[];
  rootSpanLatencyMs?: number;
  criticalPathLatencyMs: number;
  amplificationMultiplier: number;
  summary: string;
}

interface DiscoveredServicesState {
  prometheusJobs: string[];
  jaegerServices: string[];
  dockerContainers?: string[];
  applicationServices: string[];
  infrastructureServices: string[];
  allServices: string[];
}

interface TelemetryPhase3Response {
  pipeline: string;
  requestedServices: string[];
  evaluatedAt: number;
  fanOutTopologyAnalysis: FanOutAnalysisResult[];
}

export const FanOutAnalysisPage: React.FC = () => {
  const [discovered, setDiscovered] = useState<DiscoveredServicesState | null>(null);
  const [phase3Data, setPhase3Data] = useState<FanOutAnalysisResult[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [customServices, setCustomServices] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState<string>('');

  // Optional What-If Simulator overrides (null = use 100% live telemetry)
  const [simOverride, setSimOverride] = useState<{
    fanOutCount: number;
    maxDepth: number;
    gatewayMode: boolean;
  } | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchLiveTopology = useCallback(
    async (serviceToSelect?: string) => {
      setIsRefreshing(true);
      try {
        // 1. Discover live services from Telemetry Collector (Docker + Prometheus + Jaeger)
        const discoveryResult = await TelemetryService.discoverServices();
        setDiscovered(discoveryResult);

        const candidateServices = new Set<string>();
        customServices.forEach((s) => candidateServices.add(s));
        discoveryResult.applicationServices.forEach((s) => candidateServices.add(s));

        if (serviceToSelect) {
          candidateServices.add(serviceToSelect);
        }

        if (candidateServices.size === 0) {
          discoveryResult.infrastructureServices.forEach((s) => candidateServices.add(s));
        }

        const servicesToQuery = Array.from(candidateServices);
        if (servicesToQuery.length === 0) {
          throw new Error(
            'No running services discovered in Docker Engine, Prometheus (:9090), or Jaeger (:16686).'
          );
        }

        // 2. Fetch live Fan-Out & Call-Tree DAG analysis from Telemetry Collector (:8787)
        const queryParam = encodeURIComponent(servicesToQuery.join(','));
        let response: Response;
        try {
          response = await fetch(`/api/telemetry/phase3?services=${queryParam}`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
        } catch {
          response = await fetch(`http://localhost:8787/api/telemetry/phase3?services=${queryParam}`);
        }

        if (!response.ok) {
          throw new Error(`Telemetry Collector responded with HTTP ${response.status}`);
        }

        const json: TelemetryPhase3Response = await response.json();
        const rawList: FanOutAnalysisResult[] = Array.isArray(json?.fanOutTopologyAnalysis)
          ? json.fanOutTopologyAnalysis
          : [];

        if (rawList.length === 0) {
          throw new Error('Telemetry Collector returned no fan-out topology records.');
        }

        // 3. Enrich with live root latency if active load test is streaming to Anomaly Engine (:8000)
        const enrichedList = await Promise.all(
          rawList.map(async (item) => {
            const topology = Array.isArray(item.callTreeTopology) ? item.callTreeTopology : [];
            const rootSpan = topology.find((n) => n.depth === 1) || topology[0];
            let rootLatency = item.rootSpanLatencyMs ?? rootSpan?.spanDurationMs ?? 0;

            try {
              const anomRes = await fetch(
                `/api/anomaly/latest/${encodeURIComponent(item.serviceId)}`
              );
              if (anomRes.ok) {
                const latest = await anomRes.json();
                if (
                  Array.isArray(latest?.feature_vector) &&
                  latest.feature_vector.length === 4 &&
                  latest.feature_vector[2] > 0
                ) {
                  rootLatency = parseFloat((latest.feature_vector[2] * 200).toFixed(2));
                }
              }
            } catch {
              // ignore if anomaly engine has no recent override for this service
            }

            // Recompute criticalPathLatencyMs & amplificationMultiplier if backend omitted them
            const maxByDepth = new Map<number, number>();
            const updatedTopology = topology.map((node) => {
              const dur = node.depth === 1 && rootLatency > 0 ? rootLatency : node.spanDurationMs;
              const prev = maxByDepth.get(node.depth) || 0;
              if (dur > prev) maxByDepth.set(node.depth, dur);
              return { ...node, spanDurationMs: dur };
            });

            const criticalPathLatencyMs =
              item.criticalPathLatencyMs !== undefined && item.criticalPathLatencyMs > 0
                ? item.criticalPathLatencyMs
                : parseFloat(
                    Array.from(maxByDepth.values())
                      .reduce((sum, v) => sum + v, 0)
                      .toFixed(2)
                  );

            const amplificationMultiplier =
              rootLatency > 0
                ? parseFloat((criticalPathLatencyMs / rootLatency).toFixed(2))
                : item.amplificationMultiplier ?? 1.0;

            return {
              ...item,
              hasTelemetry: item.hasTelemetry ?? topology.length > 0,
              callTreeTopology: updatedTopology,
              rootSpanLatencyMs: rootLatency,
              criticalPathLatencyMs,
              amplificationMultiplier,
            };
          })
        );

        setPhase3Data(enrichedList);
        setError(null);
        setLastRefreshed(new Date());

        setSelectedServiceId((prev) => {
          if (serviceToSelect && enrichedList.some((s) => s.serviceId === serviceToSelect)) {
            return serviceToSelect;
          }
          const availableIds = enrichedList.map((s) => s.serviceId);
          if (prev && availableIds.includes(prev)) return prev;
          return availableIds[0] || null;
        });
      } catch (err: any) {
        setError(
          err?.message ||
            'Unable to connect to Telemetry Collector (:8787), Prometheus (:9090), or Jaeger (:16686).'
        );
        setPhase3Data([]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [customServices]
  );

  // Discover services and poll live telemetry
  useEffect(() => {
    fetchLiveTopology();
    const id = setInterval(() => {
      fetchLiveTopology();
    }, 5000);
    return () => clearInterval(id);
  }, [fetchLiveTopology]);

  // Live analysis for currently selected service
  const liveAnalysis = useMemo(() => {
    if (!selectedServiceId || phase3Data.length === 0) return null;
    return phase3Data.find((item) => item.serviceId === selectedServiceId) || null;
  }, [phase3Data, selectedServiceId]);

  // Apply What-If Simulator overrides ONLY when user actively moves a slider
  const activeAnalysis = useMemo<FanOutAnalysisResult | null>(() => {
    if (!liveAnalysis) return null;
    if (!simOverride) return liveAnalysis;

    const { fanOutCount, maxDepth, gatewayMode } = simOverride;
    const attenuationFactor = gatewayMode ? 0.3 : 1.0;
    const rawFanOutPenalty = parseFloat(
      Math.min(1.0, fanOutCount * 0.15 + Math.max(0, maxDepth - 1) * 0.1).toFixed(3)
    );
    const attenuatedFanOutScore = parseFloat((rawFanOutPenalty * attenuationFactor).toFixed(3));

    let fanOutLevel: FanOutAnalysisResult['fanOutLevel'] = 'LOW';
    if (attenuatedFanOutScore >= 0.6) fanOutLevel = 'CRITICAL';
    else if (attenuatedFanOutScore >= 0.35) fanOutLevel = 'HIGH';
    else if (attenuatedFanOutScore >= 0.15) fanOutLevel = 'MODERATE';

    const rootLat = liveAnalysis.rootSpanLatencyMs || 1.0;
    const criticalPathLatencyMs = parseFloat(
      (rootLat * (1 + fanOutCount * 0.22 + Math.max(0, maxDepth - 1) * 0.18)).toFixed(2)
    );
    const amplificationMultiplier = parseFloat(
      (criticalPathLatencyMs / Math.max(0.1, rootLat)).toFixed(2)
    );

    return {
      ...liveAnalysis,
      isApiGateway: gatewayMode,
      directFanOutCount: fanOutCount,
      maxDependencyDepth: maxDepth,
      attenuationFactor,
      rawFanOutPenalty,
      attenuatedFanOutScore,
      fanOutLevel,
      criticalPathLatencyMs,
      amplificationMultiplier,
      summary: `[What-If Simulation Override] Direct calls=${fanOutCount}, Max depth=${maxDepth}, Role=${
        gatewayMode ? 'API Gateway (0.3x)' : 'Standard Microservice (1.0x)'
      } → Attenuated Penalty: ${attenuatedFanOutScore.toFixed(3)}`,
    };
  }, [liveAnalysis, simOverride]);

  const handleSelectService = (svc: string) => {
    setSelectedServiceId(svc);
    setSimOverride(null);
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (!customServices.includes(trimmed)) {
      setCustomServices((prev) => [...prev, trimmed]);
    }
    setCustomInput('');
    setSimOverride(null);
    fetchLiveTopology(trimmed);
  };

  const getLevelBadge = (level: FanOutAnalysisResult['fanOutLevel']) => {
    switch (level) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-400 animate-pulse">
            CRITICAL FAN-OUT ({level})
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-400">
            HIGH AMPLIFICATION ({level})
          </span>
        );
      case 'MODERATE':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-bold text-sky-400">
            MODERATE COUPLING ({level})
          </span>
        );
      case 'NO_DATA':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-500/30 bg-zinc-500/10 px-2.5 py-1 text-xs font-bold text-zinc-400">
            NO TELEMETRY DATA
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-400">
            OPTIMAL TOPOLOGY ({level})
          </span>
        );
    }
  };

  const getSourceBadge = (source?: FanOutAnalysisResult['telemetrySource'], traceId?: string) => {
    switch (source) {
      case 'JAEGER_TRACE':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 font-mono text-[11px] font-medium text-sky-400">
            Jaeger Live Trace {traceId ? `(${traceId.slice(0, 8)})` : ''}
          </span>
        );
      case 'DOCKER_LIVE_TOPOLOGY':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-medium text-emerald-400">
            Docker Engine Live Topology
          </span>
        );
      case 'PROMETHEUS_LIVE':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[11px] font-medium text-amber-400">
            Prometheus Live Target
          </span>
        );
      default:
        return null;
    }
  };

  // 1. Initial Loading State
  if (isLoading && phase3Data.length === 0) {
    return (
      <PageContainer className="space-y-6">
        <div className="flex h-96 flex-col items-center justify-center space-y-4 rounded-xl border border-border bg-surface p-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-brand-perf" />
          <h2 className="text-lg font-medium text-text-primary">
            Discovering Live Call-Tree Topologies...
          </h2>
          <p className="max-w-md text-sm text-text-secondary">
            Querying Jaeger (:16686), Docker Engine Socket, and Prometheus (:9090) via Telemetry Collector (:8787).
          </p>
        </div>
      </PageContainer>
    );
  }

  // 2. Offline / Error State (Zero fake fallback)
  if (error || !activeAnalysis || !liveAnalysis) {
    return (
      <PageContainer className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Service Fan-Out &amp; Call-Tree Amplification Analyzer
            </h1>
            <p className="text-sm text-text-secondary">
              Evaluates distributed trace call-tree depth, downstream fan-out amplification, and API Gateway legitimate routing attenuation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchLiveTopology()}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-secondary px-3.5 py-2 text-xs font-medium text-text-primary hover:bg-surface-secondary/80 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-brand-perf' : ''}`} />
            Retry Discovery
          </button>
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/5 p-12 text-center">
          <ServerCrash className="h-12 w-12 text-rose-400" />
          <h3 className="mt-4 text-lg font-semibold text-rose-300">
            Telemetry Collector Unreachable
          </h3>
          <p className="mt-2 max-w-lg text-sm text-text-secondary leading-relaxed">
            {error ||
              'Unable to retrieve live call-tree topology from Telemetry Collector (:8787), Jaeger (:16686), or Prometheus (:9090).'}
          </p>
          <div className="mt-6 rounded-lg border border-border bg-surface p-4 text-left font-mono text-xs text-text-secondary">
            <p className="font-semibold text-text-primary">
              Ensure your telemetry containers are running:
            </p>
            <p className="mt-1 text-emerald-400">
              docker compose up -d prometheus jaeger telemetry-collector
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchLiveTopology()}
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

  const sliderFanOut = simOverride ? simOverride.fanOutCount : liveAnalysis.directFanOutCount;
  const sliderDepth = simOverride ? simOverride.maxDepth : Math.max(1, liveAnalysis.maxDependencyDepth);
  const sliderGateway = simOverride ? simOverride.gatewayMode : liveAnalysis.isApiGateway;

  return (
    <PageContainer className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Service Fan-Out &amp; Call-Tree Amplification Analyzer
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Telemetry Active
            </span>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            Evaluates live distributed trace call-tree depth, downstream container fan-out amplification, and API Gateway routing attenuation (40% P-Score weight).
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
            onClick={() => fetchLiveTopology(selectedServiceId || undefined)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-secondary px-3.5 py-2 text-xs font-medium text-text-primary hover:bg-surface-secondary/80 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-brand-perf' : ''}`} />
            Refresh Live Topology
          </button>
        </div>
      </div>

      {/* Live Telemetry Discovery Sources Bar */}
      <div className="rounded-lg border border-border/80 bg-surface-secondary/40 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-emerald-400" />
              <span className="font-semibold text-text-primary">Docker Services:</span>
              <span className="font-mono text-emerald-400">
                {discovered?.applicationServices?.length
                  ? discovered.applicationServices.join(', ')
                  : 'None'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-sky-400" />
              <span className="font-semibold text-text-primary">Jaeger Services:</span>
              <span className="font-mono text-sky-400">
                {discovered?.jaegerServices?.length
                  ? discovered.jaegerServices.join(', ')
                  : 'None'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-amber-400" />
              <span className="font-semibold text-text-primary">Prometheus Jobs:</span>
              <span className="font-mono text-amber-400">
                {discovered?.prometheusJobs?.length
                  ? discovered.prometheusJobs.join(', ')
                  : 'None'}
              </span>
            </div>
          </div>

          <form onSubmit={handleAddCustom} className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Inspect service name..."
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                className="w-48 rounded-md border border-border bg-surface pl-8 pr-3 py-1 text-xs font-mono text-text-primary placeholder:text-text-muted focus:border-brand-perf focus:outline-none"
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

        {/* Discovered Service Selector */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider mr-2 flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5 text-brand-perf" /> Active Services:
          </span>
          {phase3Data.map((svc) => {
            const isSelected = selectedServiceId === svc.serviceId;
            const isCustom = customServices.includes(svc.serviceId);
            const isApp = discovered?.applicationServices.includes(svc.serviceId);
            return (
              <div
                key={svc.serviceId}
                className={`inline-flex items-center rounded-lg border font-mono text-xs font-medium transition-all ${
                  isSelected
                    ? 'border-brand-perf bg-brand-perf/15 text-brand-perf shadow-sm'
                    : 'border-border bg-surface text-text-secondary hover:text-text-primary hover:border-border/80'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectService(svc.serviceId)}
                  className="px-3 py-1.5"
                >
                  {svc.serviceId}
                  {isApp && (
                    <span className="ml-1.5 rounded bg-emerald-500/20 text-emerald-400 px-1 py-0.2 text-[9px]">
                      LIVE
                    </span>
                  )}
                </button>
                {isCustom && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCustomServices((prev) => prev.filter((s) => s !== svc.serviceId));
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
      </div>

      {/* When the selected service has NO live telemetry or running container */}
      {!liveAnalysis.hasTelemetry || liveAnalysis.fanOutLevel === 'NO_DATA' ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/5 p-12 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-400" />
          <h3 className="mt-4 text-base font-semibold text-text-primary">
            No Live Telemetry or Running Container Found for &ldquo;{liveAnalysis.serviceId}&rdquo;
          </h3>
          <p className="mt-2 max-w-lg text-xs leading-relaxed text-text-secondary">
            {liveAnalysis.summary ||
              `Service '${liveAnalysis.serviceId}' was not found in Jaeger traces (:16686), running Docker containers, or Prometheus metrics (:9090).`}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-text-muted mr-1">Select an active cluster service:</span>
            {discovered?.applicationServices?.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSelectService(s)}
                className="rounded border border-border bg-surface px-2.5 py-1 font-mono text-[11px] text-text-primary hover:border-brand-perf"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* 4 KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* 1. Attenuated Fan-Out Penalty Score */}
            <Card className="bg-surface border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-text-muted">
                  <span className="text-xs font-medium uppercase tracking-wider">
                    Fan-Out Penalty Score
                  </span>
                  <GitBranch className="h-4 w-4 text-brand-perf" />
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span
                    className={`text-3xl font-bold tracking-tight font-mono ${
                      activeAnalysis.attenuatedFanOutScore >= 0.6
                        ? 'text-rose-400'
                        : activeAnalysis.attenuatedFanOutScore >= 0.35
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {activeAnalysis.attenuatedFanOutScore.toFixed(3)}
                  </span>
                  <span className="text-sm font-medium text-text-muted">/ 1.000</span>
                </div>
                <div className="mt-2">{getLevelBadge(activeAnalysis.fanOutLevel)}</div>
              </CardContent>
            </Card>

            {/* 2. Direct Downstream Fan-Out & Depth */}
            <Card className="bg-surface border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-text-muted">
                  <span className="text-xs font-medium uppercase tracking-wider">
                    Call-Tree Dimensions
                  </span>
                  <Layers className="h-4 w-4 text-sky-400" />
                </div>
                <div className="mt-3 flex items-baseline gap-3">
                  <div>
                    <span className="text-2xl font-bold tracking-tight text-text-primary font-mono">
                      {activeAnalysis.directFanOutCount}
                    </span>
                    <span className="ml-1 text-xs text-text-muted">direct calls</span>
                  </div>
                  <span className="text-text-muted">·</span>
                  <div>
                    <span className="text-2xl font-bold tracking-tight text-sky-400 font-mono">
                      Depth {activeAnalysis.maxDependencyDepth}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-text-secondary font-mono">
                  Raw Penalty: {activeAnalysis.rawFanOutPenalty.toFixed(3)} (before attenuation)
                </p>
              </CardContent>
            </Card>

            {/* 3. Legitimate API Gateway Attenuation */}
            <Card className="bg-surface border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-text-muted">
                  <span className="text-xs font-medium uppercase tracking-wider">
                    Gateway Attenuation
                  </span>
                  <ShieldCheck
                    className={`h-4 w-4 ${
                      activeAnalysis.isApiGateway ? 'text-sky-400' : 'text-emerald-400'
                    }`}
                  />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-text-primary font-mono">
                    {activeAnalysis.attenuationFactor.toFixed(2)}x
                  </span>
                  <span className="text-xs font-medium text-text-muted">
                    ({activeAnalysis.isApiGateway ? 'Edge Aggregator' : 'Standard Microservice'})
                  </span>
                </div>
                <p className="mt-2 text-xs text-text-secondary">
                  {activeAnalysis.isApiGateway
                    ? '70% penalty reduction applied for legitimate routing node'
                    : 'Full fan-out penalty applied (non-gateway service)'}
                </p>
              </CardContent>
            </Card>

            {/* 4. Critical Path Latency Amplification */}
            <Card className="bg-surface border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-text-muted">
                  <span className="text-xs font-medium uppercase tracking-wider">
                    Critical Path Latency
                  </span>
                  <Zap className="h-4 w-4 text-amber-400" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-amber-400 font-mono">
                    {activeAnalysis.criticalPathLatencyMs} ms
                  </span>
                  <span className="text-xs font-mono text-text-muted">
                    ({activeAnalysis.amplificationMultiplier}x amp)
                  </span>
                </div>
                <p className="mt-2 text-xs text-text-secondary font-mono">
                  Root Span: {(liveAnalysis.rootSpanLatencyMs || 0).toFixed(2)} ms → Cascaded Total
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Interactive What-If Topology & Attenuation Simulator */}
          <Card className="bg-surface border-border">
            <CardHeader className="border-b border-border/60 pb-3">
              <CardTitle className="text-sm font-semibold flex flex-wrap items-center justify-between gap-2 text-text-primary">
                <span className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-brand-perf" />
                  Fan-Out Penalty &amp; Gateway Attenuation What-If Simulator
                  {simOverride && (
                    <span className="rounded bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[11px] font-mono text-amber-400">
                      Simulation Override Active
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-text-muted">
                    Formula: min(1.0, Direct×0.15 + (Depth-1)×0.10) × Attenuation
                  </span>
                  {simOverride && (
                    <button
                      type="button"
                      onClick={() => setSimOverride(null)}
                      className="inline-flex items-center gap-1 rounded border border-border bg-surface-secondary px-2.5 py-1 text-xs font-medium text-text-primary hover:border-brand-perf"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset to Live Telemetry
                    </button>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {/* Direct Fan-Out Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-text-primary">Direct Downstream Calls:</span>
                    <span className="font-mono font-bold text-brand-perf">
                      {sliderFanOut} services
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={8}
                    step={1}
                    value={sliderFanOut}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setSimOverride({
                        fanOutCount: val,
                        maxDepth: sliderDepth,
                        gatewayMode: sliderGateway,
                      });
                    }}
                    className="w-full accent-brand-perf cursor-pointer"
                  />
                  <p className="text-[11px] text-text-muted">
                    Live value: {liveAnalysis.directFanOutCount} direct calls (+0.15 raw penalty each)
                  </p>
                </div>

                {/* Max Call-Tree Depth Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-text-primary">Max Call-Tree Depth:</span>
                    <span className="font-mono font-bold text-sky-400">Level {sliderDepth}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={6}
                    step={1}
                    value={sliderDepth}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setSimOverride({
                        fanOutCount: sliderFanOut,
                        maxDepth: val,
                        gatewayMode: sliderGateway,
                      });
                    }}
                    className="w-full accent-brand-perf cursor-pointer"
                  />
                  <p className="text-[11px] text-text-muted">
                    Live value: Depth {liveAnalysis.maxDependencyDepth} (+0.10 penalty per hop &gt; 1)
                  </p>
                </div>

                {/* API Gateway Attenuation Toggle */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-text-primary">Architectural Role:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {sliderGateway ? 'API Gateway (0.3x)' : 'Microservice (1.0x)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSimOverride({
                        fanOutCount: sliderFanOut,
                        maxDepth: sliderDepth,
                        gatewayMode: !sliderGateway,
                      });
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-xs font-mono font-semibold transition-all ${
                      sliderGateway
                        ? 'border-sky-500/40 bg-sky-500/15 text-sky-400'
                        : 'border-border bg-surface-secondary text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {sliderGateway
                      ? '✓ API Gateway Attenuation Enabled (0.3x)'
                      : 'Enable API Gateway Attenuation (0.3x)'}
                  </button>
                  <p className="text-[11px] text-text-muted">
                    Prevents false penalization of legitimate edge aggregation nodes
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live Distributed Trace / Container Call-Tree DAG Visualization */}
          <Card className="bg-surface border-border">
            <CardHeader className="border-b border-border/60 pb-3">
              <CardTitle className="text-sm font-semibold flex flex-wrap items-center justify-between gap-2 text-text-primary">
                <div className="flex items-center gap-2.5">
                  <Network className="h-4 w-4 text-brand-perf" />
                  <span>
                    Live Call-Tree DAG Topology ({liveAnalysis.serviceId})
                  </span>
                  {getSourceBadge(liveAnalysis.telemetrySource, liveAnalysis.traceId)}
                </div>
                <span className="text-xs font-mono font-normal text-text-muted">
                  {activeAnalysis.summary}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {liveAnalysis.callTreeTopology.map((node) => {
                const indentPx = (node.depth - 1) * 32;
                const widthPercent = Math.min(
                  100,
                  Math.max(
                    10,
                    (node.spanDurationMs / Math.max(0.5, liveAnalysis.criticalPathLatencyMs)) * 100
                  )
                );
                const isDb =
                  node.role.toLowerCase().includes('database') ||
                  node.role.toLowerCase().includes('persistence') ||
                  node.role.toLowerCase().includes('cache');

                return (
                  <div
                    key={node.id}
                    style={{ marginLeft: `${indentPx}px` }}
                    className="rounded-lg border border-border/80 bg-surface-secondary/30 p-4 transition-all hover:border-brand-perf/50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="rounded bg-brand-perf/20 border border-brand-perf/40 px-2 py-0.5 font-mono text-[11px] font-bold text-brand-perf">
                          Depth {node.depth}
                        </span>
                        {isDb ? (
                          <Database className="h-4 w-4 text-sky-400" />
                        ) : (
                          <Cpu className="h-4 w-4 text-emerald-400" />
                        )}
                        <span className="font-mono text-sm font-bold text-text-primary">
                          {node.serviceId}
                        </span>
                        <span className="text-xs text-text-muted">({node.role})</span>
                        {node.parentServiceId && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-text-muted">
                            ← called by{' '}
                            <strong className="text-text-secondary">{node.parentServiceId}</strong>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 font-mono text-xs">
                        {node.childrenServiceIds.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-sky-400">
                            Fan-out: {node.childrenServiceIds.length} (
                            {node.childrenServiceIds.join(', ')}) <ArrowRight className="h-3 w-3" />
                          </span>
                        )}
                        <span className="font-bold text-amber-400">{node.spanDurationMs} ms</span>
                      </div>
                    </div>

                    {/* Span Duration Waterfall Bar */}
                    <div className="mt-3 h-2 w-full rounded-full bg-surface-secondary overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          node.depth === 1
                            ? 'bg-brand-perf'
                            : node.depth === 2
                            ? 'bg-sky-400'
                            : 'bg-amber-400'
                        }`}
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </PageContainer>
  );
};
