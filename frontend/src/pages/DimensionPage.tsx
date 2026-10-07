import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { PageContainer } from '../components/layout/PageContainer';
import { mockAssessmentData, type MaturityDimension } from '../data/mockData';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';

export const DimensionPage: React.FC = () => {
  const { dimensionId } = useParams<{ dimensionId: string }>();


  let dimensionData: MaturityDimension | null = null;
  
  if (dimensionId === 'cicd') dimensionData = mockAssessmentData.dimensions.cicd;
  if (dimensionId === 'performance') dimensionData = mockAssessmentData.dimensions.performance;
  if (dimensionId === 'observability') dimensionData = mockAssessmentData.dimensions.observability;

  if (!dimensionData) {
    return <Navigate to="/" />;
  }

  return (
    <PageContainer className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight" style={{ color: dimensionData.color }}>
            {dimensionData.name} Maturity
          </h2>
          <p className="text-sm text-text-secondary mt-1">Detailed breakdown of {dimensionData.name.toLowerCase()} engineering practices.</p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-mono font-semibold" style={{ color: dimensionData.color }}>
            {dimensionData.score}
            <span className="text-lg text-text-muted">/100</span>
          </div>
          <div className="text-sm font-medium uppercase tracking-widest text-text-secondary mt-1">
            {dimensionData.level}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Metrics Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {dimensionData.metrics.map((metric) => (
              <div key={metric.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{metric.name}</span>
                  <span className="text-sm font-mono">{metric.score}</span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-secondary">
                  <div 
                    className="h-full w-full flex-1 transition-all duration-500" 
                    style={{ backgroundColor: dimensionData?.color, width: `${metric.score}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Identified Weaknesses</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {dimensionData.weaknesses.map((weakness, i) => (
                  <li key={i} className="flex items-start gap-3 p-3 rounded-md bg-brand-fault/10 border border-brand-fault/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-fault mt-2 flex-shrink-0" />
                    <span className="text-sm text-text-primary leading-relaxed">{weakness}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="flex-1">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Evidence Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-text-muted italic">
                Detailed evidence mapping is available in the Assessment review section.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
};
