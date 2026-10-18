import { DockerCollector, DockerContainerInfo } from './docker.js';
import { JaegerCollector } from './jaeger.js';

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
  hasTelemetry: boolean;
  telemetrySource: 'JAEGER_TRACE' | 'DOCKER_LIVE_TOPOLOGY' | 'PROMETHEUS_LIVE' | 'NONE';
  traceId?: string;
  isApiGateway: boolean;
  directFanOutCount: number;
  maxDependencyDepth: number;
  attenuationFactor: number; // 0.3 for API Gateway, 1.0 for standard microservices
  rawFanOutPenalty: number;
  attenuatedFanOutScore: number; // 0.000 (ideal) to 1.000 (overly complex fan-out)
  fanOutLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'NO_DATA';
  downstreamServices: string[];
  callTreeTopology: DAGNode[];
  rootSpanLatencyMs: number;
  criticalPathLatencyMs: number;
  amplificationMultiplier: number;
  summary: string;
}

export class FanOutEngine {
  private readonly dockerCollector: DockerCollector;
  private readonly jaegerCollector: JaegerCollector;

  constructor(endpoints: { jaeger?: string; dockerSocket?: string } = {}) {
    this.jaegerCollector = new JaegerCollector(endpoints.jaeger);
    this.dockerCollector = new DockerCollector(endpoints.dockerSocket);
  }

  private inferContainerRole(c: DockerContainerInfo, depth: number, hasChildren: boolean): { role: string; isApiGateway: boolean } {
    const combined = `${c.serviceName} ${c.displayId} ${c.image}`.toLowerCase();
    const isApiGateway =
      combined.includes('gateway') ||
      combined.includes('ingress') ||
      combined.includes('edge-proxy') ||
      combined.includes('bff');

    if (isApiGateway) {
      return { role: 'API Gateway / Edge Router', isApiGateway: true };
    }
    if (
      combined.includes('mongo') ||
      combined.includes('postgres') ||
      combined.includes('mysql') ||
      combined.includes('mariadb') ||
      combined.includes('cassandra')
    ) {
      return { role: 'Database / Persistence Layer', isApiGateway: false };
    }
    if (combined.includes('redis') || combined.includes('memcached')) {
      return { role: 'Cache Store', isApiGateway: false };
    }
    if (depth === 1 && hasChildren) {
      return { role: 'Orchestrator Microservice', isApiGateway: false };
    }
    if (depth === 1) {
      return { role: 'Standalone Microservice', isApiGateway: false };
    }
    return { role: 'Downstream Microservice', isApiGateway: false };
  }

