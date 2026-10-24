import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '../ui/Card';
import { mockAssessmentData } from '../../data/mockData';

export const MaturityScore: React.FC = () => {
  const [livePerfScore, setLivePerfScore] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    let mounted = true;
    const fetchLivePerf = async () => {
      const urls = ['/api/anomaly/pscore/evaluate', 'http://localhost:18002/pscore/evaluate'];
      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (mounted && typeof data.overallPScore === 'number') {
              setLivePerfScore(Number(data.overallPScore.toFixed(1)));
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

  // Recompute overall score incorporating live Performance P-Score when available
  const targetScore =
    livePerfScore !== null
      ? Number(
          (
            (mockAssessmentData.dimensions.cicd.score +
              livePerfScore +
              mockAssessmentData.dimensions.observability.score +
              mockAssessmentData.dimensions.faultTolerance.score) /
            4
          ).toFixed(1)
        )
      : mockAssessmentData.overallScore;

  useEffect(() => {
    let startTime: number;
    const duration = 1200;

    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const progress = (time - startTime) / duration;

      if (progress < 1) {
        const easeProgress = 1 - Math.pow(1 - progress, 4);
        setScore(targetScore * easeProgress);
        requestAnimationFrame(animate);
      } else {
        setScore(targetScore);
      }
    };

    requestAnimationFrame(animate);
  }, [targetScore]);

  return (
    <Card className="h-full bg-surface-secondary/30 flex flex-col justify-center">
      <CardContent className="p-8 flex items-center gap-10">
        <div className="relative w-48 h-48 flex-shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 transform">
            {/* Background Track */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="var(--color-border)"
              strokeWidth="4"
            />
            {/* Animated Score Arc */}
            <motion.circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="var(--color-text-primary)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="283"
              initial={{ strokeDashoffset: 283 }}
              animate={{ strokeDashoffset: 283 - (283 * score) / 100 }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-semibold font-mono tracking-tighter">
              {score.toFixed(1)}
            </span>
            <span className="text-xs uppercase tracking-widest text-text-secondary mt-1 font-medium">
              {targetScore >= 85
                ? 'Level 4: Optimized'
                : targetScore >= 70
                ? 'Level 3: Resilient'
                : mockAssessmentData.overallLevel}
            </span>
          </div>
        </div>

        <div className="flex flex-col space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-medium">Architecture Maturity</h3>
              {livePerfScore !== null && (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400">
                  Live P-Score: {livePerfScore}
                </span>
              )}
            </div>
            <p className="text-sm text-text-secondary mt-1 max-w-sm leading-relaxed">
              Overall engineering maturity incorporates real-time Performance Efficiency (P-Score) telemetry from active Docker microservices.
            </p>
          </div>

          <div className="flex gap-8">
            <div className="flex flex-col">
              <span className="text-xs text-text-muted mb-1">Previous Score</span>
              <span className="font-mono text-sm">{mockAssessmentData.previousScore.toFixed(1)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-text-muted mb-1">Baseline Trend</span>
              <span className="font-mono text-sm text-brand-obs">
                +{(targetScore - mockAssessmentData.previousScore).toFixed(1)}%
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-text-muted mb-1">AHP Consistency</span>
              <span className="font-mono text-sm text-emerald-400">CR &lt; 0.10</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
