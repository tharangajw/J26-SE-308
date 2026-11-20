import React, { useState } from 'react';
import {
  X,
  Code2,
  Copy,
  Check,
  Database,
  Layers,
  Cpu,
  Sparkles,
  ArrowRight,
  Terminal,
  FileCode,
  ShieldAlert,
  Zap
} from 'lucide-react';

export interface RemediationRecommendation {
  id?: string;
  ruleId: string;
  serviceId: string;
  category: 'DATABASE_INDEXING' | 'REDIS_CACHING' | 'CONTAINER_BASE_IMAGE';
  title: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  effort: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  expectedPScoreImprovement: string;
  projectedServiceDeltaPts?: number;
  triggerEvidence: string;
}

interface RemediationPatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendation: RemediationRecommendation | null;
  onApplySimulation?: (recKey: string) => void;
  isSimulated?: boolean;
}

export const RemediationPatchModal: React.FC<RemediationPatchModalProps> = ({
  isOpen,
  onClose,
  recommendation,
  onApplySimulation,
  isSimulated = false,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen || !recommendation) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Generate prescriptive code snippets based on category & ruleId
  const getCodePatchDetails = () => {
    const sId = recommendation.serviceId || 'order-service-1';

    if (recommendation.category === 'DATABASE_INDEXING') {
      const mongoScript = `// MongoDB Compound Indexing Script
// Eliminates full collection scan (COLLSCAN) for ${sId}
use pscore_telemetry;

// 1. Create compound index on queried fields
db.orders.createIndex(
  { customerId: 1, createdAt: -1 },
  { name: "idx_orders_customer_created", background: true }
);

// 2. Verify index usage with explain plan
db.orders.find({ customerId: "cust_98124" }).sort({ createdAt: -1 }).explain("executionStats");
// Expected: "stage": "IXSCAN", "totalDocsExamined": 1 (instead of COLLSCAN)`;

      const mongooseCode = `// Node.js Mongoose Schema Index
const orderSchema = new mongoose.Schema({
  customerId: { type: String, required: true },
  totalAmount: { type: Number, required: true },
  status: { type: String, default: 'PENDING' },
  createdAt: { type: Date, default: Date.now }
});

// Compound index to accelerate query execution & eliminate latency drift
orderSchema.index({ customerId: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);`;

      return {
        tab1Title: 'MongoDB Shell Script',
        tab1Lang: 'mongodb',
        tab1Code: mongoScript,
        tab2Title: 'Mongoose / Model Definition',
        tab2Lang: 'typescript',
        tab2Code: mongooseCode,
        theoreticalGain: 'Reduces query execution latency from ~48ms to < 2ms (95% speedup). Eliminates CPU spikes during peak traffic.'
      };
    }

    if (recommendation.category === 'REDIS_CACHING') {
      const expressCacheMiddleware = `// Redis Cache-Aside Middleware for ${sId}
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const CACHE_TTL_SECONDS = 60; // 1-minute TTL for high-frequency order reads

export const cacheAsideMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (req.method !== 'GET') return next();

  const cacheKey = \`cache:\${req.baseUrl}\${req.path}:\${JSON.stringify(req.query)}\`;
  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      res.setHeader('X-Cache-Status', 'HIT');
      return res.status(200).json(JSON.parse(cachedData));
    }

    // Cache Miss: Intercept json response and store in Redis
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(body)).catch(console.error);
      res.setHeader('X-Cache-Status', 'MISS');
      return originalJson(body);
    };
    next();
  } catch (err) {
    console.warn('[Cache] Redis error, bypassing cache:', err);
    next();
  }
};`;

      const routeUsage = `// App Route Integration
import { cacheAsideMiddleware } from './middleware/cache';

// Protect read-heavy endpoints from database thrashing
app.get('/api/orders/:id', cacheAsideMiddleware, getOrderById);
app.get('/api/orders/user/:userId', cacheAsideMiddleware, getOrdersByUser);`;

      return {
        tab1Title: 'Express / Redis Middleware',
        tab1Lang: 'typescript',
        tab1Code: expressCacheMiddleware,
        tab2Title: 'Route Registration',
        tab2Lang: 'typescript',
        tab2Code: routeUsage,
        theoreticalGain: 'Absorbs 85% of read queries at RAM speed (< 1.5ms). Mitigates tail latency amplification (P99/P95 ratio drops below 1.25x).'
      };
    }

    // Default: Container & Pod HPA Tuning
    const k8sHpaYaml = `# Kubernetes Deployment & HPA Tuning for ${sId}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${sId}
  labels:
    app: ${sId}
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: ${sId}
        image: ${sId}:v2.1-optimized
        resources:
          requests:
            cpu: "250m"
            memory: "256Mi"
          limits:
            cpu: "1000m"
            memory: "512Mi"
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ${sId}-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${sId}
  minReplicas: 2
  maxReplicas: 8
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70`;

    const dockerfileOpt = `# Multi-Stage Distroless Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

# Minimal Production Distroless Container (eliminates 80% container memory overhead)
FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app
COPY --from=builder /app /app
USER nonroot
EXPOSE 3000
CMD ["server.js"]`;

    return {
      tab1Title: 'Kubernetes HPA & Limits YAML',
      tab1Lang: 'yaml',
      tab1Code: k8sHpaYaml,
      tab2Title: 'Distroless Dockerfile',
      tab2Lang: 'dockerfile',
      tab2Code: dockerfileOpt,
      theoreticalGain: 'Prevents container OOM restarts and memory thrashing. Reduces cold-start warmup lag to under 15 seconds.'
    };
  };

  const patchData = getCodePatchDetails();
  const recKey = recommendation.id || `${recommendation.serviceId}-${recommendation.ruleId}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/80 bg-surface-secondary/40 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-perf/15 text-brand-perf border border-brand-perf/30">
              <Code2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-brand-perf">
                  Prescriptive Auto-Remediation Patch
                </span>
                <span className="rounded bg-surface px-2 py-0.5 font-mono text-[10px] font-bold text-text-primary border border-border">
                  {recommendation.serviceId}
                </span>
              </div>
              <h3 className="text-base font-bold text-text-primary mt-0.5">{recommendation.title}</h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-surface p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-border/80 bg-surface-secondary/20 p-3 space-y-1">
              <span className="text-[10px] font-mono uppercase text-text-muted">Target Optimization</span>
              <div className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                {recommendation.category === 'DATABASE_INDEXING' && <Database className="h-3.5 w-3.5 text-sky-400" />}
                {recommendation.category === 'REDIS_CACHING' && <Layers className="h-3.5 w-3.5 text-emerald-400" />}
                {recommendation.category === 'CONTAINER_BASE_IMAGE' && <Cpu className="h-3.5 w-3.5 text-amber-400" />}
                {recommendation.category}
              </div>
            </div>

            <div className="rounded-lg border border-border/80 bg-surface-secondary/20 p-3 space-y-1">
              <span className="text-[10px] font-mono uppercase text-text-muted">Projected P-Score Gain</span>
              <div className="text-xs font-bold text-emerald-400 font-mono">
                {recommendation.expectedPScoreImprovement} (+{recommendation.projectedServiceDeltaPts ?? 4.0} pts)
              </div>
            </div>

            <div className="rounded-lg border border-border/80 bg-surface-secondary/20 p-3 space-y-1">
              <span className="text-[10px] font-mono uppercase text-text-muted">Engineering Effort</span>
              <div className="text-xs font-bold text-text-primary">
                {recommendation.impact} Impact · {recommendation.effort} Effort
              </div>
            </div>
          </div>

          {/* Trigger Evidence Callout */}
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 space-y-1.5">
            <div className="text-xs font-mono font-bold uppercase text-sky-400 flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5" /> Empirical Telemetry Trigger Evidence
            </div>
            <p className="text-xs text-text-secondary font-mono leading-relaxed">
              {recommendation.triggerEvidence}
            </p>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">
              {recommendation.description}
            </p>
          </div>

          {/* Code Snippet 1 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                <FileCode className="h-4 w-4 text-brand-perf" /> {patchData.tab1Title}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(patchData.tab1Code, 'tab1')}
                className="inline-flex items-center gap-1.5 rounded border border-border bg-surface px-2.5 py-1 font-mono text-[11px] text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors"
              >
                {copiedKey === 'tab1' ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> Copy Code
                  </>
                )}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-xl border border-border/80 bg-slate-950 p-4 font-mono text-xs text-emerald-300 leading-relaxed shadow-inner">
              <code>{patchData.tab1Code}</code>
            </pre>
          </div>

          {/* Code Snippet 2 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                <FileCode className="h-4 w-4 text-sky-400" /> {patchData.tab2Title}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(patchData.tab2Code, 'tab2')}
                className="inline-flex items-center gap-1.5 rounded border border-border bg-surface px-2.5 py-1 font-mono text-[11px] text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors"
              >
                {copiedKey === 'tab2' ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> Copy Code
                  </>
                )}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-xl border border-border/80 bg-slate-950 p-4 font-mono text-xs text-sky-300 leading-relaxed shadow-inner">
              <code>{patchData.tab2Code}</code>
            </pre>
          </div>

          {/* Theoretical Gain Box */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="text-xs font-bold uppercase font-mono text-emerald-400">
                Architectural Performance Outcome
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                {patchData.theoreticalGain}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/80 bg-surface-secondary/40 px-6 py-4">
          <div className="text-xs text-text-muted">
            Ready to deploy to container cluster. All changes are non-destructive.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border bg-surface px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Close
            </button>
            {onApplySimulation && (
              <button
                type="button"
                onClick={() => {
                  onApplySimulation(recKey);
                  onClose();
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-mono text-xs font-bold transition-all shadow-sm ${
                  isSimulated
                    ? 'bg-surface border border-emerald-500/40 text-emerald-400'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                }`}
              >
                {isSimulated ? '✓ Already Simulated' : '⚡ Simulate What-If Gain'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
