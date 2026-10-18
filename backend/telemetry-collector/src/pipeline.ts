export interface RawTelemetrySample {
  id: string;
  timestamp: string;
  timestampMs: number;
  serviceId: string;
  cpuMillicores: number | null;
  memoryMB: number | null;
  latencyMs: number | null;
  requestRateRps: number | null;
  source: 'prometheus' | 'jaeger' | 'k8s' | 'loki';
  hasScrapeGap?: boolean;
}

export interface GridAlignedSample {
  timeSlot: string;
  timestampMs: number;
  serviceId: string;
  cpuMillicores: number | null;
  memoryMB: number | null;
  latencyMs: number | null;
  requestRateRps: number | null;
  isMissing: boolean;
  rawCount: number;
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
  imputationMethod: 'linear_interpolation' | 'forward_fill' | 'zero_fill';
}

export interface NormalizationBounds {
  cpuMillicores: { min: number; max: number };
  memoryMB: { min: number; max: number };
  latencyMs: { min: number; max: number };
  requestRateRps: { min: number; max: number };
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
    cpuMillicores: number; // 0.000 - 1.000
    memoryMB: number;      // 0.000 - 1.000
    latencyMs: number;     // 0.000 - 1.000
    requestRateRps: number;// 0.000 - 1.000
  };
  imputedFields: {
    cpu?: boolean;
    memory?: boolean;
    latency?: boolean;
    requestRate?: boolean;
  };
  imputationMethod: string;
}

export const DEFAULT_BOUNDS: NormalizationBounds = {
  cpuMillicores: { min: 0, max: 2000 },
  memoryMB: { min: 0, max: 2048 },
  latencyMs: { min: 0, max: 1000 },
  requestRateRps: { min: 0, max: 1000 }
};

export function generateTelemetrySamples(
  services: string[] = ['api-gateway', 'order-service', 'payment-service'],
  windowMinutes: number = 5,
  gapProbability: number = 0.15
): RawTelemetrySample[] {
  const samples: RawTelemetrySample[] = [];
  const now = Date.now();
  const startTime = now - windowMinutes * 60 * 1000;

  services.forEach((serviceId) => {
    let currentTime = startTime;
    let baseCpu = 250 + Math.random() * 300;
    let baseMem = 400 + Math.random() * 400;
    let baseLat = 40 + Math.random() * 80;
    let baseRps = 150 + Math.random() * 300;

    let sampleIdx = 0;
    while (currentTime <= now) {
      const jitter = (Math.random() - 0.5) * 4500;
      const sampleTime = new Date(currentTime + jitter);
      const isGap = Math.random() < gapProbability;

      baseCpu = Math.max(50, Math.min(1850, baseCpu + (Math.random() - 0.48) * 60));
      baseMem = Math.max(128, Math.min(1900, baseMem + (Math.random() - 0.47) * 40));
      baseLat = Math.max(15, Math.min(950, baseLat + (Math.random() - 0.49) * 25));
      baseRps = Math.max(10, Math.min(950, baseRps + (Math.random() - 0.48) * 50));

      const sources: Array<'prometheus' | 'jaeger' | 'k8s' | 'loki'> = ['prometheus', 'jaeger', 'k8s', 'loki'];
      samples.push({
        id: `raw-${serviceId}-${sampleIdx}`,
        timestamp: sampleTime.toISOString(),
        timestampMs: sampleTime.getTime(),
        serviceId,
        cpuMillicores: isGap ? null : Math.round(baseCpu),
        memoryMB: isGap ? null : Math.round(baseMem),
        latencyMs: isGap ? null : Math.round(baseLat),
        requestRateRps: isGap ? null : Math.round(baseRps),
        source: sources[sampleIdx % sources.length],
        hasScrapeGap: isGap
      });

      currentTime += 4500 + Math.random() * 1500;
      sampleIdx++;
    }
  });

  return samples.sort((a, b) => a.timestampMs - b.timestampMs);
}

