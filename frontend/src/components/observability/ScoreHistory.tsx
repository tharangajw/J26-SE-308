// Renders the O-Score and CCI history returned by the observability engine.
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="min-w-[180px] rounded-md border border-border bg-surface p-3 text-xs shadow-sm">
      <p className="mb-2 text-text-muted">{d.time}</p>
      <div className="flex flex-col gap-1">
        <div className="flex justify-between gap-5">
          <span className="text-brand-obs">O-Score</span>
          <span className="font-mono font-semibold text-text-primary">{d.oscore?.toFixed(1)}</span>
        </div>
        <div className="flex justify-between gap-5">
          <span className="text-cyan-400">CCI</span>
          <span className="font-mono font-semibold text-text-primary">{d.cci_index?.toFixed(1)}%</span>
        </div>
        {d.blind_spot_count > 0 && (
          <div className="flex justify-between gap-5">
            <span className="text-rose-400">Blind Spots</span>
            <span className="font-mono font-semibold text-rose-400">{d.blind_spot_count}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ScoreHistory({ history }: any) {
  if (!history || history.length === 0) {
    return (
      <Card className="flex h-[220px] items-center justify-center">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-text-muted">Collecting history… scores appear every 10 s</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = history.map((h: any, i: number) => ({
    ...h,
    time: h.timestamp
      ? new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : `#${i}`,
  }));

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Real-Time Trend</CardTitle>
            <p className="mt-1 text-xs text-text-muted">O-Score & CCI Index History</p>
          </div>
          <div className="flex gap-4 text-[11px] font-medium">
            <span className="flex items-center gap-1.5 text-brand-obs"><span className="inline-block h-0.5 w-4 bg-brand-obs" /> O-Score</span>
            <span className="flex items-center gap-1.5 text-cyan-400"><span className="inline-block h-0.5 w-4 bg-cyan-400" /> CCI</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="gOscore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gCci" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#252C35" strokeDasharray="4 4" />
            <XAxis dataKey="time" tick={{ fill: '#5E6875', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: '#5E6875', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="oscore" stroke="#10B981" strokeWidth={2} fill="url(#gOscore)" dot={false} />
            <Area type="monotone" dataKey="cci_index" stroke="#22d3ee" strokeWidth={2} fill="url(#gCci)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
