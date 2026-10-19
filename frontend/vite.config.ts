import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // The project-level .env contains the VITE_* settings used by the frontend.
  envDir: '..',
  plugins: [
    tailwindcss(),
    react()
  ],
  server: {
    host: '127.0.0.1',
    port: 3000,
    proxy: {
      '/api/observability': {
        target: 'http://localhost:8010',
        changeOrigin: true,
      },
      '/proxy/prometheus': {
        target: 'http://localhost:9090',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/prometheus/, '')
      },
      '/proxy/loki': {
        target: 'http://localhost:3100',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/loki/, '')
      },
      '/proxy/jaeger': {
        target: 'http://localhost:16686',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/jaeger/, '')
      },
      '/api/telemetry': {
        target: 'http://localhost:8787',
        changeOrigin: true
      },
      '/api/anomaly': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anomaly/, '')
      }
    }
  }
})
