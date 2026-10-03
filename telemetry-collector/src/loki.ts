import { LokiLogEntry, LokiMetrics } from './types';

export class LokiCollector {
  constructor(private readonly endpoint: string = 'http://localhost:3100') {}

  /** Fetches error logs from the last time window using Loki's query_range API. */
  public async fetchLogs(
    serviceId?: string,
    windowMinutes: number = 15,
    limit: number = 100,
  ): Promise<LokiMetrics> {
    const selector = serviceId ? `{service="${serviceId}"}` : '{level="error"}';
    const end = Date.now() * 1_000_000;
    const start = end - windowMinutes * 60 * 1_000_000_000;
    const params = new URLSearchParams({
      query: selector,
      start: String(start),
      end: String(end),
      limit: String(limit),
      direction: 'backward',
    });

    const response = await fetch(`${this.endpoint}/loki/api/v1/query_range?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch Loki logs: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    const entries: LokiLogEntry[] = (payload.data?.result ?? []).flatMap((stream: any) =>
      (stream.values ?? []).map((value: string[]) => ({
        timestamp: value[0],
        level: stream.stream?.level ?? 'unknown',
        message: value[1],
        labels: stream.stream ?? {},
      }))
    );

    return {
      errorCount: entries.length,
      totalCount: entries.length,
      entries,
    };
  }
}
