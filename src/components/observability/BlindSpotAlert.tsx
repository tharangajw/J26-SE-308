

export default function BlindSpotAlert({ spot }: any) {
  const pillars = [
    { key: 'has_metric', label: 'Metric', icon: '📊', src: 'Prometheus' },
    { key: 'has_trace',  label: 'Trace',  icon: '🔗', src: 'Jaeger' },
    { key: 'has_log',    label: 'Log',    icon: '📝', src: 'Loki' },
  ];

  const ts = spot.timestamp_utc
    ? new Date(spot.timestamp_utc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--';

  const allOk = spot.has_metric && spot.has_trace && spot.has_log;

  return (
    <div className="obs-fade-up" style={{
      background: allOk ? 'rgba(16,185,129,0.05)' : 'rgba(244,63,94,0.06)',
      border: `1px solid ${allOk ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.25)'}`,
      borderRadius: 14,
      padding: '16px 18px',
      transition: 'box-shadow 0.2s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!allOk && (
            <span className="obs-blind-blink" style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              background: '#f43f5e', boxShadow: '0 0 8px rgba(244,63,94,0.8)',
            }} />
          )}
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: allOk ? '#6ee7b7' : '#f43f5e',
            textTransform: 'uppercase', letterSpacing: '0.09em',
          }}>
            {allOk ? 'Correlated' : 'Blind Spot'}
          </span>
        </div>
        <span style={{ fontSize: 11, color: '#475569', fontFamily: "'JetBrains Mono', monospace" }}>{ts}</span>
      </div>

      {/* Pillars */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {pillars.map(p => {
          const ok = spot[p.key];
          return (
            <div key={p.key} className={`obs-pillar ${ok ? 'ok' : 'miss'}`}>
              <span>{p.icon}</span>
              <span>{p.label}</span>
              <span style={{ fontWeight: 800, marginLeft: 2 }}>{ok ? '✓' : '✗'}</span>
            </div>
          );
        })}
      </div>

      {spot.missing_pillars?.length > 0 && (
        <p style={{ fontSize: 11, color: '#64748b', marginTop: 10, lineHeight: 1.5 }}>
          ⚠ Missing: <strong style={{ color: '#f87171' }}>{spot.missing_pillars.join(', ')}</strong> — O-Score deducted
        </p>
      )}
    </div>
  );
}