export function alignTo5SecondGrid(rawSamples: RawTelemetrySample[], gridIntervalSeconds: number = 5): GridAlignedSample[] {
  if (rawSamples.length === 0) return [];
  const intervalMs = gridIntervalSeconds * 1000;
  const minTs = Math.floor(Math.min(...rawSamples.map((s) => s.timestampMs)) / intervalMs) * intervalMs;
  const maxTs = Math.ceil(Math.max(...rawSamples.map((s) => s.timestampMs)) / intervalMs) * intervalMs;

  const services = Array.from(new Set(rawSamples.map((s) => s.serviceId)));
  const alignedSamples: GridAlignedSample[] = [];

  services.forEach((serviceId) => {
    const serviceRaw = rawSamples.filter((s) => s.serviceId === serviceId);

    for (let gridTs = minTs; gridTs <= maxTs; gridTs += intervalMs) {
      const windowStart = gridTs - intervalMs / 2;
      const windowEnd = gridTs + intervalMs / 2;
      const matchingRaw = serviceRaw.filter((s) => s.timestampMs >= windowStart && s.timestampMs < windowEnd);

      const validCpus = matchingRaw.map((r) => r.cpuMillicores).filter((v): v is number => v !== null);
      const validMems = matchingRaw.map((r) => r.memoryMB).filter((v): v is number => v !== null);
      const validLats = matchingRaw.map((r) => r.latencyMs).filter((v): v is number => v !== null);
      const validRps  = matchingRaw.map((r) => r.requestRateRps).filter((v): v is number => v !== null);

      const isMissing = matchingRaw.length === 0 || (validCpus.length === 0 && validMems.length === 0);

      const formatTimeSlot = (tsMs: number) => new Date(tsMs).toTimeString().split(' ')[0];

      alignedSamples.push({
        timeSlot: formatTimeSlot(gridTs),
        timestampMs: gridTs,
        serviceId,
        cpuMillicores: validCpus.length > 0 ? Math.round(validCpus.reduce((a, b) => a + b, 0) / validCpus.length) : null,
        memoryMB: validMems.length > 0 ? Math.round(validMems.reduce((a, b) => a + b, 0) / validMems.length) : null,
        latencyMs: validLats.length > 0 ? Math.round(validLats.reduce((a, b) => a + b, 0) / validLats.length) : null,
        requestRateRps: validRps.length > 0 ? Math.round(validRps.reduce((a, b) => a + b, 0) / validRps.length) : null,
        isMissing,
        rawCount: matchingRaw.length
      });
    }
  });

  return alignedSamples.sort((a, b) => a.timestampMs - b.timestampMs);
}

