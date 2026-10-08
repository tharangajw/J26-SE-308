import { TraceCallTree, FanOutAnalysisResult } from './types';

export class FanOutEngineService {
  /**
   * Parses Jaeger call-tree structures and calculates unique dependency depth and fan-out score.
   */
  public analyzeTraceTree(callTree: TraceCallTree): FanOutAnalysisResult {
    const { spans, rootService } = callTree;
    if (!spans || spans.length === 0) {
      return {
        serviceId: rootService,
        totalSpans: 0,
        maxDependencyDepth: 0,
        directDependencyCount: 0,
        legitimateFanOutFactor: 1.0,
        fanOutScore: 0.0,
      };
    }

    // Identify unique downstream services called directly by root
    const rootSpans = spans.filter((s) => s.serviceName === rootService);
    const rootSpanIds = new Set(rootSpans.map((s) => s.spanId));
    
    const directChildSpans = spans.filter(
      (s) => s.parentSpanId && rootSpanIds.has(s.parentSpanId) && s.serviceName !== rootService
    );
    
    const directServices = new Set(directChildSpans.map((s) => s.serviceName));
    const directDependencyCount = directServices.size;

    // Calculate maximum call stack depth
    const maxDependencyDepth = this.computeMaxDepth(spans);

    // Legitimate Fan-Out Attenuation Function:
    // API Gateway or Aggregation services naturally have higher fan-out.
    // If a service is designed for aggregation, attenuate penalty by dividing by log2(directCount + 1).
    const isGateway = rootService.toLowerCase().includes('gateway');
    const legitimateAttenuation = isGateway ? Math.log2(directDependencyCount + 2) : 1.0;

    // Raw Fan-out depth penalty equation
    const rawPenalty = (directDependencyCount * 0.15 + maxDependencyDepth * 0.10) / legitimateAttenuation;
    const fanOutScore = Math.min(1.0, Math.max(0.0, parseFloat(rawPenalty.toFixed(3))));

    return {
      serviceId: rootService,
      totalSpans: spans.length,
      maxDependencyDepth,
      directDependencyCount,
      legitimateFanOutFactor: parseFloat(legitimateAttenuation.toFixed(2)),
      fanOutScore,
    };
  }

  private computeMaxDepth(spans: TraceSpan[]): number {
    const parentMap = new Map<string, string | undefined>();
    spans.forEach((s) => parentMap.set(s.spanId, s.parentSpanId));

    let maxDepth = 1;
    for (const span of spans) {
      let currentDepth = 1;
      let currParent = span.parentSpanId;
      while (currParent && parentMap.has(currParent)) {
        currentDepth++;
        currParent = parentMap.get(currParent);
        if (currentDepth > 20) break; // Safeguard against cycle loops
      }
      if (currentDepth > maxDepth) {
        maxDepth = currentDepth;
      }
    }
    return maxDepth;
  }
}
