import type { CollectionSource, PerformanceService } from './types';

export const performanceServices: PerformanceService[] = [
  { id: 'api-gateway', name: 'API Gateway', port: 3000, role: 'Entry point', dependencies: ['user-service', 'order-service'], status: 'healthy' },
  { id: 'user-service', name: 'User Service', port: 3002, role: 'Identity and profiles', dependencies: [], status: 'healthy' },
  { id: 'order-service', name: 'Order Service', port: 3003, role: 'Order orchestration', dependencies: ['inventory-service', 'payment-service'], status: 'degraded' },
  { id: 'inventory-service', name: 'Inventory Service', port: 3004, role: 'Stock reservation', dependencies: [], status: 'healthy' },
  { id: 'payment-service', name: 'Payment Service', port: 3005, role: 'Payment authorization', dependencies: [], status: 'healthy' },
];

export const collectionSources: CollectionSource[] = [
  { name: 'Prometheus', endpoint: 'http://localhost:9091', purpose: 'CPU, memory, RPS and latency histograms', status: 'connected' },
  { name: 'Jaeger', endpoint: 'http://localhost:16686', purpose: 'Cross-service traces and span latency', status: 'connected' },
  { name: 'Kubernetes API', endpoint: 'http://localhost:8001', purpose: 'Replica count and HPA state', status: 'not configured' },
];