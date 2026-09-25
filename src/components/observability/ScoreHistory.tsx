import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts';

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="obs-glass-bright" style={{ padding: '12px 16px', minWidth: 180, borderRadius: 12 }}>
      <p style={{ color: '#94a3b8', fontSize: 11, marginBottom: 8 }}>{d.time}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
          <span style={{ color: '#818cf8', fontSize: 12, fontWeight: 600 }}>O-Score</span>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{d.oscore?.toFixed(1)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
          <span style={{ color: '#22d3ee', fontSize: 12, fontWeight: 600 }}>CCI</span>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{d.cci_index?.toFixed(1)}%</span>
        </div>
        {d.blind_spot_count > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
            <span style={{ color: '#f43f5e', fontSize: 12, fontWeight: 600 }}>Blind Spots</span>
            <span style={{ color: '#f43f5e', fontSize: 13, fontWeight: 700 }}>{d.blind_spot_count}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ScoreHistory({ history }: any) {
  if (!history || history.length === 0) {
    return (
      <div className="obs-glass" style={{ padding: 24, height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="obs-shimmer" style={{ width: 180, height: 16, marginBottom: 10 }} />
        <div className="obs-shimmer" style={{ width: 120, height: 12 }} />
        <p style={{ color: '#475569', fontSize: 13, marginTop: 16 }}>Collecting history… scores appear every 10 s</p>
      </div>
    );
  }

  const chartData = history.map((h: any, i: number) => ({
    ...h,
    time: h.timestamp
      ? new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : `#${i}`,
  }));

  return (
    <div className="obs-glass obs-fade-up" style={{ padding: '20px 24px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
            Real-Time Trend
          </p>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>O-Score &amp; CCI Index History</p>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 12, fontWeight: 600 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#818cf8' }}>
            <span style={{ width: 20, height: 2, background: '#818cf8', display: 'inline-block', borderRadius: 2 }} />
            O-Score
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#22d3ee' }}>
            <span style={{ width: 20, height: 2, background: '#22d3ee', display: 'inline-block', borderRadius: 2 }} />
            CCI
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="gOscore" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gCci" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" />
          <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="oscore" stroke="#818cf8" strokeWidth={2.5}
            fill="url(#gOscore)" dot={false}
            activeDot={{ r: 5, fill: '#818cf8', stroke: '#1e1b4b', strokeWidth: 2 }} />
          <Area type="monotone" dataKey="cci_index" stroke="#22d3ee" strokeWidth={2}
            fill="url(#gCci)" dot={false}
            activeDot={{ r: 4, fill: '#22d3ee', stroke: '#083344', strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
