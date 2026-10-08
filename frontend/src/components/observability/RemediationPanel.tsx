import { useState } from 'react';

const RISK_CLASS: any = {
  Low:      'obs-sev obs-sev-low',
  Medium:   'obs-sev obs-sev-medium',
  High:     'obs-sev obs-sev-high',
  Critical: 'obs-sev obs-sev-critical',
};

const GUARDRAIL_CONFIG: any = {
  safe:             { icon: '✅', color: '#34d399', label: 'Safe to Apply' },
  review_required:  { icon: '🔍', color: '#fbbf24', label: 'Review Required' },
  dangerous:        { icon: '🚨', color: '#f43f5e', label: 'Dangerous — Manual Review' },
};

const GEMINI_MODEL = 'gemini-3.8-flash';

export default function RemediationPanel({ rcaReport }: any) {
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [remediation, setRemediation] = useState<any>(null);
  const [copied, setCopied]         = useState(false);
  const [aiProvider, setAiProvider] = useState<'claude' | 'gemini'>('claude');

  const handleGenerate = async () => {
    if (!rcaReport) return;
    setLoading(true); setError(null);
    
    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (aiProvider === 'gemini' && geminiKey) {
      try {
        const prompt = `You are a Kubernetes SRE. An issue was detected: ${rcaReport.summary || 'Database connection timeout in order-service'}. Generate a Kubernetes YAML patch to fix this issue. Return ONLY a JSON object with the following schema, no markdown blocks around it: { "script": "string (the yaml code)", "description": "string", "risk_level": "Low|Medium|High|Critical", "estimated_impact": "string", "rollback_steps": ["string", "string"] }`;
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(geminiKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        });

        const responseBody = await response.text();
        let data: any;
        try {
          data = JSON.parse(responseBody);
        } catch {
          throw new Error(`Gemini returned invalid JSON (${response.status})`);
        }
        if (!response.ok) {
          throw new Error(data.error?.message || `Gemini request failed (${response.status})`);
        }
        const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textOutput) throw new Error('Gemini returned no generated content');
        const parsed = JSON.parse(textOutput);

        setRemediation({
          script_type: 'kubernetes_yaml',
          script: parsed.script,
          guardrail_status: parsed.risk_level === 'Critical' ? 'dangerous' : parsed.risk_level === 'High' ? 'review_required' : 'safe',
          description: parsed.description,
          risk_level: parsed.risk_level,
          estimated_impact: parsed.estimated_impact,
          rollback_steps: parsed.rollback_steps,
          mode: 'live',
          provider: 'gemini'
        });
      } catch (err) {
        console.error('Gemini API error:', err);
        setError(`Gemini API Error: ${err instanceof Error ? err.message : 'Unknown error'}. Falling back to Demo Mode.`);
        generateMock('gemini');
      } finally {
        setLoading(false);
      }
    } else {
      generateMock(aiProvider);
    }
  };

  const generateMock = (provider: string) => {
    // Mock the backend generation
    setTimeout(() => {
      setRemediation({
        script_type: 'kubernetes_yaml',
        script: provider === 'claude' 
          ? `apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
spec:
  template:
    spec:
      containers:
      - name: order-service
        resources:
          requests:
            memory: "256Mi"
          limits:
            memory: "512Mi"` 
          : `apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
spec:
  template:
    spec:
      containers:
      - name: order-service
        resources:
          limits:
            memory: "512Mi" # Gemini optimization suggestion
            cpu: "500m"
          requests:
            memory: "256Mi"
            cpu: "250m"`,
        guardrail_status: 'safe',
        description: 'Update memory limits for order-service to prevent OOM errors.',
        risk_level: 'Low',
        estimated_impact: 'Prevents out of memory kills, stabilizing order processing.',
        rollback_steps: [
          'Run `kubectl rollout undo deployment/order-service`',
          'Verify pods are running with previous memory limits.'
        ],
        mode: 'demo',
        provider
      });
      setLoading(false);
    }, 1500);
  };

  const handleCopy = () => {
    if (!remediation?.script) return;
    navigator.clipboard.writeText(remediation.script).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!rcaReport) {
    return (
      <div className="obs-glass obs-fade-up" style={{ padding: '70px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚙</div>
        <p style={{ fontSize: 17, fontWeight: 700, color: '#475569', marginBottom: 8 }}>No RCA Report Yet</p>
        <p style={{ fontSize: 13, color: '#334155', maxWidth: 380, margin: '0 auto', lineHeight: 1.7 }}>
          Go to the <strong style={{ color: '#818cf8' }}>⚡ AI Analysis</strong> tab and run an analysis.
          The remediation script will auto-load here once complete.
        </p>
      </div>
    );
  }

  const guardrail = remediation ? (GUARDRAIL_CONFIG[remediation.guardrail_status] || GUARDRAIL_CONFIG.review_required) : null;

  return (
    <div className="obs-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Action bar ── */}
      <div className="obs-glass-bright" style={{ padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 22 }}>⚙</span>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Automated Remediation Guardrails</h2>
          </div>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            AI-generated fix script for: <strong style={{ color: '#a78bfa' }}>{rcaReport.summary?.substring(0, 55)}…</strong>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          
          {/* AI Toggle */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: 4, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
            <button
              onClick={() => setAiProvider('claude')}
              style={{
                padding: '6px 12px', fontSize: 13, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                background: aiProvider === 'claude' ? 'rgba(99,102,241,0.2)' : 'transparent',
                color: aiProvider === 'claude' ? '#a5b4fc' : '#64748b'
              }}
            >
              Claude 3.5
            </button>
            <button
              onClick={() => setAiProvider('gemini')}
              style={{
                padding: '6px 12px', fontSize: 13, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                background: aiProvider === 'gemini' ? 'rgba(16,185,129,0.2)' : 'transparent',
                color: aiProvider === 'gemini' ? '#6ee7b7' : '#64748b'
              }}
            >
              Gemini Pro
            </button>
          </div>

          <button className="obs-btn-emerald" onClick={handleGenerate} disabled={loading}>
            {loading
              ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⚙</span> Generating Fix…</>
              : <><span style={{ fontSize: 16 }}>🛠</span> Generate Fix Script</>
            }
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', color: '#fda4af', fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Script viewer ── */}
      {remediation && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
          {/* Code block */}
          <div className="obs-glass" style={{ overflow: 'hidden', padding: 0 }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* traffic-light dots */}
                {['#ff5f56','#febc2e','#28c840'].map(c => (
                  <span key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c, display: 'inline-block' }} />
                ))}
                <span style={{ fontSize: 12, color: '#475569', fontFamily: "'JetBrains Mono', monospace", marginLeft: 8 }}>
                  {remediation.script_type === 'kubernetes_yaml' ? 'patch.yaml' :
                   remediation.script_type === 'docker_compose' ? 'docker-compose-fix.yml' : 'fix.sh'}
                </span>
              </div>
              <button
                onClick={handleCopy}
                style={{ fontSize: 12, color: copied ? '#34d399' : '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '4px 10px', borderRadius: 6, transition: 'color 0.2s' }}
              >
                {copied ? '✓ Copied!' : '⎘ Copy'}
              </button>
            </div>
            {/* Code */}
            <div className="obs-code-block" style={{ maxHeight: 480 }}>
              {remediation.script}
            </div>
          </div>

          {/* Right sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Guardrail status */}
            <div style={{ padding: 20, borderRadius: 14, background: `rgba(${guardrail.color === '#34d399' ? '52,211,153' : guardrail.color === '#fbbf24' ? '251,191,36' : '244,63,94'},0.07)`, border: `1px solid rgba(${guardrail.color === '#34d399' ? '52,211,153' : guardrail.color === '#fbbf24' ? '251,191,36' : '244,63,94'},0.25)` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{guardrail.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: guardrail.color }}>{guardrail.label}</span>
              </div>
              <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>{remediation.description}</p>
            </div>

            {/* Metadata */}
            <div className="obs-glass" style={{ padding: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Guardrail Details</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#475569' }}>Risk Level</span>
                  <span className={`${RISK_CLASS[remediation.risk_level] || RISK_CLASS.Medium}`}>{remediation.risk_level}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#475569' }}>Script Type</span>
                  <code style={{ fontSize: 12, color: '#a5b4fc', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: 6 }}>{remediation.script_type}</code>
                </div>
                <div>
                  <span style={{ fontSize: 12, color: '#475569' }}>Estimated Impact</span>
                  <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, lineHeight: 1.5 }}>{remediation.estimated_impact}</p>
                </div>
              </div>
            </div>

            {/* Rollback */}
            <div className="obs-glass" style={{ padding: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
                ↩ Rollback Steps
              </p>
              <ol style={{ paddingLeft: 18, margin: 0 }}>
                {remediation.rollback_steps?.map((step: string, i: number) => (
                  <li key={i} style={{ fontSize: 12, color: '#64748b', lineHeight: 1.7, marginBottom: 4 }}>{step}</li>
                ))}
              </ol>
            </div>

            {/* Mode notice */}
            {remediation.mode === 'demo' && (
              <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', fontSize: 12, color: '#92400e' }}>
                <strong style={{ color: '#fbbf24' }}>Demo Mode</strong> · Set {remediation.provider === 'claude' ? 'ANTHROPIC_API_KEY' : 'GEMINI_API_KEY'} for {remediation.provider === 'claude' ? 'Claude' : 'Gemini'}-generated scripts
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Waiting state ── */}
      {!remediation && !loading && !error && (
        <div className="obs-glass" style={{ padding: '50px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>🛠</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#475569', marginBottom: 8 }}>RCA received. Ready to generate fix.</p>
          <p style={{ fontSize: 13, color: '#334155' }}>Click <strong style={{ color: '#34d399' }}>Generate Fix Script</strong> above.</p>
        </div>
      )}
    </div>
  );
}
