import React from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

interface PerformanceTrendProps {
  data: { date: string; score: number }[];
}

export const PerformanceTrend: React.FC<PerformanceTrendProps> = ({ data }) => (
  <Card className="h-full">
    <CardHeader className="flex-row items-center justify-between border-b border-border/60">
      <div>
        <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Performance trend</CardTitle>
        <p className="mt-1 text-xs text-text-muted">Assessment score over the last four evaluations</p>
      </div>
      <span className="font-mono text-sm text-emerald-400">+16 pts</span>
    </CardHeader>
    <CardContent className="h-[260px] pt-6">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="performance-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand-perf)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--color-brand-perf)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis domain={[40, 90]} tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }} />
          <Area type="monotone" dataKey="score" stroke="var(--color-brand-perf)" strokeWidth={2} fill="url(#performance-fill)" />
        </AreaChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);
