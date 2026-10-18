import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { mockAssessmentData } from '../../data/mockData';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const TrendChart: React.FC = () => {
  const data = mockAssessmentData.history;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Assessment History</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis 
              dataKey="date" 
              tick={{ fill: 'var(--color-text-secondary)', fontSize: 12, fontFamily: 'var(--font-mono)' }} 
              axisLine={false} 
              tickLine={false} 
              dy={10}
            />
            <YAxis 
              domain={[0, 100]} 
              tick={{ fill: 'var(--color-text-secondary)', fontSize: 12, fontFamily: 'var(--font-mono)' }} 
              axisLine={false} 
              tickLine={false} 
              dx={-10}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: '6px' }}
              itemStyle={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
            />
            <Line type="monotone" dataKey="overall" stroke="var(--color-text-primary)" strokeWidth={2} dot={{ r: 4, fill: 'var(--color-background)', strokeWidth: 2 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="cicd" stroke="var(--color-brand-cicd)" strokeWidth={1} strokeOpacity={0.5} dot={false} />
            <Line type="monotone" dataKey="performance" stroke="var(--color-brand-perf)" strokeWidth={1} strokeOpacity={0.5} dot={false} />
            <Line type="monotone" dataKey="observability" stroke="var(--color-brand-obs)" strokeWidth={1} strokeOpacity={0.5} dot={false} />
            <Line type="monotone" dataKey="faultTolerance" stroke="var(--color-brand-fault)" strokeWidth={1} strokeOpacity={0.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
