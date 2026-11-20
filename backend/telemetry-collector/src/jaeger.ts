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
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 800);
      const url = `${this.endpoint}/api/traces?service=${encodeURIComponent(serviceId)}&limit=${limit}`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return [];
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
    } catch {
      return [];
    }
  }

  /**
   * Parses live Jaeger trace spans & processes to build a service-level DAG call-tree topology,
   * including sibling span timestamp overlap analysis to detect Sequential (N+1) vs Parallel fan-out.
   */
  public async fetchTraceDAG(serviceId: string): Promise<{
    traceId: string;
    sequentialRatio: number;
    executionPattern: 'SINGLE' | 'PARALLEL_CONCURRENT' | 'HYBRID_WATERFALL' | 'SEQUENTIAL_N_PLUS_1';
    nodes: {
      id: string;
      serviceId: string;
      role: string;
      parentServiceId: string | null;
      childrenServiceIds: string[];
      depth: number;
      spanDurationMs: number;
      isApiGateway: boolean;
    }[];
  } | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 800);
      const url = `${this.endpoint}/api/traces?service=${encodeURIComponent(serviceId)}&limit=5`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) return null;
      const data: any = await response.json();
      const traces: any[] = data?.data;
      if (!Array.isArray(traces) || traces.length === 0) return null;

      // Pick the trace with the richest span tree
      const trace = traces.reduce((best, curr) =>
        (curr.spans?.length || 0) > (best.spans?.length || 0) ? curr : best
      , traces[0]);

      const spans: any[] = trace.spans || [];
      const processes: Record<string, { serviceName: string; tags?: any[] }> = trace.processes || {};
      if (spans.length === 0) return null;

      const spanById = new Map<string, any>();
      const spanService = new Map<string, string>();
      for (const s of spans) {
        spanById.set(s.spanID, s);
        const procSvc = processes[s.processID]?.serviceName || serviceId;
        spanService.set(s.spanID, procSvc);
      }

      // Build service-level adjacency, aggregate span durations, and collect child span intervals
      const serviceChildren = new Map<string, Set<string>>();
      const serviceParent = new Map<string, string | null>();
      const serviceDurationMs = new Map<string, number>();
      const downstreamIntervals: Array<{ startUs: number; endUs: number; durUs: number }> = [];

      for (const s of spans) {
        const svc = spanService.get(s.spanID) || serviceId;
        const durUs = Number(s.duration || 0);
        const startUs = Number(s.startTime || 0);
        const durMs = parseFloat((durUs / 1000.0).toFixed(2));
        const prevDur = serviceDurationMs.get(svc) || 0;
        if (durMs > prevDur) serviceDurationMs.set(svc, durMs);
        if (!serviceChildren.has(svc)) serviceChildren.set(svc, new Set());
        if (!serviceParent.has(svc)) serviceParent.set(svc, null);

        const parentRef = s.references?.find((r: any) => r.refType === 'CHILD_OF' || r.refType === 'FOLLOWS_FROM');
        if (parentRef && spanService.has(parentRef.spanID)) {
          const parentSvc = spanService.get(parentRef.spanID)!;
          if (parentSvc !== svc) {
            if (!serviceChildren.has(parentSvc)) serviceChildren.set(parentSvc, new Set());
            serviceChildren.get(parentSvc)!.add(svc);
            if (!serviceParent.get(svc)) {
              serviceParent.set(svc, parentSvc);
            }
            if (startUs > 0 && durUs > 0) {
              downstreamIntervals.push({ startUs, endUs: startUs + durUs, durUs });
            }
          }
        }
      }

      // Analyze whether downstream spans execute sequentially (N+1) or in parallel
      let sequentialRatio = 0.0;
      let executionPattern: 'SINGLE' | 'PARALLEL_CONCURRENT' | 'HYBRID_WATERFALL' | 'SEQUENTIAL_N_PLUS_1' = 'SINGLE';
      if (downstreamIntervals.length >= 2) {
        const sorted = [...downstreamIntervals].sort((a, b) => a.startUs - b.startUs);
        const totalDurUs = sorted.reduce((acc, it) => acc + it.durUs, 0);
        const maxSingleUs = Math.max(...sorted.map((it) => it.durUs));

        let mergedUs = 0;
        let curStart = sorted[0].startUs;
        let curEnd = sorted[0].endUs;
        for (let i = 1; i < sorted.length; i++) {
          if (sorted[i].startUs < curEnd) {
            curEnd = Math.max(curEnd, sorted[i].endUs);
          } else {
            mergedUs += curEnd - curStart;
            curStart = sorted[i].startUs;
            curEnd = sorted[i].endUs;
          }
        }
        mergedUs += curEnd - curStart;

        const denom = Math.max(1, totalDurUs - maxSingleUs);
        sequentialRatio = parseFloat(
          Math.min(1.0, Math.max(0.0, (mergedUs - maxSingleUs) / denom)).toFixed(3)
        );
        if (sequentialRatio >= 0.65) {
          executionPattern = 'SEQUENTIAL_N_PLUS_1';
        } else if (sequentialRatio <= 0.35) {
          executionPattern = 'PARALLEL_CONCURRENT';
        } else {
          executionPattern = 'HYBRID_WATERFALL';
        }
      }

      // Compute service depth via BFS from root serviceId (or trace root)
      const rootSvc = serviceChildren.has(serviceId)
        ? serviceId
        : (spanService.get(spans[0].spanID) || serviceId);

      const serviceDepth = new Map<string, number>();
      const queue: string[] = [rootSvc];
      serviceDepth.set(rootSvc, 1);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        const d = serviceDepth.get(curr) || 1;
        const children = serviceChildren.get(curr) || new Set();
        for (const child of children) {
          if (!serviceDepth.has(child)) {
            serviceDepth.set(child, d + 1);
            queue.push(child);
          }
        }
      }

      // Include any remaining services in the trace
      for (const svc of serviceChildren.keys()) {
        if (!serviceDepth.has(svc)) {
          serviceDepth.set(svc, 2);
        }
      }

      const nodes = Array.from(serviceDepth.entries())
        .sort((a, b) => a[1] - b[1])
        .map(([svc, depth]) => {
          const children = Array.from(serviceChildren.get(svc) || []);
          const isGw = svc.toLowerCase().includes('gateway');
          const isDb =
            svc.toLowerCase().includes('mongo') ||
            svc.toLowerCase().includes('postgres') ||
            svc.toLowerCase().includes('redis') ||
            svc.toLowerCase().includes('db');
          const role = isGw
            ? 'API Gateway / Edge Router'
            : isDb
            ? 'Persistence / Cache Layer'
            : depth === 1
            ? 'Root Traced Service'
            : 'Downstream Traced Service';

          return {
            id: `jaeger-${trace.traceID.slice(0, 8)}-${svc}`,
            serviceId: svc,
            role,
            parentServiceId: svc === rootSvc ? null : (serviceParent.get(svc) || rootSvc),
            childrenServiceIds: children,
            depth,
            spanDurationMs: serviceDurationMs.get(svc) || 0.1,
            isApiGateway: isGw,
          };
        });

      return {
        traceId: trace.traceID,
        sequentialRatio,
        executionPattern,
        nodes,
      };
    } catch {
      return null;
    }
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
