import { useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ZAxis
} from 'recharts';
import { Share2, Clock, GitCommit } from 'lucide-react';
import { DependencyMap } from '../performace/DependencyMap';

const generateTraceScatter = (p95Latency: number) => {
  const data = [];
  const now = new Date();
  for (let i = 0; i < 60; i++) {
    const isError = Math.random() > 0.9; // 10% error rate
    data.push({
      id: `trace-${i}`,
      time: new Date(now.getTime() - Math.random() * 3600000).getTime(), // Random time in last hour
      duration: Math.max(10, (p95Latency * 0.8) + (Math.random() - 0.5) * p95Latency + (isError ? 500 : 0)), // Errors take longer
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
        <div className="bg-slate-800/95 border border-slate-700 p-4 rounded-lg shadow-xl backdrop-blur-md">
          <p className="text-slate-300 text-xs font-mono mb-2">{pData.id}</p>
          <div className="space-y-1">
            <p className="text-sm"><span className="text-slate-500">Duration:</span> <span className="font-semibold text-white">{pData.duration.toFixed(1)} ms</span></p>
            <p className="text-sm"><span className="text-slate-500">Spans:</span> <span className="font-semibold text-white">{pData.spans}</span></p>
            <p className="text-sm"><span className="text-slate-500">Status:</span> 
              <span className={`ml-2 font-semibold ${pData.isError ? 'text-rose-400' : 'text-emerald-400'}`}>
                {pData.isError ? 'ERROR' : 'OK'}
              </span>
            </p>
            <p className="text-xs text-slate-500 mt-2">{new Date(pData.time).toLocaleTimeString()}</p>
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* High-level Trace Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="obs-glass p-5 flex items-center gap-4">
          <div className="p-3 bg-purple-500/20 rounded-xl text-purple-400 border border-purple-500/30">
            <Share2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-400 text-sm">Propagation Rate</p>
            <h3 className="text-2xl font-bold text-white">
              {data?.details?.trace_id_propagation_rate ? `${(data.details.trace_id_propagation_rate * 100).toFixed(0)}%` : '98%'}
            </h3>
          </div>
        </div>

        <div className="obs-glass p-5 flex items-center gap-4">
          <div className="p-3 bg-teal-500/20 rounded-xl text-teal-400 border border-teal-500/30">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-400 text-sm">Avg Trace Duration</p>
            <h3 className="text-2xl font-bold text-white">
              {data?.details?.avg_trace_duration_ms ? `${data.details.avg_trace_duration_ms.toFixed(1)} ms` : '124.5 ms'}
            </h3>
          </div>
        </div>

        <div className="obs-glass p-5 flex items-center gap-4">
          <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400 border border-blue-500/30">
            <GitCommit className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-400 text-sm">Services Instrumented</p>
            <h3 className="text-2xl font-bold text-white">
              {data?.details?.service_count ? data.details.service_count : '6'}
            </h3>
          </div>
        </div>
      </div>

      {/* Grid: Trace Scatter Plot & Downstream Fan-out Call Depth Graph */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 obs-glass p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-300 font-medium">Trace Durations (Last Hour)</h3>
            <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80"></div> Success</div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></div> Error</div>
            </div>
          </div>
          <div className="h-[360px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  type="number" 
                  dataKey="time" 
                  name="Time" 
                  domain={['dataMin', 'dataMax']} 
                  tickFormatter={formatXAxis}
                  stroke="#64748b" 
                  fontSize={12}
                />
                <YAxis 
                  type="number" 
                  dataKey="duration" 
                  name="Duration" 
                  unit="ms" 
                  stroke="#64748b" 
                  fontSize={12}
                />
                <ZAxis type="number" dataKey="spans" range={[50, 400]} name="Spans" />
                <Tooltip cursor={{ strokeDasharray: '3 3', stroke: '#64748b' }} content={<CustomTooltip />} />
                <Scatter name="Traces" data={traceData}>
                  {traceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.isError ? '#f43f5e' : '#34d399'} opacity={0.8} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-1">
          <DependencyMap />
        </div>
      </div>

      {/* Traces List Table */}
      <div className="obs-glass p-0 overflow-hidden flex flex-col">
        <div className="border-b border-slate-700/50 p-4 bg-slate-800/30">
          <h3 className="text-slate-300 font-medium text-sm">Slowest Traces</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800/50 text-slate-400 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 font-medium w-32">Trace ID</th>
                <th className="px-4 py-3 font-medium w-40">Root Service</th>
                <th className="px-4 py-3 font-medium">Operation</th>
                <th className="px-4 py-3 font-medium w-24">Spans</th>
                <th className="px-4 py-3 font-medium w-32 text-right">Duration (ms)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300 text-xs">
              {[...traceData].sort((a,b) => b.duration - a.duration).slice(0, 5).map((trace, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-indigo-400">{trace.id.padEnd(16, '0')}</td>
                  <td className="px-4 py-3">api-gateway</td>
                  <td className="px-4 py-3">{trace.isError ? 'POST /api/orders' : 'GET /api/catalog'}</td>
                  <td className="px-4 py-3">{trace.spans}</td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-400">{trace.duration.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
