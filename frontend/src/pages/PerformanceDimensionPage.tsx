import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  Zap, 
  CheckCircle2, 
  TriangleAlert, 
  XCircle, 
  RefreshCw, 
  Server, 
  Gauge,
  Clock,
  BarChart3,
  ExternalLink
} from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';

interface RawServiceSnapshot {
  serviceId: string;
  timestamp: number;
  prometheus: {
    cpuUsageMillicores: number;
    memoryUsageMB: number;
    diskIoBytesPerSec: number;
    avgResponseTimeMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    rps: number;
  };
  loki: {
    errorCount: number;
    totalCount: number;
  };
  jaeger: any[];
  k8s: {
    podReplicaCount: number;
    uptimeSeconds: number;
  };
  sources: {
    prometheus: boolean;
    loki: boolean;
    jaeger: boolean;
    kubernetes: boolean;
  };
}

interface TelemetryResponse {
  requestedServices: string[];
  collectedAt: number;
  snapshots: RawServiceSnapshot[];
  errors: any[];
}

export const PerformanceDimensionPage: React.FC = () => {
  const [telemetryData, setTelemetryData] = useState<TelemetryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Core active services list to monitor
  const targetServices = ['book-service-1', 'order-service-1', 'user-service-1', 'gateway-1'];

  const fetchLivePerformanceTelemetry = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const url = `http://localhost:8787/api/telemetry/snapshot?services=${targetServices.join(',')}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Collector API responded with status ${res.status}`);
      }
      const data: TelemetryResponse = await res.json();
      setTelemetryData(data);
      setErrorMsg(null);
      setLastUpdated(new Date());
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to connect to telemetry collector (port 8787)');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLivePerformanceTelemetry();
    const interval = setInterval(fetchLivePerformanceTelemetry, 4000);
    return () => clearInterval(interval);
  }, [fetchLivePerformanceTelemetry]);

  // Dynamic P-Score and metric score calculations strictly based on real data
  const snapshots = telemetryData?.snapshots || [];
  const activeSnapshots = snapshots.filter((s) => 
    s.prometheus.cpuUsageMillicores > 0 || 
    s.prometheus.memoryUsageMB > 0 || 
    s.prometheus.avgResponseTimeMs > 0
  );

  const totalActive = activeSnapshots.length;
  
  const avgCpu = totalActive > 0 
    ? activeSnapshots.reduce((acc, s) => acc + s.prometheus.cpuUsageMillicores, 0) / totalActive 
    : 0;

  const avgMemory = totalActive > 0 
    ? activeSnapshots.reduce((acc, s) => acc + s.prometheus.memoryUsageMB, 0) / totalActive 
    : 0;

  const avgLatency = totalActive > 0 
    ? activeSnapshots.reduce((acc, s) => acc + s.prometheus.avgResponseTimeMs, 0) / totalActive 
    : 0;

  const maxP95 = totalActive > 0 
    ? Math.max(...activeSnapshots.map((s) => s.prometheus.p95LatencyMs)) 
    : 0;

  const totalRps = totalActive > 0 
    ? activeSnapshots.reduce((acc, s) => acc + s.prometheus.rps, 0) 
    : 0;

  // Real-time calculated metric sub-scores (0-100)
  const latencyScore = totalActive === 0 ? 0 : Math.max(0, Math.min(100, Math.round(100 - avgLatency * 0.5)));
  const resourceScore = totalActive === 0 ? 0 : Math.max(0, Math.min(100, Math.round(100 - (avgCpu / 500) * 100)));
  const throughputScore = totalActive === 0 ? 0 : Math.max(0, Math.min(100, Math.round(totalRps * 8)));
  const availabilityScore = Math.round((totalActive / targetServices.length) * 100);

  // Real overall P-Score formula
  const overallPScore = totalActive === 0 ? 0 : Math.round(
    latencyScore * 0.35 + 
    resourceScore * 0.25 + 
    throughputScore * 0.20 + 
    availabilityScore * 0.20
  );

  const getStatusBadge = (status: 'healthy' | 'degraded' | 'offline') => {
    if (status === 'healthy') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" /> Healthy
        </span>
      );
    }
    if (status === 'degraded') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400">
          <TriangleAlert className="h-3.5 w-3.5" /> Degraded
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-400">
        <XCircle className="h-3.5 w-3.5" /> Offline
      </span>
    );
  };

  return (
    <PageContainer className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight text-brand-perf flex items-center gap-2">
              <Zap className="h-6 w-6 text-brand-perf" /> Performance Maturity
            </h2>
            {isRefreshing && <RefreshCw className="h-4 w-4 animate-spin text-brand-perf" />}
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            Live telemetry stream evaluation computed in real-time from active Docker microservice containers.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={fetchLivePerformanceTelemetry}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-secondary/40 px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-secondary transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh Telemetry
          </button>
          <div className="text-right">
            <div className="text-4xl font-mono font-semibold text-brand-perf">
              {isLoading ? '--' : overallPScore}
              <span className="text-lg text-text-muted">/100</span>
            </div>
            <div className="text-xs font-medium uppercase tracking-widest text-text-secondary mt-0.5">
              {overallPScore >= 80 ? 'Optimized' : overallPScore >= 50 ? 'Intermediate' : 'Inactive / Offline'}
            </div>
          </div>
        </div>
      </div>

      {/* Collector Connection Status Banner */}
      {errorMsg ? (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>Collector Offline: {errorMsg}. Ensure <strong>pscore-telemetry-collector</strong> container (port 8787) is running.</span>
          </div>
          <button
            type="button"
            onClick={fetchLivePerformanceTelemetry}
            className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 font-mono text-[11px]"
          >
            Retry Connection
          </button>
        </div>
      ) : (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Connected to Live Telemetry Collector (port 8787). Monitoring {targetServices.length} target microservices.</span>
          </div>
          {lastUpdated && (
            <span className="font-mono text-[11px] text-emerald-400/80">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      )}

      {/* Primary Performance Metrics Summary Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border bg-surface-secondary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Average Latency</span>
              <Clock className="h-4 w-4 text-brand-perf" />
            </div>
            <div className="mt-2 text-2xl font-mono font-semibold text-text-primary">
              {totalActive > 0 ? `${avgLatency.toFixed(1)} ms` : '0 ms'}
            </div>
            <p className="mt-1 text-[11px] text-text-muted">P95 Max: {maxP95.toFixed(1)} ms</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-secondary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">CPU Utilization</span>
              <Cpu className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-2 text-2xl font-mono font-semibold text-text-primary">
              {totalActive > 0 ? `${avgCpu.toFixed(1)} m` : '0 m'}
            </div>
            <p className="mt-1 text-[11px] text-text-muted">Active Millicores average</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-secondary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Memory Usage</span>
              <HardDrive className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 text-2xl font-mono font-semibold text-text-primary">
              {totalActive > 0 ? `${avgMemory.toFixed(1)} MB` : '0 MB'}
            </div>
            <p className="mt-1 text-[11px] text-text-muted">Container RSS memory</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-secondary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Active Services</span>
              <Server className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-mono font-semibold text-text-primary">
              {totalActive} / {targetServices.length}
            </div>
            <p className="mt-1 text-[11px] text-text-muted">{availabilityScore}% availability ratio</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content: Real Metrics Breakdown & Live Microservices Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dynamic Metric Breakdown (Real Live Scores) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
              <BarChart3 className="h-4 w-4 text-brand-perf" /> Live Evaluated Performance Parameters
            </CardTitle>
            <p className="mt-1 text-xs text-text-muted">Parameter sub-scores computed directly from real telemetry data streams.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-text-primary">Response Time & Latency Budget (Weight 35%)</span>
                <span className="font-mono text-brand-perf font-semibold">{latencyScore} / 100</span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-secondary overflow-hidden">
                <div className="h-full bg-brand-perf transition-all duration-500" style={{ width: `${latencyScore}%` }} />
              </div>
              <p className="text-[11px] text-text-muted">Evaluated from live avg response time ({avgLatency.toFixed(1)}ms).</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-text-primary">Resource Footprint Efficiency (Weight 25%)</span>
                <span className="font-mono text-cyan-400 font-semibold">{resourceScore} / 100</span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-secondary overflow-hidden">
                <div className="h-full bg-cyan-400 transition-all duration-500" style={{ width: `${resourceScore}%` }} />
              </div>
              <p className="text-[11px] text-text-muted">Evaluated from container CPU millicores ({avgCpu.toFixed(1)}m) and RAM ({avgMemory.toFixed(1)}MB).</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-text-primary">Throughput & Request Capacity (Weight 20%)</span>
                <span className="font-mono text-amber-400 font-semibold">{throughputScore} / 100</span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-secondary overflow-hidden">
                <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${throughputScore}%` }} />
              </div>
              <p className="text-[11px] text-text-muted">Evaluated from live aggregated requests per second ({totalRps.toFixed(1)} RPS).</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-text-primary">Service Availability & Uptime (Weight 20%)</span>
                <span className="font-mono text-emerald-400 font-semibold">{availabilityScore} / 100</span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-secondary overflow-hidden">
                <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${availabilityScore}%` }} />
              </div>
              <p className="text-[11px] text-text-muted">Evaluated from {totalActive} active running containers out of {targetServices.length} target microservices.</p>
            </div>
          </CardContent>
        </Card>

        {/* Live Running Microservices Telemetry Status Grid */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
              <Server className="h-4 w-4 text-emerald-400" /> Monitored Microservices Live Telemetry
            </CardTitle>
            <p className="mt-1 text-xs text-text-muted">Live container metrics dynamically discovered from Docker Engine API.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {targetServices.map((serviceId) => {
              const snap = snapshots.find((s) => s.serviceId === serviceId);
              const isAlive = snap && (
                snap.prometheus.cpuUsageMillicores > 0 || 
                snap.prometheus.memoryUsageMB > 0 || 
                snap.prometheus.avgResponseTimeMs > 0
              );

              const status: 'healthy' | 'degraded' | 'offline' = isAlive
                ? snap.prometheus.p95LatencyMs > 500 ? 'degraded' : 'healthy'
                : 'offline';

              return (
                <div
                  key={serviceId}
                  className="flex items-center justify-between gap-3 rounded-md border border-border/80 bg-surface-secondary/30 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-text-primary">{serviceId}</span>
                      {getStatusBadge(status)}
                    </div>
                    {isAlive && snap ? (
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-text-secondary">
                        <span>CPU: <strong className="text-cyan-400">{snap.prometheus.cpuUsageMillicores} m</strong></span>
                        <span>RAM: <strong className="text-amber-400">{snap.prometheus.memoryUsageMB} MB</strong></span>
                        <span>Avg Latency: <strong className="text-brand-perf">{snap.prometheus.avgResponseTimeMs} ms</strong></span>
                      </div>
                    ) : (
                      <div className="mt-1 text-[11px] text-text-muted">No active metrics received from container</div>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
};
