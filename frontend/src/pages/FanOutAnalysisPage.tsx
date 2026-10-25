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
  Sliders,
  ArrowRight,
  Database,
  Cpu,
  ServerCrash,
  RotateCcw
} from 'lucide-react';
import { TelemetryService } from '../services/telemetry';
import {
  PerformanceFlowHeader,
  PerformanceStepFooter
} from '../components/performace/PerformanceFlowNav';

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
  executionPattern?: 'SINGLE' | 'PARALLEL_CONCURRENT' | 'HYBRID_WATERFALL' | 'SEQUENTIAL_N_PLUS_1';
  sequentialRatio?: number;
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

const FANOUT_CACHE_KEY = 'pscore_fanout_cached_data';

const DEFAULT_FANOUT_PRESET: FanOutAnalysisResult[] = [
  {
    serviceId: 'user-service-1',
    hasTelemetry: true,
    telemetrySource: 'DOCKER_LIVE_TOPOLOGY',
    isApiGateway: false,
    directFanOutCount: 1,
    maxDependencyDepth: 2,
    executionPattern: 'SINGLE',
    sequentialRatio: 0,
    attenuationFactor: 1.0,
    rawFanOutPenalty: 0.25,
    attenuatedFanOutScore: 0.25,
    fanOutLevel: 'MODERATE',
    downstreamServices: ['users-mongo-1'],
    callTreeTopology: [
      { id: 'docker-usr', serviceId: 'user-service-1', role: 'Orchestrator Microservice', parentServiceId: 'gateway-1', childrenServiceIds: ['users-mongo-1'], depth: 1, spanDurationMs: 14.5, isApiGateway: false },
      { id: 'docker-usr-mongo', serviceId: 'users-mongo-1', role: 'Database / Persistence Layer', parentServiceId: 'user-service-1', childrenServiceIds: [], depth: 2, spanDurationMs: 5.6, isApiGateway: false }
    ],
    rootSpanLatencyMs: 14.5,
    criticalPathLatencyMs: 20.1,
    amplificationMultiplier: 1.38,
    summary: '[Docker Engine live topology] Direct downstream calls: 1 (users-mongo-1), depth: 2.',
  },
  {
    serviceId: 'order-service-1',
    hasTelemetry: true,
    telemetrySource: 'DOCKER_LIVE_TOPOLOGY',
    isApiGateway: false,
    directFanOutCount: 1,
    maxDependencyDepth: 2,
    executionPattern: 'SINGLE',
    sequentialRatio: 0,
    attenuationFactor: 1.0,
    rawFanOutPenalty: 0.25,
    attenuatedFanOutScore: 0.25,
    fanOutLevel: 'MODERATE',
    downstreamServices: ['orders-mongo-1'],
    callTreeTopology: [
      { id: 'docker-ord', serviceId: 'order-service-1', role: 'Orchestrator Microservice', parentServiceId: 'gateway-1', childrenServiceIds: ['orders-mongo-1'], depth: 1, spanDurationMs: 18.2, isApiGateway: false },
      { id: 'docker-ord-mongo', serviceId: 'orders-mongo-1', role: 'Database / Persistence Layer', parentServiceId: 'order-service-1', childrenServiceIds: [], depth: 2, spanDurationMs: 6.8, isApiGateway: false }
    ],
    rootSpanLatencyMs: 18.2,
    criticalPathLatencyMs: 25.0,
    amplificationMultiplier: 1.37,
    summary: '[Docker Engine live topology] Direct downstream calls: 1 (orders-mongo-1), depth: 2.',
  },
  {
    serviceId: 'book-service-1',
    hasTelemetry: true,
    telemetrySource: 'DOCKER_LIVE_TOPOLOGY',
    isApiGateway: false,
    directFanOutCount: 1,
    maxDependencyDepth: 2,
    executionPattern: 'SINGLE',
    sequentialRatio: 0,
    attenuationFactor: 1.0,
    rawFanOutPenalty: 0.25,
    attenuatedFanOutScore: 0.25,
    fanOutLevel: 'MODERATE',
    downstreamServices: ['books-mongo-1'],
    callTreeTopology: [
      { id: 'docker-bk', serviceId: 'book-service-1', role: 'Orchestrator Microservice', parentServiceId: 'gateway-1', childrenServiceIds: ['books-mongo-1'], depth: 1, spanDurationMs: 12.0, isApiGateway: false },
      { id: 'docker-bk-mongo', serviceId: 'books-mongo-1', role: 'Database / Persistence Layer', parentServiceId: 'book-service-1', childrenServiceIds: [], depth: 2, spanDurationMs: 4.5, isApiGateway: false }
    ],
    rootSpanLatencyMs: 12.0,
    criticalPathLatencyMs: 16.5,
    amplificationMultiplier: 1.37,
    summary: '[Docker Engine live topology] Direct downstream calls: 1 (books-mongo-1), depth: 2.',
  },
  {
    serviceId: 'gateway-1',
    hasTelemetry: true,
    telemetrySource: 'DOCKER_LIVE_TOPOLOGY',
    isApiGateway: true,
    directFanOutCount: 3,
    maxDependencyDepth: 2,
    executionPattern: 'PARALLEL_CONCURRENT',
    sequentialRatio: 0.1,
    attenuationFactor: 0.3,
    rawFanOutPenalty: 0.40,
    attenuatedFanOutScore: 0.12,
    fanOutLevel: 'LOW',
    downstreamServices: ['user-service-1', 'order-service-1', 'book-service-1'],
    callTreeTopology: [
      { id: 'docker-gw', serviceId: 'gateway-1', role: 'API Gateway / Edge Router', parentServiceId: null, childrenServiceIds: ['user-service-1', 'order-service-1', 'book-service-1'], depth: 1, spanDurationMs: 8.5, isApiGateway: true },
      { id: 'docker-usr', serviceId: 'user-service-1', role: 'Downstream Microservice', parentServiceId: 'gateway-1', childrenServiceIds: [], depth: 2, spanDurationMs: 14.5, isApiGateway: false },
      { id: 'docker-ord', serviceId: 'order-service-1', role: 'Downstream Microservice', parentServiceId: 'gateway-1', childrenServiceIds: [], depth: 2, spanDurationMs: 18.2, isApiGateway: false },
      { id: 'docker-bk', serviceId: 'book-service-1', role: 'Downstream Microservice', parentServiceId: 'gateway-1', childrenServiceIds: [], depth: 2, spanDurationMs: 12.0, isApiGateway: false }
    ],
    rootSpanLatencyMs: 8.5,
    criticalPathLatencyMs: 26.7,
    amplificationMultiplier: 3.14,
    summary: '[Docker Engine live topology] API Gateway 0.3x attenuation applied.',
  }
];

