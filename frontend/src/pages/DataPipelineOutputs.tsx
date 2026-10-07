import React, { useState } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Activity, CheckCircle2, Database, Play, RefreshCw, Filter, Sliders, Server } from 'lucide-react';

export const DataPipelineOutputs: React.FC = () => {
  const [selectedService, setSelectedService] = useState('order-service');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedResult, setProcessedResult] = useState<any>(null);

  const mockPipelineRun = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setProcessedResult({
        serviceId: selectedService,
        timestamp: new Date().toISOString(),
        rawInputs: {
          cpuUsageMillicores: 142.5,
          memoryUsageMB: 256.0,
          p95LatencyMs: 48.2,
          p99LatencyMs: 82.1,
          errorCount: 3,
          replicaCount: 3,
        },
        imputedMetrics: {
          missingValuesDetected: 1,
          imputedFields: ['diskIoBytesPerSec'],
          imputationMethod: 'Linear Interpolation + Median Fill',
          confidenceScore: 0.98,
        },
        normalizedFeatures: {
          normalizedCpu: 0.285,
          normalizedMemory: 0.512,
          normalizedLatency: 0.321,
          normalizedErrorRate: 0.03,
          normalizedAvailability: 0.999,
        },
        pipelineStatus: 'COMPLETED_SUCCESSFULLY',
        processedVectors: [0.285, 0.512, 0.321, 0.03, 0.999],
      });
      setIsProcessing(false);
    }, 600);
  };

  return (
    <PageContainer className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-perf">Performance Engine</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Data Pipeline Outputs</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary">
            Inspect raw telemetry preprocessing, missing data imputation, feature scaling, and normalized vector generation feeding into the Scoring Engine.
          </p>
        </div>
        <button
          type="button"
          onClick={mockPipelineRun}
          disabled={isProcessing}
          className="inline-flex items-center gap-2 rounded-md bg-brand-perf px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {isProcessing ? 'Processing Pipeline...' : 'Run Telemetry Pipeline'}
        </button>
      </div>

      {/* Pipeline Stage Architecture Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border bg-surface-secondary/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
              <Filter className="h-4 w-4" /> Stage 1: Imputer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs text-text-secondary">
            <p className="font-medium text-text-primary">Missing Telemetry Imputation (`imputer.py`)</p>
            <p className="text-text-muted">Fills missing Prometheus & Loki data points using rolling median & time-series interpolation.</p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded bg-cyan-400/10 px-2 py-0.5 font-mono text-[10px] text-cyan-400">
              Interpolation: Active
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-secondary/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              <Sliders className="h-4 w-4" /> Stage 2: Normalizer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs text-text-secondary">
            <p className="font-medium text-text-primary">Min-Max & Z-Score Scaling (`normalizer.py`)</p>
            <p className="text-text-muted">Scales raw millicores, latency ms, and replica counts into unified range [0, 1].</p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded bg-emerald-400/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400">
              Scaler: MinMax + Standard
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-secondary/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-perf">
              <Activity className="h-4 w-4" /> Stage 3: Feature Assembly
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs text-text-secondary">
            <p className="font-medium text-text-primary">Scoring & Anomaly Vectors (`pipeline.py`)</p>
            <p className="text-text-muted">Outputs clean feature vectors directly to the Performance Scoring Engine.</p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded bg-brand-perf/10 px-2 py-0.5 font-mono text-[10px] text-brand-perf">
              Target: Scoring Engine
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Target Service Selection */}
      <Card>
        <CardHeader className="border-b border-border/60">
          <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
            <Server className="h-4 w-4 text-brand-perf" /> Select Microservice for Pipeline Processing
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-3">
            {['order-service', 'payment-service', 'user-service', 'api-gateway', 'notification-service'].map((svc) => (
              <button
                key={svc}
                type="button"
                onClick={() => setSelectedService(svc)}
                className={`rounded-md border px-3 py-1.5 font-mono text-xs transition-colors ${
                  selectedService === svc
                    ? 'border-brand-perf bg-brand-perf/15 font-semibold text-brand-perf'
                    : 'border-border bg-surface-secondary/30 text-text-secondary hover:text-text-primary'
                }`}
              >
                {svc}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Processed Pipeline Output Payload */}
      {processedResult ? (
        <Card className="border-brand-perf/40 bg-surface-secondary/20">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="flex items-center justify-between gap-2 text-sm uppercase tracking-wider text-emerald-400">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Telemetry Data Pipeline Execution Output
              </span>
              <span className="font-mono text-xs text-text-muted">{processedResult.timestamp}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-5">
            {/* Before vs After Visual Comparison */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-border bg-background/80 p-4">
                <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
                  <Database className="h-3.5 w-3.5" /> Raw Telemetry Input
                </h4>
                <div className="space-y-1.5 font-mono text-xs text-text-secondary">
                  <div className="flex justify-between"><span>CPU Usage:</span><span>{processedResult.rawInputs.cpuUsageMillicores} m</span></div>
                  <div className="flex justify-between"><span>Memory:</span><span>{processedResult.rawInputs.memoryUsageMB} MB</span></div>
                  <div className="flex justify-between"><span>P95 Latency:</span><span>{processedResult.rawInputs.p95LatencyMs} ms</span></div>
                  <div className="flex justify-between"><span>P99 Latency:</span><span>{processedResult.rawInputs.p99LatencyMs} ms</span></div>
                  <div className="flex justify-between"><span>Error Count:</span><span>{processedResult.rawInputs.errorCount}</span></div>
                </div>
              </div>

              <div className="rounded-md border border-brand-perf/50 bg-background/80 p-4">
                <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  <Sliders className="h-3.5 w-3.5" /> Normalized Feature Vector [0 - 1]
                </h4>
                <div className="space-y-1.5 font-mono text-xs text-emerald-300">
                  <div className="flex justify-between"><span>Norm CPU:</span><span>{processedResult.normalizedFeatures.normalizedCpu}</span></div>
                  <div className="flex justify-between"><span>Norm Memory:</span><span>{processedResult.normalizedFeatures.normalizedMemory}</span></div>
                  <div className="flex justify-between"><span>Norm Latency:</span><span>{processedResult.normalizedFeatures.normalizedLatency}</span></div>
                  <div className="flex justify-between"><span>Norm Error Rate:</span><span>{processedResult.normalizedFeatures.normalizedErrorRate}</span></div>
                  <div className="flex justify-between"><span>Norm Availability:</span><span>{processedResult.normalizedFeatures.normalizedAvailability}</span></div>
                </div>
              </div>
            </div>

            {/* Raw Output Payload JSON */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">Normalized Feature Vector Array</p>
              <div className="flex items-center gap-3 rounded-md border border-border bg-background p-3 font-mono text-xs text-brand-perf">
                <span>Vector:</span>
                <span className="text-emerald-400">[{processedResult.processedVectors.join(', ')}]</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-border/70 p-8 text-center">
          <p className="text-xs text-text-muted">Click <strong>"Run Telemetry Pipeline"</strong> above to execute missing data imputation and normalizer preprocessing on selected microservices.</p>
        </Card>
      )}
    </PageContainer>
  );
};
