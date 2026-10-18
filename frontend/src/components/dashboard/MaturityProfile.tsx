import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { mockAssessmentData } from '../../data/mockData';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

export const MaturityProfile: React.FC = () => {
  const data = [
    {
      subject: 'CI/CD',
      A: mockAssessmentData.dimensions.cicd.score,
      fullMark: 100,
    },
    {
      subject: 'Performance',
      A: mockAssessmentData.dimensions.performance.score,
      fullMark: 100,
    },
    {
      subject: 'Fault Tolerance',
      A: mockAssessmentData.dimensions.faultTolerance.score,
      fullMark: 100,
    },
    {
      subject: 'Observability',
      A: mockAssessmentData.dimensions.observability.score,
      fullMark: 100,
    },
  ];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Maturity Profile</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="var(--color-border)" />
            <PolarAngleAxis 
              dataKey="subject" 
              tick={{ fill: 'var(--color-text-secondary)', fontSize: 12, fontFamily: 'var(--font-mono)' }} 
            />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: '6px' }}
              itemStyle={{ color: 'var(--color-text-primary)' }}
            />
            <Radar
              name="Score"
              dataKey="A"
              stroke="var(--color-text-primary)"
              fill="var(--color-text-primary)"
              fillOpacity={0.1}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
