import http from 'node:http';

export interface DockerContainerInfo {
  id: string;
  name: string;
  image: string;
  state: string;
  ports: number[];
}

export class DockerCollector {
  private socketPath: string;

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
          timeout: 1000,
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
                const image = c.Image || '';
                const ports: number[] = (c.Ports || [])
                  .map((p: any) => p.PublicPort || p.PrivatePort)
                  .filter(Boolean);
                return {
                  id: c.Id,
                  name,
                  image,
                  state: c.State || 'running',
                  ports: Array.from(new Set(ports)),
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
   * Dynamically inspects running Docker containers to find target container & port matching serviceId.
   */
  public async findContainerPort(serviceId: string): Promise<number | null> {
    const containers = await this.getRunningContainers();
    if (containers.length === 0) return null;

    const s = serviceId.toLowerCase().trim().replace(/[-_]/g, '');

    for (const c of containers) {
      const cNameNorm = c.name.toLowerCase().replace(/[-_]/g, '');
      const cImgNorm = c.image.toLowerCase().replace(/[-_]/g, '');

      // Check for name/image match
      if (
        cNameNorm === s ||
        cNameNorm.includes(s) ||
        (s.length >= 4 && cNameNorm.endsWith(s)) ||
        (s.length >= 4 && cImgNorm.includes(s))
      ) {
        if (c.ports.length > 0) {
          // Prefer public exposed port if available
          return c.ports[0];
        }
      }
    }

    return null;
  }
}
