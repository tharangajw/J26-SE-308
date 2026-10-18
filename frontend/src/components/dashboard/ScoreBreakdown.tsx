import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import { mockAssessmentData } from '../../data/mockData';

export const ScoreBreakdown: React.FC = () => {
  const [livePerfScore, setLivePerfScore] = useState<number | null>(null);
  const [livePerfLevel, setLivePerfLevel] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchLivePerf = async () => {
      const urls = ['/api/anomaly/pscore/evaluate', 'http://localhost:8000/pscore/evaluate'];
      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (mounted && typeof data.overallPScore === 'number') {
              setLivePerfScore(Number(data.overallPScore.toFixed(1)));
              setLivePerfLevel(data.maturityTier?.shortLabel || 'Level 4: Optimized');
            }
            break;
          }
        } catch {
          // ignore
        }
      }
    };
    fetchLivePerf();
    const timer = setInterval(fetchLivePerf, 8000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const dims = Object.values(mockAssessmentData.dimensions).map((d) => {
    if (d.id === 'performance' && livePerfScore !== null) {
      return {
        ...d,
        score: livePerfScore,
        level: livePerfLevel || d.level
      };
    }
    return d;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">
            Dimension Breakdown
          </CardTitle>
          {livePerfScore !== null && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live P-Score
            </span>
          )}
        </div>
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
                  {dim.id === 'performance' && livePerfScore !== null && (
                    <span className="rounded bg-brand-perf/15 border border-brand-perf/30 px-1.5 py-0.2 font-mono text-[9px] text-brand-perf">
                      PYTHON LIVE
                    </span>
                  )}
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
