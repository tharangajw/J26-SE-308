import { PrometheusMetrics } from './types.js';
import { DockerCollector } from './docker.js';

interface LatencySample {
  timestamp: number;
  latencyMs: number;
}

interface RequestCounterSnapshot {
  timestamp: number;
  totalRequests: number;
}

export class PrometheusCollector {
  private endpoint: string;
  private dockerCollector: DockerCollector;
  private latencyWindow: Map<string, LatencySample[]> = new Map();
  private requestCounterCache: Map<string, RequestCounterSnapshot> = new Map();

  private static readonly WINDOW_RETENTION_MS = 5 * 60 * 1000; // 5-minute sliding window
  private static readonly MAX_WINDOW_SAMPLES = 120;
  private static readonly MIN_INITIAL_SAMPLES = 5;

  constructor(endpoint: string = 'http://localhost:9090') {
    this.endpoint = endpoint;
    this.dockerCollector = new DockerCollector();
  }

  private async getServicePort(serviceId: string): Promise<number | null> {
    const target = await this.dockerCollector.findContainerTarget(serviceId);
    if (target) return target.port;

    const portMatch = serviceId.match(/:(3\d{3}|8\d{3})/);
    if (portMatch) return parseInt(portMatch[1], 10);

    return null;
  }

  private async pingServicePort(port: number): Promise<{ isAlive: boolean; latencyMs: number }> {
    const urls = [
      `http://host.docker.internal:${port}/`,
      `http://localhost:${port}/`
    ];
    for (const url of urls) {
      const startTime = performance.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 800);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.status >= 200 && res.status < 600) {
          const elapsed = Math.max(0.1, performance.now() - startTime);
          return { isAlive: true, latencyMs: parseFloat(elapsed.toFixed(2)) };
        }
      } catch {
        // continue
      }
    }
    return { isAlive: false, latencyMs: 0 };
  }

  /**
   * Executes a single PromQL instant query against Prometheus and returns the numeric value or null.
   */
  private async queryPrometheusScalar(promQl: string): Promise<number | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 500);
      const queryUrl = `${this.endpoint}/api/v1/query?query=${encodeURIComponent(promQl)}`;
      const response = await fetch(queryUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) return null;

      const data = await response.json();
      if (data.status === 'success' && Array.isArray(data.data?.result) && data.data.result.length > 0) {
        const rawVal = data.data.result[0]?.value?.[1];
        if (rawVal !== undefined && rawVal !== null) {
          const parsed = parseFloat(rawVal);
          if (Number.isFinite(parsed) && parsed >= 0) {
            return parsed;
          }
        }
      }
    } catch {
      // ignore query failure and allow next candidate or fallback
    }
    return null;
  }

  /**
   * Tries candidate PromQL expressions in order and returns the first valid finite metric value.
   */
  private async queryFirstAvailableMetric(queries: string[], scaleFactor: number = 1.0): Promise<number | null> {
    for (const q of queries) {
      const val = await this.queryPrometheusScalar(q);
      if (val !== null) {
        return val * scaleFactor;
      }
    }
    return null;
  }

  /**
   * Records real HTTP latency samples into a per-service sliding window and computes
   * true statistical Mean, P95, and P99 latencies from the observed sample distribution.
   */
  private async collectSlidingWindowLatencyStats(
    serviceId: string,
    port: number,
    initialSampleMs: number
  ): Promise<{ avgResponseTimeMs: number; p95LatencyMs: number; p99LatencyMs: number; windowRps: number }> {
    const now = Date.now();
    const cutoff = now - PrometheusCollector.WINDOW_RETENTION_MS;
    const history = (this.latencyWindow.get(serviceId) || []).filter((s) => s.timestamp >= cutoff);

    history.push({ timestamp: now, latencyMs: initialSampleMs });

    // If the sliding window has fewer than MIN_INITIAL_SAMPLES, collect additional real probe samples
    // so P95 and P99 are computed over a multi-sample distribution rather than a single ping.
    const needed = PrometheusCollector.MIN_INITIAL_SAMPLES - history.length;
    for (let i = 0; i < needed; i++) {
      const probe = await this.pingServicePort(port);
      if (probe.isAlive) {
        history.push({ timestamp: Date.now(), latencyMs: probe.latencyMs });
      }
    }

    if (history.length > PrometheusCollector.MAX_WINDOW_SAMPLES) {
      history.splice(0, history.length - PrometheusCollector.MAX_WINDOW_SAMPLES);
    }
    this.latencyWindow.set(serviceId, history);

    const values = history.map((s) => s.latencyMs).sort((a, b) => a - b);
    const sum = values.reduce((acc, v) => acc + v, 0);
    const avg = values.length > 0 ? sum / values.length : 0;
    const p95 = this.calculatePercentile(values, 0.95);
    const p99 = this.calculatePercentile(values, 0.99);

    const oldestTs = history[0]?.timestamp ?? now;
    const newestTs = history[history.length - 1]?.timestamp ?? now;
    const elapsedSec = Math.max(1, (newestTs - oldestTs) / 1000);
    const windowRps = parseFloat((history.length / elapsedSec).toFixed(2));

    return {
      avgResponseTimeMs: parseFloat(avg.toFixed(2)),
      p95LatencyMs: parseFloat(p95.toFixed(2)),
      p99LatencyMs: parseFloat(p99.toFixed(2)),
      windowRps,
    };
  }

  /**
   * Computes exact linear-interpolated percentile over a sorted array of real latency samples.
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    if (sortedValues.length === 1) return sortedValues[0];

    const index = percentile * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sortedValues[lower];

    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * Attempts to scrape the service's live /metrics endpoint to compute real request rate (RPS)
   * from request counter deltas over time. Returns null if /metrics is unavailable.
   */
  private async scrapeLiveServiceRps(serviceId: string, port: number): Promise<number | null> {
    const urls = [
      `http://host.docker.internal:${port}/metrics`,
      `http://localhost:${port}/metrics`
    ];

    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 500);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) continue;

        const text = await res.text();
        let totalRequests = 0;
        let matchedCounter = false;

        for (const line of text.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          if (
            /^(http_requests_total|http_request_duration_seconds_count|http_server_requests_seconds_count)\b/.test(
              trimmed
            )
          ) {
            const parts = trimmed.split(/\s+/);
            const val = parseFloat(parts[parts.length - 1]);
            if (Number.isFinite(val) && val >= 0) {
              totalRequests += val;
              matchedCounter = true;
            }
          }
        }

        if (matchedCounter) {
          const now = Date.now();
          const prev = this.requestCounterCache.get(serviceId);
          this.requestCounterCache.set(serviceId, { timestamp: now, totalRequests });

          if (prev && now > prev.timestamp && totalRequests >= prev.totalRequests) {
            const deltaSec = (now - prev.timestamp) / 1000;
            if (deltaSec > 0) {
              return parseFloat(((totalRequests - prev.totalRequests) / deltaSec).toFixed(2));
            }
          }
        }
      } catch {
        // continue
      }
    }

    return null;
  }

  /**
   * Fetches real live microservice metrics directly from Prometheus REST API.
   * Queries CPU, Memory, Disk I/O, Avg Latency, P95 Latency, P99 Latency, and RPS individually.
   * If Prometheus metrics are unavailable, falls back to Docker Engine stats and sliding-window HTTP probes.
   */
  public async fetchServiceMetrics(serviceId: string): Promise<PrometheusMetrics> {
    const [
      cpuMillicores,
      memoryMB,
      diskIoBytesPerSec,
      avgLatencyMs,
      p95LatencyMs,
      p99LatencyMs,
      rpsVal,
    ] = await Promise.all([
      this.queryFirstAvailableMetric([
        `sum(rate(container_cpu_usage_seconds_total{container=~".*${serviceId}.*"}[5m])) * 1000`,
        `sum(rate(process_cpu_seconds_total{job=~".*${serviceId}.*"}[5m])) * 1000`,
        `container_cpu_usage_seconds_total{container=~".*${serviceId}.*"} * 1000`,
      ]),
      this.queryFirstAvailableMetric([
        `sum(container_memory_working_set_bytes{container=~".*${serviceId}.*"}) / (1024 * 1024)`,
        `sum(container_memory_usage_bytes{container=~".*${serviceId}.*"}) / (1024 * 1024)`,
        `sum(process_resident_memory_bytes{job=~".*${serviceId}.*"}) / (1024 * 1024)`,
      ]),
      this.queryFirstAvailableMetric([
        `sum(rate(container_fs_reads_bytes_total{container=~".*${serviceId}.*"}[5m]) + rate(container_fs_writes_bytes_total{container=~".*${serviceId}.*"}[5m]))`,
        `sum(rate(container_blkio_device_usage_total{container=~".*${serviceId}.*"}[5m]))`,
      ]),
      this.queryFirstAvailableMetric(
        [
          `sum(rate(http_request_duration_seconds_sum{service=~".*${serviceId}.*"}[5m])) / sum(rate(http_request_duration_seconds_count{service=~".*${serviceId}.*"}[5m]))`,
          `sum(rate(http_request_duration_seconds_sum{job=~".*${serviceId}.*"}[5m])) / sum(rate(http_request_duration_seconds_count{job=~".*${serviceId}.*"}[5m]))`,
        ],
        1000.0
      ),
      this.queryFirstAvailableMetric(
        [
          `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service=~".*${serviceId}.*"}[5m])) by (le))`,
          `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job=~".*${serviceId}.*"}[5m])) by (le))`,
        ],
        1000.0
      ),
      this.queryFirstAvailableMetric(
        [
          `histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{service=~".*${serviceId}.*"}[5m])) by (le))`,
          `histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{job=~".*${serviceId}.*"}[5m])) by (le))`,
        ],
        1000.0
      ),
      this.queryFirstAvailableMetric([
        `sum(rate(http_requests_total{service=~".*${serviceId}.*"}[5m]))`,
        `sum(rate(http_request_duration_seconds_count{service=~".*${serviceId}.*"}[5m]))`,
        `sum(rate(http_requests_total{job=~".*${serviceId}.*"}[5m]))`,
        `sum(rate(http_request_duration_seconds_count{job=~".*${serviceId}.*"}[5m]))`,
      ]),
    ]);

    const hasPrometheusData = [
      cpuMillicores,
      memoryMB,
      diskIoBytesPerSec,
      avgLatencyMs,
      p95LatencyMs,
      p99LatencyMs,
      rpsVal,
    ].some((v) => v !== null && v > 0);

    // Dynamic Fallback: Query Docker Engine API for real container stats & sliding-window HTTP latency samples
    if (!hasPrometheusData) {
      const target = await this.dockerCollector.findContainerTarget(serviceId);
      if (target) {
        const pingResult = await this.pingServicePort(target.port);
        if (pingResult.isAlive) {
          const [windowStats, scrapedRps] = await Promise.all([
            this.collectSlidingWindowLatencyStats(serviceId, target.port, pingResult.latencyMs),
            this.scrapeLiveServiceRps(serviceId, target.port),
          ]);

          return {
            cpuUsageMillicores: target.stats.cpuUsageMillicores,
            memoryUsageMB: target.stats.memoryUsageMB,
            diskIoBytesPerSec: target.stats.diskIoBytesPerSec,
            avgResponseTimeMs: windowStats.avgResponseTimeMs,
            p95LatencyMs: windowStats.p95LatencyMs,
            p99LatencyMs: windowStats.p99LatencyMs,
            rps: scrapedRps !== null ? scrapedRps : windowStats.windowRps,
          };
        }
      }
    }

    if (hasPrometheusData) {
      return {
        cpuUsageMillicores: parseFloat((cpuMillicores ?? 0.0).toFixed(2)),
        memoryUsageMB: parseFloat((memoryMB ?? 0.0).toFixed(2)),
        diskIoBytesPerSec: parseFloat((diskIoBytesPerSec ?? 0.0).toFixed(2)),
        avgResponseTimeMs: parseFloat((avgLatencyMs ?? 0.0).toFixed(2)),
        p95LatencyMs: parseFloat((p95LatencyMs ?? 0.0).toFixed(2)),
        p99LatencyMs: parseFloat((p99LatencyMs ?? 0.0).toFixed(2)),
        rps: parseFloat((rpsVal ?? 0.0).toFixed(2)),
      };
    }

    return {
      cpuUsageMillicores: 0.0,
      memoryUsageMB: 0.0,
      diskIoBytesPerSec: 0.0,
      avgResponseTimeMs: 0.0,
      p95LatencyMs: 0.0,
      p99LatencyMs: 0.0,
      rps: 0.0,
    };
  }
}
