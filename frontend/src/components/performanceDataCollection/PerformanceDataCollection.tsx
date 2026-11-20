import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Copy,
  Database,
  ExternalLink,
  GitBranch,
  Network,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Server,
  Trash2,
  TriangleAlert,
  XCircle,
  Code2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { collectionSources } from './serviceCatalog';
import type { PerformanceService } from './types';
import { TelemetryService } from '../../services/telemetry';
import {
  PerformanceFlowHeader,
  PerformanceStepFooter
} from '../performace/PerformanceFlowNav';

const statusStyle = {
  healthy: 'text-emerald-400',
  degraded: 'text-amber-400',
  offline: 'text-rose-400',
};

const SERVICES_LIST_STORAGE_KEY = 'pscore_services_list';
const SNAPSHOT_STORAGE_KEY = 'pscore_latest_snapshot';

const DEFAULT_PRESET_SERVICES: PerformanceService[] = [
  { id: 'user-service-1', name: 'user-service-1', port: 3002, role: 'Orchestrator microservice', dependencies: ['users-mongo-1'], status: 'healthy' },
  { id: 'order-service-1', name: 'order-service-1', port: 3003, role: 'Transaction microservice', dependencies: ['orders-mongo-1'], status: 'healthy' },
  { id: 'book-service-1', name: 'book-service-1', port: 3001, role: 'Catalog microservice', dependencies: ['books-mongo-1'], status: 'healthy' },
  { id: 'gateway-1', name: 'gateway-1', port: 3000, role: 'API Gateway / Edge Router', dependencies: ['user-service-1', 'order-service-1', 'book-service-1'], status: 'healthy' },
];

