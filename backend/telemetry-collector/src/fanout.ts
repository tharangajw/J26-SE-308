export interface DAGNode {
  id: string;
  serviceId: string;
  role: string;
  parentServiceId: string | null;
  childrenServiceIds: string[];
  depth: number;
  spanDurationMs: number;
  isApiGateway: boolean;
}

export interface FanOutAnalysisResult {
  serviceId: string;
  isApiGateway: boolean;
  directFanOutCount: number;
  maxDependencyDepth: number;
  attenuationFactor: number; // 0.3 for API Gateway, 1.0 for standard microservices
  rawFanOutPenalty: number;
  attenuatedFanOutScore: number; // 0.000 (ideal) to 1.000 (overly complex fan-out)
  fanOutLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  downstreamServices: string[];
  callTreeTopology: DAGNode[];
  summary: string;
}

export class FanOutEngine {
  /**
   * Constructs the call-tree DAG topology and evaluates fan-out depth & attenuation factors.
   */
  public analyzeTopology(serviceId: string, liveTraceDurationMs: number = 25): FanOutAnalysisResult {
    const sId = serviceId.trim().toLowerCase();
    const isApiGateway = sId.includes('gateway');

    // Build microservices call-tree DAG based on active topology
    let directFanOutCount = 0;
    let maxDependencyDepth = 1;
    let downstreamServices: string[] = [];
    let callTreeTopology: DAGNode[] = [];

    if (isApiGateway) {
      // API Gateway routes to Book, User, and Order services
      directFanOutCount = 3;
      maxDependencyDepth = 3;
      downstreamServices = ['book-service-1', 'user-service-1', 'order-service-1'];

      callTreeTopology = [
        {
          id: 'dag-node-gateway',
          serviceId: 'gateway-1',
          role: 'API Gateway / Edge Router',
          parentServiceId: null,
          childrenServiceIds: ['book-service-1', 'user-service-1', 'order-service-1'],
          depth: 1,
          spanDurationMs: liveTraceDurationMs,
          isApiGateway: true,
        },
        {
          id: 'dag-node-book',
          serviceId: 'book-service-1',
          role: 'Target Microservice',
          parentServiceId: 'gateway-1',
          childrenServiceIds: ['books-mongo-1'],
          depth: 2,
          spanDurationMs: parseFloat((liveTraceDurationMs * 0.6).toFixed(1)),
          isApiGateway: false,
        },
        {
          id: 'dag-node-user',
          serviceId: 'user-service-1',
          role: 'Target Microservice',
          parentServiceId: 'gateway-1',
          childrenServiceIds: ['users-mongo-1'],
          depth: 2,
          spanDurationMs: parseFloat((liveTraceDurationMs * 0.5).toFixed(1)),
          isApiGateway: false,
        },
        {
          id: 'dag-node-order',
          serviceId: 'order-service-1',
          role: 'Target Microservice',
          parentServiceId: 'gateway-1',
          childrenServiceIds: ['orders-mongo-1'],
          depth: 2,
          spanDurationMs: parseFloat((liveTraceDurationMs * 0.7).toFixed(1)),
          isApiGateway: false,
        },
        {
          id: 'dag-node-book-db',
          serviceId: 'books-mongo-1',
          role: 'Database',
          parentServiceId: 'book-service-1',
          childrenServiceIds: [],
          depth: 3,
          spanDurationMs: parseFloat((liveTraceDurationMs * 0.2).toFixed(1)),
          isApiGateway: false,
        },
        {
          id: 'dag-node-user-db',
          serviceId: 'users-mongo-1',
          role: 'Database',
          parentServiceId: 'user-service-1',
          childrenServiceIds: [],
          depth: 3,
          spanDurationMs: parseFloat((liveTraceDurationMs * 0.2).toFixed(1)),
          isApiGateway: false,
        },
        {
          id: 'dag-node-order-db',
          serviceId: 'orders-mongo-1',
          role: 'Database',
          parentServiceId: 'order-service-1',
          childrenServiceIds: [],
          depth: 3,
          spanDurationMs: parseFloat((liveTraceDurationMs * 0.25).toFixed(1)),
          isApiGateway: false,
        },
      ];
    } else if (sId.includes('book')) {
      directFanOutCount = 1;
      maxDependencyDepth = 2;
      downstreamServices = ['books-mongo-1'];

      callTreeTopology = [
        {
          id: 'dag-node-book',
          serviceId: 'book-service-1',
          role: 'Target Microservice',
          parentServiceId: 'gateway-1',
          childrenServiceIds: ['books-mongo-1'],
          depth: 1,
          spanDurationMs: liveTraceDurationMs,
          isApiGateway: false,
        },
        {
          id: 'dag-node-book-db',
          serviceId: 'books-mongo-1',
          role: 'Database',
          parentServiceId: 'book-service-1',
          childrenServiceIds: [],
          depth: 2,
          spanDurationMs: parseFloat((liveTraceDurationMs * 0.3).toFixed(1)),
          isApiGateway: false,
        },
      ];
    } else if (sId.includes('user')) {
      directFanOutCount = 1;
      maxDependencyDepth = 2;
      downstreamServices = ['users-mongo-1'];

      callTreeTopology = [
        {
          id: 'dag-node-user',
          serviceId: 'user-service-1',
          role: 'Target Microservice',
          parentServiceId: 'gateway-1',
          childrenServiceIds: ['users-mongo-1'],
          depth: 1,
          spanDurationMs: liveTraceDurationMs,
          isApiGateway: false,
        },
        {
          id: 'dag-node-user-db',
          serviceId: 'users-mongo-1',
          role: 'Database',
          parentServiceId: 'user-service-1',
          childrenServiceIds: [],
          depth: 2,
          spanDurationMs: parseFloat((liveTraceDurationMs * 0.3).toFixed(1)),
          isApiGateway: false,
        },
      ];
    } else if (sId.includes('order')) {
      directFanOutCount = 1;
      maxDependencyDepth = 2;
      downstreamServices = ['orders-mongo-1'];

      callTreeTopology = [
        {
          id: 'dag-node-order',
          serviceId: 'order-service-1',
          role: 'Target Microservice',
          parentServiceId: 'gateway-1',
          childrenServiceIds: ['orders-mongo-1'],
          depth: 1,
          spanDurationMs: liveTraceDurationMs,
          isApiGateway: false,
        },
        {
          id: 'dag-node-order-db',
          serviceId: 'orders-mongo-1',
          role: 'Database',
          parentServiceId: 'order-service-1',
          childrenServiceIds: [],
          depth: 2,
          spanDurationMs: parseFloat((liveTraceDurationMs * 0.35).toFixed(1)),
          isApiGateway: false,
        },
      ];
    } else {
      directFanOutCount = 0;
      maxDependencyDepth = 1;
      downstreamServices = [];

      callTreeTopology = [
        {
          id: `dag-node-${sId}`,
          serviceId,
          role: 'Standalone Microservice',
          parentServiceId: null,
          childrenServiceIds: [],
          depth: 1,
          spanDurationMs: liveTraceDurationMs,
          isApiGateway: false,
        },
      ];
    }

    // Apply Legitimate Fan-Out Attenuation Factor
    // API Gateways route requests to multiple microservices by design; attenuationFactor = 0.3 prevents over-penalization.
    const attenuationFactor = isApiGateway ? 0.3 : 1.0;

    const rawPenalty = Math.min(1.0, directFanOutCount * 0.15 + (maxDependencyDepth - 1) * 0.10);
    const attenuatedFanOutScore = parseFloat((rawPenalty * attenuationFactor).toFixed(3));

    let fanOutLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (attenuatedFanOutScore >= 0.60) fanOutLevel = 'CRITICAL';
    else if (attenuatedFanOutScore >= 0.35) fanOutLevel = 'HIGH';
    else if (attenuatedFanOutScore >= 0.15) fanOutLevel = 'MODERATE';

    const summary = isApiGateway
      ? `API Gateway legitimate fan-out attenuation applied (${attenuationFactor}x multiplier). Raw penalty ${rawPenalty.toFixed(2)} attenuated to ${attenuatedFanOutScore.toFixed(2)}.`
      : `Standard fan-out analysis (${directFanOutCount} downstream services, max depth ${maxDependencyDepth}). Fan-out score: ${attenuatedFanOutScore.toFixed(2)}.`;

    return {
      serviceId,
      isApiGateway,
      directFanOutCount,
      maxDependencyDepth,
      attenuationFactor,
      rawFanOutPenalty: parseFloat(rawPenalty.toFixed(3)),
      attenuatedFanOutScore,
      fanOutLevel,
      downstreamServices,
      callTreeTopology,
      summary,
    };
  }
}
