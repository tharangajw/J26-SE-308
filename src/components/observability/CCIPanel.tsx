import BlindSpotAlert from './BlindSpotAlert';

function PillarBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#f43f5e';
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 13, color, fontWeight: 700 }}>{pct}%</span>
      </div>
      <div className="obs-prog-track">
        <div className="obs-prog-fill" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}60` }} />
      </div>
    </div>
  );
}

export default function CCIPanel({ cciData }: any) {
  if (!cciData) return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
      {[1,2,3].map(i => <div key={i} className="obs-glass obs-shimmer" style={{ height: 100 }} />)}
    </div>
  );

  const { cci_index = 100, total_events = 0, matched_events = 0,
    blind_spots = [], pillar_coverage = {}, event_source = 'prometheus' } = cciData;

  const blind_spot_count = blind_spots.length;  // derive from array
  const cciColor = cci_index >= 80 ? '#34d399' : cci_index >= 50 ? '#fbbf24' : '#f43f5e';

  const sources: Record<string, { label: string; color: string; icon: string }> = {
    prometheus: { label: 'Prometheus', color: '#f97316', icon: '📊' },
    jaeger:     { label: 'Jaeger',     color: '#818cf8', icon: '🔗' },
    loki:       { label: 'Loki',       color: '#22d3ee', icon: '📝' },
  };
  const sourceMeta = sources[event_source as string] || { label: String(event_source), color: '#94a3b8', icon: '🔎' };

  return (
    <div className="obs-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── KPI row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {/* Big CCI gauge */}
        <div className="obs-glass-bright obs-grad-border obs-lift" style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gridRow: 'span 1' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
            CCI Index
          </p>
          <div style={{ position: 'relative', width: 120, height: 120, marginBottom: 12 }}>
            <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
              <circle cx="60" cy="60" r="50" fill="none"
                stroke={cciColor}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 50}`}
                strokeDashoffset={`${2 * Math.PI * 50 * (1 - cci_index / 100)}`}
                style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)', filter: `drop-shadow(0 0 8px ${cciColor}80)` }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 24, fontWeight: 900, color: cciColor }}>{cci_index.toFixed(0)}</span>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>%</span>
            </div>
          </div>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Cross-Pillar Correlation</p>
          {/* Event source badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: `${sourceMeta.color}18`, border: `1px solid ${sourceMeta.color}40`, fontSize: 11, fontWeight: 700, color: sourceMeta.color }}>
            <span>{sourceMeta.icon}</span>
            <span>Events from {sourceMeta.label}</span>
          </div>
        </div>

        {/* Stats */}
        {[
          { label: 'Total Error Events', value: total_events, sub: `Detected via ${sourceMeta.label}`, color: '#94a3b8' },
          { label: 'Fully Matched', value: matched_events, sub: 'All 3 pillars correlated', color: '#34d399' },
          { label: 'Blind Spots', value: blind_spot_count, sub: 'Missing trace or log', color: blind_spot_count > 0 ? '#f43f5e' : '#34d399' },
        ].map(s => (
          <div key={s.label} className="obs-glass obs-lift obs-metric-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 110 }}>
            <div className="obs-card-glow" style={{ background: s.color }} />
            <p style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</p>
            <div>
              <span style={{ fontSize: 36, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</span>
              <p style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Pillar coverage bars ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="obs-glass" style={{ padding: 24 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 20 }}>Pillar Coverage Rate</p>
          <PillarBar label="📊 Prometheus Metrics" value={pillar_coverage.metric ?? 1} />
          <PillarBar label="🔗 Jaeger Traces"      value={pillar_coverage.trace ?? 1} />
          <PillarBar label="📝 Loki Logs"          value={pillar_coverage.log ?? 1} />
        </div>

        {/* Info card */}
        <div className="obs-glass" style={{ padding: 24 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>What is CCI?</p>
          <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7, marginBottom: 12 }}>
            The <strong style={{ color: '#818cf8' }}>Cross-Pillar Correlation Index</strong> checks if every Prometheus error spike has a matching Jaeger trace AND a Loki log entry within <strong style={{ color: '#22d3ee' }}>±2 seconds</strong>.
          </p>
          <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7 }}>
            If any pillar is missing, a <strong style={{ color: '#f43f5e' }}>Blind Spot</strong> is flagged and the O-Score is penalised by <strong style={{ color: '#f43f5e' }}>-2 points per event</strong> (max -15).
          </p>
          <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(99,102,241,0.08)', borderRadius: 10, border: '1px solid rgba(99,102,241,0.2)' }}>
            <p style={{ fontSize: 12, color: '#818cf8', fontWeight: 600 }}>
              ✓ System is {total_events === 0 ? 'error-free — CCI defaults to 100%' : `${((matched_events/Math.max(total_events,1))*100).toFixed(0)}% correlated`}
            </p>
          </div>
        </div>
      </div>

      {/* ── Blind spots ── */}
      <div className="obs-glass" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Monitoring Blind Spots</p>
            <p style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>Events where a telemetry pillar is missing</p>
          </div>
          {blind_spot_count > 0 && (
            <span style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', fontSize: 12, fontWeight: 700, color: '#f43f5e' }}>
              {blind_spot_count} blind spot{blind_spot_count > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {blind_spots.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {blind_spots.map((spot: any, i: number) => <BlindSpotAlert key={i} spot={spot} />)}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#34d399', marginBottom: 4 }}>No Blind Spots Detected</p>
            <p style={{ fontSize: 13, color: '#475569' }}>
              {total_events === 0
                ? 'No error spikes in the current window — system is clean.'
                : 'All recent error spikes are fully correlated across metrics, traces, and logs.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
