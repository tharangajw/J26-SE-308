import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Activity, Cpu, HardDrive, Network, Database } from 'lucide-react';
import { AnomalyPanel } from '../performace/AnomalyPanel';
import { ChartTooltip } from './ChartTooltip';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

export default function MetricsDashboard({ data }: any) {
  const realtime = data?.realtime;
  const cpuData = realtime?.series?.cpu ?? [];
  const memoryData = realtime?.series?.memory ?? [];
  const latencyData = realtime?.series?.latency ?? [];
  const reqData = realtime?.series?.requests ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-300">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-orange-400" />
          <span>Prometheus scraped telemetry — resource footprint, latency tails, and HTTP throughput</span>
        </div>
        <span className="font-medium uppercase tracking-wider text-emerald-400">1st pillar active</span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
              <Cpu className="h-4 w-4 text-indigo-400" /> Cluster CPU Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cpuData}>
                  <defs>
                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#252C35" vertical={false} />
                  <XAxis dataKey="time" stroke="#5E6875" fontSize={12} tickMargin={10} minTickGap={30} />
                  <YAxis stroke="#5E6875" fontSize={12} unit="%" domain={[0, 100]} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="value" name="CPU" stroke="#818cf8" fillOpacity={1} fill="url(#colorCpu)" unit="%" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
              <HardDrive className="h-4 w-4 text-emerald-400" /> Cluster Memory Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={memoryData}>
                  <defs>
                    <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#252C35" vertical={false} />
                  <XAxis dataKey="time" stroke="#5E6875" fontSize={12} tickMargin={10} minTickGap={30} />
                  <YAxis stroke="#5E6875" fontSize={12} unit="%" domain={[0, 100]} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="value" name="Memory" stroke="#10B981" fillOpacity={1} fill="url(#colorMem)" unit="%" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
              <Activity className="h-4 w-4 text-amber-400" /> Service Latency (P95)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={latencyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#252C35" vertical={false} />
                  <XAxis dataKey="time" stroke="#5E6875" fontSize={12} tickMargin={10} minTickGap={30} />
                  <YAxis stroke="#5E6875" fontSize={12} unit="ms" />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  <Line type="monotone" dataKey="value" name="p95 Latency" stroke="#fbbf24" strokeWidth={2} dot={false} unit="ms" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-secondary">
              <Network className="h-4 w-4 text-cyan-400" /> HTTP Request Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={reqData}>
                  <defs>
                    <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#252C35" vertical={false} />
                  <XAxis dataKey="time" stroke="#5E6875" fontSize={12} tickMargin={10} minTickGap={30} />
                  <YAxis stroke="#5E6875" fontSize={12} unit=" req/s" />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="step" dataKey="value" name="Requests" stroke="#38bdf8" fillOpacity={1} fill="url(#colorReq)" unit=" req/s" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <AnomalyPanel />
    </div>
  );
}
