import React from 'react';
import {
  Activity,
  Cpu,
  Server,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Box,
  Layers,
  GitPullRequest,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Network,
  Terminal,
  Gauge
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  Legend
} from 'recharts';

export interface ServiceRuntime {
  service: string;
  podRestarts: number;      // Feature 10
  cpuSpikePct: number;
  memSpikePct: number;
  errorRatePct: number;     // Feature 9
  http4xxCount: number;
  http5xxCount: number;
  maxCallDepth: number;     // Feature 7
  syncCallCount: number;    // Feature 8
  status: 'Healthy' | 'Degraded' | 'Critical';
}

export interface TraceSpan {
  spanId: string;
  service: string;
  operation: string;
  durationMs: number;
  depth: number;
  type: 'SYNC_HTTP' | 'DB_QUERY' | 'INTERNAL';
  status: 'OK' | 'ERROR';
}

export interface Phase3ScenarioState {
  id: string;
  name: string;
  targetService: string;
  cscore: number;
  threshold: number;
  decision: 'PROCEED' | 'ABORT';
  prCommentReason: string;
  featureVector: {
    commitFreq: number;
    coDeployRate: number;
    couplingIndex: number;
    apiDiff: number;
    consumers: number;
    blastRadius: number;
    maxCallDepth: number;
    syncCallCount: number;
    errorRatePct: number;
    podRestarts: number;
  };
  services: ServiceRuntime[];
  traceSpans: TraceSpan[];
  summary: {
    totalPodRestarts: number;
    avgCpuSpike: number;
    avgErrorRate: number;
    maxClusterDepth: number;
    totalSyncCalls: number;
    overallRuntimeStatus: 'NOMINAL' | 'WARNING' | 'CRITICAL';
  };
}

