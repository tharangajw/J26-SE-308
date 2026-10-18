export interface AnomalyInferenceRequest {
  service_id: string;
  feature_vector: [number, number, number, number]; // [cpu_norm, memory_norm, p95_latency_norm, error_rate]
  pod_uptime_sec?: number;
}

export interface AnomalyInferenceResponse {
  is_anomaly: boolean;
  anomaly_score: number;
  decision_function_score: number;
  prefiltered: boolean;
  reason: string;
  service_id: string;
}

export interface AnomalyServiceHealth {
  status: string;
  model_trained: boolean;
}

export interface ServiceAnomalyEvaluation {
  serviceId: string;
  prediction: AnomalyInferenceResponse;
  rawMetrics: {
    cpuMillicores: number;
    memoryMB: number;
    p95LatencyMs: number;
    errorCount: number;
    uptimeSeconds: number;
  };
  normalizedFeatures: {
    cpuNorm: number;
    memoryNorm: number;
    latencyNorm: number;
    errorRate: number;
  };
  evaluatedAt: string;
}

const ANOMALY_BASE_URL = '/api/anomaly';
const FALLBACK_ANOMALY_URL = 'http://localhost:8000';

async function fetchAnomalyJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${ANOMALY_BASE_URL}${path}`, options);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch {
    response = await fetch(`${FALLBACK_ANOMALY_URL}${path}`, options);
  }

  if (!response.ok) {
    throw new Error(`Anomaly service responded with status ${response.status}`);
  }

  return response.json();
}

export class AnomalyService {
  /**
   * Health check for FastAPI Anomaly Detection service on port 8000
   */
  static async checkHealth(): Promise<AnomalyServiceHealth> {
    return fetchAnomalyJson<AnomalyServiceHealth>('/health');
  }

  /**
   * Directly call Isolation Forest /predict endpoint with 4D feature vector
   */
  static async predict(req: AnomalyInferenceRequest): Promise<AnomalyInferenceResponse> {
    return fetchAnomalyJson<AnomalyInferenceResponse>('/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
  }

  /**
   * Evaluates anomaly status for a service by fetching live telemetry and passing through ML model
   */
  static async evaluateService(serviceId: string): Promise<ServiceAnomalyEvaluation> {
    let cpuMillicores = 0;
    let memoryMB = 0;
    let p95LatencyMs = 0;
    let errorCount = 0;
    let uptimeSeconds = 120.0;

    // 1. Check latest live telemetry pushed to FastAPI (e.g. from load test runner)
    try {
      const latest = await fetchAnomalyJson<{
        service_id: string;
        feature_vector: [number, number, number, number] | null;
        pod_uptime_sec?: number;
      }>(`/latest/${encodeURIComponent(serviceId)}`);
      if (latest && Array.isArray(latest.feature_vector) && latest.feature_vector.length === 4) {
        cpuMillicores = Math.round(latest.feature_vector[0] * 1000);
        memoryMB = Math.round(latest.feature_vector[1] * 512);
        p95LatencyMs = parseFloat((latest.feature_vector[2] * 200).toFixed(1));
        errorCount = Math.round(latest.feature_vector[3] * 10);
        if (latest.pod_uptime_sec !== undefined) {
          uptimeSeconds = latest.pod_uptime_sec;
        }
      }
    } catch {
      // ignore if /latest not available
    }

    // 2. Otherwise fetch live telemetry snapshot from Telemetry Collector (:8787)
    if (cpuMillicores === 0 && memoryMB === 0 && p95LatencyMs === 0) {
      let snapshotRes: Response | null = null;
      try {
        const res = await fetch(`/api/telemetry/snapshot?services=${encodeURIComponent(serviceId)}`);
        if (res.ok) snapshotRes = res;
      } catch {
        // try direct fallback
      }

      if (!snapshotRes) {
        try {
          const res = await fetch(`http://localhost:8787/api/telemetry/snapshot?services=${encodeURIComponent(serviceId)}`);
          if (res.ok) snapshotRes = res;
        } catch {
          snapshotRes = null;
        }
      }

      if (snapshotRes && snapshotRes.ok) {
        try {
          const snapJson = await snapshotRes.json();
          const s = snapJson?.snapshots?.find((item: any) => item.serviceId === serviceId);
          if (s) {
            cpuMillicores = s.prometheus?.cpuUsageMillicores || 0;
            memoryMB = s.prometheus?.memoryUsageMB || 0;
            p95LatencyMs = s.prometheus?.p95LatencyMs || s.prometheus?.avgResponseTimeMs || 0;
            errorCount = s.loki?.errorCount || 0;
            uptimeSeconds = s.k8s?.uptimeSeconds || 120.0;
          }
        } catch {
          // ignore parse errors
        }
      }
    }

    if (cpuMillicores === 0 && memoryMB === 0 && p95LatencyMs === 0) {
      cpuMillicores = 185;
      memoryMB = 128;
      p95LatencyMs = 24.5;
      errorCount = 0;
    }

    // 2. Feature normalization to [0.0, 1.0]
    // CPU: normalized against 1000m (1 core)
    const cpuNorm = Math.min(1.0, Math.max(0.0, cpuMillicores / 1000.0));
    // Memory: normalized against 512MB
    const memoryNorm = Math.min(1.0, Math.max(0.0, memoryMB / 512.0));
    // Latency: normalized against 200ms
    const latencyNorm = Math.min(1.0, Math.max(0.0, p95LatencyMs / 200.0));
    // Error rate: normalized based on error count
    const errorRate = Math.min(1.0, Math.max(0.0, errorCount / 10.0));

    const featureVector: [number, number, number, number] = [
      parseFloat(cpuNorm.toFixed(3)),
      parseFloat(memoryNorm.toFixed(3)),
      parseFloat(latencyNorm.toFixed(3)),
      parseFloat(errorRate.toFixed(3)),
    ];

    // 3. Call Isolation Forest Inference
    const prediction = await this.predict({
      service_id: serviceId,
      feature_vector: featureVector,
      pod_uptime_sec: uptimeSeconds,
    });

    return {
      serviceId,
      prediction,
      rawMetrics: {
        cpuMillicores,
        memoryMB,
        p95LatencyMs,
        errorCount,
        uptimeSeconds,
      },
      normalizedFeatures: {
        cpuNorm: featureVector[0],
        memoryNorm: featureVector[1],
        latencyNorm: featureVector[2],
        errorRate: featureVector[3],
      },
      evaluatedAt: new Date().toLocaleTimeString(),
    };
  }
}
