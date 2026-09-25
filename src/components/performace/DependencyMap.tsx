import React from 'react';
import { CheckCircle2, ChevronRight, CircleAlert, GitBranch } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

const dependencies = [
  { name: 'payment-service', depth: 1, status: 'Healthy', children: [{ name: 'bank-gateway-service', depth: 2, status: 'Healthy' }, { name: 'fraud-check-service', depth: 2, status: 'Degraded' }] },
  { name: 'inventory-service', depth: 1, status: 'Healthy', children: [{ name: 'warehouse-db', depth: 2, status: 'Healthy' }] },
  { name: 'notification-service', depth: 1, status: 'Degraded', children: [] },
];

export const DependencyMap: React.FC = () => (
  <Card className="h-full"><CardHeader><CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary"><GitBranch className="h-4 w-4 text-brand-perf" /> Fan-out dependency map</CardTitle><p className="mt-1 text-xs text-text-muted">order-service downstream call graph</p></CardHeader><CardContent>
    <div className="rounded-md border border-brand-perf/40 bg-brand-perf/5 p-3"><p className="text-xs uppercase tracking-wider text-text-muted">Depth 0</p><p className="mt-1 font-mono font-medium text-brand-perf">order-service</p></div>
    <div className="ml-5 border-l border-border pl-5">{dependencies.map((dependency) => <div key={dependency.name} className="relative pt-4 first:pt-5"><ChevronRight className="absolute -left-[25px] top-5 h-4 w-4 text-text-muted" /><div className="flex items-center justify-between gap-3"><div><p className="text-xs text-text-muted">Depth {dependency.depth}</p><p className="font-mono text-sm text-text-primary">{dependency.name}</p></div><span className={`flex items-center gap-1 text-xs ${dependency.status === 'Healthy' ? 'text-emerald-400' : 'text-amber-400'}`}>{dependency.status === 'Healthy' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}{dependency.status}</span></div>{dependency.children.length > 0 && <div className="ml-5 mt-2 space-y-2 border-l border-border/70 pl-4">{dependency.children.map((child) => <div key={child.name} className="flex items-center justify-between gap-2"><span className="font-mono text-xs text-text-secondary">Depth {child.depth} · {child.name}</span><span className={child.status === 'Healthy' ? 'text-xs text-emerald-400' : 'text-xs text-amber-400'}>{child.status}</span></div>)}</div>}</div>)}</div>
  </CardContent></Card>
);