  /**
   * Dynamically constructs the call-tree DAG topology from live Jaeger traces or live Docker container inspection.
   * Contains zero hardcoded service names or dummy fallback topologies.
   */
  public async analyzeTopology(
    serviceId: string,
    livePrometheusLatencyMs: number = 0
  ): Promise<FanOutAnalysisResult> {
    const cleanId = serviceId.trim();

    // 1. Check live Jaeger Distributed Traces first
    const jaegerDag = await this.jaegerCollector.fetchTraceDAG(cleanId);
    if (jaegerDag && jaegerDag.nodes.length > 0) {
      return this.computeMetricsFromTopology(
        cleanId,
        jaegerDag.nodes,
        'JAEGER_TRACE',
        jaegerDag.traceId
      );
    }

    // 2. Inspect live running Docker containers and their real Env/Label dependencies
    const containers = await this.dockerCollector.getRunningContainers();
    const rootContainer = this.dockerCollector.matchContainer(containers, cleanId);

    if (rootContainer) {
      // Build adjacency map across all running containers from real Docker Compose labels + Env URLs
      const resolvedDepsMap = new Map<string, DockerContainerInfo[]>();

      await Promise.all(
        containers.map(async (c) => {
          const envHosts = await this.dockerCollector.getContainerEnvDependencies(c.id);
          const rawDepNames = Array.from(new Set([...c.dependsOn, ...envHosts]));
          const childContainers: DockerContainerInfo[] = [];

          for (const depName of rawDepNames) {
            const target = this.dockerCollector.matchContainer(containers, depName);
            if (target && target.id !== c.id && !childContainers.some((x) => x.id === target.id)) {
              childContainers.push(target);
            }
          }
          resolvedDepsMap.set(c.id, childContainers);
        })
      );

      // Find if any upstream container calls rootContainer
      let upstreamCallerId: string | null = null;
      for (const c of containers) {
        if (c.id === rootContainer.id) continue;
        const children = resolvedDepsMap.get(c.id) || [];
        if (children.some((child) => child.id === rootContainer.id)) {
          upstreamCallerId = c.displayId;
          break;
        }
      }

      // BFS traversal from rootContainer to construct the live call-tree DAG
      const visited = new Map<string, { container: DockerContainerInfo; depth: number; parentId: string | null }>();
      const queue: { container: DockerContainerInfo; depth: number; parentId: string | null }[] = [
        { container: rootContainer, depth: 1, parentId: upstreamCallerId },
      ];
      visited.set(rootContainer.id, { container: rootContainer, depth: 1, parentId: upstreamCallerId });

      while (queue.length > 0) {
        const current = queue.shift()!;
        const children = resolvedDepsMap.get(current.container.id) || [];
        for (const child of children) {
          if (!visited.has(child.id)) {
            const nextDepth = current.depth + 1;
            visited.set(child.id, {
              container: child,
              depth: nextDepth,
              parentId: current.container.displayId,
            });
            if (nextDepth < 10) {
              queue.push({
                container: child,
                depth: nextDepth,
                parentId: current.container.displayId,
              });
            }
          }
        }
      }

      // Measure real live latency for each container in the call-tree
      const entries = Array.from(visited.values()).sort((a, b) => a.depth - b.depth);
      const nodes: DAGNode[] = await Promise.all(
        entries.map(async ({ container, depth, parentId }) => {
          const allChildren = resolvedDepsMap.get(container.id) || [];
          // Only include children that are part of this call tree
          const childrenServiceIds = allChildren
            .filter((ch) => visited.has(ch.id))
            .map((ch) => ch.displayId);

          let spanDurationMs = await this.dockerCollector.measureContainerLatencyMs(container);
          if (depth === 1 && livePrometheusLatencyMs > 0) {
            spanDurationMs = parseFloat(livePrometheusLatencyMs.toFixed(2));
          }

          const { role, isApiGateway } = this.inferContainerRole(
            container,
            depth,
            childrenServiceIds.length > 0
          );

          return {
            id: `docker-${container.id.slice(0, 12)}`,
            serviceId: container.displayId,
            role,
            parentServiceId: parentId,
            childrenServiceIds,
            depth,
            spanDurationMs,
            isApiGateway,
          };
        })
      );

      return this.computeMetricsFromTopology(cleanId, nodes, 'DOCKER_LIVE_TOPOLOGY');
    }

    // 3. If service is only in Prometheus with active latency
    if (livePrometheusLatencyMs > 0) {
      const isGw = cleanId.toLowerCase().includes('gateway');
      const singleNode: DAGNode = {
        id: `prom-${cleanId}`,
        serviceId: cleanId,
        role: isGw ? 'API Gateway / Edge Router' : 'Monitored Target',
        parentServiceId: null,
        childrenServiceIds: [],
        depth: 1,
        spanDurationMs: parseFloat(livePrometheusLatencyMs.toFixed(2)),
        isApiGateway: isGw,
      };
      return this.computeMetricsFromTopology(cleanId, [singleNode], 'PROMETHEUS_LIVE');
    }

    // 4. No telemetry or container found — return honest NO_DATA state (zero dummy data)
    return {
      serviceId: cleanId,
      hasTelemetry: false,
      telemetrySource: 'NONE',
      isApiGateway: false,
      directFanOutCount: 0,
      maxDependencyDepth: 0,
      attenuationFactor: 1.0,
      rawFanOutPenalty: 0,
      attenuatedFanOutScore: 0,
      fanOutLevel: 'NO_DATA',
      downstreamServices: [],
      callTreeTopology: [],
      rootSpanLatencyMs: 0,
      criticalPathLatencyMs: 0,
      amplificationMultiplier: 0,
      summary: `No active Jaeger traces, Docker containers, or Prometheus metrics found for '${cleanId}'.`,
    };
  }

