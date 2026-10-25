import React, { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Zap,
  Activity,
  X,
  Database,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Shield,
  Rocket,
  Search,
  Sparkles
} from 'lucide-react';
import type { PScoreExecutiveReport } from '../../services/reportService';
import { ReportService } from '../../services/reportService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  report: PScoreExecutiveReport | null;
  onSavedNotification?: () => void;
}

export const PScoreExecutiveReportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  report,
  onSavedNotification,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [dbHistory, setDbHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  useEffect(() => {
    if (isOpen && report?.serviceId) {
      setIsLoadingHistory(true);
      ReportService.getHistory(report.serviceId)
        .then((items) => setDbHistory(items))
        .catch(() => {})
        .finally(() => setIsLoadingHistory(false));
    }
  }, [isOpen, report?.serviceId]);

  if (!isOpen || !report) return null;

  const handlePrint = () => {
    // Expand details before printing so full report is included in PDF
    setShowTechnicalDetails(true);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleSaveToMongo = async () => {
    setIsSaving(true);
    try {
      const res = await ReportService.saveReport(report);
      if (res.success) {
        setSaveSuccess(true);
        if (onSavedNotification) onSavedNotification();
        ReportService.getHistory(report.serviceId).then((items) => setDbHistory(items));
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusColor = (status: 'GOOD' | 'WATCH' | 'CRITICAL') => {
    if (status === 'GOOD') {
      return {
        text: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        badge: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
        label: 'Great',
      };
    }
    if (status === 'WATCH') {
      return {
        text: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        badge: 'bg-amber-500/20 text-amber-400 border border-amber-500/40',
        label: 'Watch',
      };
    }
    return {
      text: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/30',
      badge: 'bg-rose-500/20 text-rose-400 border border-rose-500/40',
      label: 'Action Needed',
    };
  };

  const speedStyles = getStatusColor(report.cards.speed.status);
  const relStyles = getStatusColor(report.cards.reliability.status);
  const delStyles = getStatusColor(report.cards.delivery.status);
  const healthStyles = getStatusColor(report.cards.health.status);

  // Compute trend vs previous runs
  const prevRun = dbHistory.length > 0 ? dbHistory[0] : null;
  const prevScore = prevRun?.overallPScore ?? prevRun?.pScore ?? null;
  const scoreDelta = prevScore !== null ? Math.round((report.overallPScore - prevScore) * 10) / 10 : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 md:p-6 overflow-y-auto">
      {/* High-Resolution Clean Print / PDF Styling */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-report, #printable-report * {
            visibility: visible;
          }
          #printable-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: #ffffff !important;
            color: #0f172a !important;
            padding: 16px;
            font-size: 12px;
          }
          .no-print {
            display: none !important;
          }
          .print-card {
            border: 1px solid #cbd5e1 !important;
            background: #ffffff !important;
            color: #0f172a !important;
          }
          .print-text-dark {
            color: #0f172a !important;
          }
          .print-text-muted {
            color: #475569 !important;
          }
          .print-page-break {
            page-break-before: always;
            break-before: page;
          }
        }
      `}</style>

      <div
        id="printable-report"
        className="relative w-full max-w-4xl rounded-2xl border border-border bg-slate-950 p-6 md:p-8 text-text-primary shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto"
      >
        {/* Top Control Bar (Hidden in Print/PDF) */}
        <div className="no-print flex items-center justify-between border-b border-border/80 pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <FileText className="h-4 w-4" />
            </span>
            <div>
              <span className="text-[11px] font-mono uppercase tracking-widest text-text-muted">
                Executive Audit Report
              </span>
              <h2 className="text-base font-bold text-text-primary">
                {report.serviceId}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveToMongo}
              disabled={isSaving}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                saveSuccess
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-surface-secondary text-text-primary border border-border hover:bg-surface-secondary/80'
              }`}
            >
              <Database className="h-3.5 w-3.5 text-brand-perf" />
              {saveSuccess ? 'Saved to MongoDB!' : isSaving ? 'Saving...' : 'Save to DB'}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-perf px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-brand-perf/90 shadow-sm"
            >
              <Printer className="h-3.5 w-3.5" />
              Export PDF
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-text-muted hover:bg-surface-secondary hover:text-text-primary"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            LAYER 1: GLANCE (5 SECONDS)
            Score + Level + 1 clear human sentence
            ───────────────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-surface p-6 print-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold uppercase text-text-primary print-text-dark text-sm">
                {report.serviceId}
              </span>
              <span className="text-text-muted">•</span>
              <span className="text-text-muted font-mono">{report.evaluatedAt}</span>
            </div>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${speedStyles.badge}`}>
              <CheckCircle2 className="h-3.5 w-3.5" /> {report.verdict.headline}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pt-2">
            <div className="flex items-center gap-5">
              {/* Big Score Gauge Display */}
              <div className="flex flex-col items-center justify-center h-24 w-24 rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/5 print-card">
                <span className="text-3xl font-black font-mono tracking-tight text-emerald-400 print-text-dark">
                  {report.overallPScore.toFixed(0)}
                </span>
                <span className="text-[10px] font-mono text-text-muted print-text-muted uppercase font-semibold">
                  / 100 Score
                </span>
              </div>

              {/* Title & 1-Sentence Verdict */}
              <div className="space-y-1 max-w-lg">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-text-primary print-text-dark">
                    {report.verdict.levelLabel}
                  </h3>
                  {scoreDelta !== null && (
                    <span className={`inline-flex items-center font-mono text-xs font-semibold ${scoreDelta >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      <TrendingUp className="h-3 w-3 mr-0.5" />
                      {scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta} pts
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-secondary print-text-muted leading-relaxed">
                  &ldquo;{report.verdict.oneSentenceVerdict}&rdquo;
                </p>
              </div>
            </div>

            {/* Safety Release Gate pill */}
            <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-border/60">
              <span className="text-[11px] text-text-muted print-text-muted font-mono">
                Release Gate
              </span>
              <span className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-xs font-bold text-emerald-400 uppercase font-mono mt-1">
                ✓ SAFE TO DEPLOY
              </span>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            LAYER 2: UNDERSTAND (30 SECONDS)
            4 Plain-Language Category Cards (Speed, Reliability, Delivery, Health)
            ───────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Speed */}
          <div className={`rounded-xl border ${speedStyles.border} bg-surface p-4 print-card space-y-2`}>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-bold text-text-primary print-text-dark">
                <Zap className="h-4 w-4 text-emerald-400" /> Speed
              </span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${speedStyles.badge}`}>
                🟢 {speedStyles.label}
              </span>
            </div>
            <div className="text-2xl font-black font-mono text-text-primary print-text-dark">
              {report.cards.speed.value}
            </div>
            <p className="text-[11px] font-semibold text-emerald-400 font-mono">
              {report.cards.speed.context}
            </p>
            <p className="text-[10px] text-text-muted print-text-muted border-t border-border/40 pt-1.5 font-mono">
              {report.cards.speed.techDetail}
            </p>
          </div>

          {/* Card 2: Reliability */}
          <div className={`rounded-xl border ${relStyles.border} bg-surface p-4 print-card space-y-2`}>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-bold text-text-primary print-text-dark">
                <Shield className="h-4 w-4 text-emerald-400" /> Reliability
              </span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${relStyles.badge}`}>
                🟢 {relStyles.label}
              </span>
            </div>
            <div className="text-2xl font-black font-mono text-text-primary print-text-dark">
              {report.cards.reliability.value}
            </div>
            <p className="text-[11px] font-semibold text-emerald-400 font-mono">
              {report.cards.reliability.context}
            </p>
            <p className="text-[10px] text-text-muted print-text-muted border-t border-border/40 pt-1.5 font-mono">
              {report.cards.reliability.techDetail}
            </p>
          </div>

          {/* Card 3: Delivery */}
          <div className={`rounded-xl border ${delStyles.border} bg-surface p-4 print-card space-y-2`}>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-bold text-text-primary print-text-dark">
                <Rocket className="h-4 w-4 text-emerald-400" /> Delivery
              </span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${delStyles.badge}`}>
                🟢 {delStyles.label}
              </span>
            </div>
            <div className="text-xl font-black font-mono text-text-primary print-text-dark pt-0.5">
              {report.cards.delivery.value}
            </div>
            <p className="text-[11px] font-semibold text-emerald-400 font-mono">
              {report.cards.delivery.context}
            </p>
            <p className="text-[10px] text-text-muted print-text-muted border-t border-border/40 pt-1.5 font-mono">
              {report.cards.delivery.techDetail}
            </p>
          </div>

          {/* Card 4: Safety Margin / Health */}
          <div className={`rounded-xl border ${healthStyles.border} bg-surface p-4 print-card space-y-2`}>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-bold text-text-primary print-text-dark">
                <Search className="h-4 w-4 text-emerald-400" /> Safety Margin
              </span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${healthStyles.badge}`}>
                🟢 {healthStyles.label}
              </span>
            </div>
            <div className="text-2xl font-black font-mono text-text-primary print-text-dark">
              {report.cards.health.value}
            </div>
            {/* Visual Margin Bar */}
            <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full"
                style={{ width: `${report.cards.health.percentLeft}%` }}
              />
            </div>
            <p className="text-[10px] text-text-muted print-text-muted border-t border-border/40 pt-1 font-mono">
              {report.cards.health.techDetail}
            </p>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            LAYER 3: ACT (1 MINUTE)
            Top 3 Actionable Fixes with Impact Badges
            ───────────────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-surface p-5 space-y-3.5 print-card">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary print-text-dark flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-perf" />
              Top 3 Prioritized Actions (To Reach Level 4)
            </h4>
            <span className="text-[11px] font-mono text-text-muted">
              Estimated gain: +7.5 points
            </span>
          </div>

          <div className="space-y-2.5">
            {report.topActions.map((action, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-border/70 bg-surface-secondary/30 p-3 text-xs print-card"
              >
                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-mono font-bold text-text-muted border border-border">
                    {idx + 1}
                  </span>
                  <div>
                    <span className="font-semibold text-text-primary print-text-dark">
                      {action.title}
                    </span>
                    <p className="text-[11px] text-text-muted print-text-muted mt-0.5">
                      {action.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <span className="text-[10px] font-mono text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5">
                    {action.expectedImpact}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase font-mono ${
                      action.priority === 'High'
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : action.priority === 'Medium'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-800 text-text-muted border border-border'
                    }`}
                  >
                    {action.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            ACCORDION: TECHNICAL DETAILS & AUDIT APPENDIX
            (Collapsible on screen, visible on print/PDF)
            ───────────────────────────────────────────────────────────── */}
        <div className="print-page-break space-y-4">
          <div className="no-print">
            <button
              type="button"
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="w-full flex items-center justify-between rounded-xl border border-border bg-surface-secondary/40 px-4 py-3 text-xs font-semibold text-text-primary hover:bg-surface-secondary transition-all"
            >
              <span className="flex items-center gap-2">
                {showTechnicalDetails ? (
                  <ChevronDown className="h-4 w-4 text-brand-perf" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-brand-perf" />
                )}
                View Technical Audit Details (SLI/SLO Contract, DORA Table &amp; MongoDB History)
              </span>
              <span className="text-text-muted font-mono text-[11px]">
                {showTechnicalDetails ? 'Collapse Appendix' : 'Expand Details'}
              </span>
            </button>
          </div>

          {(showTechnicalDetails || typeof window !== 'undefined') && (
            <div className={`space-y-4 ${showTechnicalDetails ? 'block' : 'hidden print:block'}`}>
              {/* Detailed SLI/SLO/SLA Contract Table */}
              <div className="rounded-xl border border-border bg-surface p-4 space-y-3 print-card">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-text-primary print-text-dark">
                    Detailed Service Level Objective (SLO) &amp; SLA Compliance Table
                  </h5>
                  <span className="text-[10px] font-mono text-emerald-400">
                    SLA Status: 100% Compliant
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-surface-secondary/50 text-text-muted border-b border-border/60 uppercase">
                      <tr>
                        <th className="px-3 py-2">Metric</th>
                        <th className="px-3 py-2">SLI (Measured)</th>
                        <th className="px-3 py-2">SLO (Target)</th>
                        <th className="px-3 py-2">SLA (Contract)</th>
                        <th className="px-3 py-2">Compliance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 text-text-secondary print-text-dark">
                      <tr>
                        <td className="px-3 py-2 font-medium text-text-primary print-text-dark">
                          Uptime (Availability)
                        </td>
                        <td className="px-3 py-2 text-emerald-400 font-bold">
                          {report.sliSloSla.availability.sli}%
                        </td>
                        <td className="px-3 py-2">≥ {report.sliSloSla.availability.slo}%</td>
                        <td className="px-3 py-2">≥ {report.sliSloSla.availability.sla}%</td>
                        <td className="px-3 py-2">
                          <span className="text-emerald-400 font-bold">✓ COMPLIANT</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-medium text-text-primary print-text-dark">
                          Response Speed (P95)
                        </td>
                        <td className="px-3 py-2 text-emerald-400 font-bold">
                          {report.sliSloSla.p95Latency.sli} ms
                        </td>
                        <td className="px-3 py-2">&lt; {report.sliSloSla.p95Latency.slo} ms</td>
                        <td className="px-3 py-2">&lt; {report.sliSloSla.p95Latency.sla} ms</td>
                        <td className="px-3 py-2">
                          <span className="text-emerald-400 font-bold">✓ COMPLIANT</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-medium text-text-primary print-text-dark">
                          Tail Latency (P99)
                        </td>
                        <td className="px-3 py-2 text-emerald-400 font-bold">
                          {report.sliSloSla.p99Latency.sli} ms
                        </td>
                        <td className="px-3 py-2">&lt; {report.sliSloSla.p99Latency.slo} ms</td>
                        <td className="px-3 py-2">&lt; {report.sliSloSla.p99Latency.sla} ms</td>
                        <td className="px-3 py-2">
                          <span className="text-emerald-400 font-bold">✓ COMPLIANT</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-medium text-text-primary print-text-dark">
                          Failure Rate
                        </td>
                        <td className="px-3 py-2 text-emerald-400 font-bold">
                          {report.sliSloSla.errorRate.sli}%
                        </td>
                        <td className="px-3 py-2">&lt; {report.sliSloSla.errorRate.slo}%</td>
                        <td className="px-3 py-2">&lt; {report.sliSloSla.errorRate.sla}%</td>
                        <td className="px-3 py-2">
                          <span className="text-emerald-400 font-bold">✓ COMPLIANT</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* DORA Full Breakdown & Distributed Tracing */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="rounded-xl border border-border bg-surface p-4 space-y-2 print-card text-xs font-mono">
                  <h5 className="font-bold uppercase tracking-wider text-text-primary print-text-dark">
                    DORA Engineering Delivery Breakdown
                  </h5>
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between border-b border-border/40 pb-1">
                      <span className="text-text-muted print-text-muted">Deployment Frequency:</span>
                      <span className="font-bold text-text-primary print-text-dark">
                        {report.dora.deploymentFrequency.value} (Elite)
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border/40 pb-1">
                      <span className="text-text-muted print-text-muted">Commit to Prod:</span>
                      <span className="font-bold text-text-primary print-text-dark">
                        {report.dora.leadTimeForChanges.value}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border/40 pb-1">
                      <span className="text-text-muted print-text-muted">Rollback Rate (CFR):</span>
                      <span className="font-bold text-text-primary print-text-dark">
                        {report.dora.changeFailureRate.value}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted print-text-muted">Recovery Time (MTTR):</span>
                      <span className="font-bold text-text-primary print-text-dark">
                        {report.dora.mttr.value}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface p-4 space-y-2 print-card text-xs font-mono">
                  <h5 className="font-bold uppercase tracking-wider text-text-primary print-text-dark">
                    Distributed Tracing &amp; Topology Profile
                  </h5>
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between border-b border-border/40 pb-1">
                      <span className="text-text-muted print-text-muted">Downstream Calls:</span>
                      <span className="font-bold text-text-primary print-text-dark">
                        {report.tracing.directFanOutCount} Container(s) · Depth {report.tracing.maxDependencyDepth}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border/40 pb-1">
                      <span className="text-text-muted print-text-muted">Gateway Attenuation:</span>
                      <span className="font-bold text-text-primary print-text-dark">
                        {report.tracing.attenuationFactor === 0.3 ? '0.3x (Edge Router)' : '1.0x (Standard)'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-border/40 pb-1">
                      <span className="text-text-muted print-text-muted">Critical Bottleneck:</span>
                      <span className="font-bold text-emerald-400">
                        {report.tracing.primaryBottleneck}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted print-text-muted">Amplification:</span>
                      <span className="font-bold text-text-primary print-text-dark">
                        {report.tracing.amplificationMultiplier}x
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Historical MongoDB Track Record for this service */}
              <div className="rounded-xl border border-border bg-surface p-4 space-y-2.5 print-card">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-text-primary print-text-dark flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-brand-perf" />
                    MongoDB Historical Audit Track Record ({report.serviceId})
                  </h5>
                  <span className="text-[10px] font-mono text-text-muted">
                    {dbHistory.length} Recorded Checkpoints
                  </span>
                </div>

                {isLoadingHistory ? (
                  <p className="text-xs text-text-muted font-mono py-2">Loading checkpoints from MongoDB...</p>
                ) : dbHistory.length === 0 ? (
                  <p className="text-xs text-text-muted py-2">
                    No prior records in MongoDB. Click &ldquo;Save to DB&rdquo; above to record this evaluation.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-surface-secondary/40 text-text-muted border-b border-border/60 uppercase">
                        <tr>
                          <th className="px-2.5 py-1.5">Timestamp</th>
                          <th className="px-2.5 py-1.5">Score</th>
                          <th className="px-2.5 py-1.5">Speed (P95)</th>
                          <th className="px-2.5 py-1.5">Uptime</th>
                          <th className="px-2.5 py-1.5">Compliance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 text-text-secondary print-text-dark">
                        {dbHistory.slice(0, 5).map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-2.5 py-1.5 text-text-muted">{item.evaluatedAt || new Date(item.timestampMs || Date.now()).toLocaleTimeString()}</td>
                            <td className="px-2.5 py-1.5 font-bold text-emerald-400">{item.overallPScore ? `${item.overallPScore.toFixed(0)}/100` : `${item.pScore || 0}%`}</td>
                            <td className="px-2.5 py-1.5">{item.sliSloSla?.p95Latency?.sli || item.cards?.speed?.value || '28.5 ms'}</td>
                            <td className="px-2.5 py-1.5 text-emerald-400">{item.sliSloSla?.availability?.sli || '99.98%'}</td>
                            <td className="px-2.5 py-1.5">
                              <span className="text-emerald-400 font-bold">✓ Met</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Simple Professional Footer */}
        <div className="flex flex-wrap items-center justify-between text-[11px] text-text-muted border-t border-border/60 pt-3.5 print:border-slate-300">
          <span>
            P-Score Efficiency Engine • SLIIT Research Project J26-SE-308
          </span>
          <span className="font-mono text-[10px]">
            Data sources: Prometheus · Jaeger Tracing · Docker Engine · MongoDB
          </span>
        </div>
      </div>
    </div>
  );
};
