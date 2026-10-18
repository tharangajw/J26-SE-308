import type { CollectionSource, PerformanceService } from './types';

export const performanceServices: PerformanceService[] = [];

export const collectionSources: CollectionSource[] = [
  { name: 'Prometheus', endpoint: 'http://localhost:9091', purpose: 'CPU, memory, RPS and latency histograms', status: 'connected' },
  { name: 'Jaeger', endpoint: 'http://localhost:16686', purpose: 'Cross-service traces and span latency', status: 'connected' },
  { name: 'Kubernetes API', endpoint: 'http://localhost:8001', purpose: 'Replica count and HPA state', status: 'not configured' },
];