function getInitialServicesList(): PerformanceService[] {
  try {
    const raw = localStorage.getItem(SERVICES_LIST_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    const collected = TelemetryService.getCollectedServices();
    if (collected.length > 0) {
      return collected.map((id) => {
        const found = DEFAULT_PRESET_SERVICES.find((d) => d.id === id);
        return (
          found || {
            id,
            name: id,
            port: 8080,
            role: 'Target microservice',
            dependencies: [],
            status: 'healthy',
          }
        );
      });
    }
  } catch {
    // fallback to preset
  }
  return DEFAULT_PRESET_SERVICES;
}

function getInitialSnapshot(): any {
  try {
    const raw = sessionStorage.getItem(SNAPSHOT_STORAGE_KEY) || localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

export const PerformanceDataCollection: React.FC = () => {
  const [servicesList, setServicesList] = useState<PerformanceService[]>(getInitialServicesList);
  const [selectedServices, setSelectedServices] = useState<string[]>(() => {
    const stored = TelemetryService.getCollectedServices();
    if (stored.length > 0) return stored;
    return getInitialServicesList().map((s) => s.id);
  });
  const [activeInspectService, setActiveInspectService] = useState<string>(() => {
    const active = TelemetryService.getActiveService();
    if (active) return active;
    const initial = getInitialServicesList();
    return initial[0]?.id || 'user-service-1';
  });
  const [customInput, setCustomInput] = useState('');
  const [requestState, setRequestState] = useState('Ready to collect raw telemetry');
  const [collectedData, setCollectedData] = useState<any>(getInitialSnapshot);
  const [showRawJson, setShowRawJson] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);

  useEffect(() => {
    if (servicesList.length > 0) {
      try {
        localStorage.setItem(SERVICES_LIST_STORAGE_KEY, JSON.stringify(servicesList));
      } catch {
        // ignore
      }
    }
  }, [servicesList]);

  const endpoint = '/api/telemetry/snapshot';

  const discoverRunningContainers = useCallback(async () => {
    setIsDiscovering(true);
    try {
      const stored = TelemetryService.getCollectedServices();
      const activeFromStore = TelemetryService.getActiveService();
      const disc = await TelemetryService.discoverServices();
      const candidates = Array.from(
        new Set([
          ...stored,
          ...(activeFromStore ? [activeFromStore] : []),
          ...(disc.applicationServices.length > 0 ? disc.applicationServices : disc.allServices),
        ])
      );

      if (candidates.length > 0) {
        setServicesList((prev) => {
          const existingMap = new Map(prev.map((s) => [s.id, s]));
          const next = candidates.map((id) => {
            const existing = existingMap.get(id);
            const preset = DEFAULT_PRESET_SERVICES.find((p) => p.id === id);
            return (
              existing || preset || {
                id,
                name: id,
                port: 8080,
                role: 'Discovered container microservice',
                dependencies: [],
                status: 'healthy' as const,
              }
            );
          });
          try {
            localStorage.setItem(SERVICES_LIST_STORAGE_KEY, JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
        setSelectedServices((prev) => {
          if (prev.length > 0) return prev;
          return stored.length > 0 ? stored : candidates;
        });
      }
    } catch {
      // ignore if collector is not yet started
    } finally {
      setIsDiscovering(false);
    }
  }, []);

  useEffect(() => {
    discoverRunningContainers();
  }, [discoverRunningContainers]);

  const toggleService = (serviceId: string) => {
    setSelectedServices((current) => {
      const next = current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId];
      TelemetryService.setCollectedServices(next);
      return next;
    });
  };

  const handleAddCustomService = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customInput.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    if (!trimmed) return;

    const nextServices = selectedServices.includes(trimmed)
      ? selectedServices
      : [...selectedServices, trimmed];

    if (!servicesList.some((s) => s.id === trimmed)) {
      const newService: PerformanceService = {
        id: trimmed,
        name: customInput.trim(),
        port: 8080,
        role: 'Target microservice',
        dependencies: [],
        status: 'healthy',
      };
      setServicesList((prev) => {
        const next = [...prev, newService];
        try {
          localStorage.setItem(SERVICES_LIST_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    }
    setSelectedServices(nextServices);
    setActiveInspectService(trimmed);
    TelemetryService.setCollectedServices(nextServices, trimmed);
    setCustomInput('');
  };

  const removeService = (serviceId: string) => {
    const nextList = servicesList.filter((s) => s.id !== serviceId);
    const nextSelected = selectedServices.filter((id) => id !== serviceId);
    setServicesList(nextList);
    setSelectedServices(nextSelected);
    TelemetryService.setCollectedServices(nextSelected);
    try {
      localStorage.setItem(SERVICES_LIST_STORAGE_KEY, JSON.stringify(nextList));
    } catch {
      // ignore
    }
  };

  const collectSnapshot = async () => {
    if (selectedServices.length === 0) return;
    setIsCollecting(true);
    setRequestState('Scraping Prometheus, Jaeger, Loki & Docker Cgroups...');

    try {
      const primarySvc =
        activeInspectService && selectedServices.includes(activeInspectService)
          ? activeInspectService
          : selectedServices[0];
      TelemetryService.setCollectedServices(selectedServices, primarySvc);
      setActiveInspectService(primarySvc);

      const queryParam = encodeURIComponent(selectedServices.join(','));

      let snapResponse: Response;
      try {
        snapResponse = await fetch(`${endpoint}?services=${queryParam}`);
        if (!snapResponse.ok) throw new Error(`HTTP ${snapResponse.status}`);
      } catch {
        snapResponse = await fetch(`http://localhost:8787${endpoint}?services=${queryParam}`);
      }
      const data = await snapResponse.json();
      if (!snapResponse.ok) {
        throw new Error(data.error || 'Collector gateway error');
      }
      setCollectedData(data);
      try {
        sessionStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(data));
        localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(data));
      } catch {
        // ignore
      }

      if (data && Array.isArray(data.snapshots)) {
        setServicesList((prevServices) =>
          prevServices.map((service) => {
            const snap = data.snapshots.find((s: any) => s.serviceId === service.id);
            if (!snap) return { ...service, status: 'offline' };

            const hasRealActivity =
              snap.prometheus?.cpuUsageMillicores > 0 ||
              snap.prometheus?.memoryUsageMB > 0 ||
              snap.prometheus?.rps > 0 ||
              snap.prometheus?.avgResponseTimeMs > 0 ||
              snap.k8s?.podReplicaCount > 0 ||
              snap.k8s?.uptimeSeconds > 0 ||
              (Array.isArray(snap.jaeger) && snap.jaeger.length > 0) ||
              snap.loki?.totalCount > 0;

            let computedStatus: 'healthy' | 'degraded' | 'offline' = 'offline';
            if (hasRealActivity) {
              if (snap.loki?.errorCount > 10 || snap.prometheus?.p95LatencyMs > 500) {
                computedStatus = 'degraded';
              } else {
                computedStatus = 'healthy';
              }
            }
            return { ...service, status: computedStatus };
          })
        );
      }

      setRequestState(
        `Collected & synced ${selectedServices.length} service(s) across the entire Performance Pipeline`
      );
    } catch (err: any) {
      setRequestState(
        `Collection failed: ${err.message || 'Make sure pscore-telemetry-collector (:8787) is running'}`
      );
    } finally {
      setIsCollecting(false);
    }
  };

  const fullQueryUrl =
    selectedServices.length > 0
      ? `http://localhost:8787${endpoint}?services=${selectedServices.join(',')}`
      : `http://localhost:8787${endpoint}?services=<your-microservice-id>`;

  const currentInspectId = activeInspectService || selectedServices[0] || '';

  const currentSnapshot = collectedData?.snapshots?.find(
    (s: any) => s.serviceId === currentInspectId
  );

  return (
    <div className="space-y-6">
      {/* Unified Pipeline Flow Header */}
      <PerformanceFlowHeader
        currentStep="collection"
        services={selectedServices}
        selectedService={currentInspectId}
        onSelectService={(svcId) => {
          setActiveInspectService(svcId);
          TelemetryService.setActiveService(svcId);
        }}
        onAddService={(svcId) => {
          const trimmed = svcId.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
          if (!trimmed) return;
          const nextServices = selectedServices.includes(trimmed)
            ? selectedServices
            : [...selectedServices, trimmed];
          if (!servicesList.some((s) => s.id === trimmed)) {
            setServicesList((prev) => [
              ...prev,
              {
                id: trimmed,
                name: trimmed,
                port: 8080,
                role: 'Target microservice',
                dependencies: [],
                status: 'offline',
              },
            ]);
          }
          setSelectedServices(nextServices);
          setActiveInspectService(trimmed);
          TelemetryService.setCollectedServices(nextServices, trimmed);
        }}
      />

      {/* Page Title & Action Bar */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-perf">
            Step 1 of 4 — Multi-Source Telemetry Ingestion Gateway (:8787)
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-text-primary">
            Raw Telemetry Discovery &amp; Snapshot Collection
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-text-secondary">
            Select the target microservices to evaluate. Clicking <strong>Collect Telemetry Snapshot</strong> scrapes live metrics from Prometheus, Jaeger, Loki, and Docker Engine, locking in your target services for Steps 2, 3, and 4.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={discoverRunningContainers}
            disabled={isDiscovering}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-secondary/40 px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isDiscovering ? 'animate-spin text-brand-perf' : ''}`} />
            Auto-Discover Containers
          </button>

          <button
            type="button"
            onClick={collectSnapshot}
            disabled={selectedServices.length === 0 || isCollecting}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-perf px-4 py-2 text-xs font-semibold text-slate-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCollecting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {isCollecting ? 'Scraping Live Telemetry...' : 'Collect Telemetry Snapshot'}
          </button>
        </div>
      </div>

      {/* Target Selection & Telemetry Sources */}
      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
              <Network className="h-4 w-4 text-brand-perf" /> 1. Target Microservice Selection
            </CardTitle>
            <p className="mt-1 text-xs text-text-muted">
              Toggle services below to include them in the performance evaluation pipeline.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <form onSubmit={handleAddCustomService} className="flex gap-2">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="Add microservice ID (e.g. order-service-1, api-gateway)..."
                className="flex-1 rounded-md border border-border bg-surface-secondary/40 px-3 py-2 text-xs font-mono text-text-primary placeholder:text-text-muted focus:border-brand-perf focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-md border border-brand-perf/40 bg-brand-perf/10 px-3 py-2 text-xs font-medium text-brand-perf transition-colors hover:bg-brand-perf/20"
              >
                <Plus className="h-3.5 w-3.5" /> Add Target
              </button>
            </form>

            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {servicesList.length === 0 ? (
                <div className="rounded-md border border-dashed border-border/70 p-6 text-center text-xs text-text-muted">
                  No microservices discovered yet. Click <strong>&ldquo;Auto-Discover Containers&rdquo;</strong> or add a service ID above.
                </div>
              ) : (
                servicesList.map((service) => {
                  const selected = selectedServices.includes(service.id);
                  return (
                    <div
                      key={service.id}
                      className={`flex items-center justify-between gap-3 rounded-md border p-3 transition-colors ${
                        selected
                          ? 'border-brand-perf/60 bg-brand-perf/10'
                          : 'border-border bg-surface-secondary/20 hover:bg-surface-secondary/50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleService(service.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span
                          className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                            selected ? 'bg-brand-perf' : 'bg-text-muted'
                          }`}
                        />
                        <span className="min-w-0">
                          <span className="block font-mono text-sm font-semibold text-text-primary">
                            {service.id}
                          </span>
                          <span className="mt-0.5 block text-xs text-text-muted">
                            {service.role}
                          </span>
                        </span>
                      </button>

                      <div className="flex items-center gap-2">
                        <span
                          className={`flex shrink-0 items-center gap-1 text-xs ${
                            statusStyle[service.status]
                          }`}
                        >
                          {service.status === 'healthy' ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : service.status === 'degraded' ? (
                            <TriangleAlert className="h-3.5 w-3.5" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          {service.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeService(service.id)}
                          className="p-1 text-text-muted hover:text-rose-400 transition-colors"
                          title="Remove service"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4 text-xs text-text-secondary">
              <span className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-brand-perf" /> {selectedServices.length} target service(s) queued for pipeline
              </span>
              <span className="font-mono text-emerald-400">{requestState}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
              <Radio className="h-4 w-4 text-emerald-400" /> 2. Connected Telemetry Sources
            </CardTitle>
            <p className="mt-1 text-xs text-text-muted">
              Four upstream observability planes scraped by the Telemetry Collector.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            {collectionSources.map((source) => (
              <div
                key={source.name}
                className="border-b border-border/60 pb-3.5 last:border-0 last:pb-0"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
                    <Database className="h-4 w-4 text-brand-perf" />
                    {source.name}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${
                      source.status === 'connected'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                    }`}
                  >
                    {source.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-text-muted">{source.purpose}</p>
                <p className="mt-1.5 break-all font-mono text-[11px] text-text-secondary">
                  {source.endpoint}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Collected Raw Telemetry Inspection & Direct Step 2 Handoff */}
      {collectedData && (
        <Card className="border-brand-perf/50 bg-surface-secondary/20">
          <CardHeader className="border-b border-border/60">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> Step 1 Output: Raw Telemetry Snapshot Captured ({collectedData.snapshots?.length || 0} Services)
                </CardTitle>
                <p className="mt-1 text-xs text-text-secondary">
                  Inspect the raw multi-source telemetry below, then proceed to <strong>Step 2A (Latency Drift)</strong> to evaluate historical latency regressions and degradation against baseline releases.
                </p>
              </div>

              <Link
                to="/dimensions/performance/drift"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-perf px-4 py-2 text-xs font-semibold text-slate-950 shadow-sm hover:opacity-90 transition-opacity"
              >
                <span>Proceed to Step 2A: Latency Drift</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardHeader>

          <CardContent className="pt-5 space-y-4">
            {/* Service Switcher Pills */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-mono uppercase text-text-muted mr-1">
                  Inspect Snapshot:
                </span>
                {selectedServices.map((svcId) => (
                  <button
                    key={svcId}
                    type="button"
                    onClick={() => {
                      setActiveInspectService(svcId);
                      TelemetryService.setActiveService(svcId);
                    }}
                    className={`rounded-md border px-2.5 py-1 font-mono text-xs transition-colors ${
                      currentInspectId === svcId
                        ? 'border-brand-perf bg-brand-perf text-slate-950 font-bold'
                        : 'border-border bg-surface text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {svcId}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowRawJson((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded border border-border bg-surface px-2.5 py-1 font-mono text-xs text-text-secondary hover:text-text-primary"
              >
                <Code2 className="h-3.5 w-3.5 text-brand-perf" />
                {showRawJson ? 'Hide Raw JSON Payload' : 'View Raw JSON Payload'}
                {showRawJson ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>

            {/* Structured 4-Plane Raw Telemetry Breakdown for Selected Service */}
            {currentSnapshot && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 font-mono text-xs">
                <div className="rounded-lg border border-border bg-surface/80 p-3.5 space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-perf">
                    Prometheus Metrics
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">CPU Usage:</span>
                    <span className="text-text-primary font-bold">
                      {currentSnapshot.prometheus?.cpuUsageMillicores ?? 0} m
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Memory RSS:</span>
                    <span className="text-text-primary font-bold">
                      {currentSnapshot.prometheus?.memoryUsageMB ?? 0} MB
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">P95 / P99 Latency:</span>
                    <span className="text-amber-400 font-bold">
                      {currentSnapshot.prometheus?.p95LatencyMs ?? 0}ms /{' '}
                      {currentSnapshot.prometheus?.p99LatencyMs ?? 0}ms
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Throughput:</span>
                    <span className="text-emerald-400 font-bold">
                      {currentSnapshot.prometheus?.rps ?? 0} req/s
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-surface/80 p-3.5 space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-400">
                    Jaeger Distributed Traces
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Captured Traces:</span>
                    <span className="text-text-primary font-bold">
                      {Array.isArray(currentSnapshot.jaeger) ? currentSnapshot.jaeger.length : 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Trace Status:</span>
                    <span className="text-sky-400">
                      {Array.isArray(currentSnapshot.jaeger) && currentSnapshot.jaeger.length > 0
                        ? 'Spans Ready for Step 3B'
                        : 'Container Topology Mode'}
                    </span>
                  </div>
                  <p className="text-[10px] font-sans text-text-muted pt-1">
                    Feeds Call-Tree Depth &amp; Fan-Out Analyzer (Step 3B).
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-surface/80 p-3.5 space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                    Loki Log Aggregator
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Total Log Lines:</span>
                    <span className="text-text-primary font-bold">
                      {currentSnapshot.loki?.totalCount ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Error Log Count:</span>
                    <span
                      className={
                        (currentSnapshot.loki?.errorCount ?? 0) > 0
                          ? 'text-rose-400 font-bold'
                          : 'text-emerald-400 font-bold'
                      }
                    >
                      {currentSnapshot.loki?.errorCount ?? 0} errors
                    </span>
                  </div>
                  <p className="text-[10px] font-sans text-text-muted pt-1">
                    Feeds 4D Error Rate feature in Isolation Forest (Step 3C).
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-surface/80 p-3.5 space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                    Container / K8s Runtime
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Active Replicas:</span>
                    <span className="text-text-primary font-bold">
                      {currentSnapshot.k8s?.podReplicaCount ?? 1} pod(s)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Container Uptime:</span>
                    <span className="text-emerald-400 font-bold">
                      {currentSnapshot.k8s?.uptimeSeconds ?? 0}s
                    </span>
                  </div>
                  <p className="text-[10px] font-sans text-text-muted pt-1">
                    Feeds Cao &amp; Long 90s Startup Pre-Filter (Step 3C).
                  </p>
                </div>
              </div>
            )}

            {/* Collapsible Raw JSON Payload */}
            {showRawJson && (
              <pre className="max-h-72 overflow-y-auto rounded-md border border-border bg-background/90 p-4 font-mono text-xs text-emerald-300">
                {JSON.stringify(collectedData, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      )}

      {/* Collector API Reference */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-secondary">
            <Server className="h-3.5 w-3.5 text-brand-perf" /> Collector Gateway REST Endpoint
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface-secondary/30 p-2.5">
            <code className="break-all font-mono text-xs text-brand-perf">{fullQueryUrl}</code>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(fullQueryUrl)}
              className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-xs text-text-secondary hover:text-text-primary"
            >
              <Copy className="h-3 w-3" /> Copy URL
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
            <span className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-brand-perf" /> Returns unified Prometheus, Jaeger, Loki &amp; Docker snapshot JSON.
            </span>
            <span className="flex items-center gap-1.5">
              <ExternalLink className="h-3.5 w-3.5 text-cyan-400" /> Prometheus (:9090) · Jaeger (:16686) · Collector (:8787)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Step Navigation Footer */}
      <PerformanceStepFooter currentStep="collection" />
    </div>
  );
};
