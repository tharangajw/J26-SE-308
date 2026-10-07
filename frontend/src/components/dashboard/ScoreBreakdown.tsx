import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import { mockAssessmentData } from '../../data/mockData';

export const ScoreBreakdown: React.FC = () => {
  const dims = Object.values(mockAssessmentData.dimensions);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Dimension Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {dims.map((dim) => {
          let indicatorColor = '';
          if (dim.id === 'cicd') indicatorColor = 'bg-brand-cicd';
          if (dim.id === 'performance') indicatorColor = 'bg-brand-perf';
          if (dim.id === 'observability') indicatorColor = 'bg-brand-obs';
          if (dim.id === 'faultTolerance') indicatorColor = 'bg-brand-fault';

          return (
            <div key={dim.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{dim.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-muted hidden md:inline-block">{dim.level}</span>
                  <span className="text-sm font-mono">{dim.score}</span>
                </div>
              </div>
              <ProgressBar value={dim.score} indicatorColor={indicatorColor} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
