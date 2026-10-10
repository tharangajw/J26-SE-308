export interface TelemetryData {
  metrics: {
    cpuUsage: number;
    memoryUsage: number;
    requestCount: number;
  };
  logs: {
    errorCount: number;
    recentErrors: string[];
  };
  traces: {
    latency: number;
    errorRate: number;
    serviceCount: number;
  };
  sources: {
    prometheus: boolean;
    loki: boolean;
    jaeger: boolean;
  };
  lastUpdated: string;
}

// Removed unused variables

export class TelemetryService {
  static async getCombinedTelemetry(): Promise<TelemetryData> {
    try {
      const response = await fetch('/api/telemetry/live');
      if (!response.ok) {
        throw new Error(`Failed to fetch live telemetry: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.warn('Backend telemetry fetch failed.', error);
      return {
        metrics: { cpuUsage: 0, memoryUsage: 0, requestCount: 0 },
        logs: { errorCount: 0, recentErrors: [] },
        traces: { latency: 0, errorRate: 0, serviceCount: 0 },
        sources: { prometheus: false, loki: false, jaeger: false },
        lastUpdated: new Date().toISOString()
      };
    }
  }
}
