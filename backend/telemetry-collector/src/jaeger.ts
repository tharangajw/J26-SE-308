import { JaegerTraceSummary } from './types.js';

export class JaegerCollector {
  private endpoint: string;

  constructor(endpoint: string = 'http://localhost:16686') {
    this.endpoint = endpoint;
  }

  /**
   * Fetches real live traces directly from Jaeger REST API.
   * Throws an error if Jaeger backend is unreachable.
   */
  public async fetchTraces(serviceId: string, limit: number = 10): Promise<JaegerTraceSummary[]> {
    const url = `${this.endpoint}/api/traces?service=${encodeURIComponent(serviceId)}&limit=${limit}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch Jaeger traces for service ${serviceId}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.data || !Array.isArray(data.data)) {
      return [];
    }

    return data.data.map((trace: any) => {
      const spans = trace.spans || [];
      const rootSpan = spans.find((s: any) => !s.references || s.references.length === 0) || spans[0];
      const durationMs = rootSpan ? rootSpan.duration / 1000.0 : 0.0;
      const errorSpans = spans.filter((s: any) => 
        s.tags?.some((t: any) => t.key === 'error' && t.value === true)
      );

      return {
        traceId: trace.traceID,
        rootService: serviceId,
        spanCount: spans.length,
        depth: this.calculateTraceDepth(spans),
        durationMs: parseFloat(durationMs.toFixed(2)),
        errorCount: errorSpans.length,
      };
    });
  }

  private calculateTraceDepth(spans: any[]): number {
    if (!spans || spans.length === 0) return 0;
    const parentMap = new Map<string, string>();
    spans.forEach((s) => {
      const parentRef = s.references?.find((r: any) => r.refType === 'CHILD_OF');
      if (parentRef) parentMap.set(s.spanID, parentRef.spanID);
    });

    let maxDepth = 1;
    for (const span of spans) {
      let depth = 1;
      let curr = span.spanID;
      while (parentMap.has(curr)) {
        depth++;
        curr = parentMap.get(curr)!;
        if (depth > 20) break;
      }
      if (depth > maxDepth) maxDepth = depth;
    }
    return maxDepth;
  }
}
