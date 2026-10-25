// Cross-Pillar Correlation Index explains trace-log matching and blind spots.
import BlindSpotAlert from './BlindSpotAlert';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

function PillarBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-text-primary">{label}</span>
        <span className="font-mono font-semibold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-secondary">
        <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function CCIPanel({ cciData }: any) {
  if (!cciData) return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {[1,2,3].map(i => <Card key={i} className="h-24 animate-pulse bg-surface-secondary/20" />)}
    </div>
  );

  const { cci_index = 100, total_events = 0, matched_events = 0,
    blind_spots = [], pillar_coverage = {}, event_source = 'prometheus' } = cciData;

  const blind_spot_count = blind_spots.length;
  const cciColor = cci_index >= 80 ? 'text-emerald-400' : cci_index >= 50 ? 'text-amber-400' : 'text-rose-400';

  const sources: Record<string, { label: string; color: string }> = {
    prometheus: { label: 'Prometheus', color: 'text-orange-400' },
    jaeger:     { label: 'Jaeger',     color: 'text-indigo-400' },
    loki:       { label: 'Loki',       color: 'text-cyan-400' },
  };
  const sourceMeta = sources[event_source as string] || { label: String(event_source), color: 'text-text-muted' };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-brand-obs/40 bg-brand-obs/5">
          <CardContent className="p-4">
            <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">CCI Index</span>
            <div className={`mt-2 font-mono text-2xl font-semibold ${cciColor}`}>{cci_index.toFixed(0)}%</div>
            <p className="mt-1 text-[11px] text-text-muted">Cross-pillar correlation · {sourceMeta.label}</p>
          </CardContent>
        </Card>
        {[
          { label: 'Total Error Events', value: total_events, sub: `Detected via ${sourceMeta.label}`, color: 'text-text-primary' },
          { label: 'Fully Matched', value: matched_events, sub: 'All 3 pillars correlated', color: 'text-emerald-400' },
          { label: 'Blind Spots', value: blind_spot_count, sub: 'Missing trace or log', color: blind_spot_count > 0 ? 'text-rose-400' : 'text-emerald-400' },
        ].map((s) => (
          <Card key={s.label} className="border-border bg-surface-secondary/20">
            <CardContent className="p-4">
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">{s.label}</span>
              <div className={`mt-2 font-mono text-2xl font-semibold ${s.color}`}>{s.value}</div>
              <p className="mt-1 text-[11px] text-text-muted">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Pillar Coverage Rate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <PillarBar label="Prometheus Metrics" value={pillar_coverage.metric ?? 1} color="#f97316" />
            <PillarBar label="Jaeger Traces" value={pillar_coverage.trace ?? 1} color="#818cf8" />
            <PillarBar label="Loki Logs" value={pillar_coverage.log ?? 1} color="#22d3ee" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">What is CCI?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-text-secondary">
              The <strong className="text-text-primary">Cross-Pillar Correlation Index</strong> checks if every Prometheus error spike has a matching Jaeger trace and a Loki log entry within <strong className="text-cyan-400">±2 seconds</strong>.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-text-secondary">
              If any pillar is missing, a <strong className="text-rose-400">blind spot</strong> is flagged and the O-Score is penalised by <strong className="text-rose-400">-2 points per event</strong> (max -15).
            </p>
            <div className="mt-4 rounded-md border border-brand-obs/30 bg-brand-obs/5 px-4 py-3 text-xs text-brand-obs">
              System is {total_events === 0 ? 'error-free — CCI defaults to 100%' : `${((matched_events/Math.max(total_events,1))*100).toFixed(0)}% correlated`}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Monitoring Blind Spots</CardTitle>
              <p className="mt-1 text-xs text-text-muted">Events where a telemetry pillar is missing</p>
            </div>
            {blind_spot_count > 0 && (
              <span className="text-xs font-medium text-rose-400">{blind_spot_count} blind spot{blind_spot_count > 1 ? 's' : ''}</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {blind_spots.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {blind_spots.map((spot: any, i: number) => <BlindSpotAlert key={i} spot={spot} />)}
            </div>
          ) : (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-emerald-400">No Blind Spots Detected</p>
              <p className="mt-1 text-xs text-text-muted">
                {total_events === 0
                  ? 'No error spikes in the current window — system is clean.'
                  : 'All recent error spikes are fully correlated across metrics, traces, and logs.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
