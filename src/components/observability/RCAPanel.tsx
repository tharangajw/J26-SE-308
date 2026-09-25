import { useState } from 'react';

const SEV_STYLE: any = {
  Critical: 'obs-sev obs-sev-critical',
  High:     'obs-sev obs-sev-high',
  Medium:   'obs-sev obs-sev-medium',
  Low:      'obs-sev obs-sev-low',
};

export default function RCAPanel({ onRcaComplete }: any) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [rca, setRca]         = useState<any>(null);

  const handleAnalyze = () => {
    setLoading(true); setError(null);
    
    // Mock the backend generation
    setTimeout(() => {
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
    }, 2000);
  };

  return (
    <div className="obs-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Header action bar ── */}
      <div className="obs-glass-bright" style={{ padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 22 }}>⚡</span>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>GenAI Root-Cause Analysis</h2>
          </div>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            Powered by <strong style={{ color: '#c084fc' }}>Anthropic Claude AI</strong> · Sends correlated Prometheus + Jaeger + Loki snapshot for instant diagnosis
          </p>
        </div>
        <button className="obs-btn-primary" onClick={handleAnalyze} disabled={loading} style={{ flexShrink: 0 }}>
          {loading
            ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⚙</span> Analyzing Telemetry…</>
            : <><span style={{ fontSize: 16 }}>⚡</span> Analyze Recent Errors</>
          }
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', color: '#fda4af', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 18 }}>⚠</span> {error}
        </div>
      )}

      {/* ── RCA result ── */}
      {rca && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
          {/* Left — analysis */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Summary */}
            <div className="obs-glass" style={{ padding: 24 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Diagnostic Summary</p>
              <p style={{ fontSize: 15, color: '#cbd5e1', lineHeight: 1.75 }}>{rca.summary}</p>
            </div>

            {/* Root cause highlight */}
            <div style={{ padding: 24, borderRadius: 14, background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.25)', boxShadow: 'inset 0 0 40px rgba(99,102,241,0.04)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>🔍 Identified Root Cause</p>
              <p style={{ fontSize: 15, color: '#e2e8f0', lineHeight: 1.75, fontWeight: 500 }}>{rca.root_cause}</p>
            </div>

            {/* Recommendations */}
            <div className="obs-glass" style={{ padding: 24 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Recommendations</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {rca.recommendations?.map((rec: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      {i + 1}
                    </span>
                    <span style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right — metadata */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Metadata */}
            <div className="obs-glass" style={{ padding: 22 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Metadata</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <p style={{ fontSize: 11, color: '#475569', marginBottom: 6 }}>Severity</p>
                  <span className={SEV_STYLE[rca.severity] || SEV_STYLE.Medium}>{rca.severity}</span>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>Affected Services</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {rca.affected_services?.map((s: string) => (
                      <span key={s} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', fontSize: 12, color: '#a5b4fc', fontWeight: 500 }}>{s}</span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}>
                    <p style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>AI Model</p>
                    <p style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600 }}>
                      {rca.mode === 'demo' ? 'Demo Mode' : 'Claude AI'}
                    </p>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}>
                    <p style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>Response</p>
                    <p style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600 }}>
                      {rca.mode === 'demo' ? '< 1 ms' : `${rca.ai_response_time_ms} ms`}
                    </p>
                  </div>
                </div>
                {rca.mode === 'demo' && (
                  <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
                    <p style={{ fontSize: 12, color: '#fbbf24', fontWeight: 600 }}>Demo Mode Active</p>
                    <p style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Set ANTHROPIC_API_KEY env var for live Claude analysis</p>
                  </div>
                )}
              </div>
            </div>

            {/* Evidence */}
            <div className="obs-glass" style={{ padding: 22 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>🧪 Evidence</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rca.evidence?.map((ev: string, i: number) => (
                  <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                    {ev}
                  </div>
                ))}
              </div>
            </div>

            {/* Auto-navigate hint */}
            <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 13, color: '#6ee7b7', fontWeight: 500 }}>
              ✓ RCA complete · <strong>Remediation</strong> tab loaded automatically
            </div>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!rca && !loading && !error && (
        <div className="obs-glass" style={{ padding: '60px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
          <p style={{ fontSize: 17, fontWeight: 700, color: '#475569', marginBottom: 8 }}>Ready for AI-Powered Diagnosis</p>
          <p style={{ fontSize: 13, color: '#334155', maxWidth: 420, margin: '0 auto', lineHeight: 1.7 }}>
            Click <strong style={{ color: '#818cf8' }}>Analyze Recent Errors</strong> to send a correlated telemetry snapshot (Prometheus + Jaeger + Loki) to Claude AI for instant root-cause discovery.
          </p>
        </div>
      )}
    </div>
  );
}
