import React from 'react';
import { AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

const workloadSignals = [
  { label: 'Baseline response time', value: '182 ms', status: 'Within target', icon: CheckCircle2, tone: 'text-emerald-400' },
  { label: 'Peak P99 response time', value: '1.24 s', status: 'Needs attention', icon: AlertTriangle, tone: 'text-rose-400' },
  { label: 'Load test cadence', value: 'Not configured', status: 'Pipeline gap', icon: Clock3, tone: 'text-amber-400' },
];

export const PerformanceWorkload: React.FC = () => (
  <Card>
    <CardHeader>
      <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Runtime signals</CardTitle>
    </CardHeader>
    <CardContent className="space-y-1">
      {workloadSignals.map(({ label, value, status, icon: Icon, tone }) => (
        <div key={label} className="flex items-center justify-between gap-4 border-b border-border/50 py-3 last:border-0">
          <div className="flex min-w-0 items-center gap-3">
            <Icon className={`h-4 w-4 shrink-0 ${tone}`} aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm text-text-primary">{label}</p>
              <p className={`mt-0.5 text-xs ${tone}`}>{status}</p>
            </div>
          </div>
          <span className="shrink-0 font-mono text-sm text-text-primary">{value}</span>
        </div>
      ))}
    </CardContent>
  </Card>
);
