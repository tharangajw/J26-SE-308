export interface PerformanceService {
  id: string;
  name: string;
  port: number;
  role: string;
  dependencies: string[];
  status: 'healthy' | 'degraded' | 'offline';
}

export interface CollectionSource {
  name: string;
  endpoint: string;
  purpose: string;
  status: 'connected' | 'not configured';
}