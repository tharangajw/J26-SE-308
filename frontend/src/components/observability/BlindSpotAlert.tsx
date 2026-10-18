export default function BlindSpotAlert({ spot }: any) {
  const pillars = [
    { key: 'has_metric', label: 'Metric', src: 'Prometheus' },
    { key: 'has_trace',  label: 'Trace',  src: 'Jaeger' },
    { key: 'has_log',    label: 'Log',    src: 'Loki' },
  ];

  const ts = spot.timestamp_utc
    ? new Date(spot.timestamp_utc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--';

  const allOk = spot.has_metric && spot.has_trace && spot.has_log;

  return (
    <div className={`rounded-md border p-4 ${allOk ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className={`text-[11px] font-medium uppercase tracking-wider ${allOk ? 'text-emerald-400' : 'text-rose-400'}`}>
          {allOk ? 'Correlated' : 'Blind Spot'}
        </span>
        <span className="font-mono text-[11px] text-text-muted">{ts}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {pillars.map((p) => {
          const ok = spot[p.key];
          return (
            <span
              key={p.key}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium ${
                ok ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400' : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
              }`}
            >
              {p.label} {ok ? '✓' : '✗'}
            </span>
          );
        })}
      </div>

      {spot.missing_pillars?.length > 0 && (
        <p className="mt-3 text-[11px] leading-relaxed text-text-muted">
          Missing: <strong className="text-rose-400">{spot.missing_pillars.join(', ')}</strong> — O-Score deducted
        </p>
      )}
    </div>
  );
}
