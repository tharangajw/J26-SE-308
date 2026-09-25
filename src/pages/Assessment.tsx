import React from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface Criterion {
  id: string;
  name: string;
  dimension: string;
  description: string;
  evidence: string;
  score: number;
  maxScore: number;
  confidence: 'High' | 'Medium' | 'Low';
  status: 'Pass' | 'Warning' | 'Fail';
}

const criteriaData: Criterion[] = [
  {
    id: 'C-01',
    dimension: 'CI/CD',
    name: 'Pipeline Automation',
    description: 'All code merges trigger automated build, test, and package processes.',
    evidence: 'GitHub Actions workflows detected on main and release branches.',
    score: 5,
    maxScore: 5,
    confidence: 'High',
    status: 'Pass'
  },
  {
    id: 'C-02',
    dimension: 'CI/CD',
    name: 'Test Automation',
    description: 'Automated test suite provides >80% coverage and blocks merging on failure.',
    evidence: 'SonarQube reports 72% coverage. Blockers not strictly enforced.',
    score: 3,
    maxScore: 5,
    confidence: 'Medium',
    status: 'Warning'
  },
  {
    id: 'O-01',
    dimension: 'Observability',
    name: 'Distributed Tracing',
    description: 'Services expose trace context and maintain request correlation.',
    evidence: 'OpenTelemetry instrumentation detected in 85% of edge services.',
    score: 4,
    maxScore: 5,
    confidence: 'High',
    status: 'Pass'
  },
  {
    id: 'F-01',
    dimension: 'Fault Tolerance',
    name: 'Circuit Breakers',
    description: 'External network calls are protected by circuit breaker patterns.',
    evidence: 'Missing resilience patterns on Payment Gateway and Auth provider.',
    score: 2,
    maxScore: 5,
    confidence: 'High',
    status: 'Fail'
  }
];

export const Assessment: React.FC = () => {
  return (
    <PageContainer className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">Architecture Assessment</h2>
        <p className="text-sm text-text-secondary mt-1">Detailed evaluation of architectural criteria and evidence.</p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-text-muted uppercase bg-surface-secondary/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-medium">Criterion</th>
                <th className="px-6 py-4 font-medium">Description & Evidence</th>
                <th className="px-6 py-4 font-medium">Score</th>
                <th className="px-6 py-4 font-medium">Confidence</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {criteriaData.map((c) => (
                <tr key={c.id} className="hover:bg-surface-secondary/20 transition-colors">
                  <td className="px-6 py-4 align-top">
                    <div className="font-medium text-text-primary">{c.name}</div>
                    <div className="text-xs text-text-muted mt-1 font-mono">{c.dimension}</div>
                  </td>
                  <td className="px-6 py-4 align-top max-w-md">
                    <div className="text-text-primary mb-2">{c.description}</div>
                    <div className="text-xs text-text-secondary bg-surface-secondary/50 p-2 rounded border border-border/50 font-mono">
                      {c.evidence}
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top whitespace-nowrap">
                    <div className="font-mono text-base">
                      {c.score} <span className="text-text-muted text-xs">/ {c.maxScore}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <span className="text-xs font-mono">{c.confidence}</span>
                  </td>
                  <td className="px-6 py-4 align-top">
                    {c.status === 'Pass' && (
                      <Badge variant="success" className="gap-1.5"><CheckCircle2 className="w-3 h-3" /> Pass</Badge>
                    )}
                    {c.status === 'Warning' && (
                      <Badge variant="warning" className="gap-1.5"><AlertTriangle className="w-3 h-3" /> Warning</Badge>
                    )}
                    {c.status === 'Fail' && (
                      <Badge variant="destructive" className="gap-1.5"><XCircle className="w-3 h-3" /> Fail</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </PageContainer>
  );
};
