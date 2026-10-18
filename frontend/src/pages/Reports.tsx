import React from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { mockAssessmentData } from '../data/mockData';
import { FileText, Download, Gauge } from 'lucide-react';

const downloadPScoreDetails = () => {
  const performance = mockAssessmentData.dimensions.performance;
  const deductions = [
    ['Response time', 7, 'P99 latency rises to 1.24 s during peak traffic.'],
    ['Load testing', 6, 'Automated load tests are not yet part of the CI pipeline.'],
    ['Performance regression', 5, 'No release gate currently protects the latency budget.'],
    ['Resource utilization', 4, 'CPU reaches 88% under the midday workload spike.'],
  ] as const;
  const report = [
    'PERFORMANCE SCORE DETAILS',
    `Project: ${mockAssessmentData.projectName}`,
    `Assessment: ${mockAssessmentData.id}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    `P-Score: 78/100`,
    'Maturity tier: Mature',
    'Points deducted: 22',
    '',
    'WHY THE SCORE IS BELOW 100',
    ...deductions.map(([label, points, reason]) => `- ${label}: -${points} points. ${reason}`),
    '',
    'METRIC SCORES',
    ...performance.metrics.map((metric) => `- ${metric.name}: ${metric.score}/100 (weight ${metric.weight})`),
    '',
    'CURRENT SIGNALS',
    '- Active anomalies: 2',
    '- Fan-out depth: 5 downstream services',
    '- Selected service: order-service',
    '',
    'RECOMMENDED ACTIONS',
    '- High: Add Redis caching layer',
    '- High: Automate load testing in CI',
    '- Medium: Set resource requests and limits',
    '- Low: Define latency SLOs',
  ].join('\n');
  const url = URL.createObjectURL(new Blob([report], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `p-score-details-${mockAssessmentData.id.toLowerCase()}.txt`;
  link.click();
  URL.revokeObjectURL(url);
};

export const Reports: React.FC = () => {
  return (
    <PageContainer className="space-y-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Assessment Reports</h2>
          <p className="text-sm text-text-secondary mt-1">Generate and export official maturity research reports.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
        
        <button className="bg-text-primary text-background px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 hover:bg-text-primary/90 transition-colors">
          <Download className="w-4 h-4" /> Export PDF
        </button>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b border-border/50 bg-surface-secondary/20">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-text-muted" />
            <div>
              <CardTitle className="text-lg">Executive Summary Report</CardTitle>
              <p className="text-xs text-text-muted mt-1 font-mono">ID: {mockAssessmentData.id} • {mockAssessmentData.lastEvaluated}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8 max-w-4xl mx-auto">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-semibold">Architecture Maturity Assessment</h1>
            <p className="text-text-secondary text-lg">{mockAssessmentData.projectName}</p>
          </div>

          <div className="grid grid-cols-2 gap-8 border-y border-border py-6">
            <div>
              <h4 className="text-sm uppercase tracking-wider text-text-muted mb-2">Overall Score</h4>
              <div className="text-5xl font-mono">{mockAssessmentData.overallScore.toFixed(1)}</div>
              <div className="text-lg text-text-secondary mt-1">{mockAssessmentData.overallLevel}</div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-text-secondary">CI/CD Maturity</span>
                <span className="font-mono">{mockAssessmentData.dimensions.cicd.score}</span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-text-secondary">Performance</span>
                <span className="font-mono">{mockAssessmentData.dimensions.performance.score}</span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-text-secondary">Observability</span>
                <span className="font-mono">{mockAssessmentData.dimensions.observability.score}</span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="text-text-secondary">Fault Tolerance</span>
                <span className="font-mono">{mockAssessmentData.dimensions.faultTolerance.score}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-medium mb-4">Methodology</h3>
            <p className="text-text-secondary leading-relaxed text-sm">
              The architecture was evaluated against 28 distinct criteria across 4 dimensions. 
              The assessment methodology aligns with the Architecture Maturity Assessment Framework v2.1. 
              Evidence was collected through static analysis, pipeline inspection, and infrastructure-as-code review.
            </p>
          </div>

        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border/50 bg-surface-secondary/20">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Gauge className="w-5 h-5 text-brand-perf" />
              <div>
                <CardTitle className="text-lg">P-Score Performance Report</CardTitle>
                <p className="text-xs text-text-muted mt-1 font-mono">ID: {mockAssessmentData.id}-PERF • Live analysis</p>
              </div>
            </div>
            <button onClick={downloadPScoreDetails} className="border border-brand-perf/50 text-brand-perf px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 hover:bg-brand-perf/10 transition-colors">
              <Download className="w-4 h-4" /> <span className="hidden sm:inline">Download Details</span>
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          <div className="grid gap-6 md:grid-cols-[1fr_1.5fr]">
            <div className="border-r-0 border-border md:border-r md:pr-8">
              <p className="text-sm uppercase tracking-wider text-text-muted">Live P-Score</p>
              <div className="mt-2 font-mono text-5xl text-brand-perf">78<span className="text-xl text-text-muted">/100</span></div>
              <p className="mt-2 text-sm text-text-secondary">Mature performance tier</p>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              <div><p className="text-xs text-text-muted">Points deducted</p><p className="mt-1 font-mono text-xl text-rose-400">22</p></div>
              <div><p className="text-xs text-text-muted">Active anomalies</p><p className="mt-1 font-mono text-xl text-rose-400">2</p></div>
              <div><p className="text-xs text-text-muted">Fan-out services</p><p className="mt-1 font-mono text-xl text-brand-perf">5</p></div>
              <div><p className="text-xs text-text-muted">Peak P99 latency</p><p className="mt-1 font-mono text-xl text-amber-400">1.24s</p></div>
            </div>
          </div>
          <div className="mt-6 border-t border-border/60 pt-5">
            <h3 className="text-sm font-medium">Primary score reductions</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {['Response time (-7)', 'Load testing (-6)', 'Regression guard (-5)', 'Resource usage (-4)'].map((item) => <div key={item} className="rounded-md bg-surface-secondary/50 px-3 py-2 text-xs text-text-secondary">{item}</div>)}
            </div>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
};
