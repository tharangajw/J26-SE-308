// Displays AI remediation output and the human-review/security guardrail state.
import { useState } from 'react';
import { Wrench, TriangleAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { TelemetryService } from '../../services/telemetry';

const RISK_CLASS: Record<string, string> = {
  Low:      'text-cyan-400',
  Medium:   'text-amber-400',
  High:     'text-orange-400',
  Critical: 'text-rose-400',
  'N/A':    'text-text-muted',
};

const GUARDRAIL_CONFIG: Record<string, { color: string; label: string }> = {
  safe:             { color: 'text-emerald-400', label: 'Safe to Apply' },
  review_required:  { color: 'text-amber-400', label: 'Review Required' },
  dangerous:        { color: 'text-rose-400', label: 'Dangerous — Manual Review' },
  not_required:     { color: 'text-emerald-400', label: 'No Patch Needed' },
};

export default function RemediationPanel({ rcaReport, currentTelemetry }: any) {
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [remediation, setRemediation] = useState<any>(null);
  const [copied, setCopied]         = useState(false);
  const [applying, setApplying]     = useState(false);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState<'claude' | 'gemini' | 'openrouter'>('gemini');
  const hasCurrentTelemetry = currentTelemetry != null;
  const reportExperiment = rcaReport?.telemetry?.activeExperiment;
  const activeExperiment = hasCurrentTelemetry ? currentTelemetry.activeExperiment : reportExperiment;
  const scenarioChanged = hasCurrentTelemetry
    && (activeExperiment?.simulated === true || reportExperiment?.simulated === true)
    && activeExperiment?.faultType !== reportExperiment?.faultType;
  const simulatedMetricGap = activeExperiment?.faultType === 'METRIC_GAP'
    && activeExperiment?.simulated === true;
  const activeFaultType = activeExperiment?.faultType as string | undefined;
  const reportText = `${rcaReport?.summary ?? ''} ${rcaReport?.root_cause ?? ''}`.toLowerCase();
  const hasPrometheusMetricGap = simulatedMetricGap || (!activeFaultType
    && (reportText.includes('prometheus') || reportText.includes('metric'))
    && ['gap', 'missing', 'coverage', 'unavailable'].some((term) => reportText.includes(term)));

  const FAULT_LABELS: Record<string, string> = {
    METRIC_GAP: 'Prometheus Metrics Gap',
    TRACE_GAP: 'Jaeger Trace Gap',
    LOG_GAP: 'Loki Log Gap',
    SERVICE_DOWN: 'Service Recovery',
    ERROR_SPIKE: 'Error Spike Remediation',
    LATENCY_SPIKE: 'Latency Spike Remediation',
  };
  const faultLabel = activeFaultType ? FAULT_LABELS[activeFaultType] : undefined;
  const isChaosExperiment = !!activeFaultType && activeExperiment?.simulated === true;
  const displayFaultLabel = faultLabel || (hasPrometheusMetricGap ? 'Prometheus Metrics Gap' : undefined);

  const handleGenerate = async () => {
    if (!rcaReport) return;
    if (scenarioChanged) return;
    setLoading(true); setError(null); setRemediation(null); setCopied(false);
    
    try {
      const response = await fetch('/api/observability/ai/remediation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: aiProvider,
            report: {
              ...(hasCurrentTelemetry ? { ...rcaReport, telemetry: currentTelemetry } : rcaReport),
              discovery: await TelemetryService.getServiceDiscovery(),
            },
          })
        });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || `Remediation request failed (${response.status})`);
      setRemediation(data);
    } catch (err) {
      console.error('Remediation API error:', err);
      setError(`Remediation generation failed: ${err instanceof Error ? err.message : 'Unknown error'}. No remediation script was generated.`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!remediation?.script) return;
    navigator.clipboard.writeText(remediation.script).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleApply = async () => {
    if (!remediation) return;
    setApplying(true);
    setApplySuccess(null);
    try {
      const targetService = rcaReport?.affected_services?.[0] || activeExperiment?.serviceId || 'payment-service';
      await fetch('/api/observability/ai/remediation/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: targetService, script: remediation.script }),
      });
      await fetch('/api/observability/chaos/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      setApplySuccess(`Applied fix for ${targetService}. Telemetry restoring to healthy state.`);
    } catch (err: any) {
      setError(`Apply failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setApplying(false);
    }
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
  const showRemediation = !scenarioChanged && remediation
    && (!hasPrometheusMetricGap || remediation.script_type === 'operator_guidance');

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Wrench className="h-4 w-4 text-brand-obs" /> {isChaosExperiment ? 'Chaos Experiment Guidance' : hasPrometheusMetricGap ? 'Prometheus Metrics Guidance' : 'Automated Remediation Guardrails'}
            </h3>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-text-muted" title={rcaReport.summary || undefined}>
              {hasPrometheusMetricGap
                ? simulatedMetricGap
                  ? 'This Chaos Lab fault only simulates missing Prometheus metrics; it does not change Kubernetes resources.'
                  : `Recovery guidance for ${displayFaultLabel}. A YAML patch requires a verified scrape target and deployment configuration.`
                : `AI-generated fix script for: ${rcaReport.summary || 'the latest observability finding'}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-md border border-border bg-surface-secondary/40 p-0.5">
              <button
                type="button"
                onClick={() => setAiProvider('claude')}
                className={`rounded px-3 py-1 text-xs font-medium ${aiProvider === 'claude' ? 'bg-surface text-text-primary' : 'text-text-muted'}`}
              >
                Claude
              </button>
              <button
                type="button"
                onClick={() => setAiProvider('gemini')}
                className={`rounded px-3 py-1 text-xs font-medium ${aiProvider === 'gemini' ? 'bg-surface text-text-primary' : 'text-text-muted'}`}
              >
                Gemini
              </button>
              <button
                type="button"
                onClick={() => setAiProvider('openrouter')}
                className={`rounded px-3 py-1 text-xs font-medium ${aiProvider === 'openrouter' ? 'bg-surface text-text-primary' : 'text-text-muted'}`}
              >
                OpenRouter
              </button>
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || scenarioChanged}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-secondary/40 px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-brand-obs/60 hover:text-brand-obs disabled:opacity-50"
            >
              {scenarioChanged ? 'RCA is out of date' : loading ? 'Generating…' : hasPrometheusMetricGap ? 'Show recovery guidance' : 'Generate fix script'}
            </button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
          <TriangleAlert className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {scenarioChanged && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300">
          The chaos scenario in this RCA has changed or expired. Run AI Analysis again while the intended fault is active before generating remediation.
        </div>
      )}

      {showRemediation && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-surface-secondary/30 px-4 py-3">
              <span className="font-mono text-xs text-text-muted">
                {remediation.script_type === 'kubernetes_yaml' ? 'patch.yaml' :
                 remediation.script_type === 'docker_compose' ? 'docker-compose-fix.yml' :
                 remediation.script_type === 'operator_guidance' ? 'recovery-guidance.txt' : 'fix.sh'}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-xs font-medium text-brand-obs hover:underline"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={applying || !!applySuccess}
                  className="rounded border border-brand-obs/40 bg-brand-obs/20 px-2.5 py-1 text-xs font-medium text-brand-obs transition-colors hover:bg-brand-obs/30 disabled:opacity-50"
                >
                  {applying ? 'Applying…' : applySuccess ? 'Applied ✓' : 'Apply Fix'}
                </button>
              </div>
            </div>
            {applySuccess && (
              <div className="border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-300">
                ✓ {applySuccess}
              </div>
            )}
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
                  <span className="text-text-muted">Output Type</span>
                  <code className="rounded-md border border-border bg-surface-secondary/40 px-2 py-0.5 font-mono text-[11px]">{remediation.script_type}</code>
                </div>
                <div>
                  <span className="text-text-muted">Estimated Impact</span>
                  <p className="mt-1 leading-relaxed text-text-secondary">{remediation.estimated_impact}</p>
                </div>
              </CardContent>
            </Card>

            {remediation.rollback_steps?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Rollback Steps</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="list-decimal space-y-1 pl-4 text-xs leading-relaxed text-text-secondary">
                    {remediation.rollback_steps.map((step: string, i: number) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}

          </div>
        </div>
      )}

      {!scenarioChanged && !showRemediation && !loading && !error && (
        <Card>
          <CardContent className="p-10 text-center">
            <p className="text-sm font-medium text-text-primary">
              {hasPrometheusMetricGap ? 'Prometheus metrics gap identified. No deployment patch has been verified.' : 'RCA received. Ready to generate a fix.'}
            </p>
            <p className="mt-2 text-xs text-text-muted">
              {hasPrometheusMetricGap
                ? 'Generate recovery guidance. A YAML patch needs a verified Prometheus target, /metrics endpoint, and deployment configuration.'
                : 'Click Generate fix script above.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
