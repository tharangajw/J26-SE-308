import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '../ui/Card';
import { mockAssessmentData } from '../../data/mockData';

export const MaturityScore: React.FC = () => {
  const [score, setScore] = useState(0);
  const targetScore = mockAssessmentData.overallScore;

  useEffect(() => {
    let startTime: number;
    const duration = 1500; // 1.5s
    
    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const progress = (time - startTime) / duration;
      
      if (progress < 1) {
        // easeOutQuart
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
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-semibold font-mono tracking-tighter">
              {score.toFixed(1)}
            </span>
            <span className="text-xs uppercase tracking-widest text-text-secondary mt-1 font-medium">
              {mockAssessmentData.overallLevel}
            </span>
          </div>
        </div>

        <div className="flex flex-col space-y-4">
          <div>
            <h3 className="text-xl font-medium">Architecture Maturity</h3>
            <p className="text-sm text-text-secondary mt-1 max-w-sm leading-relaxed">
              Overall engineering maturity is currently above the recommended baseline for Tier 1 services.
            </p>
          </div>
          
          <div className="flex gap-8">
            <div className="flex flex-col">
              <span className="text-xs text-text-muted mb-1">Previous Score</span>
              <span className="font-mono text-sm">{mockAssessmentData.previousScore.toFixed(1)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-text-muted mb-1">Baseline Trend</span>
              <span className="font-mono text-sm text-brand-obs">+{mockAssessmentData.baselineComparison}%</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-text-muted mb-1">Confidence</span>
              <span className="font-mono text-sm">{mockAssessmentData.confidence}%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
