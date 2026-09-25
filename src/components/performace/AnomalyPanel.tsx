import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';

const anomalies = [
  { timestamp: '12:42:18', metric: 'P99 latency', severity: 'High', score: '0.94', status: 'New' },
  { timestamp: '12:38:05', metric: 'CPU usage', severity: 'Medium', score: '0.81', status: 'Acknowledged' },
  { timestamp: '11:57:43', metric: 'Error rate', severity: 'High', score: '0.89', status: 'New' },
  { timestamp: '10:21:16', metric: 'Memory usage', severity: 'Low', score: '0.67', status: 'Resolved' },
  { timestamp: '09:48:32', metric: 'Request throughput', severity: 'Medium', score: '0.76', status: 'Acknowledged' },
  { timestamp: '08:12:09', metric: 'P95 latency', severity: 'Low', score: '0.59', status: 'Resolved' },
];

const severityVariant = (severity: string) => severity === 'High' ? 'destructive' : severity === 'Medium' ? 'warning' : 'outline';
const statusVariant = (status: string) => status === 'New' ? 'destructive' : status === 'Acknowledged' ? 'warning' : 'success';

export const AnomalyPanel: React.FC = () => (
  <Card>
    <CardHeader className="flex-row items-center justify-between border-b border-border/60"><div><CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Anomaly detection</CardTitle><p className="mt-1 text-xs text-text-muted">Recent deviations from learned service baselines</p></div><Badge variant="destructive">2 active</Badge></CardHeader>
    <CardContent className="overflow-x-auto p-0">
      <table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-surface-secondary/50 text-xs uppercase tracking-wider text-text-muted"><tr><th className="px-6 py-3 font-medium">Timestamp</th><th className="px-4 py-3 font-medium">Metric</th><th className="px-4 py-3 font-medium">Severity</th><th className="px-4 py-3 font-medium">Anomaly score</th><th className="px-6 py-3 font-medium">Status</th></tr></thead><tbody className="divide-y divide-border/60">{anomalies.map((anomaly) => <tr key={`${anomaly.timestamp}-${anomaly.metric}`} className="hover:bg-surface-secondary/30"><td className="px-6 py-3 font-mono text-xs text-text-secondary">Today {anomaly.timestamp}</td><td className="px-4 py-3 font-medium text-text-primary">{anomaly.metric}</td><td className="px-4 py-3"><Badge variant={severityVariant(anomaly.severity) as 'destructive' | 'warning' | 'outline'}>{anomaly.severity}</Badge></td><td className="px-4 py-3 font-mono text-text-secondary">{anomaly.score}</td><td className="px-6 py-3"><Badge variant={statusVariant(anomaly.status) as 'destructive' | 'warning' | 'success'}>{anomaly.status}</Badge></td></tr>)}</tbody></table>
    </CardContent>
  </Card>
);
