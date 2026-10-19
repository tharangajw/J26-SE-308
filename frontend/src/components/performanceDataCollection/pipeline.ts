import type {
  GridAlignedSample,
  ImputedSample,
  ImputationMethod,
  NormalizationBounds,
  NormalizedSample,
  RawTelemetrySample
} from './types';

export const DEFAULT_NORMALIZATION_BOUNDS: NormalizationBounds = {
  cpuMillicores: { min: 0, max: 2000, unit: 'm' },     // 0 - 2000 millicores (2 Cores)
  memoryMB: { min: 0, max: 2048, unit: 'MB' },        // 0 - 2048 MB (2 GB)
  latencyMs: { min: 0, max: 1000, unit: 'ms' },       // 0 - 1000 ms
  requestRateRps: { min: 0, max: 1000, unit: 'rps' } // 0 - 1000 requests/sec
};

/**
 * Step 0: Fetch real heterogeneous telemetry samples from the backend Telemetry Collector (:8787).
 * Zero Math.random() or synthetic mock generation.
 */
export async function fetchRealTelemetrySamples(
  services: string[] = [],
  imputationMethod: ImputationMethod = 'linear_interpolation'
): Promise<RawTelemetrySample[]> {
  const queryServices = services.filter(Boolean).join(',');
  const queryParam = queryServices ? `services=${encodeURIComponent(queryServices)}&` : '';
  const urls = [
    `/api/telemetry/normalized?${queryParam}imputation=${encodeURIComponent(imputationMethod)}`,
    `http://localhost:8787/api/telemetry/normalized?${queryParam}imputation=${encodeURIComponent(imputationMethod)}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const body = await res.json();
      if (Array.isArray(body?.rawSamples) && body.rawSamples.length > 0) {
        return body.rawSamples as RawTelemetrySample[];
      }
      if (Array.isArray(body?.dataset) && body.dataset.length > 0) {
        return (body.dataset as NormalizedSample[]).map((item, idx) => ({
          id: `real-${item.serviceId}-${item.timestampMs || idx}`,
          timestamp: new Date(item.timestampMs || Date.now()).toISOString(),
          timestampMs: item.timestampMs || Date.now(),
          serviceId: item.serviceId,
          cpuMillicores: item.imputedFields?.cpu ? null : item.raw.cpuMillicores,
          memoryMB: item.imputedFields?.memory ? null : item.raw.memoryMB,
          latencyMs: item.imputedFields?.latency ? null : item.raw.latencyMs,
          requestRateRps: item.imputedFields?.requestRate ? null : item.raw.requestRateRps,
          source: 'prometheus',
          hasScrapeGap: Boolean(
            item.imputedFields?.cpu ||
              item.imputedFields?.memory ||
              item.imputedFields?.latency ||
              item.imputedFields?.requestRate
          ),
        }));
      }
    } catch {
      // try next URL
    }
  }

  return [];
}

/**
 * Step 1: Timestamp Grid Alignment (5-Second Time Window Grid)
 * Snaps unaligned timestamps into strict 5-second interval buckets: t_0, t_0+5s, t_0+10s...
 */
export function alignTo5SecondGrid(
  rawSamples: RawTelemetrySample[],
  gridIntervalSeconds: number = 5
): GridAlignedSample[] {
  if (rawSamples.length === 0) return [];

  const intervalMs = gridIntervalSeconds * 1000;
  
  // Find min and max timestamp bounds rounded to 5s grid
  const minTs = Math.floor(Math.min(...rawSamples.map((s) => s.timestampMs)) / intervalMs) * intervalMs;
  const maxTs = Math.ceil(Math.max(...rawSamples.map((s) => s.timestampMs)) / intervalMs) * intervalMs;

  const services = Array.from(new Set(rawSamples.map((s) => s.serviceId)));
  const alignedSamples: GridAlignedSample[] = [];

  services.forEach((serviceId) => {
    const serviceRaw = rawSamples.filter((s) => s.serviceId === serviceId);

    for (let gridTs = minTs; gridTs <= maxTs; gridTs += intervalMs) {
      // Find all raw samples falling into [gridTs - 2.5s, gridTs + 2.5s)
      const windowStart = gridTs - intervalMs / 2;
      const windowEnd = gridTs + intervalMs / 2;

      const matchingRaw = serviceRaw.filter(
        (s) => s.timestampMs >= windowStart && s.timestampMs < windowEnd
      );

      const validCpus = matchingRaw.map((r) => r.cpuMillicores).filter((v): v is number => v !== null);
      const validMems = matchingRaw.map((r) => r.memoryMB).filter((v): v is number => v !== null);
      const validLats = matchingRaw.map((r) => r.latencyMs).filter((v): v is number => v !== null);
      const validRps  = matchingRaw.map((r) => r.requestRateRps).filter((v): v is number => v !== null);

      const isMissing = matchingRaw.length === 0 || (validCpus.length === 0 && validMems.length === 0);

      const formatTimeSlot = (tsMs: number) => {
        const d = new Date(tsMs);
        return d.toTimeString().split(' ')[0]; // "10:00:05"
      };

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

/**
 * Step 2: Imputation Service
 * Fills Prometheus scrape gaps / missing 5s grid slots using:
 *  - Forward-Fill (LOCF - Last Observation Carried Forward)
 *  - Linear Interpolation
 *  - Zero Fill
 */
export function applyImputation(
  gridSamples: GridAlignedSample[],
  method: ImputationMethod = 'linear_interpolation'
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

    // Helper for metric imputation across time series array
    const imputeMetricSeries = (
      getVal: (item: GridAlignedSample) => number | null,
      targetArr: Array<{ val: number; imputed: boolean }>,
      fallbackDefault: number
    ) => {
      const rawVals = serviceGrid.map(getVal);

      for (let i = 0; i < n; i++) {
        if (rawVals[i] !== null) {
          targetArr[i] = { val: rawVals[i]!, imputed: false };
        } else {
          // Needs imputation
          if (method === 'zero_fill') {
            targetArr[i] = { val: 0, imputed: true };
          } else if (method === 'forward_fill') {
            // Find last known valid observation
            let lastValid = fallbackDefault;
            for (let k = i - 1; k >= 0; k--) {
              if (rawVals[k] !== null) {
                lastValid = rawVals[k]!;
                break;
              }
            }
            targetArr[i] = { val: lastValid, imputed: true };
          } else {
            // Linear Interpolation
            let prevIdx = -1;
            for (let k = i - 1; k >= 0; k--) {
              if (rawVals[k] !== null) {
                prevIdx = k;
                break;
              }
            }

            let nextIdx = -1;
            for (let k = i + 1; k < n; k++) {
              if (rawVals[k] !== null) {
                nextIdx = k;
                break;
              }
            }

            if (prevIdx !== -1 && nextIdx !== -1) {
              const prevVal = rawVals[prevIdx]!;
              const nextVal = rawVals[nextIdx]!;
              const prevTs = serviceGrid[prevIdx].timestampMs;
              const nextTs = serviceGrid[nextIdx].timestampMs;
              const currTs = serviceGrid[i].timestampMs;

              const interpolated = prevVal + ((nextVal - prevVal) * (currTs - prevTs)) / (nextTs - prevTs);
              targetArr[i] = { val: Math.round(interpolated), imputed: true };
            } else if (prevIdx !== -1) {
              targetArr[i] = { val: rawVals[prevIdx]!, imputed: true };
            } else if (nextIdx !== -1) {
              targetArr[i] = { val: rawVals[nextIdx]!, imputed: true };
            } else {
              targetArr[i] = { val: fallbackDefault, imputed: true };
            }
          }
        }
      }
    };

    imputeMetricSeries((s) => s.cpuMillicores, cpus, 250);
    imputeMetricSeries((s) => s.memoryMB, mems, 512);
    imputeMetricSeries((s) => s.latencyMs, lats, 50);
    imputeMetricSeries((s) => s.requestRateRps, rps, 100);

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

/**
 * Step 3: 0–1 Min-Max Normalization Service
 * Transforms heterogeneous metric units (Millicores, MB, ms, rps) into normalized 0.0 - 1.0 range:
 * normalized = clamp( (x - min) / (max - min), 0.0, 1.0 )
 */
export function applyMinMaxNormalization(
  imputedSamples: ImputedSample[],
  bounds: NormalizationBounds = DEFAULT_NORMALIZATION_BOUNDS
): NormalizedSample[] {
  const clamp = (val: number) => Math.max(0, Math.min(1, val));

  const normalizeValue = (val: number, b: { min: number; max: number }) => {
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
      cpuMillicores: normalizeValue(s.cpuMillicores, bounds.cpuMillicores),
      memoryMB: normalizeValue(s.memoryMB, bounds.memoryMB),
      latencyMs: normalizeValue(s.latencyMs, bounds.latencyMs),
      requestRateRps: normalizeValue(s.requestRateRps, bounds.requestRateRps)
    },
    imputedFields: s.imputedFields,
    imputationMethod: s.imputationMethod
  }));
}