  private computeMetricsFromTopology(
    requestedServiceId: string,
    callTreeTopology: DAGNode[],
    telemetrySource: 'JAEGER_TRACE' | 'DOCKER_LIVE_TOPOLOGY' | 'PROMETHEUS_LIVE',
    traceId?: string
  ): FanOutAnalysisResult {
    const rootNode = callTreeTopology.find((n) => n.depth === 1) || callTreeTopology[0];
    const isApiGateway = rootNode ? rootNode.isApiGateway : false;
    const downstreamServices = rootNode ? rootNode.childrenServiceIds : [];
    const directFanOutCount = downstreamServices.length;
    const maxDependencyDepth = callTreeTopology.reduce(
      (max, n) => (n.depth > max ? n.depth : max),
      1
    );

    // Legitimate Fan-Out Attenuation Factor (0.3x for API Gateway / Edge Router, 1.0x for standard microservices)
    const attenuationFactor = isApiGateway ? 0.3 : 1.0;
    const rawPenalty = Math.min(1.0, directFanOutCount * 0.15 + (maxDependencyDepth - 1) * 0.10);
    const attenuatedFanOutScore = parseFloat((rawPenalty * attenuationFactor).toFixed(3));

    let fanOutLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (attenuatedFanOutScore >= 0.60) fanOutLevel = 'CRITICAL';
    else if (attenuatedFanOutScore >= 0.35) fanOutLevel = 'HIGH';
    else if (attenuatedFanOutScore >= 0.15) fanOutLevel = 'MODERATE';

    // Compute Critical Path Latency across call-tree depths (max span duration at each depth hop)
    const maxByDepth = new Map<number, number>();
    for (const node of callTreeTopology) {
      const prev = maxByDepth.get(node.depth) || 0;
      if (node.spanDurationMs > prev) {
        maxByDepth.set(node.depth, node.spanDurationMs);
      }
    }

    const rootSpanLatencyMs = parseFloat((rootNode?.spanDurationMs || 0).toFixed(2));
    const criticalPathLatencyMs = parseFloat(
      Array.from(maxByDepth.values())
        .reduce((sum, val) => sum + val, 0)
        .toFixed(2)
    );
    const amplificationMultiplier =
      rootSpanLatencyMs > 0
        ? parseFloat((criticalPathLatencyMs / rootSpanLatencyMs).toFixed(2))
        : 1.0;

    const sourceLabel =
      telemetrySource === 'JAEGER_TRACE'
        ? `Jaeger trace (${traceId?.slice(0, 8)})`
        : telemetrySource === 'DOCKER_LIVE_TOPOLOGY'
        ? 'Docker Engine live container topology'
        : 'Prometheus live metrics';

    const summary = isApiGateway
      ? `[${sourceLabel}] API Gateway legitimate fan-out attenuation applied (${attenuationFactor}x multiplier). Raw penalty ${rawPenalty.toFixed(3)} attenuated to ${attenuatedFanOutScore.toFixed(3)}.`
      : `[${sourceLabel}] Live call-tree (${directFanOutCount} direct downstream calls, depth ${maxDependencyDepth}). Penalty score: ${attenuatedFanOutScore.toFixed(3)}.`;

    return {
      serviceId: requestedServiceId,
      hasTelemetry: true,
      telemetrySource,
      ...(traceId ? { traceId } : {}),
      isApiGateway,
      directFanOutCount,
      maxDependencyDepth,
      attenuationFactor,
      rawFanOutPenalty: parseFloat(rawPenalty.toFixed(3)),
      attenuatedFanOutScore,
      fanOutLevel,
      downstreamServices,
      callTreeTopology,
      rootSpanLatencyMs,
      criticalPathLatencyMs,
      amplificationMultiplier,
      summary,
    };
  }
}
