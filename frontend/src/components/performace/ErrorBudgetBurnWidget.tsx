import React, { useState } from 'react';
import {
  Gauge,
  Flame,
  ShieldCheck,
  AlertTriangle,
  Clock,
  HelpCircle,
  ChevronUp,
  Car,
  Server,
  Zap,
  CheckCircle2,
  AlertOctagon,
  ArrowRight
} from 'lucide-react';

interface ErrorBudgetBurnWidgetProps {
  sloTargetPct?: number;       // default: 99.9%
  avgLatencyMs?: number;       // e.g. 33.2ms
  latencyThresholdMs?: number; // e.g. 150ms
  driftPenalty?: number;       // e.g. 0.0 to 1.0
  activeServicesCount?: number;
}

export const ErrorBudgetBurnWidget: React.FC<ErrorBudgetBurnWidgetProps> = ({
  sloTargetPct = 99.9,
  avgLatencyMs = 33.2,
  latencyThresholdMs = 150.0,
  driftPenalty = 0.05,
  activeServicesCount = 3,
}) => {
  const [showExplain, setShowExplain] = useState(false);
  const [analogyTab, setAnalogyTab] = useState<'real_life' | 'sre_engineering'>('real_life');

  // Compute realistic Google SRE Error Budget metrics
  // Allowed degradation fraction = 100 - sloTargetPct (e.g. 0.1%)
  const latencyConsumptionRatio = Math.min(1.0, avgLatencyMs / latencyThresholdMs);
  const remainingBudgetPct = Math.max(0, Math.min(100, (1.0 - (latencyConsumptionRatio * 0.2 + driftPenalty * 0.8)) * 100));

  // Burn rate: 1.0x is normal consumption over a 30-day window
  const burnRate = Number(Math.max(0.6, 1.0 + (driftPenalty * 6.0) + (latencyConsumptionRatio > 0.6 ? 2.5 : 0)).toFixed(2));

  // Estimated time until exhaustion
  const estimatedDaysRemaining = burnRate > 0 ? Math.max(1, Math.round(30.0 / burnRate)) : 30;

  const isSevereBurn = burnRate >= 4.0 || remainingBudgetPct < 40;
  const isElevatedBurn = (burnRate >= 2.0 || remainingBudgetPct < 70) && !isSevereBurn;

  // Real-world downtime calculations for 30-day period (43,200 total minutes)
  const totalMonthMinutes = 43200;
  const allowedDowntimeMinutes = ((100 - sloTargetPct) / 100) * totalMonthMinutes; // 43.2 mins for 99.9%
  const consumedMinutes = (allowedDowntimeMinutes * ((100 - remainingBudgetPct) / 100)).toFixed(1);
  const remainingMinutes = (allowedDowntimeMinutes * (remainingBudgetPct / 100)).toFixed(1);

  const getStatusBadge = () => {
    if (isSevereBurn) {
      return {
        label: 'Fast Burn Rate (Exhaustion Imminent)',
        color: 'border-rose-500/40 bg-rose-500/15 text-rose-400',
        icon: <Flame className="h-3.5 w-3.5 text-rose-400" />
      };
    }
    if (isElevatedBurn) {
      return {
        label: 'Elevated Drift Burn',
        color: 'border-amber-500/40 bg-amber-500/15 text-amber-400',
        icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
      };
    }
    return {
      label: 'Nominal Burn (Sustainable)',
      color: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400',
      icon: <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
    };
  };

  const status = getStatusBadge();

  return (
    <div className="rounded-xl border border-border/80 bg-surface-secondary/20 p-4 space-y-3.5 shadow-sm transition-all">
      {/* Top Header Row with Explain Button */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
            SRE Error Budget &amp; SLA Burn Rate Forecaster
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowExplain(!showExplain)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-xs font-semibold transition-all shadow-sm ${
              showExplain
                ? 'border-sky-400 bg-sky-500 text-slate-950 font-bold'
                : 'border-sky-500/40 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20'
            }`}
            title="Click to view simple real-world analogy and SRE explanation"
          >
            {showExplain ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Hide Scenario
              </>
            ) : (
              <>
                <HelpCircle className="h-3.5 w-3.5" />
                Explain with Scenario (තේරුම් ගන්න)
              </>
            )}
          </button>

          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold ${status.color}`}>
            {status.icon}
            {status.label}
          </span>
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
        {/* Remaining Budget */}
        <div className="rounded-lg border border-border/70 bg-surface/70 p-3 space-y-1">
          <div className="text-[10px] uppercase text-text-muted flex justify-between">
            <span>Remaining Budget</span>
            <span className="text-emerald-400">{sloTargetPct}% SLO</span>
          </div>
          <div className="text-xl font-bold text-text-primary mt-0.5">
            {remainingBudgetPct.toFixed(1)}%
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface-secondary overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                remainingBudgetPct > 70 ? 'bg-emerald-400' : remainingBudgetPct > 40 ? 'bg-amber-400' : 'bg-rose-400'
              }`}
              style={{ width: `${remainingBudgetPct}%` }}
            />
          </div>
          <div className="text-[10px] text-text-muted pt-0.5">
            Safety margin: <strong className="text-text-secondary">{remainingMinutes} mins</strong> left out of {allowedDowntimeMinutes.toFixed(1)} mins
          </div>
        </div>

        {/* Burn Rate */}
        <div className="rounded-lg border border-border/70 bg-surface/70 p-3 space-y-1">
          <div className="text-[10px] uppercase text-text-muted flex justify-between">
            <span>Current Burn Rate</span>
            <span>Baseline: 1.0x</span>
          </div>
          <div className={`text-xl font-bold mt-0.5 ${
            isSevereBurn ? 'text-rose-400' : isElevatedBurn ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {burnRate}x
          </div>
          <p className="text-[10px] text-text-muted">
            {burnRate <= 1.2
              ? 'Sustainable 30-day budget consumption'
              : `Consuming safety budget ${burnRate}x faster than expected!`}
          </p>
        </div>

        {/* Depletion Forecast */}
        <div className="rounded-lg border border-border/70 bg-surface/70 p-3 space-y-1">
          <div className="text-[10px] uppercase text-text-muted flex justify-between">
            <span>Depletion Forecast</span>
            <Clock className="h-3 w-3 text-sky-400" />
          </div>
          <div className="text-xl font-bold text-sky-400 mt-0.5">
            ~{estimatedDaysRemaining} {estimatedDaysRemaining === 1 ? 'Day' : 'Days'}
          </div>
          <p className="text-[10px] text-text-muted truncate">
            {estimatedDaysRemaining > 14 ? 'Safe: Free to deploy new features' : 'Caution: Deploy freeze recommended!'}
          </p>
        </div>
      </div>

      {/* Expandable Intuitive Explanation Section */}
      {showExplain && (
        <div className="rounded-xl border border-sky-500/30 bg-surface/95 p-4 space-y-4 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Tab Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                <HelpCircle className="h-4 w-4" /> Error Budget &amp; Burn Rate කියන්නේ මොකක්ද? (සරලව)
              </h4>
              <p className="text-[11px] text-text-muted">
                Google SRE (Site Reliability Engineering) ක්‍රමවේදය සරල ජීවන උදාහරණයකින් සහ Microservices පරිසරයකින් තේරුම් ගනිමු.
              </p>
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-secondary/40 p-1 font-mono text-xs">
              <button
                type="button"
                onClick={() => setAnalogyTab('real_life')}
                className={`rounded px-2.5 py-1 transition-colors flex items-center gap-1.5 ${
                  analogyTab === 'real_life'
                    ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Car className="h-3.5 w-3.5" /> 🚗 කාර් එකක තෙල් ටැංකිය (Real-Life)
              </button>
              <button
                type="button"
                onClick={() => setAnalogyTab('sre_engineering')}
                className={`rounded px-2.5 py-1 transition-colors flex items-center gap-1.5 ${
                  analogyTab === 'sre_engineering'
                    ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Server className="h-3.5 w-3.5" /> ☁️ Microservices &amp; SRE
              </button>
            </div>
          </div>

          {/* Scenario Tab 1: Real-Life Car & Fuel Tank Analogy */}
          {analogyTab === 'real_life' ? (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Step 1 */}
                <div className="rounded-lg border border-border/70 bg-surface-secondary/30 p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[11px]">1</span>
                    Error Budget = මාසික තෙල් ටැංකිය
                  </div>
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    හිතන්න ඔබට මාසෙකට දුවන්න ලැබෙනවා <strong>ලීටර් 30 ක පෙට්‍රල් ටැංකියක්</strong>.
                    සාමාන්‍යයෙන් දවසකට <strong>ලීටර් 1 ක්</strong> පිච්චුවොත් මාසය (දින 30) කිසිම කරදරයක් නැතිව දුවන්න පුළුවන්.
                  </p>
                  <div className="font-mono text-[10px] text-emerald-400/90 bg-emerald-500/10 rounded px-2 py-1">
                    Burn Rate = 1.0x (Optimal)
                  </div>
                </div>

                {/* Step 2 */}
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-[11px]">2</span>
                    Burn Rate = තෙල් පිච්චෙන වේගය
                  </div>
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    දවසක් ඔබ අධික වේගයෙන් වාහනය එළවනවා (හෝ ටැංකියේ ලීක් එකක් තියෙනවා). දවසකට <strong>ලීටර් 4.5 ක්</strong> පිච්චෙනවා!
                    ඒ කියන්නේ ඔබ සාමාන්‍ය වේගයට වඩා <strong>4.5 ගුණයකින් තෙල් පුච්චනවා</strong>.
                  </p>
                  <div className="font-mono text-[10px] text-amber-400 bg-amber-500/10 rounded px-2 py-1">
                    Burn Rate = 4.5x (Fast Burn!)
                  </div>
                </div>

                {/* Step 3 */}
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-400">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/20 text-[11px]">3</span>
                    Depletion Forecast = තෙල් ඉවර වෙන දවස
                  </div>
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    දවසකට ලීටර් 4.5 ගානේ පිච්චුණොත්, දින 30 කට තිබුණු මුළු ටැංකියම <strong>දින 6 න් සම්පූර්ණයෙන්ම හිස් වේ</strong>!
                    පාර මැද වාහනය නතර වීමට පෙර වේගය අඩු කර ලීක් එක හදාගත යුතුය.
                  </p>
                  <div className="font-mono text-[10px] text-rose-400 bg-rose-500/10 rounded px-2 py-1">
                    Exhaustion: 30 / 4.5 = ~6.6 Days
                  </div>
                </div>
              </div>

              {/* Bottom Insight Callout */}
              <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 flex items-start gap-2.5 text-xs text-sky-200">
                <CheckCircle2 className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong>මෘදුකාංග පද්ධතියට මෙය අදාළ වෙන්නේ කෙසේද?</strong>
                  <p className="text-[11px] text-sky-300/90 leading-relaxed">
                    Microservice එකක <strong>"Error Budget"</strong> කියන්නේ මාසයක් ඇතුළත පද්ධතියට සිදුවිය හැකි උපරිම බිඳවැටීම් හෝ ප්‍රමාදයන් (Allowed Downtime) ප්‍රමාණයයි.
                    Slow database queries හෝ Memory leak එකක් නිසා responses ප්‍රමාද වන විට Error Budget එක වේගයෙන් පිච්චෙන්න (Burn වෙන්න) පටන් ගනී.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Scenario Tab 2: SRE Engineering & Multi-Window Math */
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Math Card */}
                <div className="rounded-lg border border-border/70 bg-surface-secondary/30 p-3 space-y-2">
                  <div className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-amber-400" /> ගණනය කිරීම (99.9% SLO Target එකක් සඳහා)
                  </div>
                  <div className="space-y-1 font-mono text-[11px] text-text-secondary">
                    <div className="flex justify-between border-b border-border/40 py-1">
                      <span>මාසයක මුළු කාලය:</span>
                      <strong className="text-text-primary">30 දින × 24 පැය × 60 = 43,200 මිනිත්තු</strong>
                    </div>
                    <div className="flex justify-between border-b border-border/40 py-1">
                      <span>99.9% SLO අවසර දෙන Downtime:</span>
                      <strong className="text-emerald-400">43.2 මිනිත්තු (0.1% Budget)</strong>
                    </div>
                    <div className="flex justify-between border-b border-border/40 py-1">
                      <span>දැනට වැය වී ඇති Downtime:</span>
                      <strong className="text-amber-400">{consumedMinutes} මිනිත්තු ({(100 - remainingBudgetPct).toFixed(1)}%)</strong>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span>ඉතිරිව ඇති ආරක්ෂිත කාලය:</span>
                      <strong className="text-sky-400">{remainingMinutes} මිනිත්තු ({remainingBudgetPct.toFixed(1)}%)</strong>
                    </div>
                  </div>
                </div>

                {/* SRE Policy Card */}
                <div className="rounded-lg border border-border/70 bg-surface-secondary/30 p-3 space-y-2">
                  <div className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Google SRE Action Rules (ඉංජිනේරු තීරණ)
                  </div>
                  <div className="space-y-1.5 text-[11px] text-text-secondary">
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-emerald-400 font-bold shrink-0">1.0x - 1.5x:</span>
                      <span><strong>🟢 Safe to Ship:</strong> Developers ලාට බය නැතුව අලුත් features deploy කරන්න පුළුවන්.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-amber-400 font-bold shrink-0">2.0x - 3.5x:</span>
                      <span><strong>🟡 Warning Alert:</strong> Latency drift එකක් හෝ N+1 queries හඳුනාගෙන optimization කරන්න.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-rose-400 font-bold shrink-0">&gt;= 4.0x:</span>
                      <span><strong>🔴 Feature Freeze:</strong> සියලු නව deployments නවතා (freeze කර) reliability fix කරන තෙක් hold කරන්න.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Multi-Window SRE Alerting */}
              <div className="rounded-lg border border-border/60 bg-surface/80 p-3 space-y-2 font-mono text-[11px]">
                <div className="text-[10px] uppercase text-text-muted font-bold tracking-wider">
                  Google SRE Multi-Window Alert Thresholds
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="rounded border border-rose-500/30 bg-rose-500/10 p-2">
                    <div className="font-bold text-rose-400 flex items-center gap-1">
                      <Flame className="h-3 w-3" /> 1-Hour Window
                    </div>
                    <div className="text-text-secondary mt-1">Burn Rate &gt; 14.4x</div>
                    <div className="text-[10px] text-rose-300/80">Page On-Call Engineer (Emergency)</div>
                  </div>
                  <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2">
                    <div className="font-bold text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> 6-Hour Window
                    </div>
                    <div className="text-text-secondary mt-1">Burn Rate &gt; 6.0x</div>
                    <div className="text-[10px] text-amber-300/80">High Priority Ticket (Consumes 5% in 6h)</div>
                  </div>
                  <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2">
                    <div className="font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> 3-Day Window
                    </div>
                    <div className="text-text-secondary mt-1">Burn Rate &gt; 1.0x</div>
                    <div className="text-[10px] text-emerald-300/80">Normal Weekly Sprint Review</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
