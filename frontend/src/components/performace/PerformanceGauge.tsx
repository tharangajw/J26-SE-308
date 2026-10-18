import React, { useState } from 'react';
import { Calculator, ChevronDown, CircleHelp } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';

interface PerformanceGaugeProps {
  score: number;
  tier: string;
  anomalies: number;
  fanOut: number;
  defaultShowCalculation?: boolean;
}

export const PerformanceGauge: React.FC<PerformanceGaugeProps> = ({ score, tier, anomalies, fanOut, defaultShowCalculation = false }) => {
  const [showDeductions, setShowDeductions] = useState(false);
  const [showCalculation, setShowCalculation] = useState(defaultShowCalculation);
  const color = score < 50 ? '#ef4444' : score < 75 ? '#f97316' : '#22c55e';
  const circumference = 2 * Math.PI * 76;
  const offset = circumference * (1 - score / 100);
  const deductions = [
    { label: 'Response time', points: 7, reason: 'P99 latency rises to 1.24 s during peak traffic.' },
    { label: 'Load testing', points: 6, reason: 'Automated load tests are not yet part of the CI pipeline.' },
    { label: 'Performance regression', points: 5, reason: 'No release gate currently protects the latency budget.' },
    { label: 'Resource utilization', points: 4, reason: 'CPU reaches 88% under the midday workload spike.' },
  ];

  return (
    <Card className="border-brand-perf/40 bg-brand-perf/5">
      <CardContent className="p-6">
        <div className="grid items-center gap-6 sm:grid-cols-[190px_1fr]">
          <button type="button" className="group relative mx-auto h-47.5 w-47.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-perf" onClick={() => setShowDeductions((current) => !current)} aria-expanded={showDeductions} aria-controls="performance-score-deductions" aria-label="Show why the P-Score is below 100">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 190 190" aria-hidden="true">
              <circle cx="95" cy="95" r="76" fill="none" stroke="var(--color-border)" strokeWidth="14" />
              <circle cx="95" cy="95" r="76" fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-5xl font-semibold" style={{ color }}>{score}</span>
              <span className="text-xs uppercase tracking-widest text-text-muted">P-Score / 100</span>
              <span className="mt-1 flex items-center gap-1 text-[10px] text-text-muted opacity-0 transition-opacity group-hover:opacity-100"><CircleHelp className="h-3 w-3" /> Details</span>
            </span>
          </button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Live performance health</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold">{tier} maturity</h2>
            <button type="button" onClick={() => setShowCalculation((current) => !current)} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-brand-perf/60 hover:text-brand-perf focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-perf" aria-expanded={showCalculation} aria-controls="performance-score-calculation">
              <Calculator className="h-3.5 w-3.5" /> How is this calculated?
            </button>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="border-l-2 border-rose-400 pl-3"><p className="text-2xl font-mono text-rose-400">{anomalies}</p><p className="text-xs text-text-muted">Active anomalies</p></div>
            <div className="border-l-2 border-brand-perf pl-3"><p className="text-2xl font-mono text-brand-perf">{fanOut}</p><p className="text-xs text-text-muted">Fan-out services</p></div>
          </div>
        </div>
        </div>
        {showCalculation && <div id="performance-score-calculation" className="mt-6 border-t border-border/70 pt-5" role="region" aria-label="P-Score calculation details">
          <h3 className="text-sm font-semibold">How the P-Score is calculated</h3>
          <p className="mt-1 text-xs text-text-secondary">The score combines weighted performance parameters, then applies evidence-based operational adjustments.</p>
          <div className="mt-4 rounded-md border border-brand-perf/30 bg-brand-perf/5 px-4 py-3 font-mono text-xs text-brand-perf">P-Score = normalized weighted parameter score - operational deductions</div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-140 text-left text-xs"><thead className="text-text-muted"><tr><th className="pb-2 font-medium">Parameter</th><th className="pb-2 font-medium">Current value</th><th className="pb-2 font-medium">Score</th><th className="pb-2 font-medium">Weight</th><th className="pb-2 text-right font-medium">Impact</th></tr></thead><tbody className="divide-y divide-border/60">{[
              ['Response time', 'P99 1.24 s', '70/100', '1.5x', '-7 pts'],
              ['Throughput', '510 req/s', '80/100', '1.2x', 'Included'],
              ['Resource utilization', '88% CPU peak', '75/100', '1.0x', '-4 pts'],
              ['Scalability', '5 downstream services', '78/100', '1.5x', 'Included'],
              ['Load testing', 'Not in CI', '65/100', '1.0x', '-6 pts'],
              ['Performance regression', 'No release gate', '72/100', '1.2x', '-5 pts'],
            ].map(([parameter, value, parameterScore, weight, impact]) => <tr key={parameter}><td className="py-2 font-medium text-text-primary">{parameter}</td><td className="py-2 text-text-secondary">{value}</td><td className="py-2 font-mono text-text-secondary">{parameterScore}</td><td className="py-2 font-mono text-text-secondary">{weight}</td><td className={`py-2 text-right font-mono ${impact.startsWith('-') ? 'text-rose-400' : 'text-text-muted'}`}>{impact}</td></tr>)}</tbody></table>
          </div>
          <p className="mt-3 text-xs text-text-muted">The four operational deductions total 22 points, resulting in the current P-Score of {score}/100.</p>
        </div>}
        {showDeductions && <div id="performance-score-deductions" className="mt-6 border-t border-border/70 pt-5" role="region" aria-label="P-Score deductions">
          <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">Why {score}/100?</h3><p className="mt-1 text-xs text-text-muted">{100 - score} points are currently deducted from the ideal score.</p></div><ChevronDown className="h-4 w-4 rotate-180 text-text-muted" aria-hidden="true" /></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {deductions.map((deduction) => <div key={deduction.label} className="rounded-md border border-border/70 bg-surface/50 p-3"><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">{deduction.label}</span><span className="font-mono text-sm text-rose-400">-{deduction.points} pts</span></div><p className="mt-1 text-xs leading-relaxed text-text-secondary">{deduction.reason}</p></div>)}
          </div>
        </div>}
      </CardContent>
    </Card>
  );
};
