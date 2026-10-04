import { FanOutEngineService } from '../src/fanout';
import { TraceCallTree } from '../src/types';

function testFanOutEngine() {
  console.log('--- Testing Fan-Out Engine Module ---');
  const engine = new FanOutEngineService();

  const mockCallTree: TraceCallTree = {
    traceId: 'trace-101',
    rootService: 'api-gateway',
    spans: [
      { spanId: 's1', serviceName: 'api-gateway', operationName: 'GET /checkout', durationMs: 150 },
      { spanId: 's2', parentSpanId: 's1', serviceName: 'order-service', operationName: 'POST /orders', durationMs: 90 },
      { spanId: 's3', parentSpanId: 's2', serviceName: 'user-service', operationName: 'GET /user', durationMs: 30 },
      { spanId: 's4', parentSpanId: 's2', serviceName: 'payment-service', operationName: 'POST /pay', durationMs: 50 },
    ],
  };

  const result = engine.analyzeTraceTree(mockCallTree);
  console.assert(result.totalSpans === 4, 'Span count should be 4');
  console.assert(result.maxDependencyDepth === 3, 'Max depth should be 3');
  console.assert(result.legitimateFanOutFactor > 1.0, 'API Gateway should receive attenuation factor');

  console.log('[OK] Fan-Out Engine tests passed successfully!');
  console.log('Fan-Out Analysis Result:', result);
}

testFanOutEngine();
