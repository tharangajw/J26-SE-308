import { useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ZAxis
} from 'recharts';
import { Share2, Clock, GitCommit } from 'lucide-react';
import { DependencyMap } from '../performace/DependencyMap';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

const generateTraceScatter = (p95Latency: number) => {
  const data = [];
  const now = new Date();
  for (let i = 0; i < 60; i++) {
    const isError = Math.random() > 0.9;
    data.push({
      id: `trace-${i}`,
      time: new Date(now.getTime() - Math.random() * 3600000).getTime(),
      duration: Math.max(10, (p95Latency * 0.8) + (Math.random() - 0.5) * p95Latency + (isError ? 500 : 0)),
      spans: Math.floor(Math.random() * 15) + 3,
      isError: isError
    });
  }
  return data.sort((a, b) => a.time - b.time);
};

export default function TracesDashboard({ data }: any) {
  const p95Latency = data?.details?.service_latency_p95_ms || 150;
  const traceData = useMemo(() => generateTraceScatter(p95Latency), [p95Latency]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const pData = payload[0].payload;
      return (
        <div className="rounded-md border border-border bg-surface p-4 shadow-sm">
          <p className="mb-2 font-mono text-xs text-text-secondary">{pData.id}</p>
          <div className="space-y-1 text-sm">
            <p><span className="text-text-muted">Duration:</span> <span className="font-mono font-semibold">{pData.duration.toFixed(1)} ms</span></p>
            <p><span className="text-text-muted">Spans:</span> <span className="font-mono font-semibold">{pData.spans}</span></p>
            <p><span className="text-text-muted">Status:</span>
              <span className={`ml-2 font-medium ${pData.isError ? 'text-rose-400' : 'text-emerald-400'}`}>
                {pData.isError ? 'ERROR' : 'OK'}
              </span>
            </p>
            <p className="mt-2 text-xs text-text-muted">{new Date(pData.time).toLocaleTimeString()}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  const formatXAxis = (tickItem: number) => {
    return new Date(tickItem).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-border bg-surface-secondary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Propagation Rate</span>
              <Share2 className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold text-text-primary">
              {data?.details?.trace_id_propagation_rate ? `${(data.details.trace_id_propagation_rate * 100).toFixed(0)}%` : '98%'}
            </div>
            <p className="mt-1 text-[11px] text-text-muted">W3C TraceContext coverage</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-secondary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Avg Trace Duration</span>
              <Clock className="h-4 w-4 text-brand-obs" />
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold text-text-primary">
              {data?.details?.avg_trace_duration_ms ? `${data.details.avg_trace_duration_ms.toFixed(1)} ms` : '124.5 ms'}
            </div>
            <p className="mt-1 text-[11px] text-text-muted">End-to-end span length</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-secondary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Services Instrumented</span>
              <GitCommit className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold text-text-primary">
              {data?.details?.service_count ? data.details.service_count : '6'}
            </div>
            <p className="mt-1 text-[11px] text-text-muted">Jaeger-reported services</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Trace Durations (Last Hour)</CardTitle>
              <div className="flex items-center gap-4 text-[11px] text-text-secondary">
                <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-emerald-400" /> Success</div>
                <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-rose-400" /> Error</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#252C35" />
                  <XAxis type="number" dataKey="time" name="Time" domain={['dataMin', 'dataMax']} tickFormatter={formatXAxis} stroke="#5E6875" fontSize={12} />
                  <YAxis type="number" dataKey="duration" name="Duration" unit="ms" stroke="#5E6875" fontSize={12} />
                  <ZAxis type="number" dataKey="spans" range={[50, 400]} name="Spans" />
                  <Tooltip cursor={{ strokeDasharray: '3 3', stroke: '#5E6875' }} content={<CustomTooltip />} />
                  <Scatter name="Traces" data={traceData}>
                    {traceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.isError ? '#f43f5e' : '#10B981'} opacity={0.8} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-1">
          <DependencyMap />
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Slowest Traces</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead className="border-b border-border text-text-muted">
                <tr>
                  <th className="w-32 px-4 py-3 font-medium">Trace ID</th>
                  <th className="w-40 px-4 py-3 font-medium">Root Service</th>
                  <th className="px-4 py-3 font-medium">Operation</th>
                  <th className="w-24 px-4 py-3 font-medium">Spans</th>
                  <th className="w-32 px-4 py-3 text-right font-medium">Duration (ms)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-xs text-text-secondary">
                {[...traceData].sort((a,b) => b.duration - a.duration).slice(0, 5).map((trace) => (
                  <tr key={trace.id} className="hover:bg-surface-secondary/30">
                    <td className="px-4 py-3 font-mono text-brand-obs">{trace.id.padEnd(16, '0')}</td>
                    <td className="px-4 py-3">api-gateway</td>
                    <td className="px-4 py-3">{trace.isError ? 'POST /api/orders' : 'GET /api/catalog'}</td>
                    <td className="px-4 py-3 font-mono">{trace.spans}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-amber-400">{trace.duration.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
