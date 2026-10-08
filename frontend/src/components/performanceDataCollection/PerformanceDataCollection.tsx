import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Copy,
  Database,
  ExternalLink,
  GitBranch,
  Network,
  Play,
  Plus,
  Radio,
  Server,
  Sparkles,
  Trash2,
  TriangleAlert,
  XCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { collectionSources } from './serviceCatalog';
import { PipelineNormalization } from './PipelineNormalization';
import type { PerformanceService } from './types';

const statusStyle = {
  healthy: 'text-emerald-400',
  degraded: 'text-amber-400',
  offline: 'text-rose-400',
};

export const PerformanceDataCollection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'phase1' | 'phase2'>('phase1');
  const [servicesList, setServicesList] = useState<PerformanceService[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [requestState, setRequestState] = useState('Ready to collect');
  const [collectedData, setCollectedData] = useState<any>(null);
  const [isCollecting, setIsCollecting] = useState(false);

  const endpoint = '/api/telemetry/snapshot';

  const toggleService = (serviceId: string) => {
    setSelectedServices((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId]
    );
  };

  const handleAddCustomService = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customInput.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    if (!trimmed) return;

    if (!servicesList.some((s) => s.id === trimmed)) {
      const newService: PerformanceService = {
        id: trimmed,
        name: customInput.trim(),
        port: 8080,
        role: 'Target microservice',
        dependencies: [],
        status: 'offline', // Default to offline until snapshot collection verifies live metrics
      };
      setServicesList((prev) => [...prev, newService]);
      setSelectedServices((prev) => [...prev, trimmed]);
    } else if (!selectedServices.includes(trimmed)) {
      setSelectedServices((prev) => [...prev, trimmed]);
    }
    setCustomInput('');
  };

  const removeService = (serviceId: string) => {
    setServicesList((prev) => prev.filter((s) => s.id !== serviceId));
    setSelectedServices((prev) => prev.filter((id) => id !== serviceId));
  };

  const collectSnapshot = async () => {
    if (selectedServices.length === 0) return;
    setIsCollecting(true);
    setRequestState('Querying Prometheus, Jaeger, Loki & K8s for selected services...');
    setCollectedData(null);

    try {
      const targetUrl = `http://localhost:8787${endpoint}?services=${selectedServices.join(',')}`;
      const response = await fetch(targetUrl);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Collector gateway error');
      }

      setCollectedData(data);

      // Dynamically update status based on real telemetry data received
      if (data && Array.isArray(data.snapshots)) {
        setServicesList((prevServices) =>
          prevServices.map((service) => {
            const snap = data.snapshots.find((s: any) => s.serviceId === service.id);
            if (!snap) return { ...service, status: 'offline' };

            const hasRealActivity =
              (snap.prometheus?.cpuUsageMillicores > 0) ||
              (snap.prometheus?.memoryUsageMB > 0) ||
              (snap.prometheus?.rps > 0) ||
              (snap.prometheus?.avgResponseTimeMs > 0) ||
              (snap.k8s?.podReplicaCount > 0) ||
              (snap.k8s?.uptimeSeconds > 0) ||
              (Array.isArray(snap.jaeger) && snap.jaeger.length > 0) ||
              (snap.loki?.totalCount > 0);

            let computedStatus: 'healthy' | 'degraded' | 'offline' = 'offline';

            if (hasRealActivity) {
              if (snap.loki?.errorCount > 10 || snap.prometheus?.p95LatencyMs > 500) {
                computedStatus = 'degraded';
              } else {
                computedStatus = 'healthy';
              }
            } else {
              computedStatus = 'offline';
            }

            return {
              ...service,
              status: computedStatus,
            };
          })
        );
      }

      setRequestState(`Snapshot collected for ${selectedServices.length} service(s)`);
    } catch (err: any) {
      setRequestState(`Collection failed: ${err.message || 'Make sure telemetry-collector (port 8787) is running'}`);
    } finally {
      setIsCollecting(false);
    }
  };

  const fullQueryUrl = selectedServices.length > 0
    ? `http://localhost:8787${endpoint}?services=${selectedServices.join(',')}`
    : `http://localhost:8787${endpoint}?services=<your-microservice-id>`;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-perf">
            Performance Engineering Pipeline
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Telemetry Preprocessing & Normalization</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary">
            Phase 1 connects live service streams. Phase 2 aligns timestamps onto a uniform 5s grid, imputes Prometheus scrape gaps, and normalizes heterogeneous units into standard 0.0–1.0 ranges.
          </p>
        </div>

        {/* Phase Navigation Tabs */}
        <div className="flex rounded-lg border border-border/80 bg-surface-secondary/40 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('phase1')}
            className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'phase1'
                ? 'bg-surface text-brand-perf shadow-sm border border-border/50'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Network className="h-3.5 w-3.5" /> Phase 1: Data Collection
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('phase2')}
            className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'phase2'
                ? 'bg-surface text-brand-perf shadow-sm border border-border/50'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-brand-perf" /> Phase 2: Preprocessing & Normalization
          </button>
        </div>
      </div>

      {/* Tab 1: Collection Map */}
      {activeTab === 'phase1' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={collectSnapshot}
              disabled={selectedServices.length === 0 || isCollecting}
              className="inline-flex items-center gap-2 rounded-md bg-brand-perf px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {isCollecting ? 'Collecting...' : 'Collect Snapshot'}
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <Card>
              <CardHeader className="border-b border-border/60">
                <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
                  <Network className="h-4 w-4 text-brand-perf" /> Multi-Service Target Connection Map
                </CardTitle>
                <p className="mt-1 text-xs text-text-muted">
                  Add or select microservice IDs running in your environment (e.g. order-service-1, user-service-1). Status is verified via live telemetry.
                </p>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                {/* Add Custom Microservice Input Form */}
                <form onSubmit={handleAddCustomService} className="flex gap-2">
                  <input
                    type="text"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder="Enter microservice ID (e.g. order-service-1, payment-service)..."
                    className="flex-1 rounded-md border border-border bg-surface-secondary/40 px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-brand-perf focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-md border border-brand-perf/40 bg-brand-perf/10 px-3 py-2 text-xs font-medium text-brand-perf transition-colors hover:bg-brand-perf/20"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Service
                  </button>
                </form>

                {/* Microservices List */}
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {servicesList.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/70 p-6 text-center text-xs text-text-muted">
                      No microservices added yet. Type your running microservice ID above and click <strong>"Add Service"</strong>.
                    </div>
                  ) : (
                    servicesList.map((service) => {
                      const selected = selectedServices.includes(service.id);
                      return (
                        <div
                          key={service.id}
                          className={`flex items-center justify-between gap-3 rounded-md border p-3 transition-colors ${
                            selected
                              ? 'border-brand-perf/60 bg-brand-perf/10'
                              : 'border-border bg-surface-secondary/20 hover:bg-surface-secondary/50'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleService(service.id)}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          >
                            <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${selected ? 'bg-brand-perf' : 'bg-text-muted'}`} />
                            <span className="min-w-0">
                              <span className="block font-mono text-sm text-text-primary">{service.id}</span>
                              <span className="mt-0.5 block text-xs text-text-muted">{service.role}</span>
                            </span>
                          </button>

                          <div className="flex items-center gap-2">
                            <span className={`flex shrink-0 items-center gap-1 text-xs ${statusStyle[service.status]}`}>
                              {service.status === 'healthy' ? (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              ) : service.status === 'degraded' ? (
                                <TriangleAlert className="h-3.5 w-3.5" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5" />
                              )}
                              {service.status}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeService(service.id)}
                              className="p-1 text-text-muted hover:text-rose-400 transition-colors"
                              title="Remove service"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-border/60 pt-4 text-xs text-text-secondary">
                  <span className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-brand-perf" /> {selectedServices.length} service(s) selected
                  </span>
                  <span className="font-mono text-text-muted">{requestState}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b border-border/60">
                <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
                  <Radio className="h-4 w-4 text-emerald-400" /> Collection sources
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                {collectionSources.map((source) => (
                  <div key={source.name} className="border-b border-border/60 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Database className="h-4 w-4 text-text-muted" />
                        {source.name}
                      </span>
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wider ${
                          source.status === 'connected' ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {source.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-text-muted">{source.purpose}</p>
                    <p className="mt-2 break-all font-mono text-[11px] text-text-secondary">{source.endpoint}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Live Response Payload Viewer */}
          {collectedData && (
            <Card className="border-brand-perf/40 bg-surface-secondary/20">
              <CardHeader className="border-b border-border/60">
                <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> Live Telemetry Snapshot Response Payload
                </CardTitle>
                <p className="mt-1 text-xs text-text-muted">
                  Raw telemetry data received from telemetry-collector gateway for {collectedData.snapshots?.length || 0} service(s).
                </p>
              </CardHeader>
              <CardContent className="pt-4">
                <pre className="max-h-80 overflow-y-auto rounded-md border border-border bg-background/80 p-4 font-mono text-xs text-emerald-300">
                  {JSON.stringify(collectedData, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
                <Server className="h-4 w-4 text-brand-perf" /> API Endpoint Command
              </CardTitle>
              <p className="mt-1 text-xs text-text-muted">Use this exact GET URL from Postman, cURL, or any external script.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface-secondary/30 p-3">
                <code className="break-all font-mono text-xs text-brand-perf">
                  {fullQueryUrl}
                </code>
                <button
                  type="button"
                  onClick={() =>
                    navigator.clipboard?.writeText(fullQueryUrl)
                  }
                  className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs text-text-secondary hover:text-text-primary"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy URL
                </button>
              </div>
              <div className="grid gap-3 text-xs text-text-secondary md:grid-cols-3">
                <p>
                  <Activity className="mb-1 h-4 w-4 text-brand-perf" />
                  Returns one telemetry snapshot per selected service.
                </p>
                <p>
                  <ExternalLink className="mb-1 h-4 w-4 text-cyan-400" />
                  Open Prometheus at <span className="font-mono">:9090</span> and Jaeger at <span className="font-mono">:16686</span>.
                </p>
                <p>
                  <Server className="mb-1 h-4 w-4 text-amber-400" />
                  Check response fields: <span className="font-mono">prometheus</span>, <span className="font-mono">jaeger</span>,{' '}
                  <span className="font-mono">loki</span>, <span className="font-mono">k8s</span>.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 2: Phase 2 Preprocessing & Normalization */}
      {activeTab === 'phase2' && <PipelineNormalization />}
    </div>
  );
};