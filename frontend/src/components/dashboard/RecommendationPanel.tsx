import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { mockAssessmentData } from '../../data/mockData';
import { ArrowUpRight, AlertCircle } from 'lucide-react';

export const RecommendationPanel: React.FC = () => {
  const recommendations = mockAssessmentData.recommendations;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Engineering Recommendations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {recommendations.map((rec) => (
          <div key={rec.id} className="p-4 rounded-md border border-border/50 bg-surface-secondary/20 hover:bg-surface-secondary/50 transition-colors group">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                {rec.impact === 'High' && <AlertCircle className="w-4 h-4 text-brand-fault" />}
                <h4 className="font-medium text-sm text-text-primary">{rec.title}</h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-secondary border border-border">
                  Effort: {rec.effort}
                </span>
              </div>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed mb-3">
              {rec.description}
            </p>
            <div className="flex items-center justify-between border-t border-border/50 pt-3">
              <div className="flex items-center gap-4 text-xs text-text-muted">
                <span className="font-mono">Cur: {rec.currentScore}</span>
                <span className="text-brand-obs flex items-center gap-1 font-mono">
                  <ArrowUpRight className="w-3 h-3" />
                  {rec.expectedImprovement}
                </span>
              </div>
              <span className="text-[10px] text-text-muted uppercase tracking-wider hidden md:block">
                {rec.evidence}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
