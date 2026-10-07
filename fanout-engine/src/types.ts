export interface TraceSpan {
  spanId: string;
  parentSpanId?: string;
  serviceName: string;
  operationName: string;
  durationMs: number;
}

export interface TraceCallTree {
  traceId: string;
  rootService: string;
  spans: TraceSpan[];
}

export interface FanOutAnalysisResult {
  serviceId: string;
  totalSpans: number;
  maxDependencyDepth: number;
  directDependencyCount: number;
  legitimateFanOutFactor: number; // Attenuation weight for architectural aggregation nodes
  fanOutScore: number; // 0.0 to 1.0 penalty factor
}
