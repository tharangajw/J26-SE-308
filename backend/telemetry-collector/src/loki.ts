import { LokiLogEntry, LokiMetrics } from './types.js';

export class LokiCollector {
  constructor(private readonly endpoint: string = 'http://localhost:3100') {}

  private static detectLogLevel(streamLabels: Record<string, string>, rawMessage: string): string {
    const labelLevel = (streamLabels.level || streamLabels.severity || streamLabels.lvl || '').toLowerCase().trim();
    if (labelLevel) {
      if (['error', 'err', 'fatal', 'critical', 'panic', 'severe'].includes(labelLevel)) return 'error';
      if (['warn', 'warning'].includes(labelLevel)) return 'warn';
      if (['info', 'information'].includes(labelLevel)) return 'info';
      if (['debug', 'trace'].includes(labelLevel)) return 'debug';
    }

    // Check if message is structured JSON with a level/severity field
    const trimmed = rawMessage.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        const jsonLvl = String(parsed.level ?? parsed.severity ?? parsed.lvl ?? '').toLowerCase();
        if (['error', 'err', 'fatal', 'critical', 'panic', 'severe', '50', '60'].includes(jsonLvl)) return 'error';
        if (['warn', 'warning', '40'].includes(jsonLvl)) return 'warn';
        if (['info', '30'].includes(jsonLvl)) return 'info';
        if (['debug', 'trace', '20', '10'].includes(jsonLvl)) return 'debug';
        if (typeof parsed.status === 'number' && parsed.status >= 500) return 'error';
      } catch {
        // fall through to regex inspection
      }
    }

    // Inspect plain-text log line for explicit severity markers
    if (/\b(INFO|DEBUG|TRACE)\b/i.test(rawMessage) && !/\b(ERROR|FATAL|CRITICAL|EXCEPTION|PANIC)\b/i.test(rawMessage)) {
      return 'info';
    }
    if (/\b(WARN|WARNING)\b/i.test(rawMessage) && !/\b(ERROR|FATAL|CRITICAL|EXCEPTION|PANIC)\b/i.test(rawMessage)) {
      return 'warn';
    }
    if (
      /\b(ERROR|FATAL|CRITICAL|SEVERE|PANIC|UNHANDLED|EXCEPTION|TRACEBACK)\b/i.test(rawMessage) ||
      /\bHTTP\/\d\.\d"\s+5\d{2}\b/.test(rawMessage) ||
      /\bstatus[=:\s]+5\d{2}\b/i.test(rawMessage)
    ) {
      return 'error';
    }

    return 'info';
  }

  /** Fetches logs from the last time window using Loki's query_range API and counts only actual error entries. */
  public async fetchLogs(
    serviceId?: string,
    windowMinutes: number = 15,
    limit: number = 100,
  ): Promise<LokiMetrics> {
    const selector = serviceId
      ? `{service=~".*${serviceId}.*"}`
      : '{level=~"(?i)(error|err|fatal|critical)"}';
    const end = Date.now() * 1_000_000;
    const start = end - windowMinutes * 60 * 1_000_000_000;
    const params = new URLSearchParams({
      query: selector,
      start: String(start),
      end: String(end),
      limit: String(limit),
      direction: 'backward',
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 800);
      const response = await fetch(`${this.endpoint}/loki/api/v1/query_range?${params}`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return { errorCount: 0, totalCount: 0, entries: [] };
      }

      const payload = await response.json();
      const entries: LokiLogEntry[] = (payload.data?.result ?? []).flatMap((stream: any) => {
        const labels: Record<string, string> = stream.stream ?? {};
        return (stream.values ?? []).map((value: string[]) => {
          const message = value[1] ?? '';
          const level = LokiCollector.detectLogLevel(labels, message);
          return {
            timestamp: value[0],
            level,
            message,
            labels,
          };
        });
      });

      const errorEntries = entries.filter((e) => e.level === 'error');

      return {
        errorCount: errorEntries.length,
        totalCount: entries.length,
        entries,
      };
    } catch {
      return { errorCount: 0, totalCount: 0, entries: [] };
    }
  }
}