export function applyImputation(
  gridSamples: GridAlignedSample[],
  method: 'linear_interpolation' | 'forward_fill' | 'zero_fill' = 'linear_interpolation'
): ImputedSample[] {
  const services = Array.from(new Set(gridSamples.map((s) => s.serviceId)));
  const imputedResults: ImputedSample[] = [];

  services.forEach((serviceId) => {
    const serviceGrid = gridSamples
      .filter((s) => s.serviceId === serviceId)
      .sort((a, b) => a.timestampMs - b.timestampMs);

    const n = serviceGrid.length;
    const cpus: Array<{ val: number; imputed: boolean }> = new Array(n);
    const mems: Array<{ val: number; imputed: boolean }> = new Array(n);
    const lats: Array<{ val: number; imputed: boolean }> = new Array(n);
    const rps : Array<{ val: number; imputed: boolean }> = new Array(n);

    const imputeSeries = (
      getVal: (item: GridAlignedSample) => number | null,
      targetArr: Array<{ val: number; imputed: boolean }>,
      fallback: number
    ) => {
      const rawVals = serviceGrid.map(getVal);

      for (let i = 0; i < n; i++) {
        if (rawVals[i] !== null) {
          targetArr[i] = { val: rawVals[i]!, imputed: false };
        } else {
          if (method === 'zero_fill') {
            targetArr[i] = { val: 0, imputed: true };
          } else if (method === 'forward_fill') {
            let lastValid = fallback;
            for (let k = i - 1; k >= 0; k--) {
              if (rawVals[k] !== null) {
                lastValid = rawVals[k]!;
                break;
              }
            }
            targetArr[i] = { val: lastValid, imputed: true };
          } else {
            let prevIdx = -1;
            for (let k = i - 1; k >= 0; k--) {
              if (rawVals[k] !== null) { prevIdx = k; break; }
            }
            let nextIdx = -1;
            for (let k = i + 1; k < n; k++) {
              if (rawVals[k] !== null) { nextIdx = k; break; }
            }

            if (prevIdx !== -1 && nextIdx !== -1) {
              const prevVal = rawVals[prevIdx]!;
              const nextVal = rawVals[nextIdx]!;
              const prevTs = serviceGrid[prevIdx].timestampMs;
              const nextTs = serviceGrid[nextIdx].timestampMs;
              const currTs = serviceGrid[i].timestampMs;
              const interp = prevVal + ((nextVal - prevVal) * (currTs - prevTs)) / (nextTs - prevTs);
              targetArr[i] = { val: Math.round(interp), imputed: true };
            } else if (prevIdx !== -1) {
              targetArr[i] = { val: rawVals[prevIdx]!, imputed: true };
            } else if (nextIdx !== -1) {
              targetArr[i] = { val: rawVals[nextIdx]!, imputed: true };
            } else {
              targetArr[i] = { val: fallback, imputed: true };
            }
          }
        }
      }
    };

    imputeSeries((s) => s.cpuMillicores, cpus, 250);
    imputeSeries((s) => s.memoryMB, mems, 512);
    imputeSeries((s) => s.latencyMs, lats, 50);
    imputeSeries((s) => s.requestRateRps, rps, 100);

    for (let i = 0; i < n; i++) {
      const g = serviceGrid[i];
      imputedResults.push({
        timeSlot: g.timeSlot,
        timestampMs: g.timestampMs,
        serviceId: g.serviceId,
        cpuMillicores: cpus[i].val,
        memoryMB: mems[i].val,
        latencyMs: lats[i].val,
        requestRateRps: rps[i].val,
        imputedFields: {
          cpu: cpus[i].imputed,
          memory: mems[i].imputed,
          latency: lats[i].imputed,
          requestRate: rps[i].imputed
        },
        imputationMethod: method
      });
    }
  });

  return imputedResults.sort((a, b) => a.timestampMs - b.timestampMs);
}

export function applyMinMaxNormalization(
  imputedSamples: ImputedSample[],
  bounds: NormalizationBounds = DEFAULT_BOUNDS
): NormalizedSample[] {
  const clamp = (val: number) => Math.max(0, Math.min(1, val));
  const norm = (val: number, b: { min: number; max: number }) => {
    if (b.max <= b.min) return 0;
    return Number(clamp((val - b.min) / (b.max - b.min)).toFixed(3));
  };

  return imputedSamples.map((s) => ({
    timeSlot: s.timeSlot,
    timestampMs: s.timestampMs,
    serviceId: s.serviceId,
    raw: {
      cpuMillicores: s.cpuMillicores,
      memoryMB: s.memoryMB,
      latencyMs: s.latencyMs,
      requestRateRps: s.requestRateRps
    },
    normalized: {
      cpuMillicores: norm(s.cpuMillicores, bounds.cpuMillicores),
      memoryMB: norm(s.memoryMB, bounds.memoryMB),
      latencyMs: norm(s.latencyMs, bounds.latencyMs),
      requestRateRps: norm(s.requestRateRps, bounds.requestRateRps)
    },
    imputedFields: s.imputedFields,
    imputationMethod: s.imputationMethod
  }));
}
