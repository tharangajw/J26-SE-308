import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Search, Filter, TriangleAlert, BarChart3 } from 'lucide-react';
import { ChartTooltip } from './ChartTooltip';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

export default function LogsDashboard({ data }: any) {
  const realtime = data?.realtime;
  const logData = realtime?.logs?.series ?? [];
  const logs = realtime?.logs?.recentLogs ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
              <BarChart3 className="h-4 w-4 text-brand-obs" /> Log Volume (Last 2 Hours)
            </CardTitle>
            {data?.details?.log_error_count > 0 && (
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-400">
                <TriangleAlert className="h-3.5 w-3.5" />
                {data.details.log_error_count} errors detected
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={logData} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252C35" vertical={false} />
                <XAxis dataKey="time" stroke="#5E6875" fontSize={12} tickMargin={10} minTickGap={30} />
                <YAxis stroke="#5E6875" fontSize={12} />
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="info" name="Info Logs" stackId="a" fill="#3b82f6" radius={[0, 0, 4, 4]} />
                <Bar dataKey="error" name="Error Logs" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-4 border-b border-border bg-surface-secondary/30 p-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search logs... (e.g., status:error service:order-service)"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 pl-9 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-obs/60 focus:outline-none"
            />
          </div>
          <button type="button" className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-secondary/40 px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-secondary">
            <Filter className="h-4 w-4" />
            Filters
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="border-b border-border text-text-muted">
              <tr>
                <th className="w-40 px-4 py-3 font-medium">Timestamp</th>
                <th className="w-24 px-4 py-3 font-medium">Level</th>
                <th className="w-40 px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Message</th>
                <th className="w-32 px-4 py-3 font-medium">Trace ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-mono text-xs">
              {logs.map((log: any, idx: number) => (
                <tr key={idx} className="hover:bg-surface-secondary/30">
                  <td className="px-4 py-2.5 text-text-muted">{new Date(Number(log.timestamp) / 1000000).toLocaleTimeString()}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] font-medium uppercase ${
                      log.level === 'ERROR' || log.level === 'CRITICAL' ? 'text-rose-400' :
                      log.level === 'WARN'  ? 'text-amber-400' :
                      'text-emerald-400'
                    }`}>
                      {log.level}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-brand-obs">{log.service}</td>
                  <td className={`max-w-md truncate px-4 py-2.5 ${log.level === 'ERROR' || log.level === 'CRITICAL' ? 'text-rose-300' : 'text-text-secondary'}`}>
                    {log.message}
                  </td>
                  <td className="cursor-pointer px-4 py-2.5 text-cyan-400 hover:underline">
                    {log.traceId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