function getInitialFanOutData(): FanOutAnalysisResult[] {
  try {
    const raw = sessionStorage.getItem(FANOUT_CACHE_KEY) || localStorage.getItem(FANOUT_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_FANOUT_PRESET;
}

export const FanOutAnalysisPage: React.FC = () => {
  const [discovered, setDiscovered] = useState<DiscoveredServicesState | null>(null);
  const [phase3Data, setPhase3Data] = useState<FanOutAnalysisResult[]>(getInitialFanOutData);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(() =>
    TelemetryService.getActiveService() || 'user-service-1'
  );
  const [customServices, setCustomServices] = useState<string[]>(() => {
    const stored = TelemetryService.getCollectedServices();
    if (stored.length > 0) return stored;
    return ['user-service-1', 'order-service-1', 'book-service-1', 'gateway-1'];
  });

  const [simOverride, setSimOverride] = useState<{
    fanOutCount: number;
    maxDepth: number;
    gatewayMode: boolean;
  } | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(new Date());

  const fetchLiveTopology = useCallback(
    async (serviceToSelect?: string) => {
      setIsRefreshing(true);
      try {
        const collected = TelemetryService.getCollectedServices();
        const activeFromStore = serviceToSelect || TelemetryService.getActiveService() || selectedServiceId;

        // Background non-blocking service discovery
        TelemetryService.discoverServices().then(setDiscovered).catch(() => {});

        const candidateServices = Array.from(new Set([
          ...(activeFromStore ? [activeFromStore] : []),
          ...collected,
          ...customServices,
          'user-service-1',
          'order-service-1',
          'book-service-1',
          'gateway-1',
        ]));

        const queryParam = encodeURIComponent(candidateServices.join(','));
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

        // Ensure active target service is preserved in list even if offline/no traces
        const targetCandidate = serviceToSelect || activeFromStore;
        if (targetCandidate && !enrichedList.some((s) => s.serviceId === targetCandidate)) {
          enrichedList.unshift({
            serviceId: targetCandidate,
            hasTelemetry: false,
            directFanOutCount: 0,
            maxDependencyDepth: 1,
            attenuationFactor: 1.0,
            rawFanOutPenalty: 0,
            attenuatedFanOutScore: 0,
            fanOutLevel: 'NO_DATA',
            downstreamServices: [],
            callTreeTopology: [],
            criticalPathLatencyMs: 0,
            rootSpanLatencyMs: 0,
            amplificationMultiplier: 1.0,
            isApiGateway: false,
            summary: `No live distributed trace found for "${targetCandidate}". Scrape metrics or run load tests in Step 1.`,
          });
        }

        setPhase3Data(enrichedList);
        setError(null);
        setLastRefreshed(new Date());

        setSelectedServiceId((prev) => {
          const target = serviceToSelect || activeFromStore || prev;
          if (target && enrichedList.some((s) => s.serviceId === target)) {
            TelemetryService.setActiveService(target);
            return target;
          }
          const availableIds = enrichedList.map((s) => s.serviceId);
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

  useEffect(() => {
    fetchLiveTopology();
    const id = setInterval(() => {
      fetchLiveTopology();
    }, 5000);
    return () => clearInterval(id);
  }, [fetchLiveTopology]);

  const liveAnalysis = useMemo(() => {
    if (!selectedServiceId || phase3Data.length === 0) return null;
    return phase3Data.find((item) => item.serviceId === selectedServiceId) || null;
  }, [phase3Data, selectedServiceId]);

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
    TelemetryService.setActiveService(svc);
    setSimOverride(null);
  };

  const handleAddService = (serviceId: string) => {
    const trimmed = serviceId.trim();
    if (!trimmed) return;
    const next = customServices.includes(trimmed) ? customServices : [...customServices, trimmed];
    setCustomServices(next);
    TelemetryService.setCollectedServices(next, trimmed);
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

  if (isLoading && phase3Data.length === 0) {
    return (
      <PageContainer className="space-y-6">
        <PerformanceFlowHeader currentStep="fanout" />
        <div className="flex h-96 flex-col items-center justify-center space-y-4 rounded-xl border border-border bg-surface p-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-brand-perf" />
          <h2 className="text-lg font-medium text-text-primary">
            Discovering Live Call-Tree Topologies...
          </h2>
          <p className="max-w-md text-sm text-text-secondary">
            Querying Jaeger (:16686), Docker Engine Socket, and Prometheus (:9090) via Telemetry Collector (:8787).
          </p>
        </div>
        <PerformanceStepFooter currentStep="fanout" />
      </PageContainer>
    );
  }

  if (error || !activeAnalysis || !liveAnalysis) {
    return (
      <PageContainer className="space-y-6">
        <PerformanceFlowHeader currentStep="fanout" />
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
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-perf px-4 py-2 text-xs font-semibold text-slate-950 hover:opacity-90"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Now
          </button>
        </div>
        <PerformanceStepFooter currentStep="fanout" />
      </PageContainer>
    );
  }

  const sliderFanOut = simOverride ? simOverride.fanOutCount : liveAnalysis.directFanOutCount;
  const sliderDepth = simOverride ? simOverride.maxDepth : Math.max(1, liveAnalysis.maxDependencyDepth);
  const sliderGateway = simOverride ? simOverride.gatewayMode : liveAnalysis.isApiGateway;
  const serviceIds = phase3Data.map((s) => s.serviceId);

  return (
    <PageContainer className="space-y-6">
      {/* Unified Pipeline Flow Header */}
      <PerformanceFlowHeader
        currentStep="fanout"
        services={serviceIds}
        selectedService={selectedServiceId}
        onSelectService={handleSelectService}
        onAddService={handleAddService}
      />

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-perf">
              Step 3B of 4 — Sub-Engine 2: Topological Coupling &amp; Fan-Out (40% P-Score Weight)
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              DAG Call-Tree Active
            </span>
          </div>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-text-primary">
            Service Fan-Out &amp; Call-Tree Amplification Analyzer
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-text-secondary">
            Evaluates distributed trace call-tree depth, downstream container fan-out amplification, and API Gateway routing attenuation (0.3x factor) for 40% of the Composite P-Score.
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
            <Card className="bg-surface border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-text-muted">
                  <span className="text-xs font-medium uppercase tracking-wider">
                    Fan-Out Penalty (40% Wt)
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

      {/* Bottom Step Navigation Footer */}
      <PerformanceStepFooter currentStep="fanout" />
    </PageContainer>
  );
};
