import http from 'node:http';

export interface DockerContainerInfo {
  id: string;
  name: string;
  serviceName: string;
  displayId: string;
  project: string;
  image: string;
  state: string;
  ports: number[];
  publicPorts: number[];
  dependsOn: string[];
}

export interface LiveContainerStats {
  cpuUsageMillicores: number;
  memoryUsageMB: number;
  diskIoBytesPerSec: number;
}

export interface ContainerLifecycleState {
  podReplicaCount: number;
  hpaTriggerEvents: number;
  podSpinUpLagSec: number;
  uptimeSeconds: number;
}

export class DockerCollector {
  private socketPath: string;
  private statsCache: Map<string, { stats: LiveContainerStats; fetchedAt: number }> = new Map();
  private envDepsCache: Map<string, { deps: string[]; fetchedAt: number }> = new Map();

  constructor(socketPath: string = '/var/run/docker.sock') {
    this.socketPath = socketPath;
  }

  /**
   * Queries Docker Engine API via socket to list all running containers.
   */
  public async getRunningContainers(): Promise<DockerContainerInfo[]> {
    return new Promise((resolve) => {
      const req = http.request(
        {
          socketPath: this.socketPath,
          path: '/containers/json',
          method: 'GET',
          timeout: 1500,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              const list = JSON.parse(body);
              if (!Array.isArray(list)) return resolve([]);
              const containers: DockerContainerInfo[] = list.map((c: any) => {
                const name = (c.Names?.[0] || '').replace(/^\//, '');
                const labels = c.Labels || {};
                const project = labels['com.docker.compose.project'] || '';
                const serviceName = labels['com.docker.compose.service'] || name;
                const displayId =
                  project && name.startsWith(`${project}-`)
                    ? name.slice(project.length + 1)
                    : name;

                const dependsRaw = labels['com.docker.compose.depends_on'] || '';
                const dependsOn = dependsRaw
                  ? dependsRaw
                      .split(',')
                      .map((entry: string) => entry.split(':')[0]?.trim())
                      .filter(Boolean)
                  : [];

                const image = c.Image || '';
                const ports: number[] = (c.Ports || [])
                  .map((p: any) => p.PublicPort || p.PrivatePort)
                  .filter(Boolean);
                const publicPorts: number[] = (c.Ports || [])
                  .map((p: any) => p.PublicPort)
                  .filter(Boolean);

                return {
                  id: c.Id,
                  name,
                  serviceName,
                  displayId,
                  project,
                  image,
                  state: c.State || 'running',
                  ports: Array.from(new Set(ports)),
                  publicPorts: Array.from(new Set(publicPorts)),
                  dependsOn: Array.from(new Set(dependsOn)),
                };
              });
              resolve(containers);
            } catch {
              resolve([]);
            }
          });
        }
      );

      req.on('error', () => resolve([]));
      req.on('timeout', () => {
        req.destroy();
        resolve([]);
      });
      req.end();
    });
  }

  /**
   * Inspects a container's real environment variables (/containers/:id/json)
   * to discover downstream service URLs (e.g. USER_SERVICE_URL=http://user-service:3002, MONGO_URL=mongodb://orders-mongo:27017/db).
   */
  public async getContainerEnvDependencies(containerId: string): Promise<string[]> {
    const cached = this.envDepsCache.get(containerId);
    if (cached && Date.now() - cached.fetchedAt < 15000) {
      return cached.deps;
    }

    return new Promise((resolve) => {
      const req = http.request(
        {
          socketPath: this.socketPath,
          path: `/containers/${containerId}/json`,
          method: 'GET',
          timeout: 1500,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              const info = JSON.parse(body);
              const envList: string[] = info?.Config?.Env || [];
              const hosts = new Set<string>();

              for (const entry of envList) {
                const eqIdx = entry.indexOf('=');
                if (eqIdx === -1) continue;
                const key = entry.slice(0, eqIdx).trim();
                const val = entry.slice(eqIdx + 1).trim();

                // Extract hostname from protocol://hostname(:port)
                const urlMatches = val.matchAll(/[a-zA-Z0-9+.-]+:\/\/([a-zA-Z0-9._-]+)(?::\d+)?/g);
                for (const match of urlMatches) {
                  const host = match[1]?.toLowerCase();
                  if (host && host !== 'localhost' && host !== '127.0.0.1' && host !== '0.0.0.0' && host !== 'host.docker.internal') {
                    hosts.add(host);
                  }
                }

                // Also check *_HOST variables
                if (key.endsWith('_HOST') && val && !val.includes('/')) {
                  const host = val.toLowerCase();
                  if (host !== 'localhost' && host !== '127.0.0.1') {
                    hosts.add(host);
                  }
                }
              }

              const deps = Array.from(hosts);
              this.envDepsCache.set(containerId, { deps, fetchedAt: Date.now() });
              resolve(deps);
            } catch {
              resolve([]);
            }
          });
        }
      );

      req.on('error', () => resolve([]));
      req.on('timeout', () => {
        req.destroy();
        resolve([]);
      });
      req.end();
    });
  }

  /**
   * Measures live response latency for a running container via HTTP ping (if public port exists)
   * or live Docker Engine socket round-trip inspection for internal/DB containers.
   */
  public async measureContainerLatencyMs(container: DockerContainerInfo): Promise<number> {
    if (container.publicPorts.length > 0) {
      const port = container.publicPorts[0];
      const urls = [`http://host.docker.internal:${port}/`, `http://localhost:${port}/`];
      for (const url of urls) {
        const start = performance.now();
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 600);
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.status >= 200 && res.status < 600) {
            return parseFloat(Math.max(0.5, performance.now() - start).toFixed(2));
          }
        } catch {
          // continue
        }
      }
    }

    // For internal containers (e.g. MongoDB / Redis without host HTTP ports), measure live Docker inspect turnaround
    return new Promise((resolve) => {
      const start = performance.now();
      const req = http.request(
        {
          socketPath: this.socketPath,
          path: `/containers/${container.id}/json`,
          method: 'GET',
          timeout: 800,
        },
        (res) => {
          res.on('data', () => {});
          res.on('end', () => {
            const elapsed = Math.max(0.5, performance.now() - start);
            resolve(parseFloat(elapsed.toFixed(2)));
          });
        }
      );
      req.on('error', () => resolve(0));
      req.on('timeout', () => {
        req.destroy();
        resolve(0);
      });
      req.end();
    });
  }

  /**
   * Fetches real live CPU, RAM, and Disk IO stats for a specific container directly from Docker Daemon.
   * Caches results for 5 seconds to ensure fast sub-10ms response times.
   */
  public async getContainerLiveStats(containerId: string): Promise<LiveContainerStats> {
    const cached = this.statsCache.get(containerId);
    if (cached && Date.now() - cached.fetchedAt < 5000) {
      return cached.stats;
    }

    return new Promise((resolve) => {
      const req = http.request(
        {
          socketPath: this.socketPath,
          path: `/containers/${containerId}/stats?stream=false`,
          method: 'GET',
          timeout: 3000,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              const stats = JSON.parse(body);
              const memBytes = stats.memory_stats?.usage || 0;
              const memoryUsageMB = parseFloat((memBytes / (1024 * 1024)).toFixed(2));

              const cpuDelta = (stats.cpu_stats?.cpu_usage?.total_usage || 0) - (stats.precpu_stats?.cpu_usage?.total_usage || 0);
              const systemDelta = (stats.cpu_stats?.system_cpu_usage || 0) - (stats.precpu_stats?.system_cpu_usage || 0);
              const numCpus = stats.cpu_stats?.online_cpus || stats.cpu_stats?.cpu_usage?.percpu_usage?.length || 1;
              const cpuPercent = systemDelta > 0 && cpuDelta > 0 ? (cpuDelta / systemDelta) * numCpus * 100 : 0.0;
              const cpuUsageMillicores = parseFloat(((cpuPercent / 100) * 1000).toFixed(2));

              let diskIoBytesPerSec = 0;
              const blkio = stats.blkio_stats?.io_service_bytes_recursive;
              if (Array.isArray(blkio)) {
                diskIoBytesPerSec = blkio.reduce((acc: number, item: any) => acc + (item.value || 0), 0);
              }

              const resultStats = {
                cpuUsageMillicores: Math.max(0, cpuUsageMillicores),
                memoryUsageMB: Math.max(0, memoryUsageMB),
                diskIoBytesPerSec: Math.max(0, diskIoBytesPerSec),
              };

              this.statsCache.set(containerId, { stats: resultStats, fetchedAt: Date.now() });
              resolve(resultStats);
            } catch {
              resolve(cached?.stats || { cpuUsageMillicores: 0, memoryUsageMB: 0, diskIoBytesPerSec: 0 });
            }
          });
        }
      );

      req.on('error', () => resolve(cached?.stats || { cpuUsageMillicores: 0, memoryUsageMB: 0, diskIoBytesPerSec: 0 }));
      req.on('timeout', () => {
        req.destroy();
        resolve(cached?.stats || { cpuUsageMillicores: 0, memoryUsageMB: 0, diskIoBytesPerSec: 0 });
      });
      req.end();
    });
  }

  /**
   * Matches a container from a list of running containers by serviceId, displayId, serviceName, or container name.
   */
  public matchContainer(containers: DockerContainerInfo[], serviceId: string): DockerContainerInfo | null {
    const raw = serviceId.toLowerCase().trim();
    const norm = raw.replace(/[-_]/g, '');

    // 1. Exact match on displayId, serviceName, or name
    for (const c of containers) {
      if (
        c.displayId.toLowerCase() === raw ||
        c.serviceName.toLowerCase() === raw ||
        c.name.toLowerCase() === raw
      ) {
        return c;
      }
    }

    // 2. Normalized match
    for (const c of containers) {
      const cNameNorm = c.name.toLowerCase().replace(/[-_]/g, '');
      const cDispNorm = c.displayId.toLowerCase().replace(/[-_]/g, '');
      const cSvcNorm = c.serviceName.toLowerCase().replace(/[-_]/g, '');

      if (
        cDispNorm === norm ||
        cSvcNorm === norm ||
        cNameNorm === norm ||
        cDispNorm.startsWith(norm) ||
        (norm.length >= 4 && cNameNorm.endsWith(norm))
      ) {
        return c;
      }
    }

    return null;
  }

  /**
   * Dynamically inspects running Docker containers to find target container, exposed port & live real-time stats.
   */
  public async findContainerTarget(serviceId: string): Promise<{
    port: number;
    containerId: string;
    stats: LiveContainerStats;
  } | null> {
    const containers = await this.getRunningContainers();
    if (containers.length === 0) return null;

    const matched = this.matchContainer(containers, serviceId);
    if (matched && matched.ports.length > 0) {
      const port = matched.publicPorts[0] || matched.ports[0];
      const stats = await this.getContainerLiveStats(matched.id);
      return { port, containerId: matched.id, stats };
    }

    return null;
  }

  /**
   * Inspects the running container's /containers/:id/json metadata to extract real
   * State.StartedAt and Created timestamps, computing live uptimeSeconds, podSpinUpLagSec, and replica count.
   */
  public async getContainerLifecycleState(serviceId: string): Promise<ContainerLifecycleState | null> {
    const containers = await this.getRunningContainers();
    if (containers.length === 0) return null;

    const matched = this.matchContainer(containers, serviceId);
    if (!matched) return null;

    const replicaCount = containers.filter(
      (c) => c.serviceName.toLowerCase() === matched.serviceName.toLowerCase()
    ).length || 1;

    return new Promise((resolve) => {
      const req = http.request(
        {
          socketPath: this.socketPath,
          path: `/containers/${matched.id}/json`,
          method: 'GET',
          timeout: 1500,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              const info = JSON.parse(body);
              const startedAtRaw: string | undefined = info?.State?.StartedAt;
              const createdRaw: string | undefined = info?.Created;
              const restartCount = Number(info?.RestartCount ?? 0);

              let uptimeSeconds = 0;
              let podSpinUpLagSec = 0;

              if (startedAtRaw && !startedAtRaw.startsWith('0001-')) {
                const startedMs = Date.parse(startedAtRaw);
                if (Number.isFinite(startedMs) && startedMs > 0) {
                  uptimeSeconds = Math.max(0, Math.round((Date.now() - startedMs) / 1000));
                }
                if (createdRaw) {
                  const createdMs = Date.parse(createdRaw);
                  if (Number.isFinite(createdMs) && Number.isFinite(startedMs) && startedMs >= createdMs) {
                    podSpinUpLagSec = parseFloat(Math.min(60, (startedMs - createdMs) / 1000).toFixed(2));
                  }
                }
              }

              resolve({
                podReplicaCount: replicaCount,
                hpaTriggerEvents: Math.max(0, restartCount),
                podSpinUpLagSec,
                uptimeSeconds,
              });
            } catch {
              resolve(null);
            }
          });
        }
      );

      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
      req.end();
    });
  }
}
