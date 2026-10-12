import { useState } from 'react';
import { Wrench, TriangleAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

const RISK_CLASS: Record<string, string> = {
  Low:      'text-cyan-400',
  Medium:   'text-amber-400',
  High:     'text-orange-400',
  Critical: 'text-rose-400',
};

const GUARDRAIL_CONFIG: Record<string, { color: string; label: string }> = {
  safe:             { color: 'text-emerald-400', label: 'Safe to Apply' },
  review_required:  { color: 'text-amber-400', label: 'Review Required' },
  dangerous:        { color: 'text-rose-400', label: 'Dangerous — Manual Review' },
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
            memory: "512Mi"
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
      <Card>
        <CardContent className="p-10 text-center">
          <p className="text-sm font-medium text-text-primary">No RCA report yet</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-text-muted">
            Go to the AI Analysis tab and run an analysis. The remediation script will load here once complete.
          </p>
        </CardContent>
      </Card>
    );
  }

  const guardrail = remediation ? (GUARDRAIL_CONFIG[remediation.guardrail_status] || GUARDRAIL_CONFIG.review_required) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Wrench className="h-4 w-4 text-brand-obs" /> Automated Remediation Guardrails
            </h3>
            <p className="mt-1 text-xs text-text-muted">
              AI-generated fix script for: {rcaReport.summary?.substring(0, 55)}…
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-md border border-border bg-surface-secondary/40 p-0.5">
              <button
                type="button"
                onClick={() => setAiProvider('claude')}
                className={`rounded px-3 py-1 text-xs font-medium ${aiProvider === 'claude' ? 'bg-surface text-text-primary' : 'text-text-muted'}`}
              >
                Claude 3.5
              </button>
              <button
                type="button"
                onClick={() => setAiProvider('gemini')}
                className={`rounded px-3 py-1 text-xs font-medium ${aiProvider === 'gemini' ? 'bg-surface text-text-primary' : 'text-text-muted'}`}
              >
                Gemini Pro
              </button>
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-secondary/40 px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-brand-obs/60 hover:text-brand-obs disabled:opacity-50"
            >
              {loading ? 'Generating fix…' : 'Generate fix script'}
            </button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
          <TriangleAlert className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {remediation && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-surface-secondary/30 px-4 py-3">
              <span className="font-mono text-xs text-text-muted">
                {remediation.script_type === 'kubernetes_yaml' ? 'patch.yaml' :
                 remediation.script_type === 'docker_compose' ? 'docker-compose-fix.yml' : 'fix.sh'}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs font-medium text-brand-obs hover:underline"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="max-h-[480px] overflow-x-auto bg-background p-5 font-mono text-xs leading-relaxed text-emerald-300">
              {remediation.script}
            </pre>
          </Card>

          <div className="space-y-6">
            <Card className="border-brand-obs/40 bg-brand-obs/5">
              <CardHeader>
                <CardTitle className={`text-sm uppercase tracking-wider ${guardrail?.color}`}>{guardrail?.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs leading-relaxed text-text-secondary">{remediation.description}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Guardrail Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Risk Level</span>
                  <span className={`font-medium ${RISK_CLASS[remediation.risk_level] || RISK_CLASS.Medium}`}>{remediation.risk_level}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Script Type</span>
                  <code className="rounded-md border border-border bg-surface-secondary/40 px-2 py-0.5 font-mono text-[11px]">{remediation.script_type}</code>
                </div>
                <div>
                  <span className="text-text-muted">Estimated Impact</span>
                  <p className="mt-1 leading-relaxed text-text-secondary">{remediation.estimated_impact}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Rollback Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal space-y-1 pl-4 text-xs leading-relaxed text-text-secondary">
                  {remediation.rollback_steps?.map((step: string, i: number) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            {remediation.mode === 'demo' && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                Demo mode. Set {remediation.provider === 'claude' ? 'ANTHROPIC_API_KEY' : 'GEMINI_API_KEY'} for live scripts.
              </div>
            )}
          </div>
        </div>
      )}

      {!remediation && !loading && !error && (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="text-sm font-medium text-text-primary">RCA received. Ready to generate a fix.</p>
            <p className="mt-2 text-xs text-text-muted">Click Generate fix script above.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
