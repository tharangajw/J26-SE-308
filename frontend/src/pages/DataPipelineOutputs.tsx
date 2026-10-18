import React, { useState, useEffect, useCallback } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import {
  Activity,
  CheckCircle2,
  Database,
  Play,
  RefreshCw,
  Filter,
  Sliders,
  Server,
  Radio,
  Plus,
  CircleDot,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { TelemetryService } from '../services/telemetry';

interface LiveServiceInfo {
  id: string;
  status: 'live' | 'idle' | 'offline';
  cpu?: number;
  memory?: number;
  p95?: number;
  p99?: number;
  rps?: number;
  replicas?: number;
}

interface PythonPipelineResponse {
  serviceId: string;
  hasTelemetry: boolean;
  timestamp: string;
  pipelineEngine: string;
  pipelineStatus: string;
  rawInputs: {
    cpuUsageMillicores: number;
    memoryUsageMB: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    rps: number;
    errorCount: number;
    replicaCount: number;
  };
  imputedMetrics: {
    missingValuesDetected: number;
    imputedFields: string[];
    imputationMethod: string;
    samplesInWindow: number;
  };
  normalizedFeatures: {
    normalizedCpu: number;
    normalizedMemory: number;
    normalizedLatency: number;
    normalizedRps: number;
    normalizedErrorRate: number;
    normalizedAvailability: number;
  };
  processedVectors: number[];
  timeSeriesGrid: Array<{
    timeSlot: string;
    timestampMs: number;
    serviceId: string;
    isImputed: boolean;
    raw: {
      cpuMillicores: number;
      memoryMB: number;
      latencyMs: number;
      requestRateRps: number;
    };
    normalized: {
      cpuMillicores: number;
      memoryMB: number;
      latencyMs: number;
      requestRateRps: number;
    };
  }>;
}

export const DataPipelineOutputs: React.FC = () => {
  const [liveServices, setLiveServices] = useState<LiveServiceInfo[]>([]);
  const [selectedService, setSelectedService] = useState<string>('');
  const [imputationMethod, setImputationMethod] = useState<
    'linear_interpolation' | 'forward_fill' | 'zero_fill'
  >('linear_interpolation');
  const [isDiscovering, setIsDiscovering] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processedResult, setProcessedResult] = useState<PythonPipelineResponse | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [customServiceName, setCustomServiceName] = useState<string>('');
  const [lastDiscoveredAt, setLastDiscoveredAt] = useState<Date | null>(null);

  const runPythonPipeline = useCallback(
    async (targetSvc: string, method: string = imputationMethod) => {
      if (!targetSvc) return;
      setIsProcessing(true);
      setPipelineError(null);
      try {
        const q = `service_id=${encodeURIComponent(targetSvc)}&imputation=${encodeURIComponent(method)}`;
        const urls = [
          `/api/anomaly/pipeline/process?${q}`,
          `http://localhost:8000/pipeline/process?${q}`,
        ];
        let result: PythonPipelineResponse | null = null;
        for (const url of urls) {
          try {
            const res = await fetch(url);
            if (res.ok) {
              result = await res.json();
              break;
            }
          } catch {
            // try next
          }
        }
        if (!result) {
          throw new Error(
            'Unable to connect to Python FastAPI Pipeline Engine on port 8000 (/pipeline/process).'
          );
        }
        setProcessedResult(result);
      } catch (err: any) {
        setPipelineError(err?.message || 'Python Pipeline execution failed');
      } finally {
        setIsProcessing(false);
      }
    },
    [imputationMethod]
  );

  // Dynamic discovery of live running microservices from Telemetry Collector (Docker + Prometheus + Jaeger)
  const discoverLiveServices = useCallback(async () => {
    setIsDiscovering(true);
    const discovered: Map<string, LiveServiceInfo> = new Map();

    try {
      const disc = await TelemetryService.discoverServices();
      const candidates =
        disc.applicationServices.length > 0 ? disc.applicationServices : disc.allServices;

      if (candidates.length > 0) {
        const query = encodeURIComponent(candidates.join(','));
        const urls = [
          `/api/telemetry/snapshot?services=${query}`,
          `http://localhost:8787/api/telemetry/snapshot?services=${query}`,
        ];
        for (const url of urls) {
          try {
            const res = await fetch(url);
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data.snapshots)) {
                data.snapshots.forEach((snap: any) => {
                  const prom = snap.prometheus || {};
                  const k8s = snap.k8s || {};
                  const isLive =
                    prom.cpuUsageMillicores > 0 ||
                    prom.memoryUsageMB > 0 ||
                    prom.avgResponseTimeMs > 0 ||
                    prom.rps > 0;
                  discovered.set(snap.serviceId, {
                    id: snap.serviceId,
                    status: isLive ? 'live' : 'offline',
                    cpu: prom.cpuUsageMillicores || 0,
                    memory: prom.memoryUsageMB || 0,
                    p95: prom.p95LatencyMs || 0,
                    p99: prom.p99LatencyMs || 0,
                    rps: prom.rps || 0,
                    replicas: k8s.podReplicaCount || (isLive ? 1 : 0),
                  });
                });
                break;
              }
            }
          } catch {
            // continue
          }
        }
      }
    } catch {
      // ignore
    }

    const servicesArray = Array.from(discovered.values());
    setLiveServices(servicesArray);
    setLastDiscoveredAt(new Date());

    setSelectedService((prev) => {
      const target =
        prev && discovered.has(prev) ? prev : servicesArray[0]?.id || '';
      return target;
    });

    setIsDiscovering(false);
  }, []);

  useEffect(() => {
    discoverLiveServices();
    const interval = setInterval(discoverLiveServices, 8000);
    return () => clearInterval(interval);
  }, [discoverLiveServices]);

  // Automatically run Python pipeline when selectedService or imputationMethod changes
  useEffect(() => {
    if (selectedService) {
      runPythonPipeline(selectedService, imputationMethod);
    }
  }, [selectedService, imputationMethod, runPythonPipeline]);

  const handleAddCustomService = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customServiceName.trim();
    if (!trimmed) return;

    if (!liveServices.some((s) => s.id === trimmed)) {
      setLiveServices((prev) => [
        ...prev,
        {
          id: trimmed,
          status: 'idle',
        },
      ]);
    }
    setSelectedService(trimmed);
    setCustomServiceName('');
  };

  return (
    <PageContainer className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-perf">
              Phase 2 — Python Pandas &amp; NumPy Preprocessing Engine
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Python 3.11 FastAPI (:8000)
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Data Pipeline Outputs</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary">
            Executes live 5-second UTC grid alignment, Pandas missing-data imputation, and NumPy Min-Max [0, 1] feature scaling on real container telemetry streams.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastDiscoveredAt && (
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <Clock className="h-3.5 w-3.5" />
              {lastDiscoveredAt.toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={() => runPythonPipeline(selectedService, imputationMethod)}
            disabled={isProcessing || !selectedService}
            className="inline-flex items-center gap-2 rounded-md bg-brand-perf px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {isProcessing ? 'Running Python Pipeline...' : 'Run Python Pipeline'}
          </button>
        </div>
      </div>

      {/* Pipeline Stage Architecture Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border bg-surface-secondary/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
              <Filter className="h-4 w-4" /> Stage 1: Pandas 5s Grid &amp; Imputer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs text-text-secondary">
            <p className="font-medium text-text-primary">
              Time-Series Alignment &amp; Imputation (<code>pipeline_engine.py</code>)
            </p>
            <p className="text-text-muted">
              Aligns live container snapshots onto a 5-second UTC grid and imputes missing scrape intervals via Pandas.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <select
                value={imputationMethod}
                onChange={(e) => setImputationMethod(e.target.value as any)}
                className="rounded border border-border bg-surface px-2 py-1 font-mono text-[11px] text-cyan-400 focus:border-brand-perf focus:outline-none"
              >
                <option value="linear_interpolation">Linear Interpolation</option>
                <option value="forward_fill">Forward Fill (ffill)</option>
                <option value="zero_fill">Zero Fill</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-secondary/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              <Sliders className="h-4 w-4" /> Stage 2: NumPy Min-Max Normalizer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs text-text-secondary">
            <p className="font-medium text-text-primary">
              Domain Bounds Scaling (<code>normalizer.py</code>)
            </p>
            <p className="text-text-muted">
              Scales raw CPU millicores (0–2000m), memory (0–4096MB), and P95 latency (0–2000ms) into unified [0, 1] bounds.
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded bg-emerald-400/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400">
              Scaler: NumPy clip((x - min) / (max - min), 0, 1)
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-secondary/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-perf">
              <Activity className="h-4 w-4" /> Stage 3: Feature Vector Assembly
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs text-text-secondary">
            <p className="font-medium text-text-primary">
              Scoring &amp; Anomaly Vectors (<code>pscore_engine.py</code>)
            </p>
            <p className="text-text-muted">
              Streams normalized 5D vectors directly into the Isolation Forest ML model and Composite P-Score Engine.
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded bg-brand-perf/10 px-2 py-0.5 font-mono text-[10px] text-brand-perf">
              Target: Python P-Score Engine (:8000)
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Target Service Selection (Dynamic Live Running Services) */}
      <Card>
        <CardHeader className="border-b border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
              <Server className="h-4 w-4 text-brand-perf" /> Select Live Microservice for Pipeline Processing
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
                <Radio className="h-3 w-3 animate-pulse text-emerald-400" />
                Live Discovered ({liveServices.length} Services)
              </span>
              <button
                type="button"
                onClick={() => discoverLiveServices()}
                disabled={isDiscovering}
                className="inline-flex items-center gap-1 rounded border border-border bg-surface-secondary/40 px-2.5 py-1 text-xs text-text-muted hover:text-text-primary disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isDiscovering ? 'animate-spin text-brand-perf' : ''}`} />
                {isDiscovering ? 'Scanning...' : 'Refresh'}
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-2.5">
            {liveServices.map((svc) => (
              <button
                key={svc.id}
                type="button"
                onClick={() => setSelectedService(svc.id)}
                className={`group flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-xs transition-all ${
                  selectedService === svc.id
                    ? 'border-brand-perf bg-brand-perf/15 font-semibold text-brand-perf shadow-sm'
                    : 'border-border bg-surface-secondary/30 text-text-secondary hover:border-border-focus hover:text-text-primary'
                }`}
              >
                <CircleDot
                  className={`h-2.5 w-2.5 ${
                    svc.status === 'live'
                      ? 'text-emerald-400'
                      : svc.status === 'idle'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                />
                <span>{svc.id}</span>
                {svc.memory !== undefined && svc.memory > 0 && (
                  <span className="ml-1 rounded bg-background/60 px-1.5 py-0.5 text-[10px] text-text-muted">
                    {svc.memory}MB · {svc.p95}ms
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Inspect Custom Microservice */}
          <form
            onSubmit={handleAddCustomService}
            className="flex max-w-md items-center gap-2 pt-2 border-t border-border/40"
          >
            <input
              type="text"
              value={customServiceName}
              onChange={(e) => setCustomServiceName(e.target.value)}
              placeholder="Inspect specific service name..."
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-muted focus:border-brand-perf focus:outline-none"
            />
            <button
              type="submit"
              disabled={!customServiceName.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-surface-secondary px-3 py-1.5 text-xs font-medium text-text-primary border border-border hover:bg-surface-secondary/80 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5 text-brand-perf" />
              Inspect
            </button>
          </form>
        </CardContent>
      </Card>

      {pipelineError && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{pipelineError}</span>
        </div>
      )}

      {/* Processed Pipeline Output Payload */}
      {processedResult && (
        <>
          {!processedResult.hasTelemetry ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/5 p-10 text-center">
              <AlertTriangle className="h-9 w-9 text-amber-400" />
              <h3 className="mt-3 text-base font-semibold text-text-primary">
                No Active Telemetry Stream Found for &ldquo;{processedResult.serviceId}&rdquo;
              </h3>
              <p className="mt-1 max-w-lg text-xs text-text-secondary">
                The Python Pandas pipeline queried Telemetry Collector (:8787), but no live container or Prometheus metrics were returned for this service.
              </p>
            </div>
          ) : (
            <Card className="border-brand-perf/40 bg-surface-secondary/20">
              <CardHeader className="border-b border-border/60">
                <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm uppercase tracking-wider text-emerald-400">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Python Pipeline Execution Output (
                    {processedResult.serviceId})
                  </span>
                  <span className="font-mono text-xs text-text-muted">
                    {processedResult.pipelineEngine} · {processedResult.timestamp}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-5">
                {/* Before vs After Visual Comparison */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-md border border-border bg-background/80 p-4">
                    <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
                      <Database className="h-3.5 w-3.5" /> Raw Live Telemetry Input
                    </h4>
                    <div className="space-y-1.5 font-mono text-xs text-text-secondary">
                      <div className="flex justify-between">
                        <span>CPU Usage:</span>
                        <span className="text-text-primary font-medium">
                          {processedResult.rawInputs.cpuUsageMillicores} m
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Memory (RSS):</span>
                        <span className="text-text-primary font-medium">
                          {processedResult.rawInputs.memoryUsageMB} MB
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>P95 Latency:</span>
                        <span className="text-text-primary font-medium">
                          {processedResult.rawInputs.p95LatencyMs} ms
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>P99 Latency:</span>
                        <span className="text-text-primary font-medium">
                          {processedResult.rawInputs.p99LatencyMs} ms
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Request Rate (RPS):</span>
                        <span className="text-text-primary font-medium">
                          {processedResult.rawInputs.rps} req/s
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Error Count:</span>
                        <span className="text-text-primary font-medium">
                          {processedResult.rawInputs.errorCount}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Active Replicas:</span>
                        <span className="text-text-primary font-medium">
                          {processedResult.rawInputs.replicaCount}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border border-brand-perf/50 bg-background/80 p-4">
                    <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                      <Sliders className="h-3.5 w-3.5" /> NumPy Normalized Feature Vector [0 – 1]
                    </h4>
                    <div className="space-y-1.5 font-mono text-xs text-emerald-300">
                      <div className="flex justify-between">
                        <span>Norm CPU (0–2000m):</span>
                        <span className="font-bold">
                          {processedResult.normalizedFeatures.normalizedCpu}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Norm Memory (0–4096MB):</span>
                        <span className="font-bold">
                          {processedResult.normalizedFeatures.normalizedMemory}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Norm P95 Latency (0–2000ms):</span>
                        <span className="font-bold">
                          {processedResult.normalizedFeatures.normalizedLatency}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Norm Throughput (0–1000 RPS):</span>
                        <span className="font-bold">
                          {processedResult.normalizedFeatures.normalizedRps}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Norm Error Rate:</span>
                        <span className="font-bold">
                          {processedResult.normalizedFeatures.normalizedErrorRate}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Norm Availability:</span>
                        <span className="font-bold">
                          {processedResult.normalizedFeatures.normalizedAvailability}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Imputation Summary */}
                <div className="rounded-md border border-border/70 bg-background/60 p-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                  <div>
                    <span className="text-text-muted">Strategy: </span>
                    <span className="text-cyan-400">
                      {processedResult.imputedMetrics.imputationMethod}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted">Grid Slots in Buffer: </span>
                    <span className="text-text-primary">
                      {processedResult.imputedMetrics.samplesInWindow} slots
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted">Missing Cells Imputed: </span>
                    <span className="text-amber-400">
                      {processedResult.imputedMetrics.missingValuesDetected}
                    </span>
                  </div>
                </div>

                {/* 5s Resampled Time-Series Table */}
                {processedResult.timeSeriesGrid.length > 0 && (
                  <div className="overflow-x-auto rounded-md border border-border bg-background/60">
                    <table className="w-full text-left font-mono text-xs">
                      <thead className="border-b border-border bg-surface-secondary/50 text-[11px] uppercase text-text-muted">
                        <tr>
                          <th className="px-3 py-2">5s UTC Slot</th>
                          <th className="px-3 py-2">Raw CPU / Norm</th>
                          <th className="px-3 py-2">Raw RAM / Norm</th>
                          <th className="px-3 py-2">Raw P95 / Norm</th>
                          <th className="px-3 py-2">Raw RPS / Norm</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {processedResult.timeSeriesGrid.map((row) => (
                          <tr key={row.timestampMs} className="hover:bg-surface-secondary/20">
                            <td className="px-3 py-2 text-text-primary">{row.timeSlot}</td>
                            <td className="px-3 py-2">
                              {row.raw.cpuMillicores}m{' '}
                              <span className="text-emerald-400">
                                ({row.normalized.cpuMillicores})
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {row.raw.memoryMB}MB{' '}
                              <span className="text-emerald-400">({row.normalized.memoryMB})</span>
                            </td>
                            <td className="px-3 py-2">
                              {row.raw.latencyMs}ms{' '}
                              <span className="text-emerald-400">({row.normalized.latencyMs})</span>
                            </td>
                            <td className="px-3 py-2">
                              {row.raw.requestRateRps}{' '}
                              <span className="text-emerald-400">
                                ({row.normalized.requestRateRps})
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {row.isImputed ? (
                                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-400">
                                  IMPUTED
                                </span>
                              ) : (
                                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-400">
                                  LIVE SCRAPE
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Output Feature Vector Array */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    5D Normalized Output Vector [CPU, Memory, P95 Latency, Error Rate, Availability]
                  </p>
                  <div className="flex items-center gap-3 rounded-md border border-border bg-background p-3 font-mono text-xs text-brand-perf">
                    <span>Vector:</span>
                    <span className="text-emerald-400 font-bold">
                      [{processedResult.processedVectors.join(', ')}]
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </PageContainer>
  );
};