export const PHASE3_SCENARIOS: Record<string, Phase3ScenarioState> = {
  healthy: {
    id: 'healthy',
    name: 'Nominal Canary Run (Pass Gate)',
    targetService: 'order-service',
    cscore: 14.2,
    threshold: 28.9,
    decision: 'PROCEED',
    prCommentReason:
      'Canary Deployment Passed: All 10 architectural & runtime features are within nominal bounds (Max Call Depth: 2, Pod Restarts: 0, Error Rate: 0.2%). Promoting build from Sandbox to Production.',
    featureVector: {
      commitFreq: 4.0,
      coDeployRate: 0.25,
      couplingIndex: 0.208,
      apiDiff: 0,
      consumers: 1,
      blastRadius: 0,
      maxCallDepth: 2,
      syncCallCount: 2,
      errorRatePct: 0.2,
      podRestarts: 0
    },
    services: [
      {
        service: 'gateway',
        podRestarts: 0,
        cpuSpikePct: 18.4,
        memSpikePct: 32.0,
        errorRatePct: 0.0,
        http4xxCount: 0,
        http5xxCount: 0,
        maxCallDepth: 3,
        syncCallCount: 1,
        status: 'Healthy'
      },
      {
        service: 'order-service',
        podRestarts: 0,
        cpuSpikePct: 22.5,
        memSpikePct: 41.0,
        errorRatePct: 0.2,
        http4xxCount: 1,
        http5xxCount: 0,
        maxCallDepth: 2,
        syncCallCount: 2,
        status: 'Healthy'
      },
      {
        service: 'book-service',
        podRestarts: 0,
        cpuSpikePct: 14.2,
        memSpikePct: 29.5,
        errorRatePct: 0.0,
        http4xxCount: 0,
        http5xxCount: 0,
        maxCallDepth: 1,
        syncCallCount: 0,
        status: 'Healthy'
      },
      {
        service: 'user-service',
        podRestarts: 0,
        cpuSpikePct: 11.8,
        memSpikePct: 26.0,
        errorRatePct: 0.0,
        http4xxCount: 0,
        http5xxCount: 0,
        maxCallDepth: 1,
        syncCallCount: 0,
        status: 'Healthy'
      }
    ],
    traceSpans: [
      { spanId: 'sp-101', service: 'gateway', operation: 'POST /api/orders', durationMs: 48, depth: 1, type: 'SYNC_HTTP', status: 'OK' },
      { spanId: 'sp-102', service: 'order-service', operation: 'POST /orders (Controller)', durationMs: 42, depth: 2, type: 'INTERNAL', status: 'OK' },
      { spanId: 'sp-103', service: 'user-service', operation: 'GET /users/:id (Sync Validation)', durationMs: 12, depth: 3, type: 'SYNC_HTTP', status: 'OK' },
      { spanId: 'sp-104', service: 'book-service', operation: 'GET /books/:id (Sync Stock Check)', durationMs: 15, depth: 3, type: 'SYNC_HTTP', status: 'OK' },
      { spanId: 'sp-105', service: 'orders_db', operation: 'MongoDB INSERT orders', durationMs: 8, depth: 3, type: 'DB_QUERY', status: 'OK' }
    ],
    summary: {
      totalPodRestarts: 0,
      avgCpuSpike: 16.7,
      avgErrorRate: 0.05,
      maxClusterDepth: 3,
      totalSyncCalls: 3,
      overallRuntimeStatus: 'NOMINAL'
    }
  },
  pod_crash: {
    id: 'pod_crash',
    name: 'Memory Leak & Pod CrashLoopBackOff (Feature 10 Alert)',
    targetService: 'order-service',
    cscore: 99.8,
    threshold: 28.9,
    decision: 'ABORT',
    prCommentReason:
      'Deployment Blocked: High Architectural & Runtime Risk — Kubernetes Pod crashed and restarted 14 times (OOMKilled / CrashLoopBackOff) with 5.4% HTTP 5xx Error Rate during Canary test traffic.',
    featureVector: {
      commitFreq: 12.0,
      coDeployRate: 0.67,
      couplingIndex: 0.583,
      apiDiff: 1,
      consumers: 1,
      blastRadius: 1,
      maxCallDepth: 3,
      syncCallCount: 2,
      errorRatePct: 5.4,
      podRestarts: 14
    },
    services: [
      {
        service: 'gateway',
        podRestarts: 0,
        cpuSpikePct: 34.0,
        memSpikePct: 44.0,
        errorRatePct: 4.2,
        http4xxCount: 3,
        http5xxCount: 18,
        maxCallDepth: 3,
        syncCallCount: 1,
        status: 'Degraded'
      },
      {
        service: 'order-service',
        podRestarts: 14,
        cpuSpikePct: 78.5,
        memSpikePct: 96.4,
        errorRatePct: 5.4,
        http4xxCount: 4,
        http5xxCount: 23,
        maxCallDepth: 3,
        syncCallCount: 2,
        status: 'Critical'
      },
      {
        service: 'book-service',
        podRestarts: 0,
        cpuSpikePct: 19.0,
        memSpikePct: 33.0,
        errorRatePct: 0.0,
        http4xxCount: 0,
        http5xxCount: 0,
        maxCallDepth: 1,
        syncCallCount: 0,
        status: 'Healthy'
      },
      {
        service: 'user-service',
        podRestarts: 0,
        cpuSpikePct: 15.2,
        memSpikePct: 28.0,
        errorRatePct: 0.0,
        http4xxCount: 0,
        http5xxCount: 0,
        maxCallDepth: 1,
        syncCallCount: 0,
        status: 'Healthy'
      }
    ],
    traceSpans: [
      { spanId: 'sp-201', service: 'gateway', operation: 'POST /api/orders', durationMs: 1420, depth: 1, type: 'SYNC_HTTP', status: 'ERROR' },
      { spanId: 'sp-202', service: 'order-service', operation: 'POST /orders (OOM CrashLoop)', durationMs: 1395, depth: 2, type: 'INTERNAL', status: 'ERROR' },
      { spanId: 'sp-203', service: 'user-service', operation: 'GET /users/:id (Sync Validation)', durationMs: 18, depth: 3, type: 'SYNC_HTTP', status: 'OK' },
      { spanId: 'sp-204', service: 'book-service', operation: 'GET /books/:id (Connection Reset)', durationMs: 1250, depth: 3, type: 'SYNC_HTTP', status: 'ERROR' }
    ],
    summary: {
      totalPodRestarts: 14,
      avgCpuSpike: 36.7,
      avgErrorRate: 2.4,
      maxClusterDepth: 3,
      totalSyncCalls: 3,
      overallRuntimeStatus: 'CRITICAL'
    }
  },
  deep_trace_cascade: {
    id: 'deep_trace_cascade',
    name: 'N+1 Blocking Cascade & Deep Call Chain (Features 7 & 8 Alert)',
    targetService: 'order-service',
    cscore: 94.6,
    threshold: 28.9,
    decision: 'ABORT',
    prCommentReason:
      'Deployment Blocked: High Architectural Risk (Max Call Depth = 6 levels & Synchronous Blocking Call Count = 9 per request exceeded safe microservice decoupling limits, causing severe latency amplification).',
    featureVector: {
      commitFreq: 11.0,
      coDeployRate: 0.72,
      couplingIndex: 0.589,
      apiDiff: 2,
      consumers: 2,
      blastRadius: 4,
      maxCallDepth: 6,
      syncCallCount: 9,
      errorRatePct: 3.8,
      podRestarts: 2
    },
    services: [
      {
        service: 'gateway',
        podRestarts: 0,
        cpuSpikePct: 52.0,
        memSpikePct: 58.0,
        errorRatePct: 2.1,
        http4xxCount: 2,
        http5xxCount: 8,
        maxCallDepth: 6,
        syncCallCount: 3,
        status: 'Degraded'
      },
      {
        service: 'order-service',
        podRestarts: 2,
        cpuSpikePct: 92.4,
        memSpikePct: 84.0,
        errorRatePct: 3.8,
        http4xxCount: 5,
        http5xxCount: 14,
        maxCallDepth: 5,
        syncCallCount: 9,
        status: 'Critical'
      },
      {
        service: 'book-service',
        podRestarts: 0,
        cpuSpikePct: 76.0,
        memSpikePct: 69.0,
        errorRatePct: 1.5,
        http4xxCount: 1,
        http5xxCount: 6,
        maxCallDepth: 3,
        syncCallCount: 4,
        status: 'Degraded'
      },
      {
        service: 'user-service',
        podRestarts: 0,
        cpuSpikePct: 64.0,
        memSpikePct: 55.0,
        errorRatePct: 0.8,
        http4xxCount: 4,
        http5xxCount: 0,
        maxCallDepth: 2,
        syncCallCount: 2,
        status: 'Healthy'
      }
    ],
    traceSpans: [
      { spanId: 'sp-301', service: 'gateway', operation: 'POST /api/orders', durationMs: 890, depth: 1, type: 'SYNC_HTTP', status: 'OK' },
      { spanId: 'sp-302', service: 'order-service', operation: 'POST /orders (N+1 Loop)', durationMs: 860, depth: 2, type: 'INTERNAL', status: 'OK' },
      { spanId: 'sp-303', service: 'user-service', operation: 'GET /users/:id (Sync Call #1)', durationMs: 95, depth: 3, type: 'SYNC_HTTP', status: 'OK' },
      { spanId: 'sp-304', service: 'book-service', operation: 'GET /books/:id (Sync Call #2..#8)', durationMs: 610, depth: 4, type: 'SYNC_HTTP', status: 'OK' },
      { spanId: 'sp-305', service: 'user-service', operation: 'GET /users/verify (Nested Sync Hop)', durationMs: 210, depth: 5, type: 'SYNC_HTTP', status: 'OK' },
      { spanId: 'sp-306', service: 'books_db', operation: 'MongoDB Lock Wait (Depth 6)', durationMs: 145, depth: 6, type: 'DB_QUERY', status: 'ERROR' }
    ],
    summary: {
      totalPodRestarts: 2,
      avgCpuSpike: 71.1,
      avgErrorRate: 2.05,
      maxClusterDepth: 6,
      totalSyncCalls: 18,
      overallRuntimeStatus: 'CRITICAL'
    }
  },
  error_storm: {
    id: 'error_storm',
    name: 'HTTP 4xx/5xx Error Rate Storm (Feature 9 Alert)',
    targetService: 'book-service',
    cscore: 96.4,
    threshold: 28.9,
    decision: 'ABORT',
    prCommentReason:
      'Deployment Blocked: High Architectural Risk — Breaking API Contract (Blast Radius = 6) triggered an 18.4% HTTP 4xx/5xx Error Rate across downstream consumers in the Canary Sandbox.',
    featureVector: {
      commitFreq: 14.0,
      coDeployRate: 0.71,
      couplingIndex: 0.649,
      apiDiff: 3,
      consumers: 2,
      blastRadius: 6,
      maxCallDepth: 4,
      syncCallCount: 4,
      errorRatePct: 18.4,
      podRestarts: 4
    },
    services: [
      {
        service: 'gateway',
        podRestarts: 0,
        cpuSpikePct: 48.0,
        memSpikePct: 52.0,
        errorRatePct: 14.2,
        http4xxCount: 42,
        http5xxCount: 29,
        maxCallDepth: 4,
        syncCallCount: 2,
        status: 'Critical'
      },
      {
        service: 'order-service',
        podRestarts: 1,
        cpuSpikePct: 66.0,
        memSpikePct: 71.0,
        errorRatePct: 16.8,
        http4xxCount: 55,
        http5xxCount: 29,
        maxCallDepth: 3,
        syncCallCount: 2,
        status: 'Critical'
      },
      {
        service: 'book-service',
        podRestarts: 3,
        cpuSpikePct: 84.5,
        memSpikePct: 88.0,
        errorRatePct: 18.4,
        http4xxCount: 38,
        http5xxCount: 54,
        maxCallDepth: 2,
        syncCallCount: 0,
        status: 'Critical'
      },
      {
        service: 'user-service',
        podRestarts: 0,
        cpuSpikePct: 16.0,
        memSpikePct: 30.0,
        errorRatePct: 0.0,
        http4xxCount: 0,
        http5xxCount: 0,
        maxCallDepth: 1,
        syncCallCount: 0,
        status: 'Healthy'
      }
    ],
    traceSpans: [
      { spanId: 'sp-401', service: 'gateway', operation: 'POST /api/orders -> HTTP 502', durationMs: 320, depth: 1, type: 'SYNC_HTTP', status: 'ERROR' },
      { spanId: 'sp-402', service: 'order-service', operation: 'POST /orders -> Downstream Schema Error', durationMs: 295, depth: 2, type: 'INTERNAL', status: 'ERROR' },
      { spanId: 'sp-403', service: 'book-service', operation: 'GET /books/:id -> HTTP 500 Invalid Field', durationMs: 240, depth: 3, type: 'SYNC_HTTP', status: 'ERROR' },
      { spanId: 'sp-404', service: 'books_db', operation: 'MongoDB Schema ValidationException', durationMs: 45, depth: 4, type: 'DB_QUERY', status: 'ERROR' }
    ],
    summary: {
      totalPodRestarts: 4,
      avgCpuSpike: 53.6,
      avgErrorRate: 12.35,
      maxClusterDepth: 4,
      totalSyncCalls: 4,
      overallRuntimeStatus: 'CRITICAL'
    }
  }
};

