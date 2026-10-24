// Sends the live correlated snapshot to an AI provider for root-cause analysis.
import { useEffect, useState } from 'react';
import { BrainCircuit, CheckCircle2, LoaderCircle, Sparkles, TriangleAlert, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

const SEV_STYLE: Record<string, string> = {
  Critical: 'text-rose-400',
  High:     'text-orange-400',
  Medium:   'text-amber-400',
  Low:      'text-cyan-400',
};

export default function RCAPanel({ onRcaComplete, cciData }: any) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [rca, setRca]         = useState<any>(null);
  const [provider, setProvider] = useState<'gemini' | 'claude' | 'openrouter'>('gemini');
  const [providers, setProviders] = useState<Record<string, { configured: boolean; model: string }>>({});

  useEffect(() => {
    fetch('/api/observability/ai/providers')
      .then(response => response.ok ? response.json() : null)
      .then(data => data && setProviders(data))
      .catch(() => setProviders({}));
  }, []);

  const handleAnalyze = async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch('/api/observability/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, snapshot: cciData ?? {} }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || `${provider} analysis failed (${response.status})`);
      setRca(data);
      if (onRcaComplete) onRcaComplete(data);
    } catch (err) {
      const providerLabel = provider === 'gemini' ? 'Gemini' : provider === 'claude' ? 'Claude' : 'OpenRouter';
      setError(`${providerLabel} API Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-brand-obs/30 bg-gradient-to-br from-brand-obs/10 via-surface to-surface">
        <CardContent className="space-y-5 p-5">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <BrainCircuit className="h-4 w-4 text-brand-obs" /> AI Root-Cause Analysis
            </h3>
            <p className="mt-1 text-xs text-text-muted">
              Run the same correlated telemetry snapshot through Gemini, Claude, or OpenRouter.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {(['gemini', 'claude', 'openrouter'] as const).map((name) => {
              const selected = provider === name;
              const configured = providers[name]?.configured;
              return (
                <button key={name} type="button" onClick={() => setProvider(name)} className={`rounded-xl border p-4 text-left transition-colors ${selected ? 'border-brand-obs/70 bg-brand-obs/10' : 'border-border bg-surface-secondary/25 hover:border-brand-obs/40'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 font-semibold capitalize text-text-primary">
                      {name === 'gemini' ? <Sparkles className="h-4 w-4 text-cyan-300" /> : name === 'claude' ? <Zap className="h-4 w-4 text-orange-300" /> : <BrainCircuit className="h-4 w-4 text-violet-300" />}{name}
                    </span>
                    <span className={`text-[10px] font-medium uppercase ${configured ? 'text-emerald-400' : 'text-amber-400'}`}>{configured ? 'Connected' : 'Demo fallback'}</span>
                  </div>
                  <p className="mt-2 text-xs text-text-muted">{providers[name]?.model || 'Configure provider key in Docker'}</p>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-obs px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-brand-obs/80 disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? 'Analyzing telemetry…' : 'Analyze recent errors'}
          </button>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
          <TriangleAlert className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {rca && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Diagnostic Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-text-secondary">{rca.summary}</p>
              </CardContent>
            </Card>

            <Card className="border-brand-obs/40 bg-brand-obs/5">
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Identified Root Cause</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-text-primary">{rca.root_cause}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {rca.recommendations?.map((rec: string, i: number) => (
                  <div key={i} className="flex items-start gap-3 rounded-md border border-border/80 bg-surface-secondary/30 p-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-brand-obs/40 text-[11px] font-mono text-brand-obs">{i + 1}</span>
                    <span className="text-sm leading-relaxed text-text-secondary">{rec}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-text-muted">Severity</p>
                  <span className={`mt-1 text-sm font-medium ${SEV_STYLE[rca.severity] || SEV_STYLE.Medium}`}>{rca.severity}</span>
                </div>
                <div>
                  <p className="mb-2 text-[11px] uppercase tracking-wider text-text-muted">Affected Services</p>
                  <div className="flex flex-wrap gap-2">
                    {rca.affected_services?.map((s: string) => (
                      <span key={s} className="rounded-md border border-border bg-surface-secondary/40 px-2 py-1 font-mono text-[11px] text-text-secondary">{s}</span>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-border/80 bg-surface-secondary/30 p-3">
                    <p className="text-[10px] uppercase text-text-muted">AI Model</p>
                    <p className="mt-1 text-xs font-medium capitalize">{rca.mode === 'demo' ? `${rca.provider} demo` : `${rca.provider} AI`}</p>
                  </div>
                  <div className="rounded-md border border-border/80 bg-surface-secondary/30 p-3">
                    <p className="text-[10px] uppercase text-text-muted">Response</p>
                    <p className="mt-1 font-mono text-xs">{rca.mode === 'demo' ? '< 1 ms' : `${rca.ai_response_time_ms} ms`}</p>
                  </div>
                </div>
                {rca.mode === 'demo' && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                    Demo fallback active. {rca.fallback_reason || 'Configure the provider key in Docker for live analysis.'}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Evidence</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {rca.evidence?.map((ev: string, i: number) => (
                  <div key={i} className="rounded-md border border-border/80 bg-surface-secondary/30 p-3 text-xs leading-relaxed text-text-secondary">
                    {ev}
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
              RCA complete · Remediation tab loaded automatically
            </div>
          </div>
        </div>
      )}

      {!rca && !loading && !error && (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="text-sm font-medium text-text-primary">Ready for AI-powered diagnosis</p>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-text-muted">
              Click Analyze recent errors to send a correlated telemetry snapshot to the RCA engine.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
