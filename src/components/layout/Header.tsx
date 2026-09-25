import React, { useState, useCallback } from 'react';
import { RefreshCcw, Download, CheckCircle2, Loader2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { mockAssessmentData } from '../../data/mockData';
import * as XLSX from 'xlsx';

const getPageTitle = (pathname: string): string => {
  if (pathname === '/') return 'Overview Dashboard';
  if (pathname === '/assessment') return 'Architecture Assessment';
  if (pathname.includes('/dimensions/cicd')) return 'CI/CD Maturity';
  if (pathname.includes('/dimensions/performance')) return 'Performance Maturity';
  if (pathname === '/dimensions/observability/history') return 'Observability — O-Score History';
  if (pathname.includes('/dimensions/observability')) return 'Observability Maturity';
  if (pathname.includes('/dimensions/fault-tolerance')) return 'Fault Tolerance Maturity';
  if (pathname === '/architecture') return 'Architecture Graph';
  if (pathname === '/evidence') return 'Evidence Review';
  if (pathname === '/reports') return 'Assessment Reports';
  if (pathname === '/settings') return 'Settings';
  return 'Dashboard';
};

export const Header: React.FC = () => {
  const location = useLocation();
  const title = getPageTitle(location.pathname);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastEvaluated, setLastEvaluated] = useState('2m ago');
  const [evalStatus, setEvalStatus] = useState<'complete' | 'evaluating'>('complete');

  const handleRefresh = useCallback(() => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setEvalStatus('evaluating');
    setLastEvaluated('evaluating...');

    // Simulate evaluation running for 2.5s
    setTimeout(() => {
      setIsRefreshing(false);
      setEvalStatus('complete');
      setLastEvaluated('Just now');
    }, 2500);
  }, [isRefreshing]);

  const handleExport = useCallback(() => {
    const data = mockAssessmentData;
    const wb = XLSX.utils.book_new();

    // --- Sheet 1: Summary ---
    const summaryRows = [
      ['Architecture Maturity Assessment Report'],
      [''],
      ['Assessment ID',       data.id],
      ['Project Name',        data.projectName],
      ['Architecture Type',   data.architectureType],
      ['Generated At',        new Date().toLocaleString()],
      [''],
      ['OVERALL RESULTS', ''],
      ['Overall Score',       `${data.overallScore} / 100`],
      ['Maturity Level',      data.overallLevel],
      ['Confidence',          `${data.confidence}%`],
      ['Evaluation Duration', data.evaluationDuration],
      ['Baseline Improvement',`+${data.baselineComparison} pts vs previous`],
      [''],
      ['DIMENSION SCORES', ''],
      ['Dimension',           'Score', 'Level'],
      ['CI/CD',               data.dimensions.cicd.score,           data.dimensions.cicd.level],
      ['Performance',         data.dimensions.performance.score,    data.dimensions.performance.level],
      ['Observability',       data.dimensions.observability.score,  data.dimensions.observability.level],
      ['Fault Tolerance',     data.dimensions.faultTolerance.score, data.dimensions.faultTolerance.level],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // --- Sheet 2: Dimension Metrics ---
    const metricsHeader = ['Dimension', 'Metric', 'Score', 'Weight', 'Weighted Score'];
    const metricsRows: (string | number)[][] = [metricsHeader];
    const dims = [
      { name: 'CI/CD',           d: data.dimensions.cicd },
      { name: 'Performance',     d: data.dimensions.performance },
      { name: 'Observability',   d: data.dimensions.observability },
      { name: 'Fault Tolerance', d: data.dimensions.faultTolerance },
    ];
    dims.forEach(({ name, d }) => {
      d.metrics.forEach(m => {
        metricsRows.push([name, m.name, m.score, m.weight, parseFloat((m.score * m.weight).toFixed(2))]);
      });
      metricsRows.push(['', '', '', '', '']); // blank row between dimensions
    });
    const wsMetrics = XLSX.utils.aoa_to_sheet(metricsRows);
    wsMetrics['!cols'] = [{ wch: 18 }, { wch: 28 }, { wch: 10 }, { wch: 10 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsMetrics, 'Dimension Metrics');

    // --- Sheet 3: Recommendations ---
    const recHeader = ['ID', 'Title', 'Impact', 'Effort', 'Description', 'Expected Improvement'];
    const recRows: (string | number)[][] = [recHeader];
    data.recommendations.forEach(r => {
      recRows.push([r.id, r.title, r.impact, r.effort, r.description, r.expectedImprovement]);
    });
    const wsRec = XLSX.utils.aoa_to_sheet(recRows);
    wsRec['!cols'] = [{ wch: 10 }, { wch: 38 }, { wch: 10 }, { wch: 10 }, { wch: 60 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsRec, 'Recommendations');

    // --- Sheet 4: Assessment History ---
    const histHeader = ['Assessment ID', 'Date', 'Overall', 'CI/CD', 'Performance', 'Observability', 'Fault Tolerance'];
    const histRows: (string | number)[][] = [histHeader];
    data.history.forEach(h => {
      histRows.push([h.assessmentId, h.date, h.overall, h.cicd, h.performance, h.observability, h.faultTolerance]);
    });
    const wsHist = XLSX.utils.aoa_to_sheet(histRows);
    wsHist['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsHist, 'History');

    // Download
    XLSX.writeFile(wb, `ArchMaturity-Report-${data.id}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, []);

  return (
    <header className="h-14 border-b border-border bg-background/95 backdrop-blur flex items-center justify-between px-6 sticky top-0 z-10">
      <div>
        <h1 className="text-sm font-semibold tracking-tight text-text-primary">{title}</h1>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-3 text-xs border-r border-border/50 pr-4">
          <span className="text-text-secondary font-mono">#ARCH-042</span>
          <span className="text-text-muted">Last evaluated: {lastEvaluated}</span>
          <div className={`flex items-center gap-1 transition-colors ${evalStatus === 'complete' ? 'text-brand-obs' : 'text-amber-400'}`}>
            {evalStatus === 'complete' ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Evaluation Complete</span>
              </>
            ) : (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Re-evaluating...</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-text-secondary">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1.5 hover:bg-surface-secondary rounded-md transition-colors border border-transparent hover:border-border/50 disabled:opacity-50"
            title="Refresh Evaluation"
          >
            <RefreshCcw className={`w-4 h-4 transition-transform ${isRefreshing ? 'animate-spin' : 'hover:rotate-180 duration-500'}`} />
          </button>
          <button
            onClick={handleExport}
            className="p-1.5 hover:bg-surface-secondary rounded-md transition-colors border border-transparent hover:border-border/50 flex items-center gap-1.5 px-2 active:scale-95"
            title="Export Report as JSON"
          >
            <Download className="w-4 h-4" />
            <span className="text-xs font-medium hidden lg:inline">Export</span>
          </button>
        </div>
      </div>
    </header>
  );
};