export const Phase3Dashboard: React.FC = () => {
  const scenario = PHASE3_SCENARIOS.pod_crash;
  const { services, summary, featureVector, traceSpans } = scenario;

  const vectorItems = [
    { idx: 1, phase: 'P1', name: 'CommitFreq', val: featureVector.commitFreq, color: 'text-blue-400' },
    { idx: 2, phase: 'P1', name: 'CoDeploy', val: featureVector.coDeployRate, color: 'text-blue-400' },
    { idx: 3, phase: 'P1', name: 'CouplingIdx', val: featureVector.couplingIndex, color: 'text-blue-400' },
    { idx: 4, phase: 'P2', name: 'APIDiff', val: featureVector.apiDiff, color: 'text-purple-400' },
    { idx: 5, phase: 'P2', name: 'Consumers', val: featureVector.consumers, color: 'text-purple-400' },
    { idx: 6, phase: 'P2', name: 'BlastRadius', val: featureVector.blastRadius, color: 'text-purple-400' },
    { idx: 7, phase: 'P3', name: 'MaxDepth', val: featureVector.maxCallDepth, color: 'text-amber-400' },
    { idx: 8, phase: 'P3', name: 'SyncCalls', val: featureVector.syncCallCount, color: 'text-amber-400' },
    { idx: 9, phase: 'P3', name: 'ErrorRate', val: `${featureVector.errorRatePct}%`, color: 'text-rose-400' },
    { idx: 10, phase: 'P3', name: 'Restarts', val: featureVector.podRestarts, color: 'text-rose-400' }
  ];

  return (
    <div className="h-full bg-background text-text-primary p-4 lg:p-6 overflow-y-auto space-y-6">
      
      {/* ── Top Header Banner ── */}
      <div className="flex flex-wrap lg:flex-nowrap justify-between items-center bg-surface border border-border rounded-xl p-4 shadow-sm gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.15)]">
            <Activity className="text-amber-400 w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-text-primary tracking-wide">
                Phase 3: Runtime Topology &amp; Infrastructure Monitor
              </h1>
              <span className="text-amber-400 border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 rounded text-xs font-mono">
                Canary Sandbox + XGBoost Gate
              </span>
            </div>
            <p className="text-[11px] text-text-muted uppercase tracking-widest mt-1">
              Kubernetes Canary Sandbox • OpenTelemetry Collector (Push) • Prometheus Metrics • XGBoost Brain
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs bg-surface-secondary/50 px-4 py-2 rounded-lg border border-border/50">
          <div className="flex gap-1.5 items-center">
            <span className="text-text-muted">Sandbox Cluster:</span>
            <span className="flex items-center gap-1 font-mono text-text-primary">
              <Box className="w-3.5 h-3.5 text-amber-400" /> k8s-canary-ns
            </span>
          </div>
          <div className="flex gap-1.5 items-center">
            <span className="text-text-muted">Ingestion Push:</span>
            <span className="font-mono text-emerald-400">POST /v1/telemetry</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${
            summary.overallRuntimeStatus === 'CRITICAL'
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
              : summary.overallRuntimeStatus === 'WARNING'
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              summary.overallRuntimeStatus === 'CRITICAL' ? 'bg-rose-400 animate-ping' : 'bg-emerald-400 animate-pulse'
            }`} />
            <span>{summary.overallRuntimeStatus} SANDBOX</span>
          </div>
        </div>
      </div>

      {/* ── Step-by-Step Phase 3 Architecture Flow Bar (Steps 1 to 5) ── */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="text-[11px] font-mono uppercase tracking-wider text-text-muted mb-3 flex items-center justify-between">
          <span>Phase 3 End-to-End Runtime Execution Flow (5 Stages)</span>
          <span className="text-amber-400">Zero Client Code Modification • Push Telemetry Model</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-surface-secondary/40 border border-border/60 flex flex-col justify-between">
            <div className="flex items-center justify-between text-blue-400 font-mono text-[10px] font-bold">
              <span>STEP 1</span>
              <Box className="w-3.5 h-3.5" />
            </div>
            <div className="font-semibold text-text-primary mt-1">K8s Canary Sandbox</div>
            <p className="text-[11px] text-text-muted mt-0.5">
              Deploys PR Docker image into isolated K8s Canary prior to Production.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-surface-secondary/40 border border-border/60 flex flex-col justify-between">
            <div className="flex items-center justify-between text-indigo-400 font-mono text-[10px] font-bold">
              <span>STEP 2</span>
              <Network className="w-3.5 h-3.5" />
            </div>
            <div className="font-semibold text-text-primary mt-1">Telemetry Push Model</div>
            <p className="text-[11px] text-text-muted mt-0.5">
              OTel Collector &amp; Prometheus push live traces &amp; metrics to SaaS API.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-surface-secondary/40 border border-amber-500/30 flex flex-col justify-between">
            <div className="flex items-center justify-between text-amber-400 font-mono text-[10px] font-bold">
              <span>STEP 3</span>
              <Activity className="w-3.5 h-3.5" />
            </div>
            <div className="font-semibold text-text-primary mt-1">Extract Features 7–10</div>
            <p className="text-[11px] text-text-muted mt-0.5">
              Max Call Depth, Sync Calls, HTTP 4xx/5xx Error Rate &amp; Pod Restarts.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-surface-secondary/40 border border-purple-500/30 flex flex-col justify-between">
            <div className="flex items-center justify-between text-purple-400 font-mono text-[10px] font-bold">
              <span>STEP 4</span>
              <Cpu className="w-3.5 h-3.5" />
            </div>
            <div className="font-semibold text-text-primary mt-1">XGBoost Brain (C-Score)</div>
            <p className="text-[11px] text-text-muted mt-0.5">
              Evaluates 10-feature vector from Phases 1, 2 &amp; 3 into 0–100 risk score.
            </p>
          </div>

          <div className={`p-3 rounded-lg border flex flex-col justify-between ${
            scenario.decision === 'PROCEED'
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-rose-500/10 border-rose-500/30'
          }`}>
            <div className={`flex items-center justify-between font-mono text-[10px] font-bold ${
              scenario.decision === 'PROCEED' ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              <span>STEP 5: VERDICT</span>
              {scenario.decision === 'PROCEED' ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
            </div>
            <div className="font-bold text-text-primary mt-1">
              {scenario.decision === 'PROCEED' ? 'PROCEED (Pass PR)' : 'ABORT (Block PR)'}
            </div>
            <p className="text-[11px] text-text-secondary mt-0.5">
              C-Score: <b>{scenario.cscore}</b> / {scenario.threshold} limit
            </p>
          </div>
        </div>
      </div>

      {/* ── Top 4 KPI Cards: Explicit Phase 3 Runtime Features (Feature 7 to Feature 10) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Feature 7: Maximum Call Depth */}
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">
                FEATURE 7 • OTel Traces
              </span>
              <Layers className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-xs text-text-muted uppercase tracking-wider font-semibold mt-2">Maximum Call Depth</div>
            <div className={`text-3xl font-bold font-mono tracking-wide mt-1 ${
              featureVector.maxCallDepth > 3 ? 'text-rose-400' : 'text-indigo-400'
            }`}>
              {featureVector.maxCallDepth} <span className="text-sm font-normal text-text-muted">hops</span>
            </div>
          </div>
          <div className="text-[11px] text-text-muted mt-3">
            Trace span depth before reaching DB ({featureVector.maxCallDepth > 3 ? 'High Complexity Risk' : 'Optimal Depth'})
          </div>
        </div>

        {/* Feature 8: Synchronous Call Count */}
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold">
                FEATURE 8 • OTel Spans
              </span>
              <Network className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-xs text-text-muted uppercase tracking-wider font-semibold mt-2">Synchronous Call Count</div>
            <div className={`text-3xl font-bold font-mono tracking-wide mt-1 ${
              featureVector.syncCallCount > 4 ? 'text-rose-400' : 'text-purple-400'
            }`}>
              {featureVector.syncCallCount} <span className="text-sm font-normal text-text-muted">blocking calls</span>
            </div>
          </div>
          <div className="text-[11px] text-text-muted mt-3">
            Sequential blocking HTTP calls ({featureVector.syncCallCount > 4 ? 'N+1 Query Cascade Detected' : 'No N+1 Bottleneck'})
          </div>
        </div>

        {/* Feature 9: HTTP Error Rates */}
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                FEATURE 9 • Prometheus
              </span>
              <Gauge className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xs text-text-muted uppercase tracking-wider font-semibold mt-2">HTTP 4xx/5xx Error Rate</div>
            <div className={`text-3xl font-bold font-mono tracking-wide mt-1 ${
              featureVector.errorRatePct > 2.0 ? 'text-rose-400' : 'text-emerald-400'
            }`}>
              {featureVector.errorRatePct}%
            </div>
          </div>
          <div className="text-[11px] text-text-muted mt-3">
            Client (4xx) &amp; Server (5xx) failure rate during Canary load
          </div>
        </div>

        {/* Feature 10: Pod Restarts */}
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
                FEATURE 10 • Prometheus
              </span>
              <Server className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-xs text-text-muted uppercase tracking-wider font-semibold mt-2">K8s Pod Restarts</div>
            <div className={`text-3xl font-bold font-mono tracking-wide mt-1 ${
              featureVector.podRestarts > 0 ? 'text-rose-400' : 'text-emerald-400'
            }`}>
              {featureVector.podRestarts} <span className="text-sm font-normal text-text-muted">restarts</span>
            </div>
          </div>
          <div className="text-[11px] text-text-muted mt-3">
            Container CrashLoopBackOff / Memory Leak crashes in Canary
          </div>
        </div>

      </div>

      {/* ── Main Section: Left (Service Matrix + OTel Trace Waterfall + Resource Chart) & Right (Simulator + Brain + PR Action) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* 1. Microservice Canary Runtime Health Matrix */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border/60 flex items-center justify-between bg-surface-secondary/30">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Canary Sandbox Microservice Telemetry Matrix (Features 7–10)
                </h3>
              </div>
              <span className="text-xs text-text-muted font-mono">OTel + Prometheus Live Stream</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border text-[11px] text-text-muted uppercase tracking-wider bg-surface-secondary/40 font-semibold">
                    <th className="py-3 px-4">Microservice</th>
                    <th className="py-3 px-4">Pod Status</th>
                    <th className="py-3 px-4">F7: Max Depth</th>
                    <th className="py-3 px-4">F8: Sync Calls</th>
                    <th className="py-3 px-4">F9: Error Rate (4xx/5xx)</th>
                    <th className="py-3 px-4">F10: Restarts</th>
                    <th className="py-3 px-4 text-right">CPU / RAM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {services.map((s, idx) => (
                    <tr key={idx} className="hover:bg-surface-secondary/20 transition-colors">
                      <td className="py-3 px-4 font-sans font-medium text-text-primary">
                        <div className="flex items-center gap-2">
                          <Box className="w-3.5 h-3.5 text-amber-400" />
                          <span>{s.service}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {s.status === 'Healthy' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-sans font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" /> Nominal
                          </span>
                        ) : s.status === 'Degraded' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-sans font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <AlertTriangle className="w-3 h-3" /> Degraded
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-sans font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <XCircle className="w-3 h-3" /> CrashLoop
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={s.maxCallDepth > 3 ? 'text-rose-400 font-bold' : 'text-indigo-400'}>
                          {s.maxCallDepth} levels
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={s.syncCallCount > 4 ? 'text-rose-400 font-bold' : 'text-purple-400'}>
                          {s.syncCallCount} blocking
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={s.errorRatePct > 2 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                          {s.errorRatePct}%
                        </span>
                        <span className="text-[10px] text-text-muted ml-1.5">
                          ({s.http4xxCount} 4xx / {s.http5xxCount} 5xx)
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-bold ${s.podRestarts > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {s.podRestarts}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-text-secondary">
                        {s.cpuSpikePct}% / {s.memSpikePct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Resource Utilization Bar Chart */}
            <div className="p-4 border-t border-border/60">
              <div className="text-xs font-semibold text-text-primary mb-3 flex items-center justify-between">
                <span>Canary Container CPU &amp; Memory Pressure (%)</span>
                <span className="text-[10px] text-text-muted font-mono">Prometheus cAdvisor Metrics</span>
              </div>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={services} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                    <XAxis dataKey="service" stroke="#737373" fontSize={11} />
                    <YAxis stroke="#737373" fontSize={11} domain={[0, 100]} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="cpuSpikePct" radius={[4, 4, 0, 0]} name="CPU Spike %">
                      {services.map((entry, index) => (
                        <Cell key={`cpu-${index}`} fill={entry.cpuSpikePct > 70 ? '#f43f5e' : entry.cpuSpikePct > 40 ? '#f59e0b' : '#10b981'} />
                      ))}
                    </Bar>
                    <Bar dataKey="memSpikePct" radius={[4, 4, 0, 0]} name="Memory Usage %" fill="#6366f1" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 2. OpenTelemetry Trace Span Tree Visualizer (Features 7 & 8 Inspector) */}
          <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-text-primary">
                  OpenTelemetry Distributed Trace Span Tree (Features 7 &amp; 8 Extraction)
                </h3>
              </div>
              <span className="text-[11px] font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded border border-indigo-500/20">
                Max Depth: {featureVector.maxCallDepth} • Sync Calls: {featureVector.syncCallCount}
              </span>
            </div>

            <div className="space-y-2">
              {traceSpans.map((span, idx) => (
                <div
                  key={idx}
                  style={{ marginLeft: `${(span.depth - 1) * 20}px` }}
                  className={`p-2.5 rounded-lg border text-xs font-mono flex items-center justify-between transition-all ${
                    span.status === 'ERROR'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      : 'bg-surface-secondary/50 border-border/60 text-text-primary'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-background/80 border border-border text-text-muted">
                      L{span.depth}
                    </span>
                    <span className="font-bold text-amber-400">{span.service}</span>
                    <ArrowRight className="w-3 h-3 text-text-muted shrink-0" />
                    <span className="truncate">{span.operation}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded border ${
                      span.type === 'SYNC_HTTP'
                        ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                        : span.type === 'DB_QUERY'
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                        : 'bg-surface border-border text-text-muted'
                    }`}>
                      {span.type}
                    </span>
                    <span className={`font-bold ${span.durationMs > 500 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {span.durationMs} ms
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column (4 cols): Step 4 Brain (10-Feature Vector) + Step 5 GitHub PR Action */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* 1. Step 4: The Brain — 10-Feature Vector & XGBoost Inference */}
          <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-brand-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
                  Step 4: The Brain (XGBoost 10-Feature Vector)
                </span>
              </div>
              <span className="text-[10px] font-mono text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded border border-brand-primary/20">
                xgboost_c_score_model.pkl
              </span>
            </div>

            {/* Live Feature Array Display */}
            <div className="p-2.5 rounded-lg bg-background/80 border border-border/60 font-mono text-[11px] text-text-secondary break-all">
              <span className="text-text-muted">// Input Vector X[1..10]:</span>
              <div className="text-amber-400 font-bold mt-1">
                [{featureVector.commitFreq}, {featureVector.coDeployRate}, {featureVector.couplingIndex}, {featureVector.apiDiff}, {featureVector.consumers}, {featureVector.blastRadius}, {featureVector.maxCallDepth}, {featureVector.syncCallCount}, {featureVector.errorRatePct}, {featureVector.podRestarts}]
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
              {vectorItems.map(item => (
                <div key={item.idx} className="flex items-center justify-between px-2.5 py-1.5 rounded bg-surface-secondary/40 border border-border/40">
                  <span className="text-text-muted">
                    F{item.idx} ({item.name}):
                  </span>
                  <span className={`font-bold ${item.color}`}>{item.val}</span>
                </div>
              ))}
            </div>

            {/* C-Score Output Gauge */}
            <div className="pt-2 border-t border-border/50">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-text-secondary font-medium">Predicted Architectural Risk (C-Score):</span>
                <span className={`font-mono font-bold text-base ${
                  scenario.cscore > scenario.threshold ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  {scenario.cscore} / 100
                </span>
              </div>
              <div className="w-full h-2.5 bg-surface-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    scenario.cscore > scenario.threshold ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(5, scenario.cscore))}%` }}
                />
              </div>
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-text-muted bg-surface-secondary/40 px-2.5 py-1.5 rounded border border-border/40">
                <span>Threshold: <b className="text-rose-400">&gt; {scenario.threshold} (HIGH RISK)</b></span>
                <span>ROC-AUC: <b className="text-emerald-400">0.8269</b></span>
                <span>Acc: <b className="text-blue-400">78.81%</b></span>
                <span>Dataset: <b className="text-text-primary">100k</b></span>
              </div>
            </div>
          </div>

          {/* 3. Step 5: Final Decision & Automated GitHub PR Comment */}
          <div className={`rounded-xl p-5 border space-y-3 ${
            scenario.decision === 'PROCEED'
              ? 'bg-emerald-500/5 border-emerald-500/30'
              : 'bg-rose-500/5 border-rose-500/30'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitPullRequest className={`w-4 h-4 ${scenario.decision === 'PROCEED' ? 'text-emerald-400' : 'text-rose-400'}`} />
                <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
                  Step 5: Pipeline Gatekeeper Action
                </span>
              </div>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                scenario.decision === 'PROCEED'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
              }`}>
                {scenario.decision === 'PROCEED' ? 'PASS → DEPLOY PROD' : 'ABORT → BLOCK PR'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-background/80 border border-border/60 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-text-muted">
                <Terminal className="w-3.5 h-3.5 text-brand-primary" />
                <span>Automated GitHub PR Comment Preview:</span>
              </div>
              <p className={`text-xs leading-relaxed font-medium ${
                scenario.decision === 'PROCEED' ? 'text-emerald-300' : 'text-rose-300'
              }`}>
                "{scenario.prCommentReason}"
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
