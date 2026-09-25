import React from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

const tooltipStyle = { backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: '6px', fontSize: 12 };
const axis = { fill: 'var(--color-text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' };

const hourly = [
  { time: '00:00', score: 71, baseline: 74, cpu: 38, memory: 56, p95: 168, p99: 290, rps: 420 },
  { time: '04:00', score: 73, baseline: 74, cpu: 34, memory: 54, p95: 156, p99: 265, rps: 360 },
  { time: '08:00', score: 76, baseline: 74, cpu: 62, memory: 61, p95: 198, p99: 370, rps: 680 },
  { time: '12:00', score: 78, baseline: 74, cpu: 88, memory: 76, p95: 312, p99: 610, rps: 910 },
  { time: '16:00', score: 75, baseline: 74, cpu: 71, memory: 69, p95: 244, p99: 460, rps: 760 },
  { time: '20:00', score: 79, baseline: 74, cpu: 54, memory: 63, p95: 182, p99: 330, rps: 570 },
  { time: '24:00', score: 78, baseline: 74, cpu: 47, memory: 59, p95: 176, p99: 312, rps: 510 },
];

const ChartCard = ({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) => (
  <Card className={className}>
    <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wider text-text-secondary">{title}</CardTitle></CardHeader>
    <CardContent className="h-[210px] pt-3">{children}</CardContent>
  </Card>
);

export const PerformanceCharts: React.FC = () => (
  <div className="space-y-6">
    <ChartCard title="P-Score trend · last 24 hours" className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={hourly} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="time" tick={axis} axisLine={false} tickLine={false} />
          <YAxis domain={[60, 85]} tick={axis} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="score" name="P-Score" stroke="var(--color-brand-perf)" strokeWidth={3} dot={{ r: 3, fill: 'var(--color-brand-perf)' }} />
          <Line type="monotone" dataKey="baseline" name="Historical average" stroke="var(--color-text-muted)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>

    <div className="grid gap-4 md:grid-cols-2">
      <ChartCard title="CPU usage · last 1 hour">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={hourly} margin={{ top: 8, right: 8, left: -25, bottom: 0 }}><CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="time" tick={axis} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tick={axis} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Area type="monotone" dataKey="cpu" name="CPU %" stroke="#f97316" fill="#f97316" fillOpacity={0.18} /></AreaChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Memory usage · last 1 hour">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={hourly} margin={{ top: 8, right: 8, left: -25, bottom: 0 }}><CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="time" tick={axis} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tick={axis} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Area type="monotone" dataKey="memory" name="Memory %" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.18} /></AreaChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="P95 / P99 latency · ms">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={hourly} margin={{ top: 8, right: 8, left: -25, bottom: 0 }}><CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="time" tick={axis} axisLine={false} tickLine={false} /><YAxis tick={axis} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 11 }} /><Line type="monotone" dataKey="p95" name="P95" stroke="#22c55e" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="p99" name="P99" stroke="#ef4444" strokeWidth={2} dot={false} /></LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Requests / transactions per second">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={hourly} margin={{ top: 8, right: 8, left: -25, bottom: 0 }}><CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="time" tick={axis} axisLine={false} tickLine={false} /><YAxis tick={axis} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="rps" name="Requests / sec" fill="var(--color-brand-perf)" radius={[3, 3, 0, 0]} /></BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  </div>
);
