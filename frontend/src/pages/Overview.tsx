import React from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { MaturityScore } from '../components/dashboard/MaturityScore';
import { MaturityProfile } from '../components/dashboard/MaturityProfile';
import { ScoreBreakdown } from '../components/dashboard/ScoreBreakdown';
import { TrendChart } from '../components/dashboard/TrendChart';
import { RecommendationPanel } from '../components/dashboard/RecommendationPanel';

export const Overview: React.FC = () => {
  return (
    <PageContainer className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <MaturityScore />
        </div>
        <div className="lg:col-span-1">
          <ScoreBreakdown />
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MaturityProfile />
        <TrendChart />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <RecommendationPanel />
      </div>
    </PageContainer>
  );
};
