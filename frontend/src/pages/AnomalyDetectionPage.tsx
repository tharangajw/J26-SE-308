import React, { useState, useEffect, useCallback } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Zap,
  ServerCrash,
  ShieldAlert,
  ShieldCheck,
  Cpu,
  Layers,
  Flame,
  Sliders
} from 'lucide-react';
import { TelemetryService } from '../services/telemetry';
import {
  AnomalyService,
  type ServiceAnomalyEvaluation,
  type AnomalyServiceHealth
} from '../services/anomaly';
import {
  PerformanceFlowHeader,
  PerformanceStepFooter
} from '../components/performace/PerformanceFlowNav';

export const AnomalyDetectionPage: React.FC = () => {
  const [health, setHealth] = useState<AnomalyServiceHealth | null>(null);
  const [discoveredServices, setDiscoveredServices] = useState<string[]>(() =>
    TelemetryService.getCollectedServices()
  );
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(() =>
    TelemetryService.getActiveService()
  );
  const [customServices, setCustomServices] = useState<string[]>(() =>
    TelemetryService.getCollectedServices()
  );
  const [evaluation, setEvaluation] = useState<ServiceAnomalyEvaluation | null>(null);
  const [predictionHistory, setPredictionHistory] = useState<ServiceAnomalyEvaluation[]>([]);
  const [testUptimeSec, setTestUptimeSec] = useState<number>(120);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const initServices = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const collected = TelemetryService.getCollectedServices();
      const activeFromStore = TelemetryService.getActiveService();
      const healthData = await AnomalyService.checkHealth();
      setHealth(healthData);

      const discovery = await TelemetryService.discoverServices();
      const baseServices =
        collected.length > 0
          ? collected
          : discovery.applicationServices && discovery.applicationServices.length > 0
          ? discovery.applicationServices
          : discovery.allServices;
      const allDiscovered = Array.from(new Set([
        ...collected,
        ...customServices,
        ...(activeFromStore ? [activeFromStore] : []),
        ...baseServices
      ]));
      setDiscoveredServices(allDiscovered);

      setError(null);
      return allDiscovered;
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to Anomaly Detection FastAPI Service on port 8000.');
      return [];
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [customServices]);

  const evaluateSelectedService = useCallback(async (serviceId: string, uptimeOverride?: number) => {
    if (!serviceId) return;
    setIsRefreshing(true);
    try {
      let evalResult = await AnomalyService.evaluateService(serviceId);

      if (uptimeOverride !== undefined && uptimeOverride !== evalResult.rawMetrics.uptimeSeconds) {
        const customPred = await AnomalyService.predict({
          service_id: serviceId,
          feature_vector: [
            evalResult.normalizedFeatures.cpuNorm,
            evalResult.normalizedFeatures.memoryNorm,
            evalResult.normalizedFeatures.latencyNorm,
            evalResult.normalizedFeatures.errorRate,
          ],
          pod_uptime_sec: uptimeOverride,
        });
        evalResult = {
          ...evalResult,
          prediction: customPred,
          rawMetrics: {
            ...evalResult.rawMetrics,
            uptimeSeconds: uptimeOverride,
          },
        };
      } else {
        setTestUptimeSec(evalResult.rawMetrics.uptimeSeconds);
      }

      setEvaluation(evalResult);
      setLastRefreshed(new Date());
      setPredictionHistory((prev) => {
        const top = prev[0];
        if (
          top &&
          top.serviceId === evalResult.serviceId &&
          top.rawMetrics.cpuMillicores === evalResult.rawMetrics.cpuMillicores &&
          top.rawMetrics.memoryMB === evalResult.rawMetrics.memoryMB &&
          top.rawMetrics.uptimeSeconds === evalResult.rawMetrics.uptimeSeconds &&
          top.prediction.anomaly_score === evalResult.prediction.anomaly_score
        ) {
          return prev;
        }
        return [evalResult, ...prev.slice(0, 9)];
      });
      setError(null);
    } catch (err: any) {
      setError(err?.message || `Failed to evaluate anomaly for ${serviceId}`);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const injectWorkloadScenario = useCallback(
    async (
      rawMetrics: { cpuMillicores: number; memoryMB: number; p95LatencyMs: number; errorCount: number },
      uptimeSec: number
    ) => {
      const targetService = selectedServiceId || discoveredServices[0];
      if (!targetService) return;
      setIsRefreshing(true);
      try {
        const cpuNorm = parseFloat(Math.min(1.0, Math.max(0.0, rawMetrics.cpuMillicores / 1000.0)).toFixed(3));
        const memoryNorm = parseFloat(Math.min(1.0, Math.max(0.0, rawMetrics.memoryMB / 512.0)).toFixed(3));
        const latencyNorm = parseFloat(Math.min(1.0, Math.max(0.0, rawMetrics.p95LatencyMs / 200.0)).toFixed(3));
        const errorRate = parseFloat(Math.min(1.0, Math.max(0.0, rawMetrics.errorCount / 10.0)).toFixed(3));

        const prediction = await AnomalyService.predict({
          service_id: targetService,
          feature_vector: [cpuNorm, memoryNorm, latencyNorm, errorRate],
          pod_uptime_sec: uptimeSec,
        });

        const evalResult: ServiceAnomalyEvaluation = {
          serviceId: targetService,
          prediction,
          rawMetrics: {
            ...rawMetrics,
            uptimeSeconds: uptimeSec,
          },
          normalizedFeatures: {
            cpuNorm,
            memoryNorm,
            latencyNorm,
            errorRate,
          },
          evaluatedAt: new Date().toLocaleTimeString(),
        };

        setEvaluation(evalResult);
        setLastRefreshed(new Date());
        setPredictionHistory((prev) => [evalResult, ...prev.slice(0, 9)]);
        setError(null);
      } catch (err: any) {
        setError(err?.message || `Failed to run inference for ${targetService}`);
      } finally {
        setIsRefreshing(false);
      }
    },
    [selectedServiceId, discoveredServices]
  );

  useEffect(() => {
    initServices().then((services) => {
      const activeFromStore = TelemetryService.getActiveService();
      const target = activeFromStore || selectedServiceId || services[0];
      if (target) {
        setSelectedServiceId(target);
        evaluateSelectedService(target);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedServiceId || !health) return;
    const intervalId = setInterval(() => {
      evaluateSelectedService(selectedServiceId);
    }, 2000);
    return () => clearInterval(intervalId);
  }, [selectedServiceId, health, evaluateSelectedService]);

  const handleSelectService = (sId: string) => {
    setSelectedServiceId(sId);
    TelemetryService.setActiveService(sId);
    evaluateSelectedService(sId);
  };

  const handleAddService = (serviceId: string) => {
    const trimmed = serviceId.trim();
    if (!trimmed) return;
    const next = customServices.includes(trimmed) ? customServices : [...customServices, trimmed];
    setCustomServices(next);
    setDiscoveredServices((prev) => Array.from(new Set([...prev, trimmed])));
    TelemetryService.setCollectedServices(next, trimmed);
    setSelectedServiceId(trimmed);
    evaluateSelectedService(trimmed);
  };

  const handleUptimeChange = async (val: number) => {
    setTestUptimeSec(val);
    if (evaluation) {
      await injectWorkloadScenario(
        {
          cpuMillicores: evaluation.rawMetrics.cpuMillicores,
          memoryMB: evaluation.rawMetrics.memoryMB,
          p95LatencyMs: evaluation.rawMetrics.p95LatencyMs,
          errorCount: evaluation.rawMetrics.errorCount,
        },
        val
      );
    } else if (selectedServiceId) {
      evaluateSelectedService(selectedServiceId, val);
    }
  };

  if (isLoading && !health) {
    return (
      <PageContainer className="space-y-6">
        <PerformanceFlowHeader currentStep="anomaly" />
        <div className="flex h-96 flex-col items-center justify-center space-y-4 rounded-xl border border-border bg-surface p-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-brand-perf" />
          <h2 className="text-lg font-medium text-text-primary">Connecting to Anomaly Detection Engine...</h2>
          <p className="max-w-md text-sm text-text-secondary">
            Checking FastAPI service on port 8000 and pulling cluster metrics.
          </p>
        </div>
        <PerformanceStepFooter currentStep="anomaly" />
      </PageContainer>
    );
  }

  if (error && !health) {
    return (
      <PageContainer className="space-y-6">
        <PerformanceFlowHeader currentStep="anomaly" />
        <div className="flex flex-col items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/5 p-12 text-center">
          <ServerCrash className="h-12 w-12 text-rose-400" />
          <h3 className="mt-4 text-lg font-semibold text-rose-300">FastAPI Anomaly Service Offline (Port 8000)</h3>
          <p className="mt-2 max-w-lg text-sm text-text-secondary leading-relaxed">
            {error || 'Unable to connect to the Isolation Forest model on http://localhost:8000.'}
          </p>
          <div className="mt-6 rounded-lg border border-border bg-surface p-4 text-left font-mono text-xs text-text-secondary">
            <p className="font-semibold text-text-primary">To start the anomaly detection backend container:</p>
            <p className="mt-1 text-emerald-400">docker start pscore-anomaly-detection</p>
          </div>
          <button
            type="button"
            onClick={() => initServices()}
            disabled={isRefreshing}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-perf px-4 py-2 text-xs font-semibold text-slate-950 hover:opacity-90"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Now
          </button>
        </div>
        <PerformanceStepFooter currentStep="anomaly" />
      </PageContainer>
    );
  }

  const isPrefiltered = evaluation?.prediction?.prefiltered;
  const isAnomaly = evaluation?.prediction?.is_anomaly;
  const score = evaluation?.prediction?.anomaly_score ?? 0;

  const getScoreColor = () => {
    if (isPrefiltered) return 'text-sky-400';
    if (score >= 0.5) return 'text-rose-400';
    if (score >= 0.25) return 'text-amber-400';
    return 'text-emerald-400';
  };

  return (
    <PageContainer className="space-y-6">
      {/* Unified Pipeline Flow Header */}
      <PerformanceFlowHeader
        currentStep="anomaly"
        services={discoveredServices}
        selectedService={selectedServiceId}
        onSelectService={handleSelectService}
        onAddService={handleAddService}
      />

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">
              Step 3C of 4 — Sub-Engine 3: Unsupervised ML Runtime Anomaly (20% P-Score Weight)
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              FastAPI :8000 Online
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-medium text-sky-400">
              Isolation Forest Trained
            </span>
          </div>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-text-primary">
            Performance Anomaly Detection &amp; 90s Startup Filter
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-text-secondary">
            Consumes the normalized 4D feature vector from Step 2, applies the Cao &amp; Long 90-second pod-startup exclusion filter, and outputs the ML Anomaly Penalty (20% weight) with XAI attribution.
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
            onClick={() => {
              if (selectedServiceId) evaluateSelectedService(selectedServiceId);
            }}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-secondary px-3.5 py-2 text-xs font-medium text-text-primary hover:bg-surface-secondary/80 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-brand-perf' : ''}`} />
            Evaluate Live
          </button>
        </div>
      </div>

      {evaluation && (
        <>
          {/* 4 Focused KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-surface border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-text-muted">
                  <span className="text-xs font-medium uppercase tracking-wider">Detection Status</span>
                  {isPrefiltered ? (
                    <ShieldCheck className="h-4 w-4 text-sky-400" />
                  ) : isAnomaly ? (
                    <ShieldAlert className="h-4 w-4 text-rose-400" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  )}
                </div>
                <div className="mt-3">
                  {isPrefiltered ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-bold text-sky-400">
                      PREFILTERED (STARTUP)
                    </span>
                  ) : isAnomaly ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-400 animate-pulse">
                      ANOMALY DETECTED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-400">
                      NORMAL OPERATION
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-text-secondary font-mono truncate">
                  {evaluation.prediction.reason}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-surface border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-text-muted">
                  <span className="text-xs font-medium uppercase tracking-wider">ML Penalty (20% Wt)</span>
                  <Flame className={`h-4 w-4 ${getScoreColor()}`} />
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className={`text-3xl font-bold tracking-tight font-mono ${getScoreColor()}`}>
                    {score.toFixed(3)}
                  </span>
                  <span className="text-sm font-medium text-text-muted">/ 1.000</span>
                </div>
                <p className="mt-1 text-xs text-text-secondary">
                  {score >= 0.5 ? 'Severe deviation from cluster baseline' : score >= 0.25 ? 'Moderate workload drift' : 'Within normal bounds'}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-surface border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-text-muted">
                  <span className="text-xs font-medium uppercase tracking-wider">Cao &amp; Long Filter</span>
                  <Clock className="h-4 w-4 text-sky-400" />
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight text-text-primary font-mono">
                    {evaluation.rawMetrics.uptimeSeconds}s
                  </span>
                  <span className="text-xs font-medium text-text-muted">(Threshold: 90s)</span>
                </div>
                <p className="mt-1 text-xs text-text-secondary">
                  {evaluation.rawMetrics.uptimeSeconds < 90
                    ? 'Startup spike suppressed (FPR 72.5% reduction)'
                    : 'Evaluated past 90s warmup window'}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-surface border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-text-muted">
                  <span className="text-xs font-medium uppercase tracking-wider">Decision Function</span>
                  <Activity className="h-4 w-4 text-brand-perf" />
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight text-text-primary font-mono">
                    {evaluation.prediction.decision_function_score.toFixed(4)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-text-secondary">
                  Negative score denotes Isolation Forest outlier
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 4-Dimensional Feature Vector Breakdown */}
          <Card className="bg-surface border-border">
            <CardHeader className="border-b border-border/60 pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between text-text-primary">
                <span className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-brand-perf" />
                  4-Dimensional Normalized Feature Vector (From Step 2)
                </span>
                <span className="text-xs font-mono font-normal text-text-muted">
                  Target: {evaluation.serviceId}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-border/80 bg-surface-secondary/30 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span className="flex items-center gap-1.5 font-medium text-text-primary">
                      <Cpu className="h-3.5 w-3.5 text-brand-perf" /> CPU Utilization
                    </span>
                    <span className="font-mono text-brand-perf font-semibold">
                      {evaluation.normalizedFeatures.cpuNorm.toFixed(3)}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-surface-secondary overflow-hidden">
                    <div
                      className="h-full bg-brand-perf transition-all duration-500 rounded-full"
                      style={{ width: `${evaluation.normalizedFeatures.cpuNorm * 100}%` }}
                    />
                  </div>
                  <p className="text-[11px] font-mono text-text-muted">
                    Raw: {evaluation.rawMetrics.cpuMillicores} millicores
                  </p>
                </div>

                <div className="rounded-lg border border-border/80 bg-surface-secondary/30 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span className="flex items-center gap-1.5 font-medium text-text-primary">
                      <Layers className="h-3.5 w-3.5 text-sky-400" /> Memory Footprint
                    </span>
                    <span className="font-mono text-sky-400 font-semibold">
                      {evaluation.normalizedFeatures.memoryNorm.toFixed(3)}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-surface-secondary overflow-hidden">
                    <div
                      className="h-full bg-sky-400 transition-all duration-500 rounded-full"
                      style={{ width: `${evaluation.normalizedFeatures.memoryNorm * 100}%` }}
                    />
                  </div>
                  <p className="text-[11px] font-mono text-text-muted">
                    Raw: {evaluation.rawMetrics.memoryMB} MB
                  </p>
                </div>

                <div className="rounded-lg border border-border/80 bg-surface-secondary/30 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span className="flex items-center gap-1.5 font-medium text-text-primary">
                      <Zap className="h-3.5 w-3.5 text-amber-400" /> P95 Latency
                    </span>
                    <span className="font-mono text-amber-400 font-semibold">
                      {evaluation.normalizedFeatures.latencyNorm.toFixed(3)}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-surface-secondary overflow-hidden">
                    <div
                      className="h-full bg-amber-400 transition-all duration-500 rounded-full"
                      style={{ width: `${evaluation.normalizedFeatures.latencyNorm * 100}%` }}
                    />
                  </div>
                  <p className="text-[11px] font-mono text-text-muted">
                    Raw: {evaluation.rawMetrics.p95LatencyMs.toFixed(1)} ms
                  </p>
                </div>

                <div className="rounded-lg border border-border/80 bg-surface-secondary/30 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span className="flex items-center gap-1.5 font-medium text-text-primary">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-400" /> Error Rate
                    </span>
                    <span className="font-mono text-rose-400 font-semibold">
                      {evaluation.normalizedFeatures.errorRate.toFixed(3)}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-surface-secondary overflow-hidden">
                    <div
                      className="h-full bg-rose-400 transition-all duration-500 rounded-full"
                      style={{ width: `${evaluation.normalizedFeatures.errorRate * 100}%` }}
                    />
                  </div>
                  <p className="text-[11px] font-mono text-text-muted">
                    Raw: {evaluation.rawMetrics.errorCount} errors
                  </p>
                </div>
              </div>

              {evaluation.prediction.feature_attributions && (
                <div className="mt-5 rounded-lg border border-brand-perf/30 bg-brand-perf/5 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-brand-perf flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5" /> Explainable AI (XAI) — Isolation Forest Feature Attribution
                    </span>
                    <span className="rounded bg-surface border border-border px-2.5 py-0.5 font-mono text-xs text-text-primary">
                      Dominant Driver:{' '}
                      <strong className="text-brand-perf">
                        {evaluation.prediction.feature_attributions.dominantDriver}
                      </strong>
                    </span>
                  </div>

                  <div className="h-3 w-full rounded-full bg-surface-secondary overflow-hidden flex">
                    <div
                      className="bg-emerald-400 transition-all duration-500"
                      style={{ width: `${evaluation.prediction.feature_attributions.cpuPercent}%` }}
                      title={`CPU: ${evaluation.prediction.feature_attributions.cpuPercent}%`}
                    />
                    <div
                      className="bg-sky-400 transition-all duration-500"
                      style={{ width: `${evaluation.prediction.feature_attributions.memoryPercent}%` }}
                      title={`Memory: ${evaluation.prediction.feature_attributions.memoryPercent}%`}
                    />
                    <div
                      className="bg-amber-400 transition-all duration-500"
                      style={{ width: `${evaluation.prediction.feature_attributions.latencyPercent}%` }}
                      title={`Latency: ${evaluation.prediction.feature_attributions.latencyPercent}%`}
                    />
                    <div
                      className="bg-rose-400 transition-all duration-500"
                      style={{ width: `${evaluation.prediction.feature_attributions.errorPercent}%` }}
                      title={`Errors: ${evaluation.prediction.feature_attributions.errorPercent}%`}
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                    <div className="flex items-center justify-between rounded bg-surface/80 px-2.5 py-1 border border-border/60">
                      <span className="text-emerald-400">CPU:</span>
                      <span className="font-bold text-text-primary">
                        {evaluation.prediction.feature_attributions.cpuPercent}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded bg-surface/80 px-2.5 py-1 border border-border/60">
                      <span className="text-sky-400">RAM:</span>
                      <span className="font-bold text-text-primary">
                        {evaluation.prediction.feature_attributions.memoryPercent}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded bg-surface/80 px-2.5 py-1 border border-border/60">
                      <span className="text-amber-400">P95 Latency:</span>
                      <span className="font-bold text-text-primary">
                        {evaluation.prediction.feature_attributions.latencyPercent}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded bg-surface/80 px-2.5 py-1 border border-border/60">
                      <span className="text-rose-400">Error Rate:</span>
                      <span className="font-bold text-text-primary">
                        {evaluation.prediction.feature_attributions.errorPercent}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Interactive Cao & Long 90s Rule Tester */}
          <Card className="bg-surface border-border">
            <CardHeader className="border-b border-border/60 pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between text-text-primary">
                <span className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-brand-perf" />
                  Cao &amp; Long 90s Pod-Startup Exclusion Window Simulator
                </span>
                <span className="text-xs font-mono font-bold text-brand-perf">
                  Uptime: {testUptimeSec}s
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <p className="text-xs text-text-secondary leading-relaxed">
                Move the slider to simulate pod startup noise. If uptime is below 90 seconds (0s - 90s), the pre-filter automatically excludes transient startup spikes from triggering false alarms.
              </p>
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono text-text-muted">0s (Startup Spike)</span>
                <input
                  type="range"
                  min={10}
                  max={300}
                  step={5}
                  value={testUptimeSec}
                  onChange={(e) => handleUptimeChange(Number(e.target.value))}
                  className="w-full accent-brand-perf cursor-pointer"
                />
                <span className="text-xs font-mono text-text-muted">300s (Warmup Passed)</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="font-semibold text-text-secondary">
                  Active Filter Mode:
                </span>
                <span className={`font-mono font-bold ${testUptimeSec < 90 ? 'text-sky-400' : 'text-emerald-400'}`}>
                  {testUptimeSec < 90 ? 'ACTIVE PRE-FILTER (Startup artifact suppressed)' : 'EXCLUSION WINDOW EXPIRED (Evaluated by Isolation Forest)'}
                </span>
              </div>

              <div className="mt-4 pt-4 border-t border-border/60 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-semibold text-text-secondary">
                  Test Real FastAPI :8000 Inference Scenarios:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isRefreshing}
                    onClick={() =>
                      injectWorkloadScenario(
                        { cpuMillicores: 185, memoryMB: 128, p95LatencyMs: 24.5, errorCount: 0 },
                        testUptimeSec
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Normal Baseline
                  </button>
                  <button
                    type="button"
                    disabled={isRefreshing}
                    onClick={() =>
                      injectWorkloadScenario(
                        { cpuMillicores: 950, memoryMB: 465, p95LatencyMs: 175.0, errorCount: 2 },
                        testUptimeSec
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500/20 disabled:opacity-50"
                  >
                    <Flame className="h-3.5 w-3.5" />
                    Inject CPU &amp; RAM Spike (Anomaly)
                  </button>
                  <button
                    type="button"
                    disabled={isRefreshing}
                    onClick={() =>
                      injectWorkloadScenario(
                        { cpuMillicores: 880, memoryMB: 410, p95LatencyMs: 195.0, errorCount: 6 },
                        testUptimeSec
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Inject Latency &amp; Error Storm
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live Prediction Stream Log */}
          <Card className="bg-surface border-border">
            <CardHeader className="border-b border-border/60 pb-3">
              <CardTitle className="text-sm font-semibold text-text-primary">
                Live Anomaly Inference Stream Log
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-surface-secondary/50 text-text-muted border-b border-border/60 uppercase">
                    <tr>
                      <th className="px-5 py-3 font-medium">Time</th>
                      <th className="px-5 py-3 font-medium">Service</th>
                      <th className="px-5 py-3 font-medium">Uptime</th>
                      <th className="px-5 py-3 font-medium">Anomaly Score</th>
                      <th className="px-5 py-3 font-medium">Decision Score</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 text-text-secondary">
                    {predictionHistory.map((h, i) => (
                      <tr key={`log-${i}`} className="hover:bg-surface-secondary/30">
                        <td className="px-5 py-3 text-text-muted">{h.evaluatedAt}</td>
                        <td className="px-5 py-3 font-semibold text-text-primary">{h.serviceId}</td>
                        <td className="px-5 py-3">{h.rawMetrics.uptimeSeconds}s</td>
                        <td className="px-5 py-3 font-bold text-text-primary">
                          {h.prediction.anomaly_score.toFixed(3)}
                        </td>
                        <td className="px-5 py-3">{h.prediction.decision_function_score.toFixed(4)}</td>
                        <td className="px-5 py-3">
                          {h.prediction.prefiltered ? (
                            <span className="rounded bg-sky-500/20 text-sky-400 px-2 py-0.5 text-[10px] font-semibold">
                              PREFILTERED
                            </span>
                          ) : h.prediction.is_anomaly ? (
                            <span className="rounded bg-rose-500/20 text-rose-400 px-2 py-0.5 text-[10px] font-semibold">
                              ANOMALY
                            </span>
                          ) : (
                            <span className="rounded bg-emerald-500/20 text-emerald-400 px-2 py-0.5 text-[10px] font-semibold">
                              NORMAL
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Bottom Step Navigation Footer */}
      <PerformanceStepFooter currentStep="anomaly" />
    </PageContainer>
  );
};
