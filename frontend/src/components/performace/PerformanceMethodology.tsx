import React from 'react';
import { Activity, Database, Gauge, Layers3, Network, Server, Timer, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

const parameterGroups = [
  {
    title: 'Infrastructure metrics',
    icon: Server,
    color: 'text-cyan-400',
    parameters: ['CPU utilization', 'Memory utilization', 'Disk I/O', 'Pod replica count'],
    justification: 'These metrics form the baseline resource-footprint layer for container and pod health. They are widely used by HPA and VPA, but the P-Score combines them with drift and anomaly analysis so a single noisy resource signal does not create a false performance alert.',
    source: '2026 arXiv auto-scaling survey and container benchmarking study',
    links: [
      { label: 'Auto-scaling survey', href: 'https://arxiv.org/pdf/2004.02372' },
      { label: 'Container benchmarking', href: 'https://arxiv.org/html/2507.17128' },
    ],
  },
  {
    title: 'Latency metrics',
    icon: Timer,
    color: 'text-amber-400',
    parameters: ['Average response time', 'P95 latency', 'P99 latency'],
    justification: 'Average latency shows typical behavior, while P95 and P99 expose the tail experienced by the slowest users. Window-level P95 is preferred for drift analysis because aggregation smooths volatile individual requests without hiding genuine degradation.',
    source: '2025 arXiv tail-latency prediction research',
    links: [{ label: 'Tail-latency research', href: 'https://arxiv.org/html/2512.16959v1' }],
  },
  {
    title: 'Throughput metrics',
    icon: TrendingUp,
    color: 'text-emerald-400',
    parameters: ['Requests per second (RPS)', 'Transactions per second (TPS)'],
    justification: 'Throughput gives context to latency. A high P95 during a high-RPS period can indicate expected load pressure rather than a regression, so RPS and TPS must be evaluated alongside tail latency to measure true load-handling capacity.',
    source: 'Systems and serving research practice',
    links: [{ label: 'RPS and tail latency study', href: 'https://arxiv.org/pdf/2606.05933' }],
  },
  {
    title: 'Elasticity metrics',
    icon: Layers3,
    color: 'text-rose-400',
    parameters: ['HPA trigger time', 'Pod spin-up time', 'Initialization lag'],
    justification: 'Elasticity measures whether the platform can respond before a traffic surge harms its SLO. HPA polling intervals, container cold starts, and initialization delays can leave a service under-provisioned even when scaling is configured correctly.',
    source: 'Kubernetes cold-start and production autoscaling research',
    links: [
      { label: 'Kubernetes resource strategies', href: 'https://scaleops.com/blog/5-kubernetes-resource-optimization-strategies-that-work-in-production/' },
      { label: 'Cold-start research', href: 'https://arxiv.org/pdf/2512.14290' },
    ],
  },
];

export const PerformanceMethodology: React.FC = () => (
  <div className="space-y-6">
    <Card className="border-brand-perf/30 bg-brand-perf/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Gauge className="h-5 w-5 text-brand-perf" /> Performance and scalability score</CardTitle>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary">The P-Score evaluates whether a service is fast under current load and capable of maintaining that performance as demand changes. It combines four parameter groups instead of relying on CPU or latency alone.</p>
      </CardHeader>
      <CardContent className="grid gap-3 border-t border-border/60 pt-5 sm:grid-cols-4">
        {[
          ['01', 'Resource footprint', 'Can the workload run efficiently?'],
          ['02', 'User-facing latency', 'How slow are the tail requests?'],
          ['03', 'Load-handling capacity', 'How much work can it sustain?'],
          ['04', 'Elasticity response', 'Can it scale before SLO impact?'],
        ].map(([number, title, description]) => <div key={number} className="border-l-2 border-brand-perf/50 pl-3"><p className="font-mono text-xs text-brand-perf">{number}</p><p className="mt-1 text-sm font-medium">{title}</p><p className="mt-1 text-xs text-text-muted">{description}</p></div>)}
      </CardContent>
    </Card>

    <div className="grid gap-4 lg:grid-cols-2">
      {parameterGroups.map(({ title, icon: Icon, color, parameters, justification, source, links }) => <Card key={title} className="h-full"><CardHeader className="border-b border-border/60 pb-4"><CardTitle className="flex items-center gap-2 text-base"><Icon className={`h-5 w-5 ${color}`} /> {title}</CardTitle><div className="mt-3 flex flex-wrap gap-2">{parameters.map((parameter) => <span key={parameter} className="rounded-full border border-border bg-surface-secondary px-2.5 py-1 text-xs text-text-secondary">{parameter}</span>)}</div></CardHeader><CardContent className="pt-5"><p className="text-sm leading-relaxed text-text-secondary">{justification}</p><p className="mt-4 text-xs font-medium text-text-muted">Academic / industry basis: {source}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">{links.map((link) => <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className={`text-xs font-medium underline underline-offset-4 ${color} hover:opacity-80`}>{link.label}</a>)}</div></CardContent></Card>)}
    </div>

    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary"><Network className="h-4 w-4 text-brand-perf" /> Why combine these parameters?</CardTitle></CardHeader>
      <CardContent className="grid gap-4 text-sm leading-relaxed text-text-secondary md:grid-cols-3">
        <p><Activity className="mb-2 h-4 w-4 text-cyan-400" />Resource metrics explain <strong className="font-medium text-text-primary">what is saturated</strong>.</p>
        <p><Database className="mb-2 h-4 w-4 text-amber-400" />Latency and throughput explain <strong className="font-medium text-text-primary">what users experience</strong>.</p>
        <p><Server className="mb-2 h-4 w-4 text-rose-400" />Elasticity explains <strong className="font-medium text-text-primary">whether the system can recover</strong>.</p>
      </CardContent>
    </Card>
  </div>
);
