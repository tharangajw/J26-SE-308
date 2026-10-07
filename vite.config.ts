import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { ServerResponse } from 'node:http'

function handleProxyError(name: string) {
  return (_err: Error, _req: unknown, res: unknown) => {
    const response = res as ServerResponse | undefined;
    if (response && typeof response.writeHead === 'function' && !response.headersSent) {
      response.writeHead(502, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: `${name} backend unavailable` }));
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react()
  ],
  server: {
    proxy: {
      '/proxy/prometheus': {
        target: 'http://localhost:9090',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/prometheus/, ''),
        configure: (proxy) => {
          proxy.on('error', handleProxyError('Prometheus'));
        }
      },
      '/proxy/loki': {
        target: 'http://localhost:3100',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/loki/, ''),
        configure: (proxy) => {
          proxy.on('error', handleProxyError('Loki'));
        }
      },
      '/proxy/jaeger': {
        target: 'http://localhost:16686',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/jaeger/, ''),
        configure: (proxy) => {
          proxy.on('error', handleProxyError('Jaeger'));
        }
      }
    }
  }
})
