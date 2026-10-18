import React, { useState, useEffect, useCallback } from 'react';
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
  Cpu
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
  isApiGateway: boolean;
  directFanOutCount: number;
  maxDependencyDepth: number;
  attenuationFactor: number;
  rawFanOutPenalty: number;
  attenuatedFanOutScore: number;
  fanOutLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  downstreamServices: string[];
  callTreeTopology: DAGNode[];
  criticalPathLatencyMs: number;
  amplificationMultiplier: number;
  summary: string;
}

function buildServiceTopology(
  serviceId: string,
  baseLatencyMs: number,
  overrideFanOut?: number,
  overrideDepth?: number,
  overrideGatewayMode?: boolean
): FanOutAnalysisResult {
  const sId = serviceId.trim().toLowerCase();
  const isApiGateway =
    overrideGatewayMode !== undefined ? overrideGatewayMode : sId.includes('gateway');

  let directFanOutCount = 2;
  let maxDependencyDepth = 2;
  let downstreamServices: string[] = [];
  let callTreeTopology: DAGNode[] = [];

  if (sId.includes('gateway')) {
    directFanOutCount = 3;
    maxDependencyDepth = 3;
    downstreamServices = ['order-service', 'payment-service', 'inventory-service'];
    callTreeTopology = [
      {
        id: 'dag-gateway',
        serviceId: serviceId,
        role: 'API Gateway / Edge Aggregator',
        parentServiceId: null,
        childrenServiceIds: ['order-service', 'payment-service', 'inventory-service'],
        depth: 1,
        spanDurationMs: parseFloat(baseLatencyMs.toFixed(1)),
        isApiGateway: true,
      },
      {
        id: 'dag-order',
        serviceId: 'order-service',
        role: 'Core Microservice',
        parentServiceId: serviceId,
        childrenServiceIds: ['orders-postgres-db'],
        depth: 2,
        spanDurationMs: parseFloat((baseLatencyMs * 0.68).toFixed(1)),
        isApiGateway: false,
      },
      {
        id: 'dag-payment',
        serviceId: 'payment-service',
        role: 'Core Microservice',
        parentServiceId: serviceId,
        childrenServiceIds: ['stripe-Clearing-api'],
        depth: 2,
        spanDurationMs: parseFloat((baseLatencyMs * 0.55).toFixed(1)),
        isApiGateway: false,
      },
      {
        id: 'dag-inventory',
        serviceId: 'inventory-service',
        role: 'Core Microservice',
        parentServiceId: serviceId,
        childrenServiceIds: ['inventory-redis-cache'],
        depth: 2,
        spanDurationMs: parseFloat((baseLatencyMs * 0.42).toFixed(1)),
        isApiGateway: false,
      },
      {
        id: 'dag-order-db',
        serviceId: 'orders-postgres-db',
        role: 'Persistence Layer',
        parentServiceId: 'order-service',
        childrenServiceIds: [],
        depth: 3,
        spanDurationMs: parseFloat((baseLatencyMs * 0.25).toFixed(1)),
        isApiGateway: false,
      },
      {
        id: 'dag-payment-ext',
        serviceId: 'stripe-clearing-api',
        role: 'External Settlement Node',
        parentServiceId: 'payment-service',
        childrenServiceIds: [],
        depth: 3,
        spanDurationMs: parseFloat((baseLatencyMs * 0.31).toFixed(1)),
        isApiGateway: false,
      },
      {
        id: 'dag-inv-db',
        serviceId: 'inventory-redis-cache',
        role: 'Cache Store',
        parentServiceId: 'inventory-service',
        childrenServiceIds: [],
        depth: 3,
        spanDurationMs: parseFloat((baseLatencyMs * 0.12).toFixed(1)),
        isApiGateway: false,
      },
    ];
  } else if (sId.includes('order')) {
    directFanOutCount = 3;
    maxDependencyDepth = 3;
    downstreamServices = ['payment-service', 'inventory-service', 'notification-service'];
    callTreeTopology = [
      {
        id: 'dag-order-root',
        serviceId: serviceId,
        role: 'Orchestrator Microservice',
        parentServiceId: 'api-gateway',
        childrenServiceIds: ['payment-service', 'inventory-service', 'notification-service'],
        depth: 1,
        spanDurationMs: parseFloat(baseLatencyMs.toFixed(1)),
        isApiGateway: false,
      },
      {
        id: 'dag-pay-child',
        serviceId: 'payment-service',
        role: 'Downstream Dependency',
        parentServiceId: serviceId,
        childrenServiceIds: ['fraud-check-service', 'ledger-db'],
        depth: 2,
        spanDurationMs: parseFloat((baseLatencyMs * 0.62).toFixed(1)),
        isApiGateway: false,
      },
      {
        id: 'dag-inv-child',
        serviceId: 'inventory-service',
        role: 'Downstream Dependency',
        parentServiceId: serviceId,
        childrenServiceIds: ['warehouse-mongo'],
        depth: 2,
        spanDurationMs: parseFloat((baseLatencyMs * 0.48).toFixed(1)),
        isApiGateway: false,
      },
      {
        id: 'dag-notif-child',
        serviceId: 'notification-service',
        role: 'Downstream Dependency',
        parentServiceId: serviceId,
        childrenServiceIds: [],
        depth: 2,
        spanDurationMs: parseFloat((baseLatencyMs * 0.30).toFixed(1)),
        isApiGateway: false,
      },
      {
        id: 'dag-fraud-leaf',
        serviceId: 'fraud-check-service',
        role: 'Deep Call-Chain Node',
        parentServiceId: 'payment-service',
        childrenServiceIds: [],
        depth: 3,
        spanDurationMs: parseFloat((baseLatencyMs * 0.38).toFixed(1)),
        isApiGateway: false,
      },
      {
        id: 'dag-warehouse-leaf',
        serviceId: 'warehouse-mongo',
        role: 'Database',
        parentServiceId: 'inventory-service',
        childrenServiceIds: [],
        depth: 3,
        spanDurationMs: parseFloat((baseLatencyMs * 0.22).toFixed(1)),
        isApiGateway: false,
      },
    ];
  } else if (sId.includes('payment')) {
    directFanOutCount = 2;
    maxDependencyDepth = 2;
    downstreamServices = ['fraud-check-service', 'payments-ledger-db'];
    callTreeTopology = [
      {
        id: 'dag-pay-root',
        serviceId: serviceId,
        role: 'Target Microservice',
        parentServiceId: 'order-service',
        childrenServiceIds: ['fraud-check-service', 'payments-ledger-db'],
        depth: 1,
        spanDurationMs: parseFloat(baseLatencyMs.toFixed(1)),
        isApiGateway: false,
      },
      {
        id: 'dag-fraud',
        serviceId: 'fraud-check-service',
        role: 'Downstream Verification',
        parentServiceId: serviceId,
        childrenServiceIds: [],
        depth: 2,
        spanDurationMs: parseFloat((baseLatencyMs * 0.55).toFixed(1)),
        isApiGateway: false,
      },
      {
        id: 'dag-pay-db',
        serviceId: 'payments-ledger-db',
        role: 'Database',
        parentServiceId: serviceId,
        childrenServiceIds: [],
        depth: 2,
        spanDurationMs: parseFloat((baseLatencyMs * 0.28).toFixed(1)),
        isApiGateway: false,
      },
    ];
  } else {
    directFanOutCount = 1;
    maxDependencyDepth = 2;
    downstreamServices = [`${serviceId}-db`];
    callTreeTopology = [
      {
        id: `dag-${sId}`,
        serviceId: serviceId,
        role: 'Target Microservice',
        parentServiceId: 'api-gateway',
        childrenServiceIds: [`${serviceId}-db`],
        depth: 1,
        spanDurationMs: parseFloat(baseLatencyMs.toFixed(1)),
        isApiGateway: false,
      },
      {
        id: `dag-${sId}-db`,
        serviceId: `${serviceId}-db`,
        role: 'Database',
        parentServiceId: serviceId,
        childrenServiceIds: [],
        depth: 2,
        spanDurationMs: parseFloat((baseLatencyMs * 0.32).toFixed(1)),
        isApiGateway: false,
      },
    ];
  }

  if (overrideFanOut !== undefined) directFanOutCount = overrideFanOut;
  if (overrideDepth !== undefined) maxDependencyDepth = overrideDepth;

  // Legitimate Fan-Out Attenuation Factor (0.3x for API Gateway / BFF, 1.0x for standard microservices)
  const attenuationFactor = isApiGateway ? 0.3 : 1.0;
  const rawPenalty = Math.min(1.0, directFanOutCount * 0.15 + (maxDependencyDepth - 1) * 0.10);
  const attenuatedFanOutScore = parseFloat((rawPenalty * attenuationFactor).toFixed(3));

  let fanOutLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
  if (attenuatedFanOutScore >= 0.60) fanOutLevel = 'CRITICAL';
  else if (attenuatedFanOutScore >= 0.35) fanOutLevel = 'HIGH';
  else if (attenuatedFanOutScore >= 0.15) fanOutLevel = 'MODERATE';

  const criticalPathLatencyMs = parseFloat(
    (baseLatencyMs * (1 + directFanOutCount * 0.22 + (maxDependencyDepth - 1) * 0.18)).toFixed(1)
  );
  const amplificationMultiplier = parseFloat(
    (criticalPathLatencyMs / Math.max(1, baseLatencyMs)).toFixed(2)
  );

  const summary = isApiGateway
    ? `API Gateway legitimate fan-out attenuation applied (${attenuationFactor}x multiplier). Raw penalty ${rawPenalty.toFixed(3)} attenuated to ${attenuatedFanOutScore.toFixed(3)}.`
    : `Standard microservice fan-out (${directFanOutCount} direct downstream calls, depth ${maxDependencyDepth}). Penalty score: ${attenuatedFanOutScore.toFixed(3)}.`;

  return {
    serviceId,
    isApiGateway,
    directFanOutCount,
    maxDependencyDepth,
    attenuationFactor,
    rawFanOutPenalty: parseFloat(rawPenalty.toFixed(3)),
    attenuatedFanOutScore,
    fanOutLevel,
    downstreamServices,
    callTreeTopology,
    criticalPathLatencyMs,
    amplificationMultiplier,
    summary,
  };
}

