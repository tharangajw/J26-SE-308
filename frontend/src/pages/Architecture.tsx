import React from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Database, Server, Cloud, Globe } from 'lucide-react';

export const Architecture: React.FC = () => {
  return (
    <PageContainer className="space-y-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Architecture Graph</h2>
          <p className="text-sm text-text-secondary mt-1">Interactive visualization of dependencies and health status.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success">All Systems Healthy</Badge>
          <Badge variant="outline">7 Services</Badge>
        </div>
      </div>

      <Card className="min-h-[500px] relative overflow-hidden bg-surface-secondary/20 flex flex-col">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">Dependency Map</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-8 flex items-center justify-center relative">
          
          {/* Mock Node Visualization */}
          <div className="relative w-full max-w-4xl h-full min-h-[400px] flex flex-col items-center justify-between py-10">
            {/* SVG Connecting Lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
              <path d="M 50% 20% L 50% 40%" stroke="var(--color-border)" strokeWidth="2" strokeDasharray="4 4" />
              <path d="M 50% 40% L 30% 60%" stroke="var(--color-border)" strokeWidth="2" strokeDasharray="4 4" />
              <path d="M 50% 40% L 70% 60%" stroke="var(--color-brand-fault)" strokeWidth="2" strokeDasharray="4 4" />
              <path d="M 30% 60% L 50% 80%" stroke="var(--color-border)" strokeWidth="2" strokeDasharray="4 4" />
              <path d="M 70% 60% L 50% 80%" stroke="var(--color-border)" strokeWidth="2" strokeDasharray="4 4" />
            </svg>

            {/* Client Node */}
            <div className="z-10 bg-surface border border-border p-4 rounded-lg shadow-sm flex flex-col items-center gap-2 w-48 hover:border-brand-obs transition-colors cursor-pointer group">
              <Globe className="w-6 h-6 text-text-secondary group-hover:text-brand-obs transition-colors" />
              <div className="text-sm font-medium">Web Client</div>
              <Badge variant="outline" className="text-[10px]">React / TS</Badge>
            </div>

            {/* Gateway Node */}
            <div className="z-10 bg-surface border border-border p-4 rounded-lg shadow-sm flex flex-col items-center gap-2 w-48 hover:border-brand-obs transition-colors cursor-pointer group mt-10">
              <Cloud className="w-6 h-6 text-text-secondary group-hover:text-brand-obs transition-colors" />
              <div className="text-sm font-medium">API Gateway</div>
              <Badge variant="success" className="text-[10px]">99.9% Uptime</Badge>
            </div>

            {/* Services Level */}
            <div className="flex w-full justify-around mt-10">
              <div className="z-10 bg-surface border border-border p-4 rounded-lg shadow-sm flex flex-col items-center gap-2 w-48 hover:border-brand-obs transition-colors cursor-pointer group">
                <Server className="w-6 h-6 text-text-secondary group-hover:text-brand-obs transition-colors" />
                <div className="text-sm font-medium">Auth Service</div>
                <Badge variant="success" className="text-[10px]">Healthy</Badge>
              </div>

              <div className="z-10 bg-surface border border-brand-fault/50 p-4 rounded-lg shadow-sm flex flex-col items-center gap-2 w-48 hover:border-brand-fault transition-colors cursor-pointer group">
                <Server className="w-6 h-6 text-brand-fault group-hover:text-brand-fault transition-colors" />
                <div className="text-sm font-medium">Payment Service</div>
                <Badge variant="destructive" className="text-[10px]">Missing CB</Badge>
              </div>
            </div>

            {/* Database Node */}
            <div className="z-10 bg-surface border border-border p-4 rounded-lg shadow-sm flex flex-col items-center gap-2 w-48 hover:border-brand-obs transition-colors cursor-pointer group mt-10">
              <Database className="w-6 h-6 text-text-secondary group-hover:text-brand-obs transition-colors" />
              <div className="text-sm font-medium">Primary DB</div>
              <Badge variant="outline" className="text-[10px]">PostgreSQL</Badge>
            </div>
          </div>

        </CardContent>
      </Card>
    </PageContainer>
  );
};
