import React from 'react';
import { ArrowDown, ArrowUp, Gauge } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';

interface PerformanceMetricCardProps {
  name: string;
  score: number;
  weight: number;
  index: number;
}

const metricDetails = [
  { unit: 'ms', detail: 'Target under 200 ms', icon: Gauge },
  { unit: 'req/s', detail: 'Sustained request rate', icon: ArrowUp },
  { unit: '%', detail: 'CPU and memory headroom', icon: Gauge },
  { unit: 'x', detail: 'Horizontal scaling readiness', icon: ArrowUp },
  { unit: 'coverage', detail: 'Automated test coverage', icon: ArrowDown },
  { unit: 'guardrail', detail: 'Release regression checks', icon: ArrowDown },
];

export const PerformanceMetricCard: React.FC<PerformanceMetricCardProps> = ({ name, score, weight, index }) => {
  const detail = metricDetails[index % metricDetails.length];
  const Icon = detail.icon;
  const tone = score >= 80 ? 'text-emerald-400' : score >= 70 ? 'text-amber-400' : 'text-rose-400';
  const barTone = score >= 80 ? 'bg-emerald-400' : score >= 70 ? 'bg-amber-400' : 'bg-rose-400';

  return (
    <Card className="h-full border-border/70 bg-surface-secondary/30">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-text-primary">{name}</p>
            <p className="mt-1 text-xs text-text-muted">{detail.detail}</p>
          </div>
          <Icon className={`h-4 w-4 ${tone}`} aria-hidden="true" />
        </div>
        <div className="mt-5 flex items-end justify-between">
          <span className={`font-mono text-2xl font-semibold ${tone}`}>{score}</span>
          <span className="text-xs text-text-muted">weight {weight.toFixed(1)}</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface">
          <div className={`h-full rounded-full ${barTone}`} style={{ width: `${score}%` }} />
        </div>
        <p className="mt-2 text-right text-[11px] uppercase tracking-wider text-text-muted">{detail.unit}</p>
      </CardContent>
    </Card>
  );
};
