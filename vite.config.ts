import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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
      }
    }
  }
})
