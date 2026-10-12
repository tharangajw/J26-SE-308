import { useState } from 'react';
import { Sparkles, TriangleAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

const SEV_STYLE: Record<string, string> = {
  Critical: 'text-rose-400',
  High:     'text-orange-400',
  Medium:   'text-amber-400',
  Low:      'text-cyan-400',
};

const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.8-flash';

export default function RCAPanel({ onRcaComplete, cciData }: any) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [rca, setRca]         = useState<any>(null);

  const handleAnalyze = async () => {
    setLoading(true); setError(null);
    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!geminiKey) {
      const mockRca = {
        summary: 'Detected MongoDB connection timeouts in order-service. The service is attempting to reconnect repeatedly but failing due to exhausted pool connections.',
        root_cause: 'MongoDB connection pool exhaustion under high load in order-service.',
        recommendations: [
          'Increase the MongoDB connection pool size in order-service configuration.',
          'Implement circuit breaking for the database connection.',
          'Scale up the MongoDB instance if CPU is saturated.'
        ],
        severity: 'High',
        affected_services: ['order-service', 'api-gateway'],
        mode: 'demo',
        ai_response_time_ms: 0,
        evidence: [
          'Metrics: High latency in p95 HTTP requests.',
          'Traces: order-service POST /api/orders spans exceeding 5s.',
          'Logs: MongoTimeoutError in order-service.'
        ]
      };
      setRca(mockRca);
      if (onRcaComplete) onRcaComplete(mockRca);
      setLoading(false);
      return;
    }

    try {
      const startedAt = performance.now();
      const prompt = `You are an observability SRE performing root-cause analysis. Analyze this telemetry snapshot:
${JSON.stringify(cciData ?? {}, null, 2)}

Return ONLY valid JSON, without markdown, using this schema:
{
  "summary": "string",
  "root_cause": "string",
  "recommendations": ["string"],
  "severity": "Critical|High|Medium|Low",
  "affected_services": ["string"],
  "evidence": ["string"]
}`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(geminiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });
      const responseBody = await response.text();
      let data: any;
      try { data = JSON.parse(responseBody); } catch { throw new Error(`Gemini returned invalid JSON (${response.status})`); }
      if (!response.ok) throw new Error(data.error?.message || `Gemini request failed (${response.status})`);
      const output = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!output) throw new Error('Gemini returned no generated content');
      const parsed = JSON.parse(output.replace(/^```json\s*|\s*```$/g, '').trim());
      const liveRca = {
        ...parsed,
        mode: 'live',
        provider: 'gemini',
        ai_response_time_ms: Math.round(performance.now() - startedAt),
      };
      setRca(liveRca);
      if (onRcaComplete) onRcaComplete(liveRca);
    } catch (err) {
      setError(`Gemini API Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Sparkles className="h-4 w-4 text-brand-obs" /> GenAI Root-Cause Analysis
            </h3>
            <p className="mt-1 text-xs text-text-muted">
              Sends a correlated Prometheus + Jaeger + Loki snapshot for diagnosis
            </p>
          </div>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-secondary/40 px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-brand-obs/60 hover:text-brand-obs disabled:opacity-50"
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
                    <p className="mt-1 text-xs font-medium">{rca.mode === 'demo' ? 'Demo Mode' : rca.provider === 'gemini' ? 'Gemini AI' : 'AI'}</p>
                  </div>
                  <div className="rounded-md border border-border/80 bg-surface-secondary/30 p-3">
                    <p className="text-[10px] uppercase text-text-muted">Response</p>
                    <p className="mt-1 font-mono text-xs">{rca.mode === 'demo' ? '< 1 ms' : `${rca.ai_response_time_ms} ms`}</p>
                  </div>
                </div>
                {rca.mode === 'demo' && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                    Demo mode active. Add VITE_GEMINI_API_KEY to the project .env for live analysis.
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
