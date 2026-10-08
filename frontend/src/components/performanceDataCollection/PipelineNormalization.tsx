import React, { useState, useMemo } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  Clock,
  Database,
  Filter,
  Layers,
  RefreshCw,
  Sliders,
  Sparkles,
  Zap
} from 'lucide-react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import {
  alignTo5SecondGrid,
  applyImputation,
  applyMinMaxNormalization,
  DEFAULT_NORMALIZATION_BOUNDS,
  generateMockRawTelemetry
} from './pipeline';
import type { ImputationMethod, NormalizationBounds } from './types';

const tooltipStyle = {
  backgroundColor: 'var(--color-surface)',
  borderColor: 'var(--color-border)',
  borderRadius: '6px',
  fontSize: '12px'
};

const axisStyle = {
  fill: 'var(--color-text-muted)',
  fontSize: 10,
  fontFamily: 'var(--font-mono)'
};

export const PipelineNormalization: React.FC = () => {
  const [selectedService, setSelectedService] = useState<string>('api-gateway');
  const [imputationMethod, setImputationMethod] = useState<ImputationMethod>('linear_interpolation');
  const [gapProbability, setGapProbability] = useState<number>(0.15);
  const [activeStage, setActiveStage] = useState<'all' | 'raw' | 'grid' | 'imputed' | 'normalized'>('all');
  const [bounds, setBounds] = useState<NormalizationBounds>(DEFAULT_NORMALIZATION_BOUNDS);
  const [seed, setSeed] = useState<number>(1);

  // 1. Generate Raw Heterogeneous Telemetry Data
  const rawData = useMemo(() => {
    return generateMockRawTelemetry(['api-gateway', 'order-service', 'payment-service'], 6, gapProbability);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, gapProbability]);

  // 2. Align to 5-Second Grid
  const gridAlignedData = useMemo(() => {
    return alignTo5SecondGrid(rawData, 5);
  }, [rawData]);

  // 3. Impute Missing Scrape Gaps
  const imputedData = useMemo(() => {
    return applyImputation(gridAlignedData, imputationMethod);
  }, [gridAlignedData, imputationMethod]);

  // 4. Apply 0–1 Min-Max Normalization
  const normalizedData = useMemo(() => {
    return applyMinMaxNormalization(imputedData, bounds);
  }, [imputedData, bounds]);

  // Filtered dataset for selected service
  const filteredNormalized = useMemo(() => {
    return normalizedData.filter((d) => d.serviceId === selectedService);
  }, [normalizedData, selectedService]);

  const filteredRaw = useMemo(() => {
    return rawData.filter((d) => d.serviceId === selectedService);
  }, [rawData, selectedService]);

  const missingCount = useMemo(() => {
    return gridAlignedData.filter((d) => d.serviceId === selectedService && d.isMissing).length;
  }, [gridAlignedData, selectedService]);

  const handleRegenerate = () => {
    setSeed((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header & Pipeline Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-brand-perf/30 bg-brand-perf/5 p-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand-perf" />
            <h2 className="text-lg font-semibold text-text-primary">Phase 2: Preprocessing & Normalization Pipeline</h2>
          </div>
          <p className="text-xs text-text-secondary">
            Aligns heterogeneous metrics to a uniform 5-second grid, imputes missing scrapes, and normalizes values to 0.0 – 1.0.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRegenerate}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary"
          >
            <RefreshCw className="h-3.5 w-3.5 text-brand-perf" /> Regenerate Scrape Stream
          </button>
        </div>
      </div>

      {/* Pipeline Stepper */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          onClick={() => setActiveStage(activeStage === 'raw' ? 'all' : 'raw')}
          className={`cursor-pointer transition-all ${
            activeStage === 'raw' ? 'ring-2 ring-amber-400 bg-amber-400/5' : 'hover:border-border/80'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">1. Heterogeneous Raw</span>
              <Database className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 font-mono text-lg font-bold text-text-primary">
              {filteredRaw.length} <span className="text-xs font-normal text-text-muted">samples</span>
            </div>
            <p className="mt-1 text-[11px] text-text-muted">Raw Millicores, MB, ms & rps with random timestamp jitter.</p>
          </CardContent>
        </Card>

        <Card
          onClick={() => setActiveStage(activeStage === 'grid' ? 'all' : 'grid')}
          className={`cursor-pointer transition-all ${
            activeStage === 'grid' ? 'ring-2 ring-cyan-400 bg-cyan-400/5' : 'hover:border-border/80'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">2. 5s Grid Alignment</span>
              <Clock className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-2 font-mono text-lg font-bold text-text-primary">
              5s <span className="text-xs font-normal text-text-muted">time window</span>
            </div>
            <p className="mt-1 text-[11px] text-text-muted">
              Snapped to 5-second intervals. Found <span className="font-semibold text-rose-400">{missingCount} missing slots</span>.
            </p>
          </CardContent>
        </Card>

        <Card
          onClick={() => setActiveStage(activeStage === 'imputed' ? 'all' : 'imputed')}
          className={`cursor-pointer transition-all ${
            activeStage === 'imputed' ? 'ring-2 ring-indigo-400 bg-indigo-400/5' : 'hover:border-border/80'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">3. Imputation Service</span>
              <Filter className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="mt-2 font-mono text-lg font-bold text-text-primary capitalize">
              {imputationMethod.replace('_', ' ')}
            </div>
            <p className="mt-1 text-[11px] text-text-muted">Reconstructs missing Prometheus scrape points without bias.</p>
          </CardContent>
        </Card>

        <Card
          onClick={() => setActiveStage(activeStage === 'normalized' ? 'all' : 'normalized')}
          className={`cursor-pointer transition-all ${
            activeStage === 'normalized' ? 'ring-2 ring-emerald-400 bg-emerald-400/5' : 'hover:border-border/80'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">4. Min-Max (0–1)</span>
              <BarChart2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 font-mono text-lg font-bold text-emerald-400">0.000 – 1.000</div>
            <p className="mt-1 text-[11px] text-text-muted">All metric dimensions transformed into unitless standard scale.</p>
          </CardContent>
        </Card>
      </div>

      {/* Control Configuration Panel */}
      <Card>
        <CardHeader className="border-b border-border/60 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
              <Sliders className="h-4 w-4 text-brand-perf" /> Pipeline Configuration & Controls
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Active Target Service:</span>
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="rounded-md border border-border bg-surface-secondary/40 px-3 py-1 font-mono text-xs text-text-primary outline-none focus:ring-1 focus:ring-brand-perf"
              >
                <option value="api-gateway">api-gateway</option>
                <option value="order-service">order-service</option>
                <option value="payment-service">payment-service</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 pt-5 md:grid-cols-3">
          {/* Imputation Mode Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Imputation Algorithm
            </label>
            <div className="space-y-1.5">
              {(['linear_interpolation', 'forward_fill', 'zero_fill'] as ImputationMethod[]).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setImputationMethod(method)}
                  className={`flex w-full items-center justify-between rounded-md border p-2.5 text-xs transition-colors ${
                    imputationMethod === method
                      ? 'border-brand-perf bg-brand-perf/10 font-medium text-brand-perf'
                      : 'border-border bg-surface-secondary/20 text-text-secondary hover:bg-surface-secondary/50'
                  }`}
                >
                  <span className="capitalize">{method.replace('_', ' ')}</span>
                  {imputationMethod === method && <CheckCircle2 className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          </div>

          {/* Scrape Gap Simulation */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Simulated Scrape Gap Rate
              </label>
              <span className="font-mono text-xs font-bold text-amber-400">{Math.round(gapProbability * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="0.4"
              step="0.05"
              value={gapProbability}
              onChange={(e) => setGapProbability(parseFloat(e.target.value))}
              className="w-full accent-brand-perf"
            />
            <p className="text-[11px] text-text-muted leading-relaxed">
              Adjusts the probability of missing Prometheus metric scrapes to evaluate how effectively the imputation engine fills timestamp gaps.
            </p>
          </div>

          {/* Normalization Bounds Inspector */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              0–1 Max Scaling Bounds
            </label>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="rounded border border-border/60 bg-surface-secondary/30 p-2">
                <span className="block text-[10px] uppercase text-text-muted">CPU Max (m)</span>
                <input
                  type="number"
                  value={bounds.cpuMillicores.max}
                  onChange={(e) => setBounds(b => ({ ...b, cpuMillicores: { ...b.cpuMillicores, max: Number(e.target.value) || 1000 } }))}
                  className="mt-1 w-full rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-brand-perf outline-none"
                />
              </div>
              <div className="rounded border border-border/60 bg-surface-secondary/30 p-2">
                <span className="block text-[10px] uppercase text-text-muted">Mem Max (MB)</span>
                <input
                  type="number"
                  value={bounds.memoryMB.max}
                  onChange={(e) => setBounds(b => ({ ...b, memoryMB: { ...b.memoryMB, max: Number(e.target.value) || 1024 } }))}
                  className="mt-1 w-full rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-cyan-400 outline-none"
                />
              </div>
              <div className="rounded border border-border/60 bg-surface-secondary/30 p-2">
                <span className="block text-[10px] uppercase text-text-muted">Latency Max (ms)</span>
                <input
                  type="number"
                  value={bounds.latencyMs.max}
                  onChange={(e) => setBounds(b => ({ ...b, latencyMs: { ...b.latencyMs, max: Number(e.target.value) || 1000 } }))}
                  className="mt-1 w-full rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-rose-400 outline-none"
                />
              </div>
              <div className="rounded border border-border/60 bg-surface-secondary/30 p-2">
                <span className="block text-[10px] uppercase text-text-muted">RPS Max</span>
                <input
                  type="number"
                  value={bounds.requestRateRps.max}
                  onChange={(e) => setBounds(b => ({ ...b, requestRateRps: { ...b.requestRateRps, max: Number(e.target.value) || 1000 } }))}
                  className="mt-1 w-full rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-amber-400 outline-none"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visualization Comparison Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Chart 1: Raw Heterogeneous Metrics (Before Normalization) */}
        <Card>
          <CardHeader className="border-b border-border/60 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-amber-400">
                <Activity className="h-4 w-4" /> Raw Heterogeneous Telemetry ({selectedService})
              </CardTitle>
              <span className="rounded bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] text-amber-400">
                Mixed Units (m, MB, ms, rps)
              </span>
            </div>
          </CardHeader>
          <CardContent className="h-[280px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredNormalized} margin={{ top: 8, right: 12, left: -15, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="timeSlot" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="raw.cpuMillicores"
                  name="CPU (m)"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="raw.memoryMB"
                  name="Mem (MB)"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="raw.latencyMs"
                  name="Latency (ms)"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chart 2: 0-1 Normalized Dataset (After Preprocessing) */}
        <Card>
          <CardHeader className="border-b border-border/60 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-emerald-400">
                <Zap className="h-4 w-4" /> 0.0 – 1.0 Normalized Dataset ({selectedService})
              </CardTitle>
              <span className="rounded bg-emerald-400/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400">
                Normalized [0.0 - 1.0]
              </span>
            </div>
          </CardHeader>
          <CardContent className="h-[280px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filteredNormalized} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="timeSlot" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 1]} tick={axisStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="normalized.cpuMillicores"
                  name="CPU Norm"
                  stroke="#f97316"
                  fill="#f97316"
                  fillOpacity={0.15}
                />
                <Area
                  type="monotone"
                  dataKey="normalized.memoryMB"
                  name="Mem Norm"
                  stroke="#06b6d4"
                  fill="#06b6d4"
                  fillOpacity={0.15}
                />
                <Area
                  type="monotone"
                  dataKey="normalized.latencyMs"
                  name="Latency Norm"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.15}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Step-by-Step Telemetry Grid Table */}
      <Card>
        <CardHeader className="border-b border-border/60 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
                <Layers className="h-4 w-4 text-brand-perf" /> Preprocessed 5-Second Telemetry Dataset
              </CardTitle>
              <p className="mt-1 text-xs text-text-muted">
                Inspect how each 5-second time window converts raw heterogeneous metrics into imputed & normalized values.
              </p>
            </div>
            <span className="font-mono text-xs text-brand-perf">
              Service: <span className="font-bold">{selectedService}</span>
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-border/60 text-[11px] uppercase tracking-wider text-text-muted">
                  <th className="pb-3 pt-1">Time (5s Grid)</th>
                  <th className="pb-3 pt-1">CPU (Raw / Norm)</th>
                  <th className="pb-3 pt-1">Memory (Raw / Norm)</th>
                  <th className="pb-3 pt-1">Latency (Raw / Norm)</th>
                  <th className="pb-3 pt-1">Throughput (Raw / Norm)</th>
                  <th className="pb-3 pt-1 text-right">Imputation Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredNormalized.slice(0, 15).map((row, idx) => {
                  const isAnyImputed = Object.values(row.imputedFields).some(Boolean);
                  return (
                    <tr
                      key={`${row.timeSlot}-${idx}`}
                      className={`transition-colors hover:bg-surface-secondary/40 ${
                        isAnyImputed ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      <td className="py-2.5 font-semibold text-text-primary">{row.timeSlot}</td>

                      {/* CPU */}
                      <td className="py-2.5">
                        <span className="text-text-secondary">{row.raw.cpuMillicores}m</span>
                        <ArrowRight className="mx-1 inline h-3 w-3 text-text-muted" />
                        <span className="font-bold text-brand-perf">{row.normalized.cpuMillicores}</span>
                      </td>

                      {/* Memory */}
                      <td className="py-2.5">
                        <span className="text-text-secondary">{row.raw.memoryMB}MB</span>
                        <ArrowRight className="mx-1 inline h-3 w-3 text-text-muted" />
                        <span className="font-bold text-cyan-400">{row.normalized.memoryMB}</span>
                      </td>

                      {/* Latency */}
                      <td className="py-2.5">
                        <span className="text-text-secondary">{row.raw.latencyMs}ms</span>
                        <ArrowRight className="mx-1 inline h-3 w-3 text-text-muted" />
                        <span className="font-bold text-rose-400">{row.normalized.latencyMs}</span>
                      </td>

                      {/* RPS */}
                      <td className="py-2.5">
                        <span className="text-text-secondary">{row.raw.requestRateRps}rps</span>
                        <ArrowRight className="mx-1 inline h-3 w-3 text-text-muted" />
                        <span className="font-bold text-amber-400">{row.normalized.requestRateRps}</span>
                      </td>

                      {/* Imputation Tag */}
                      <td className="py-2.5 text-right">
                        {isAnyImputed ? (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                            Imputed ({row.imputationMethod.replace('_', ' ')})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> Scraped
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
    </div>
  );
};