export const FanOutAnalysisPage: React.FC = () => {
  const [discoveredServices, setDiscoveredServices] = useState<string[]>([
    'order-service',
    'api-gateway',
    'payment-service',
    'inventory-service',
  ]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('order-service');
  const [customServices, setCustomServices] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState<string>('');
  const [analysis, setAnalysis] = useState<FanOutAnalysisResult | null>(null);
  const [baseLatencyMs, setBaseLatencyMs] = useState<number>(24.5);

  // Simulator controls
  const [simFanOutCount, setSimFanOutCount] = useState<number>(3);
  const [simMaxDepth, setSimMaxDepth] = useState<number>(3);
  const [simGatewayMode, setSimGatewayMode] = useState<boolean>(false);

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const evaluateFanOut = useCallback(
    async (
      serviceId: string,
      fanOutOverride?: number,
      depthOverride?: number,
      gatewayOverride?: boolean
    ) => {
      setIsRefreshing(true);
      try {
        let liveLatency = 24.5;

        // 1. Check live latency from FastAPI :8000 (updated by JMeter load test)
        try {
          const res = await fetch(`/api/anomaly/latest/${encodeURIComponent(serviceId)}`);
          if (res.ok) {
            const latest = await res.json();
            if (Array.isArray(latest?.feature_vector) && latest.feature_vector.length === 4) {
              liveLatency = Math.max(12.0, parseFloat((latest.feature_vector[2] * 200).toFixed(1)));
            }
          }
        } catch {
          // ignore
        }

        // 2. Check Telemetry Collector :8787 phase3 if available
        try {
          const phase3Res = await fetch(
            `/api/telemetry/phase3?services=${encodeURIComponent(serviceId)}`
          );
          if (phase3Res.ok) {
            const phase3Json = await phase3Res.json();
            const found = phase3Json?.fanOutTopologyAnalysis?.find(
              (f: any) => f.serviceId === serviceId
            );
            if (found && found.callTreeTopology?.[0]?.spanDurationMs > 0 && liveLatency === 24.5) {
              liveLatency = found.callTreeTopology[0].spanDurationMs;
            }
          }
        } catch {
          // ignore
        }

        setBaseLatencyMs(liveLatency);
        const result = buildServiceTopology(
          serviceId,
          liveLatency,
          fanOutOverride,
          depthOverride,
          gatewayOverride
        );
        setAnalysis(result);
        if (fanOutOverride === undefined) setSimFanOutCount(result.directFanOutCount);
        if (depthOverride === undefined) setSimMaxDepth(result.maxDependencyDepth);
        if (gatewayOverride === undefined) setSimGatewayMode(result.isApiGateway);
        setLastRefreshed(new Date());
      } finally {
        setIsRefreshing(false);
      }
    },
    []
  );

  // Discover services on mount
  useEffect(() => {
    TelemetryService.discoverServices()
      .then((disc) => {
        if (disc.allServices.length > 0) {
          setDiscoveredServices((prev) => Array.from(new Set([...prev, ...disc.allServices])));
        }
      })
      .catch(() => {});
    evaluateFanOut('order-service');
  }, [evaluateFanOut]);

  // Auto-poll every 3 seconds so live JMeter latency spikes reflect in the call-tree spans
  useEffect(() => {
    const id = setInterval(() => {
      evaluateFanOut(selectedServiceId, simFanOutCount, simMaxDepth, simGatewayMode);
    }, 3000);
    return () => clearInterval(id);
  }, [selectedServiceId, simFanOutCount, simMaxDepth, simGatewayMode, evaluateFanOut]);

  const handleSelectService = (svc: string) => {
    setSelectedServiceId(svc);
    evaluateFanOut(svc);
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (!customServices.includes(trimmed)) {
      setCustomServices((prev) => [...prev, trimmed]);
      setDiscoveredServices((prev) => Array.from(new Set([...prev, trimmed])));
    }
    setSelectedServiceId(trimmed);
    setCustomInput('');
    evaluateFanOut(trimmed);
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
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-400">
            OPTIMAL TOPOLOGY ({level})
          </span>
        );
    }
  };

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
              DAG Call-Tree Engine Active
            </span>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            Evaluates distributed trace call-tree depth, downstream fan-out amplification, and API Gateway legitimate routing attenuation (40% P-Score weight).
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
            onClick={() => evaluateFanOut(selectedServiceId)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-secondary px-3.5 py-2 text-xs font-medium text-text-primary hover:bg-surface-secondary/80 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-brand-perf' : ''}`} />
            Analyze Topology
          </button>
        </div>
      </div>

      {/* Service Selector */}
      <div className="rounded-lg border border-border/80 bg-surface-secondary/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider mr-2 flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-brand-perf" /> Monitored Services:
            </span>
            {discoveredServices.map((svc) => {
              const isSelected = selectedServiceId === svc;
              const isCustom = customServices.includes(svc);
              return (
                <div
                  key={svc}
                  className={`inline-flex items-center rounded-lg border font-mono text-xs font-medium transition-all ${
                    isSelected
                      ? 'border-brand-perf bg-brand-perf/15 text-brand-perf shadow-sm'
                      : 'border-border bg-surface text-text-secondary hover:text-text-primary hover:border-border/80'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectService(svc)}
                    className="px-3 py-1.5"
                  >
                    {svc}
                  </button>
                  {isCustom && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCustomServices((prev) => prev.filter((s) => s !== svc));
                        setDiscoveredServices((prev) => prev.filter((s) => s !== svc));
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
              Add
            </button>
          </form>
        </div>
      </div>

      {analysis && (
        <>
          {/* 4 KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* 1. Attenuated Fan-Out Penalty Score */}
            <Card className="bg-surface border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-text-muted">
                  <span className="text-xs font-medium uppercase tracking-wider">Fan-Out Penalty Score</span>
                  <GitBranch className="h-4 w-4 text-brand-perf" />
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span
                    className={`text-3xl font-bold tracking-tight font-mono ${
                      analysis.attenuatedFanOutScore >= 0.6
                        ? 'text-rose-400'
                        : analysis.attenuatedFanOutScore >= 0.35
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {analysis.attenuatedFanOutScore.toFixed(3)}
                  </span>
                  <span className="text-sm font-medium text-text-muted">/ 1.000</span>
                </div>
                <div className="mt-2">{getLevelBadge(analysis.fanOutLevel)}</div>
              </CardContent>
            </Card>

            {/* 2. Direct Downstream Fan-Out & Depth */}
            <Card className="bg-surface border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-text-muted">
                  <span className="text-xs font-medium uppercase tracking-wider">Call-Tree Dimensions</span>
                  <Layers className="h-4 w-4 text-sky-400" />
                </div>
                <div className="mt-3 flex items-baseline gap-3">
                  <div>
                    <span className="text-2xl font-bold tracking-tight text-text-primary font-mono">
                      {analysis.directFanOutCount}
                    </span>
                    <span className="ml-1 text-xs text-text-muted">direct calls</span>
                  </div>
                  <span className="text-text-muted">·</span>
                  <div>
                    <span className="text-2xl font-bold tracking-tight text-sky-400 font-mono">
                      Depth {analysis.maxDependencyDepth}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-text-secondary font-mono">
                  Raw Penalty: {analysis.rawFanOutPenalty.toFixed(3)} (before attenuation)
                </p>
              </CardContent>
            </Card>

            {/* 3. Legitimate API Gateway Attenuation */}
            <Card className="bg-surface border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-text-muted">
                  <span className="text-xs font-medium uppercase tracking-wider">Gateway Attenuation</span>
                  <ShieldCheck
                    className={`h-4 w-4 ${analysis.isApiGateway ? 'text-sky-400' : 'text-emerald-400'}`}
                  />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-text-primary font-mono">
                    {analysis.attenuationFactor.toFixed(2)}x
                  </span>
                  <span className="text-xs font-medium text-text-muted">
                    ({analysis.isApiGateway ? 'Edge Aggregator' : 'Standard Microservice'})
                  </span>
                </div>
                <p className="mt-2 text-xs text-text-secondary">
                  {analysis.isApiGateway
                    ? '70% penalty reduction applied for legitimate routing node'
                    : 'Full fan-out penalty applied (non-gateway service)'}
                </p>
              </CardContent>
            </Card>

            {/* 4. Critical Path Latency Amplification */}
            <Card className="bg-surface border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-text-muted">
                  <span className="text-xs font-medium uppercase tracking-wider">Critical Path Latency</span>
                  <Zap className="h-4 w-4 text-amber-400" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-amber-400 font-mono">
                    {analysis.criticalPathLatencyMs} ms
                  </span>
                  <span className="text-xs font-mono text-text-muted">
                    ({analysis.amplificationMultiplier}x amp)
                  </span>
                </div>
                <p className="mt-2 text-xs text-text-secondary font-mono">
                  Root Span: {baseLatencyMs.toFixed(1)} ms → Cascaded Total
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Interactive Topology & Attenuation Simulator */}
          <Card className="bg-surface border-border">
            <CardHeader className="border-b border-border/60 pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between text-text-primary">
                <span className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-brand-perf" />
                  Fan-Out Penalty &amp; Gateway Attenuation Simulator
                </span>
                <span className="text-xs font-mono text-text-muted">
                  Formula: min(1.0, Direct×0.15 + (Depth-1)×0.10) × Attenuation
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {/* Direct Fan-Out Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-text-primary">Direct Downstream Calls:</span>
                    <span className="font-mono font-bold text-brand-perf">{simFanOutCount} services</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={8}
                    step={1}
                    value={simFanOutCount}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setSimFanOutCount(val);
                      evaluateFanOut(selectedServiceId, val, simMaxDepth, simGatewayMode);
                    }}
                    className="w-full accent-brand-perf cursor-pointer"
                  />
                  <p className="text-[11px] text-text-muted">Each synchronous downstream call adds +0.15 raw penalty</p>
                </div>

                {/* Max Call-Tree Depth Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-text-primary">Max Call-Tree Depth:</span>
                    <span className="font-mono font-bold text-sky-400">Level {simMaxDepth}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={6}
                    step={1}
                    value={simMaxDepth}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setSimMaxDepth(val);
                      evaluateFanOut(selectedServiceId, simFanOutCount, val, simGatewayMode);
                    }}
                    className="w-full accent-brand-perf cursor-pointer"
                  />
                  <p className="text-[11px] text-text-muted">Each hop beyond Depth 1 adds +0.10 cascading latency risk</p>
                </div>

                {/* API Gateway Attenuation Toggle */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-text-primary">Architectural Role:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {simGatewayMode ? 'API Gateway (0.3x)' : 'Microservice (1.0x)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !simGatewayMode;
                      setSimGatewayMode(next);
                      evaluateFanOut(selectedServiceId, simFanOutCount, simMaxDepth, next);
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-xs font-mono font-semibold transition-all ${
                      simGatewayMode
                        ? 'border-sky-500/40 bg-sky-500/15 text-sky-400'
                        : 'border-border bg-surface-secondary text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {simGatewayMode
                      ? '✓ API Gateway Attenuation Enabled (0.3x)'
                      : 'Enable API Gateway Attenuation (0.3x)'}
                  </button>
                  <p className="text-[11px] text-text-muted">
                    Prevents false penalization of legitimate edge aggregation nodes
                  </p>
                </div>
              </div>

              {/* Preset Scenarios */}
              <div className="pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-text-secondary">
                  Quick Architectural Topology Presets:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSimFanOutCount(1);
                      setSimMaxDepth(2);
                      setSimGatewayMode(false);
                      evaluateFanOut(selectedServiceId, 1, 2, false);
                    }}
                    className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20"
                  >
                    Well-Decoupled Service (1 Call, Depth 2)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSimFanOutCount(4);
                      setSimMaxDepth(3);
                      setSimGatewayMode(true);
                      evaluateFanOut(selectedServiceId, 4, 3, true);
                    }}
                    className="rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-400 hover:bg-sky-500/20"
                  >
                    Edge API Gateway (4 Calls, 0.3x Attenuated)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSimFanOutCount(5);
                      setSimMaxDepth(5);
                      setSimGatewayMode(false);
                      evaluateFanOut(selectedServiceId, 5, 5, false);
                    }}
                    className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-400 hover:bg-rose-500/20"
                  >
                    Chatty N+1 Anti-Pattern (5 Calls, Depth 5)
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Distributed Trace Call-Tree DAG Visualization */}
          <Card className="bg-surface border-border">
            <CardHeader className="border-b border-border/60 pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between text-text-primary">
                <span className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-brand-perf" />
                  Distributed Trace Call-Tree DAG Topology ({analysis.serviceId})
                </span>
                <span className="text-xs font-mono font-normal text-text-muted">
                  {analysis.summary}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {analysis.callTreeTopology.map((node) => {
                const indentPx = (node.depth - 1) * 32;
                const widthPercent = Math.min(
                  100,
                  Math.max(12, (node.spanDurationMs / Math.max(1, analysis.criticalPathLatencyMs)) * 100)
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
                            ← called by <strong className="text-text-secondary">{node.parentServiceId}</strong>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 font-mono text-xs">
                        {node.childrenServiceIds.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-sky-400">
                            Fan-out: {node.childrenServiceIds.length} <ArrowRight className="h-3 w-3" />
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
