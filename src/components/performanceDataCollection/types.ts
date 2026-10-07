export interface PerformanceService {
  id: string;
  name: string;
  port: number;
  role: string;
  dependencies: string[];
  status: 'healthy' | 'degraded' | 'offline';
}

export interface CollectionSource {
  name: string;
  endpoint: string;
  purpose: string;
  status: 'connected' | 'not configured';
}

export type ImputationMethod = 'forward_fill' | 'linear_interpolation' | 'zero_fill';

export interface RawTelemetrySample {
  id: string;
  timestamp: string; // Raw unaligned timestamp e.g. "10:00:03.245"
  timestampMs: number;
  serviceId: string;
  cpuMillicores: number | null; // e.g., 450m
  memoryMB: number | null;      // e.g., 512MB
  latencyMs: number | null;     // e.g., 120ms
  requestRateRps: number | null;// e.g., 350 rps
  source: 'prometheus' | 'jaeger' | 'k8s' | 'loki';
  hasScrapeGap?: boolean;
}

export interface GridAlignedSample {
  timeSlot: string;      // Formatted "10:00:00", "10:00:05", etc.
  timestampMs: number;   // Exact 5s grid timestamp
  serviceId: string;
  cpuMillicores: number | null;
  memoryMB: number | null;
  latencyMs: number | null;
  requestRateRps: number | null;
  isMissing: boolean;    // true if no raw sample fell within 5s window
  rawCount: number;      // number of raw samples aggregated into this 5s bucket
}

export interface ImputedSample {
  timeSlot: string;
  timestampMs: number;
  serviceId: string;
  cpuMillicores: number;
  memoryMB: number;
  latencyMs: number;
  requestRateRps: number;
  imputedFields: {
    cpu?: boolean;
    memory?: boolean;
    latency?: boolean;
    requestRate?: boolean;
  };
  imputationMethod: ImputationMethod;
}

export interface MetricBounds {
  min: number;
  max: number;
  unit: string;
}

export interface NormalizationBounds {
  cpuMillicores: MetricBounds;
  memoryMB: MetricBounds;
  latencyMs: MetricBounds;
  requestRateRps: MetricBounds;
}

export interface NormalizedSample {
  timeSlot: string;
  timestampMs: number;
  serviceId: string;
  raw: {
    cpuMillicores: number;
    memoryMB: number;
    latencyMs: number;
    requestRateRps: number;
  };
  normalized: {
    cpuMillicores: number; // 0.0 - 1.0
    memoryMB: number;      // 0.0 - 1.0
    latencyMs: number;     // 0.0 - 1.0
    requestRateRps: number;// 0.0 - 1.0
  };
  imputedFields: {
    cpu?: boolean;
    memory?: boolean;
    latency?: boolean;
    requestRate?: boolean;
  };
  imputationMethod: ImputationMethod;
}

export type PipelineStage = 'raw' | 'grid_aligned' | 'imputed' | 'normalized';