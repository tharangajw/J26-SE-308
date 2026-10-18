import React from 'react';
import { Database, Gauge, ShieldCheck, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';

const recommendations = [
  { title: 'Add Redis caching layer', description: 'Cache repeat reads on the order path to reduce P99 latency during traffic peaks.', priority: 'High', icon: Database },
  { title: 'Automate load testing in CI', description: 'Run k6 scenarios before deployment and block releases that exceed latency budgets.', priority: 'High', icon: Gauge },
  { title: 'Set resource requests and limits', description: 'Give services predictable CPU and memory allocations to prevent noisy-neighbor effects.', priority: 'Medium', icon: Zap },
  { title: 'Define latency SLOs', description: 'Track P95 and P99 objectives by endpoint so performance drift becomes actionable.', priority: 'Low', icon: ShieldCheck },
];

export const RecommendationList: React.FC = () => <Card><CardHeader><CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Automated recommendations</CardTitle><p className="mt-1 text-xs text-text-muted">Prioritized actions from current performance evidence</p></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{recommendations.map(({ title, description, priority, icon: Icon }) => <div key={title} className="border border-border/70 bg-surface-secondary/30 p-4"><div className="flex items-start justify-between gap-3"><Icon className="h-5 w-5 text-brand-perf" /><Badge variant={priority === 'High' ? 'destructive' : priority === 'Medium' ? 'warning' : 'outline'}>Priority: {priority}</Badge></div><h3 className="mt-4 font-medium text-text-primary">{title}</h3><p className="mt-1 text-sm leading-relaxed text-text-secondary">{description}</p></div>)}</CardContent></Card>;
