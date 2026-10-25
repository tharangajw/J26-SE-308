import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { mockAssessmentData } from '../../data/mockData';
import { ArrowUpRight, AlertCircle, Sparkles } from 'lucide-react';

interface LiveRecommendation {
  id: string;
  title: string;
  impact: string;
  effort: string;
  description: string;
  currentScore: string;
  expectedImprovement: string;
  evidence: string;
  isLivePython?: boolean;
}

export const RecommendationPanel: React.FC = () => {
  const [liveRecs, setLiveRecs] = useState<LiveRecommendation[]>([]);

  useEffect(() => {
    let mounted = true;
    const fetchLiveRecs = async () => {
      const urls = ['/api/anomaly/pscore/evaluate', 'http://localhost:8000/pscore/evaluate', 'http://localhost:18002/pscore/evaluate'];
      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (mounted && Array.isArray(data.recommendations)) {
              const svcScoreMap: Record<string, number> = {};
              for (const s of data.serviceEvaluations || []) {
                svcScoreMap[s.serviceId] = s.pScore;
              }
              const mapped: LiveRecommendation[] = data.recommendations
                .slice(0, 4)
                .map((r: any, idx: number) => ({
                  id: r.id || `${r.serviceId}-${r.ruleId}-${idx}`,
                  title: r.title,
                  impact: r.impact === 'HIGH' ? 'High' : 'Medium',
                  effort: r.effort === 'LOW' ? 'Low' : 'Medium',
                  description: r.description,
                  currentScore: `${(svcScoreMap[r.serviceId] ?? data.overallPScore ?? 85).toFixed(1)}`,
                  expectedImprovement: r.expectedPScoreImprovement,
                  evidence: r.triggerEvidence,
                  isLivePython: true
                }));
              setLiveRecs(mapped);
            }
            break;
          }
        } catch {
          // ignore
        }
      }
    };
    fetchLiveRecs();
    const timer = setInterval(fetchLiveRecs, 8000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const recommendations: LiveRecommendation[] =
    liveRecs.length > 0
      ? liveRecs
      : mockAssessmentData.recommendations.map((r) => ({
          id: r.id,
          title: r.title,
          impact: r.impact,
          effort: r.effort,
          description: r.description,
          currentScore: String(r.currentScore),
          expectedImprovement: r.expectedImprovement,
          evidence: r.evidence
        }));

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm uppercase tracking-wider text-text-secondary">
            Engineering Recommendations
          </CardTitle>
          {liveRecs.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] text-emerald-400">
              <Sparkles className="h-3 w-3" /> Live Python Context-Aware Engine
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {recommendations.map((rec) => (
          <div
            key={rec.id}
            className="p-4 rounded-md border border-border/50 bg-surface-secondary/20 hover:bg-surface-secondary/50 transition-colors group"
          >
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
            <p className="text-sm text-text-secondary leading-relaxed mb-3">{rec.description}</p>
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
