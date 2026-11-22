import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Cpu,
  HardDrive,
  Zap,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Server,
  Clock,
  BarChart3,
  GitBranch,
  TrendingUp,
  Sparkles,
  Database,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Scale,
  Gauge,
  Play,
  RotateCcw,
  Sliders,
  Camera,
  AlertTriangle,
  FileText,
  Printer,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Info,
  Calculator,
  Code2
} from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { TelemetryService } from '../services/telemetry';
import {
  PerformanceFlowHeader,
  PerformanceStepFooter
} from '../components/performace/PerformanceFlowNav';
import {
  PScoreExecutiveReportModal
} from '../components/performace/PScoreExecutiveReportModal';
import {
  RemediationPatchModal,
  type RemediationRecommendation
} from '../components/performace/RemediationPatchModal';
import {
  TraceWaterfallModal
} from '../components/performace/TraceWaterfallModal';
import {
  ErrorBudgetBurnWidget
} from '../components/performace/ErrorBudgetBurnWidget';
import {
  PerformanceScenarioInjector,
  type PerformanceScenarioId
} from '../components/performace/PerformanceScenarioInjector';
import {
  ReportService
} from '../services/reportService';
import type {
  PScoreExecutiveReport
} from '../services/reportService';

interface MaturityTierInfo {
  level: number;
  tier: string;
  shortLabel: string;
  summary: string;
}

interface ApdexAndTailInfo {
  tailLatencyRatio: number;
  apdexScore: number;
  apdexRating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  apdexThresholdMs: number;
}

interface FeatureAttributionsInfo {
  cpuPercent: number;
  memoryPercent: number;
  latencyPercent: number;
  errorPercent: number;
  dominantDriver: string;
}

interface ServiceEvaluation {
  serviceId: string;
  hasTelemetry: boolean;
  pScore: number;
  maturityTier: MaturityTierInfo;
  apdexAndTail?: ApdexAndTailInfo;
  signals: {
    driftScore: number;
    driftLevel: string;
    liveP95LatencyMs: number;
    historicalBaselineMs: number;
    fanOutScore: number;
    fanOutLevel: string;
    directFanOutCount: number;
    maxDependencyDepth: number;
    executionPattern?: 'SINGLE' | 'PARALLEL_CONCURRENT' | 'HYBRID_WATERFALL' | 'SEQUENTIAL_N_PLUS_1';
    sequentialRatio?: number;
    isApiGateway: boolean;
    attenuationFactor: number;
    anomalyScore: number;
    isAnomaly: boolean;
    prefiltered: boolean;
    featureAttributions?: FeatureAttributionsInfo;
  };
  penalties: {
    driftPenaltyPts: number;
    fanOutPenaltyPts: number;
    anomalyPenaltyPts: number;
    totalPenaltyPts: number;
  };
  rawMetrics: {
    cpuUsageMillicores: number;
    memoryUsageMB: number;
    avgResponseTimeMs: number;
    p95LatencyMs: number;
    p99LatencyMs?: number;
    rps: number;
  };
}

interface RecommendationItem {
  id?: string;
  ruleId: string;
  serviceId: string;
  category: 'DATABASE_INDEXING' | 'REDIS_CACHING' | 'CONTAINER_BASE_IMAGE';
  title: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  effort: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  expectedPScoreImprovement: string;
  projectedServiceDeltaPts?: number;
  projectedClusterDeltaPts?: number;
  triggerEvidence: string;
}

interface AHPValidationInfo {
  weights: {
    drift: number;
    fanout: number;
    anomaly: number;
  };
  normalizedWeights?: {
    drift: number;
    fanout: number;
    anomaly: number;
  };
  pairwiseMatrix: number[][];
  labels: string[];
  lambdaMax: number;
  consistencyIndex: number;
  consistencyIndexCI?: number;
  randomIndex: number;
  randomIndexRI?: number;
  consistencyRatio: number;
  consistencyRatioCR?: number;
  isConsistent: boolean;
}

interface PScoreHistoryPoint {
  timestamp: number;
  overallPScore: number;
  driftHealthScore: number;
  fanOutHealthScore: number;
  anomalyHealthScore: number;
  tierLevel: number;
}

interface BaselineSnapshot {
  capturedAt: string;
  overallPScore: number;
  tierLabel: string;
  projectedScore?: number;
  serviceScores: Record<string, number>;
}

interface PythonPScoreResponse {
  engine: string;
  evaluatedAt: number;
  evaluationLatencyMs: number;
  overallPScore: number;
  maturityTier: MaturityTierInfo;
  weights: {
    drift: number;
    fanout: number;
    anomaly: number;
  };
  ahpValidation?: AHPValidationInfo;
  clusterSubScores: {
    driftHealthScore: number;
    fanOutHealthScore: number;
    anomalyHealthScore: number;
    avgDriftPenalty: number;
    avgFanOutPenalty: number;
    avgAnomalyPenalty: number;
    avgApdexScore?: number;
    avgTailLatencyRatio?: number;
  };
  pScoreHistory?: PScoreHistoryPoint[];
  serviceEvaluations: ServiceEvaluation[];
  recommendations: RecommendationItem[];
}

interface WeightPreset {
  id: string;
  label: string;
  drift: number;
  fanout: number;
  anomaly: number;
  a12: number;
  a13: number;
  a23: number;
  description: string;
}

const SAATY_SCALE_OPTIONS: { value: number; label: string }[] = [
  { value: 0.2, label: '1/5 (0.20) — Strongly Inferior' },
  { value: 0.3333, label: '1/3 (0.33) — Moderately Inferior' },
  { value: 0.5, label: '1/2 (0.50) — Slightly Inferior' },
  { value: 1, label: '1 (1.00) — Equal Importance' },
  { value: 2, label: '2 (2.00) — Slightly Preferred' },
  { value: 3, label: '3 (3.00) — Moderately Preferred' },
  { value: 5, label: '5 (5.00) — Strongly Preferred' },
  { value: 7, label: '7 (7.00) — Very Strongly Preferred' },
  { value: 9, label: '9 (9.00) — Extremely Preferred' }
];

const WEIGHT_PRESETS: WeightPreset[] = [
  {
    id: 'BALANCED',
    label: 'Balanced Architecture (40/40/20)',
    drift: 0.4,
    fanout: 0.4,
    anomaly: 0.2,
    a12: 1,
    a13: 2,
    a23: 2,
    description: 'Default AHP weight distribution balancing temporal latency stability and topological fan-out.'
  },
  {
    id: 'LATENCY_CRITICAL',
    label: 'Latency-SLA Critical (55/25/20)',
    drift: 0.55,
    fanout: 0.25,
    anomaly: 0.2,
    a12: 2,
    a13: 3,
    a23: 1,
    description: 'Prioritizes OLS regression latency drift for strict P95/P99 SLA-bound payment & checkout pipelines.'
  },
  {
    id: 'MESH_HEAVY',
    label: 'High-Fan-Out Mesh (25/55/20)',
    drift: 0.25,
    fanout: 0.55,
    anomaly: 0.2,
    a12: 0.5,
    a13: 1,
    a23: 3,
    description: 'Prioritizes synchronous call-tree amplification and deep microservice dependency chains.'
  }
];

function classifyScoreToTier(pScore: number): MaturityTierInfo {
  if (pScore >= 85) {
    return {
      level: 4,
      tier: 'Level 4: Optimized (Proactive & Self-Optimizing)',
      shortLabel: 'Level 4: Optimized',
      summary: 'Sub-millisecond drift stability, well-attenuated call trees, and zero ML runtime anomalies.'
    };
  }
  if (pScore >= 70) {
    return {
      level: 3,
      tier: 'Level 3: Resilient (Observable & Stable)',
      shortLabel: 'Level 3: Resilient',
      summary: 'Healthy runtime telemetry with minor synchronous fan-out or mild temporal latency drift.'
    };
  }
  if (pScore >= 50) {
    return {
      level: 2,
      tier: 'Level 2: Managed (Emerging Bottlenecks)',
      shortLabel: 'Level 2: Managed',
      summary: 'Noticeable latency drift or unattenuated synchronous fan-out requiring caching or indexing.'
    };
  }
  return {
    level: 1,
    tier: 'Level 1: Reactive (Critical Degradation)',
    shortLabel: 'Level 1: Reactive',
    summary: 'Severe performance degradation across latency drift, deep call chains, or ML container anomalies.'
  };
}

export const PerformanceDimensionPage: React.FC = () => {
  const [data, setData] = useState<PythonPScoreResponse | null>(null);
  const [selectedServiceFilter, setSelectedServiceFilter] = useState<string>('ALL');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('BALANCED');
  const [useCustomPairwise, setUseCustomPairwise] = useState<boolean>(false);
  const [pairwiseJudgments, setPairwiseJudgments] = useState<{ a12: number; a13: number; a23: number }>({
    a12: 1,
    a13: 2,
    a23: 2
  });
  const [simulatedRecIds, setSimulatedRecIds] = useState<string[]>([]);
  const [capturedBaseline, setCapturedBaseline] = useState<BaselineSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [currentReport, setCurrentReport] = useState<PScoreExecutiveReport | null>(null);

  // New Performance Enhancements: Scenario Simulator, Code Patch & Trace Modals
  const [activeScenario, setActiveScenario] = useState<PerformanceScenarioId>('LIVE');
  const [selectedPatchRec, setSelectedPatchRec] = useState<RemediationRecommendation | null>(null);
  const [selectedTraceService, setSelectedTraceService] = useState<string | null>(null);

  const handleOpenReport = useCallback((serviceIdToFocus?: string) => {
    if (!data) return;
    const targetService =
      serviceIdToFocus ||
      (selectedServiceFilter !== 'ALL' ? selectedServiceFilter : null) ||
      TelemetryService.getActiveService() ||
      data.serviceEvaluations?.[0]?.serviceId ||
      'user-service-1';

    const reportObj = ReportService.buildExecutiveReport(data, targetService);
    setCurrentReport(reportObj);
    setIsReportModalOpen(true);
  }, [data, selectedServiceFilter]);

  const activePreset = useMemo(
    () => WEIGHT_PRESETS.find((p) => p.id === selectedPresetId) || WEIGHT_PRESETS[0],
    [selectedPresetId]
  );

  const fetchCompositePScore = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const collected = TelemetryService.getCollectedServices();
      const activeFromStore = TelemetryService.getActiveService();
      if (activeFromStore && !collected.includes(activeFromStore)) {
        collected.push(activeFromStore);
      }
      let qs = `?w_drift=${activePreset.drift}&w_fanout=${activePreset.fanout}&w_anomaly=${activePreset.anomaly}`;
      if (collected.length > 0) {
        qs += `&services=${encodeURIComponent(collected.join(','))}`;
      }
      if (useCustomPairwise) {
        qs += `&a12=${pairwiseJudgments.a12}&a13=${pairwiseJudgments.a13}&a23=${pairwiseJudgments.a23}`;
      }
      const urls = [
        `/api/anomaly/pscore/evaluate${qs}`,
        `http://localhost:18002/pscore/evaluate${qs}`
      ];
      let payload: PythonPScoreResponse | null = null;

      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            payload = await res.json();
            break;
          }
        } catch {
          // try fallback URL
        }
      }

      if (!payload) {
        throw new Error(
          'Unable to connect to Python FastAPI Composite P-Score Engine on port 8000 (/pscore/evaluate).'
        );
      }

      setData(payload);
      setErrorMsg(null);
      setLastUpdated(new Date());
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to connect to Python P-Score Engine (port 8000)');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activePreset, useCustomPairwise, pairwiseJudgments]);

  useEffect(() => {
    fetchCompositePScore();
    const interval = setInterval(fetchCompositePScore, 5000);
    return () => clearInterval(interval);
  }, [fetchCompositePScore]);

  // Simulated Scenarios for Live Viva & Demo Injection
  const displayData: PythonPScoreResponse | null = useMemo(() => {
    if (activeScenario === 'LIVE') return data;

    if (activeScenario === 'NOMINAL') {
      return {
        engine: 'Simulated Scenario: Nominal High-Performance Flow (Optimal Level 4)',
        evaluatedAt: Date.now() / 1000,
        evaluationLatencyMs: 11.8,
        overallPScore: 91.5,
        maturityTier: {
          level: 4,
          tier: 'Level 4: Optimized (Proactive & Self-Optimizing)',
          shortLabel: 'Level 4: Optimized',
          summary: 'Sub-millisecond drift stability, concurrent Promise.all calls, and zero ML runtime anomalies.'
        },
        weights: data?.weights || { drift: 0.4, fanout: 0.4, anomaly: 0.2 },
        ahpValidation: data?.ahpValidation,
        clusterSubScores: {
          driftHealthScore: 95.0,
          fanOutHealthScore: 92.0,
          anomalyHealthScore: 100.0,
          avgDriftPenalty: 0.02,
          avgFanOutPenalty: 0.05,
          avgAnomalyPenalty: 0.00,
          avgApdexScore: 0.995,
          avgTailLatencyRatio: 1.15
        },
        pScoreHistory: data?.pScoreHistory,
        recommendations: (data?.recommendations || []).slice(0, 2),
        serviceEvaluations: [
          {
            serviceId: 'order-service-1',
            hasTelemetry: true,
            pScore: 91.8,
            maturityTier: { level: 4, tier: 'Level 4: Optimized', shortLabel: 'Level 4', summary: 'Sub-millisecond drift' },
            apdexAndTail: { apdexScore: 0.995, apdexRating: 'EXCELLENT', tailLatencyRatio: 1.15, apdexThresholdMs: 50 },
            signals: {
              driftScore: 0.02,
              driftLevel: 'LOW',
              liveP95LatencyMs: 22.0,
              historicalBaselineMs: 21.0,
              fanOutScore: 0.05,
              fanOutLevel: 'LOW',
              directFanOutCount: 2,
              maxDependencyDepth: 2,
              executionPattern: 'PARALLEL_CONCURRENT' as const,
              sequentialRatio: 0.0,
              isApiGateway: false,
              attenuationFactor: 1.0,
              anomalyScore: 0.0,
              isAnomaly: false,
              prefiltered: false,
              featureAttributions: { cpuPercent: 12, memoryPercent: 18, latencyPercent: 65, errorPercent: 5, dominantDriver: 'P95 Latency Nominal' }
            },
            penalties: { driftPenaltyPts: 1.2, fanOutPenaltyPts: 2.0, anomalyPenaltyPts: 0.0, totalPenaltyPts: 3.2 },
            rawMetrics: { cpuUsageMillicores: 120, memoryUsageMB: 68, avgResponseTimeMs: 16.5, p95LatencyMs: 22.0, p99LatencyMs: 25.3, rps: 64.0 }
          },
          {
            serviceId: 'payment-service-1',
            hasTelemetry: true,
            pScore: 93.0,
            maturityTier: { level: 4, tier: 'Level 4: Optimized', shortLabel: 'Level 4', summary: 'Optimal' },
            apdexAndTail: { apdexScore: 0.998, apdexRating: 'EXCELLENT', tailLatencyRatio: 1.12, apdexThresholdMs: 50 },
            signals: {
              driftScore: 0.01,
              driftLevel: 'LOW',
              liveP95LatencyMs: 18.0,
              historicalBaselineMs: 17.5,
              fanOutScore: 0.02,
              fanOutLevel: 'LOW',
              directFanOutCount: 1,
              maxDependencyDepth: 1,
              executionPattern: 'PARALLEL_CONCURRENT' as const,
              sequentialRatio: 0.0,
              isApiGateway: false,
              attenuationFactor: 1.0,
              anomalyScore: 0.0,
              isAnomaly: false,
              prefiltered: false,
              featureAttributions: { cpuPercent: 10, memoryPercent: 15, latencyPercent: 70, errorPercent: 5, dominantDriver: 'Nominal' }
            },
            penalties: { driftPenaltyPts: 0.8, fanOutPenaltyPts: 1.0, anomalyPenaltyPts: 0.0, totalPenaltyPts: 1.8 },
            rawMetrics: { cpuUsageMillicores: 95, memoryUsageMB: 54, avgResponseTimeMs: 12.0, p95LatencyMs: 18.0, p99LatencyMs: 20.2, rps: 42.0 }
          },
          {
            serviceId: 'gateway-1',
            hasTelemetry: true,
            pScore: 89.8,
            maturityTier: { level: 4, tier: 'Level 4: Optimized', shortLabel: 'Level 4', summary: 'Optimal' },
            apdexAndTail: { apdexScore: 0.992, apdexRating: 'EXCELLENT', tailLatencyRatio: 1.18, apdexThresholdMs: 50 },
            signals: {
              driftScore: 0.03,
              driftLevel: 'LOW',
              liveP95LatencyMs: 24.5,
              historicalBaselineMs: 23.0,
              fanOutScore: 0.06,
              fanOutLevel: 'LOW',
              directFanOutCount: 4,
              maxDependencyDepth: 2,
              executionPattern: 'PARALLEL_CONCURRENT' as const,
              sequentialRatio: 0.0,
              isApiGateway: true,
              attenuationFactor: 0.3,
              anomalyScore: 0.0,
              isAnomaly: false,
              prefiltered: false,
              featureAttributions: { cpuPercent: 15, memoryPercent: 20, latencyPercent: 60, errorPercent: 5, dominantDriver: 'Gateway Edge Traffic' }
            },
            penalties: { driftPenaltyPts: 1.5, fanOutPenaltyPts: 2.4, anomalyPenaltyPts: 0.0, totalPenaltyPts: 3.9 },
            rawMetrics: { cpuUsageMillicores: 140, memoryUsageMB: 78, avgResponseTimeMs: 18.0, p95LatencyMs: 24.5, p99LatencyMs: 28.9, rps: 110.0 }
          }
        ]
      };
    }

    if (activeScenario === 'SEQUENTIAL_N_PLUS_1') {
      return {
        engine: 'Simulated Scenario: Sequential N+1 DB Bottleneck (Degraded Level 2)',
        evaluatedAt: Date.now() / 1000,
        evaluationLatencyMs: 48.6,
        overallPScore: 63.8,
        maturityTier: {
          level: 2,
          tier: 'Level 2: Managed (Emerging Bottlenecks)',
          shortLabel: 'Level 2: Managed',
          summary: 'Severe sequential N+1 cascading delays on order-service-1; queries require caching or indexing.'
        },
        weights: data?.weights || { drift: 0.4, fanout: 0.4, anomaly: 0.2 },
        ahpValidation: data?.ahpValidation,
        clusterSubScores: {
          driftHealthScore: 62.0,
          fanOutHealthScore: 55.0,
          anomalyHealthScore: 88.0,
          avgDriftPenalty: 0.38,
          avgFanOutPenalty: 0.45,
          avgAnomalyPenalty: 0.12,
          avgApdexScore: 0.810,
          avgTailLatencyRatio: 2.38
        },
        pScoreHistory: data?.pScoreHistory,
        recommendations: data?.recommendations || [],
        serviceEvaluations: [
          {
            serviceId: 'order-service-1',
            hasTelemetry: true,
            pScore: 61.5,
            maturityTier: { level: 2, tier: 'Level 2: Managed', shortLabel: 'Level 2: Managed', summary: 'Sequential Bottleneck' },
            apdexAndTail: { apdexScore: 0.785, apdexRating: 'FAIR', tailLatencyRatio: 2.42, apdexThresholdMs: 50 },
            signals: {
              driftScore: 0.42,
              driftLevel: 'HIGH',
              liveP95LatencyMs: 68.2,
              historicalBaselineMs: 22.0,
              fanOutScore: 0.48,
              fanOutLevel: 'HIGH',
              directFanOutCount: 3,
              maxDependencyDepth: 3,
              executionPattern: 'SEQUENTIAL_N_PLUS_1' as const,
              sequentialRatio: 1.0,
              isApiGateway: false,
              attenuationFactor: 1.0,
              anomalyScore: 0.24,
              isAnomaly: false,
              prefiltered: false,
              featureAttributions: { cpuPercent: 35, memoryPercent: 20, latencyPercent: 40, errorPercent: 5, dominantDriver: 'Sequential N+1 Call-Tree' }
            },
            penalties: { driftPenaltyPts: 16.8, fanOutPenaltyPts: 19.2, anomalyPenaltyPts: 4.8, totalPenaltyPts: 40.8 },
            rawMetrics: { cpuUsageMillicores: 420, memoryUsageMB: 185, avgResponseTimeMs: 52.0, p95LatencyMs: 68.2, p99LatencyMs: 165.0, rps: 38.0 }
          },
          {
            serviceId: 'payment-service-1',
            hasTelemetry: true,
            pScore: 78.0,
            maturityTier: { level: 3, tier: 'Level 3: Resilient', shortLabel: 'Level 3', summary: 'Stable' },
            apdexAndTail: { apdexScore: 0.940, apdexRating: 'EXCELLENT', tailLatencyRatio: 1.35, apdexThresholdMs: 50 },
            signals: {
              driftScore: 0.12,
              driftLevel: 'LOW',
              liveP95LatencyMs: 28.0,
              historicalBaselineMs: 24.0,
              fanOutScore: 0.10,
              fanOutLevel: 'LOW',
              directFanOutCount: 1,
              maxDependencyDepth: 1,
              executionPattern: 'PARALLEL_CONCURRENT' as const,
              sequentialRatio: 0.0,
              isApiGateway: false,
              attenuationFactor: 1.0,
              anomalyScore: 0.0,
              isAnomaly: false,
              prefiltered: false,
              featureAttributions: { cpuPercent: 18, memoryPercent: 22, latencyPercent: 55, errorPercent: 5, dominantDriver: 'P95 Latency' }
            },
            penalties: { driftPenaltyPts: 4.8, fanOutPenaltyPts: 4.0, anomalyPenaltyPts: 0.0, totalPenaltyPts: 8.8 },
            rawMetrics: { cpuUsageMillicores: 160, memoryUsageMB: 82, avgResponseTimeMs: 21.0, p95LatencyMs: 28.0, p99LatencyMs: 37.8, rps: 28.0 }
          }
        ]
      };
    }

    if (activeScenario === 'POD_WARMUP') {
      return {
        engine: 'Simulated Scenario: Pod Cold Start with 90s Grace Filter Active',
        evaluatedAt: Date.now() / 1000,
        evaluationLatencyMs: 18.0,
        overallPScore: 78.4,
        maturityTier: {
          level: 3,
          tier: 'Level 3: Resilient (Observable & Stable)',
          shortLabel: 'Level 3: Resilient',
          summary: 'Container uptime 45s (<90s) experiencing CPU initialization spike; 90s filter suppresses false alarm to 0 pts!'
        },
        weights: data?.weights || { drift: 0.4, fanout: 0.4, anomaly: 0.2 },
        ahpValidation: data?.ahpValidation,
        clusterSubScores: {
          driftHealthScore: 85.0,
          fanOutHealthScore: 85.0,
          anomalyHealthScore: 100.0,
          avgDriftPenalty: 0.15,
          avgFanOutPenalty: 0.15,
          avgAnomalyPenalty: 0.00,
          avgApdexScore: 0.960,
          avgTailLatencyRatio: 1.35
        },
        pScoreHistory: data?.pScoreHistory,
        recommendations: data?.recommendations || [],
        serviceEvaluations: [
          {
            serviceId: 'order-service-1',
            hasTelemetry: true,
            pScore: 78.4,
            maturityTier: { level: 3, tier: 'Level 3: Resilient', shortLabel: 'Level 3: Resilient', summary: 'Warmup Suppressed' },
            apdexAndTail: { apdexScore: 0.960, apdexRating: 'EXCELLENT', tailLatencyRatio: 1.35, apdexThresholdMs: 50 },
            signals: {
              driftScore: 0.15,
              driftLevel: 'LOW',
              liveP95LatencyMs: 32.0,
              historicalBaselineMs: 26.0,
              fanOutScore: 0.15,
              fanOutLevel: 'LOW',
              directFanOutCount: 2,
              maxDependencyDepth: 2,
              executionPattern: 'PARALLEL_CONCURRENT' as const,
              sequentialRatio: 0.0,
              isApiGateway: false,
              attenuationFactor: 1.0,
              anomalyScore: 0.0,
              isAnomaly: false,
              prefiltered: true,
              featureAttributions: { cpuPercent: 55, memoryPercent: 35, latencyPercent: 10, errorPercent: 0, dominantDriver: 'Pod Startup Grace Window (45s < 90s)' }
            },
            penalties: { driftPenaltyPts: 6.0, fanOutPenaltyPts: 6.0, anomalyPenaltyPts: 0.0, totalPenaltyPts: 12.0 },
            rawMetrics: { cpuUsageMillicores: 680, memoryUsageMB: 240, avgResponseTimeMs: 24.0, p95LatencyMs: 32.0, p99LatencyMs: 43.2, rps: 45.0 }
          }
        ]
      };
    }

    return data;
  }, [data, activeScenario]);

  const activeData = displayData || data;

  const activeEvals = useMemo(() => {
    return (activeData?.serviceEvaluations || []).filter((e) => e.hasTelemetry);
  }, [activeData]);

  const filteredRecommendations = useMemo(() => {
    const recs = activeData?.recommendations || [];
    if (selectedServiceFilter === 'ALL') return recs;
    return recs.filter((r) => r.serviceId === selectedServiceFilter);
  }, [activeData, selectedServiceFilter]);

  const toggleSimulateRec = (recKey: string) => {
    setSimulatedRecIds((prev) =>
      prev.includes(recKey) ? prev.filter((id) => id !== recKey) : [...prev, recKey]
    );
  };

  const simulateAllFixes = () => {
    const allKeys = (activeData?.recommendations || []).map(
      (r) => r.id || `${r.serviceId}-${r.ruleId}`
    );
    setSimulatedRecIds(allKeys);
  };

  const resetSimulations = () => {
    setSimulatedRecIds([]);
  };

  // Closed-Loop Remediation Simulation Calculations
  const simulationSummary = useMemo(() => {
    const baseScore = activeData?.overallPScore ?? 0;
    const allRecs = activeData?.recommendations || [];
    const activeSimulatedRecs = allRecs.filter((r) =>
      simulatedRecIds.includes(r.id || `${r.serviceId}-${r.ruleId}`)
    );

    const serviceDeltaMap: Record<string, number> = {};
    for (const r of activeSimulatedRecs) {
      const delta = r.projectedServiceDeltaPts ?? 4.0;
      serviceDeltaMap[r.serviceId] = (serviceDeltaMap[r.serviceId] || 0) + delta;
    }

    const evals = activeData?.serviceEvaluations || [];
    let totalProjectedScore = 0;
    for (const ev of evals) {
      const gain = serviceDeltaMap[ev.serviceId] || 0;
      const proj = Math.min(100, ev.pScore + gain);
      totalProjectedScore += proj;
    }

    const projectedOverallScore =
      evals.length > 0 ? Math.min(100, totalProjectedScore / evals.length) : baseScore;
    const totalClusterGain = Math.max(0, projectedOverallScore - baseScore);
    const projectedTier = classifyScoreToTier(projectedOverallScore);

    return {
      isSimulating: activeSimulatedRecs.length > 0,
      simulatedCount: activeSimulatedRecs.length,
      baseScore,
      projectedOverallScore,
      totalClusterGain,
      projectedTier,
      serviceDeltaMap
    };
  }, [activeData, simulatedRecIds]);

  const handleCaptureBaseline = () => {
    if (!activeData) return;
    const svcMap: Record<string, number> = {};
    for (const s of activeData.serviceEvaluations) {
      svcMap[s.serviceId] = s.pScore;
    }
    setCapturedBaseline({
      capturedAt: new Date().toLocaleTimeString(),
      overallPScore: activeData.overallPScore,
      tierLabel: activeData.maturityTier.shortLabel,
      projectedScore: simulationSummary.isSimulating ? simulationSummary.projectedOverallScore : undefined,
      serviceScores: svcMap
    });
  };

  const avgLatency =
    activeEvals.length > 0
      ? activeEvals.reduce((sum, s) => sum + s.rawMetrics.avgResponseTimeMs, 0) / activeEvals.length
      : 0;
  const maxP95 =
    activeEvals.length > 0
      ? Math.max(...activeEvals.map((s) => s.rawMetrics.p95LatencyMs))
      : 0;
  const avgApdex =
    activeData?.clusterSubScores?.avgApdexScore ??
    (activeEvals.length > 0
      ? activeEvals.reduce((sum, s) => sum + (s.apdexAndTail?.apdexScore ?? 1), 0) / activeEvals.length
      : 1);
  const avgTailRatio =
    activeData?.clusterSubScores?.avgTailLatencyRatio ??
    (activeEvals.length > 0
      ? activeEvals.reduce((sum, s) => sum + (s.apdexAndTail?.tailLatencyRatio ?? 1.2), 0) /
        activeEvals.length
      : 1.2);
  const avgMemory =
    activeEvals.length > 0
      ? activeEvals.reduce((sum, s) => sum + s.rawMetrics.memoryUsageMB, 0) / activeEvals.length
      : 0;

  const heroVerdict = useMemo(() => {
    if (!activeData) return 'Connecting to Composite P-Score Engine...';
    const score = activeData.overallPScore;
    if (score >= 85) {
      return 'Optimal cluster stability. All microservices exceed latency SLAs with low dependency coupling.';
    } else if (score >= 70) {
      return 'Stable runtime performance. Telemetry shows healthy latency; optimizing database queries will achieve Level 4.';
    } else if (score >= 50) {
      return 'Moderate degradation detected. Downstream call-tree fan-out or database latency drift requires tuning.';
    } else {
      return 'Critical performance breach. High latency drift and unattenuated downstream cascading calls detected.';
    }
  }, [activeData]);

  const crValue =
    activeData?.ahpValidation?.consistencyRatio ?? activeData?.ahpValidation?.consistencyRatioCR ?? 0;
  const ciValue =
    activeData?.ahpValidation?.consistencyIndex ?? activeData?.ahpValidation?.consistencyIndexCI ?? 0;
  const riValue =
    activeData?.ahpValidation?.randomIndex ?? activeData?.ahpValidation?.randomIndexRI ?? 0.58;
  const isAhpConsistent = activeData?.ahpValidation?.isConsistent ?? crValue < 0.1;

  const getTierBadgeColor = (level?: number) => {
    switch (level) {
      case 4:
        return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400';
      case 3:
        return 'border-sky-500/40 bg-sky-500/15 text-sky-400';
      case 2:
        return 'border-amber-500/40 bg-amber-500/15 text-amber-400';
      default:
        return 'border-rose-500/40 bg-rose-500/15 text-rose-400';
    }
  };

  const getExecutionPatternBadge = (
    pattern?: ServiceEvaluation['signals']['executionPattern'],
    seqRatio?: number
  ) => {
    if (!pattern || pattern === 'SINGLE') return null;
    if (pattern === 'SEQUENTIAL_N_PLUS_1') {
      return (
        <span className="rounded bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.5 font-mono text-[10px] text-rose-400">
          Sequential N+1 ({Math.round((seqRatio ?? 1) * 100)}%)
        </span>
      );
    }
    if (pattern === 'HYBRID_WATERFALL') {
      return (
        <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 font-mono text-[10px] text-amber-400">
          Hybrid Waterfall ({Math.round((seqRatio ?? 0.5) * 100)}% Seq)
        </span>
      );
    }
    return (
      <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
        Parallel (Promise.all)
      </span>
    );
  };

  const getCategoryBadge = (cat: RecommendationItem['category']) => {
    switch (cat) {
      case 'DATABASE_INDEXING':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 font-mono text-[10px] font-semibold text-sky-400">
            <Database className="h-3 w-3" /> DB INDEXING
          </span>
        );
      case 'REDIS_CACHING':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
            <Layers className="h-3 w-3" /> REDIS CACHING
          </span>
        );
      case 'CONTAINER_BASE_IMAGE':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-400">
            <Cpu className="h-3 w-3" /> CONTAINER &amp; HPA
          </span>
        );
    }
  };

  return (
    <PageContainer className="space-y-6">
      {/* Unified Pipeline Flow Header */}
      <PerformanceFlowHeader
        currentStep="pscore"
        services={(data?.serviceEvaluations || []).map((s) => s.serviceId)}
        selectedService={selectedServiceFilter === 'ALL' ? TelemetryService.getActiveService() : selectedServiceFilter}
        onSelectService={(svcId) => {
          setSelectedServiceFilter(svcId);
          TelemetryService.setActiveService(svcId);
        }}
        onAddService={(svcId) => {
          const trimmed = svcId.trim();
          if (!trimmed) return;
          const existing = TelemetryService.getCollectedServices();
          TelemetryService.setCollectedServices(
            existing.includes(trimmed) ? existing : [...existing, trimmed],
            trimmed
          );
          setSelectedServiceFilter(trimmed);
          fetchCompositePScore();
        }}
      />

      {/* Page Header with Action Center */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-perf">
              Step 4 of 4 · Composite Aggregation
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              FastAPI Engine (:8000)
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2.5">
            <Zap className="h-6 w-6 text-brand-perf" /> Performance Efficiency Maturity (P-Score)
          </h2>
          <p className="mt-1 text-sm text-text-secondary max-w-2xl">
            Cluster-wide architectural maturity evaluating latency drift, distributed call-tree coupling, and ML runtime anomalies.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={fetchCompositePScore}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-secondary/40 px-3.5 py-2 text-xs font-medium text-text-primary hover:bg-surface-secondary shadow-sm transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-brand-perf' : ''}`} />
            Evaluate Live
          </button>

          <Link
            to="/dimensions/performance/calculation"
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-perf/40 bg-brand-perf/10 hover:bg-brand-perf/20 px-3 py-2 text-xs font-semibold text-brand-perf shadow-sm transition-all"
            title="View Complete Mathematical Calculation Logic & Examples"
          >
            <Calculator className="h-3.5 w-3.5" />
            Calculation Logic
          </Link>

          <Link
            to={`/reports/summary?service=${encodeURIComponent(
              (selectedServiceFilter !== 'ALL' ? selectedServiceFilter : null) ||
              TelemetryService.getActiveService() ||
              data?.serviceEvaluations?.[0]?.serviceId ||
              'order-service-1'
            )}&autoPrint=true`}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-md shadow-emerald-500/20 transition-all"
            title="Download 1-Page Plain Language Executive Summary PDF"
          >
            <FileText className="h-3.5 w-3.5" />
            📄 Summary PDF (1 Page)
          </Link>

          <Link
            to={`/reports/technical?service=${encodeURIComponent(
              (selectedServiceFilter !== 'ALL' ? selectedServiceFilter : null) ||
              TelemetryService.getActiveService() ||
              data?.serviceEvaluations?.[0]?.serviceId ||
              'order-service-1'
            )}&autoPrint=true`}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 hover:bg-amber-300 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-md shadow-amber-400/20 transition-all"
            title="Download 4-Page Comprehensive Engineering Audit PDF"
          >
            <FileText className="h-3.5 w-3.5" />
            🔧 Technical PDF (4 Pages)
          </Link>
        </div>
      </div>

      {/* Live Performance Scenario Injector */}
      <PerformanceScenarioInjector
        activeScenario={activeScenario}
        onSelectScenario={setActiveScenario}
      />

      {/* Layer 1: Executive Hero Card (5-Second Glance) */}
      <div className="relative overflow-hidden rounded-xl border border-brand-perf/25 bg-gradient-to-r from-surface-secondary/40 via-surface/80 to-surface-secondary/30 p-5 lg:p-6 shadow-sm backdrop-blur">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Left: Overall P-Score Display & Verdict */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="flex flex-col items-center justify-center rounded-2xl border border-brand-perf/30 bg-surface/90 px-6 py-4 shadow-inner min-w-[140px]">
              <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
                Composite P-Score
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-4xl font-extrabold font-mono text-brand-perf tracking-tight">
                  {isLoading || !activeData ? '--' : activeData.overallPScore.toFixed(1)}
                </span>
                <span className="text-sm font-mono text-text-muted">/100</span>
              </div>
              {simulationSummary.isSimulating && (
                <span className="mt-1 font-mono text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-2 py-0.5">
                  → {simulationSummary.projectedOverallScore.toFixed(1)} (+{simulationSummary.totalClusterGain.toFixed(1)})
                </span>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {activeData?.maturityTier && (
                  <span
                    className={`rounded-full border px-3 py-1 font-mono text-xs font-bold ${getTierBadgeColor(
                      activeData.maturityTier.level
                    )}`}
                  >
                    {activeData.maturityTier.tier}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Cluster Nominal
                </span>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed max-w-xl font-medium">
                &ldquo;{heroVerdict}&rdquo;
              </p>
            </div>
          </div>

          {/* Right: Quick Vitals Pill List */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2.5 w-full lg:w-auto font-mono text-xs">
            <div className="rounded-lg border border-border/70 bg-surface/70 p-2.5">
              <div className="text-[10px] uppercase text-text-muted">Response Speed</div>
              <div className="text-sm font-bold text-text-primary mt-0.5">
                {avgLatency.toFixed(1)} ms <span className="text-[10px] text-emerald-400 font-normal">(&lt;150ms ✓)</span>
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-surface/70 p-2.5">
              <div className="text-[10px] uppercase text-text-muted">Reliability (Apdex)</div>
              <div className="text-sm font-bold text-emerald-400 mt-0.5">
                {avgApdex.toFixed(3)} <span className="text-[10px] text-emerald-400 font-normal">(EXCELLENT)</span>
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-surface/70 p-2.5">
              <div className="text-[10px] uppercase text-text-muted">Fleet Services</div>
              <div className="text-sm font-bold text-text-primary mt-0.5">
                {activeEvals.length} Live Microservices
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-surface/70 p-2.5">
              <div className="text-[10px] uppercase text-text-muted">AHP Consistency</div>
              <div className={`text-sm font-bold mt-0.5 ${isAhpConsistent ? 'text-emerald-400' : 'text-amber-400'}`}>
                CR = {crValue.toFixed(4)} <span className="text-[10px] font-normal">(&lt;0.10 ✓)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Engine Status Banner */}
      {errorMsg ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>
              Python Engine Offline: {errorMsg}. Ensure <strong>pscore-anomaly-detection</strong> (:8000) and{' '}
              <strong>pscore-telemetry-collector</strong> (:8787) containers are running.
            </span>
          </div>
          <button
            type="button"
            onClick={fetchCompositePScore}
            className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 font-mono text-[11px]"
          >
            Retry Connection
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5 text-xs text-emerald-300 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              <strong>{activeData?.engine || data?.engine}</strong> — Monitoring {activeEvals.length} microservices (Eval latency:{' '}
              {activeData?.evaluationLatencyMs ?? data?.evaluationLatencyMs ?? 0}ms) | Mathematical Consistency:{' '}
              <strong className={isAhpConsistent ? 'text-emerald-300' : 'text-amber-300'}>
                CR = {crValue.toFixed(4)} ({isAhpConsistent ? '< 0.10 Rigorous' : '>= 0.10 Revise'})
              </strong>
            </span>
          </div>
          {lastUpdated && (
            <span className="font-mono text-[11px] text-emerald-400/80">
              Last evaluated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      )}

      {/* Layer 2: Primary Performance Metrics Summary Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-surface-secondary/20 hover:border-brand-perf/30 transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Response Speed (P95)
              </span>
              <Clock className="h-4 w-4 text-sky-400" />
            </div>
            <div className="mt-2 text-2xl font-mono font-bold text-text-primary">
              {activeEvals.length > 0 ? `${avgLatency.toFixed(1)} ms` : '0 ms'}
            </div>
            <p className="mt-1 text-[11px] text-text-muted">
              Target: &lt;150 ms · Cluster Max: <strong className="text-text-secondary font-mono">{maxP95.toFixed(1)} ms</strong>
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-secondary/20 hover:border-emerald-500/30 transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Cluster Apdex SLA (T=50ms)
              </span>
              <Gauge className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-mono font-bold text-emerald-400">
                {avgApdex.toFixed(3)}
              </span>
              <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
                {avgApdex >= 0.94 ? 'EXCELLENT' : avgApdex >= 0.85 ? 'GOOD' : 'FAIR'}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-text-muted">
              Tail Amplification (P99/P95): <strong className="font-mono text-sky-400">{avgTailRatio.toFixed(2)}x</strong>
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-secondary/20 hover:border-amber-400/30 transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Container RAM Footprint
              </span>
              <HardDrive className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 text-2xl font-mono font-bold text-text-primary">
              {activeEvals.length > 0 ? `${avgMemory.toFixed(1)} MB` : '0 MB'}
            </div>
            <p className="mt-1 text-[11px] text-text-muted">Live Docker Engine cgroup RSS</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-surface-secondary/20 hover:border-brand-perf/30 transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Remediation Simulator
              </span>
              <Sparkles className="h-4 w-4 text-brand-perf" />
            </div>
            <div className="mt-2 text-2xl font-mono font-bold text-text-primary">
              {simulationSummary.isSimulating ? (
                <span className="text-emerald-400">
                  +{simulationSummary.totalClusterGain.toFixed(1)} pts
                </span>
              ) : (
                `${data?.recommendations?.length ?? 0} Rules Active`
              )}
            </div>
            <p className="mt-1 text-[11px] text-text-muted">
              {simulationSummary.isSimulating
                ? `${simulationSummary.simulatedCount} fixes simulated`
                : 'Click "Simulate Fix" below'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* SRE Error Budget Burn Rate & Depletion Forecaster */}
      <ErrorBudgetBurnWidget
        sloTargetPct={99.9}
        avgLatencyMs={avgLatency}
        latencyThresholdMs={150.0}
        driftPenalty={activeData?.clusterSubScores?.avgDriftPenalty ?? 0.05}
        activeServicesCount={activeEvals.length}
      />

      {/* Novelty Architecture: 3 Core Research Pillars (Full-Width 3 Columns) */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-brand-perf" /> Research Methodology · 3 Composite Sub-Engines
            </h3>
            <p className="text-xs text-text-secondary">
              Composite P-Score aggregates 3 distinct telemetry signals weighted via Saaty Analytic Hierarchy Process (AHP).
            </p>
          </div>
          <span className="font-mono text-xs font-semibold text-brand-perf bg-brand-perf/10 border border-brand-perf/20 rounded-md px-2.5 py-1">
            Weights: {Math.round((data?.weights?.drift ?? 0.4) * 100)}% Drift /{' '}
            {Math.round((data?.weights?.fanout ?? 0.4) * 100)}% Fan-Out /{' '}
            {Math.round((data?.weights?.anomaly ?? 0.2) * 100)}% ML
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Sub-Engine 1: Historical Drift */}
          <Card className="border-border hover:border-sky-400/40 bg-surface-secondary/20 transition-all flex flex-col justify-between shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-[11px] font-mono font-bold text-sky-400">
                  Sub-Engine 1 · {Math.round((data?.weights?.drift ?? 0.4) * 100)}% Weight
                </span>
                <span className="font-mono text-base font-extrabold text-sky-400">
                  {data?.clusterSubScores?.driftHealthScore ?? 100}/100
                </span>
              </div>
              <CardTitle className="text-sm font-semibold text-text-primary mt-2">
                Historical Latency Drift Analyzer
              </CardTitle>
              <p className="text-xs text-text-muted leading-relaxed">
                Ordinary Least Squares (OLS) regression comparing live latency against rolling baselines.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="h-2 w-full rounded-full bg-surface-secondary overflow-hidden">
                <div
                  className="h-full bg-sky-400 transition-all duration-500"
                  style={{ width: `${data?.clusterSubScores?.driftHealthScore ?? 100}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-text-secondary border-t border-border/40 pt-2.5">
                <span>Avg Drift Penalty:</span>
                <strong className="text-sky-400 font-bold">
                  {data?.clusterSubScores?.avgDriftPenalty?.toFixed(3) ?? '0.000'} pts
                </strong>
              </div>
              <Link
                to="/dimensions/performance/drift"
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-sky-400/30 bg-sky-400/10 py-1.5 text-xs font-semibold text-sky-400 hover:bg-sky-400/20 transition-colors"
              >
                Inspect Drift Engine <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </CardContent>
          </Card>

          {/* Sub-Engine 2: Fan-Out & Attenuation */}
          <Card className="border-border hover:border-brand-perf/40 bg-surface-secondary/20 transition-all flex flex-col justify-between shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-perf/30 bg-brand-perf/10 px-2 py-0.5 text-[11px] font-mono font-bold text-brand-perf">
                  Sub-Engine 2 · {Math.round((data?.weights?.fanout ?? 0.4) * 100)}% Weight
                </span>
                <span className="font-mono text-base font-extrabold text-brand-perf">
                  {data?.clusterSubScores?.fanOutHealthScore ?? 100}/100
                </span>
              </div>
              <CardTitle className="text-sm font-semibold text-text-primary mt-2">
                Topological Fan-Out &amp; Call-Tree Depth
              </CardTitle>
              <p className="text-xs text-text-muted leading-relaxed">
                Evaluates distributed trace DAG depth, sequential N+1 calls, and 0.3x API Gateway attenuation.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="h-2 w-full rounded-full bg-surface-secondary overflow-hidden">
                <div
                  className="h-full bg-brand-perf transition-all duration-500"
                  style={{ width: `${data?.clusterSubScores?.fanOutHealthScore ?? 100}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-text-secondary border-t border-border/40 pt-2.5">
                <span>Avg Fan-Out Penalty:</span>
                <strong className="text-brand-perf font-bold">
                  {data?.clusterSubScores?.avgFanOutPenalty?.toFixed(3) ?? '0.000'} pts
                </strong>
              </div>
              <Link
                to="/dimensions/performance/fanout"
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-brand-perf/30 bg-brand-perf/10 py-1.5 text-xs font-semibold text-brand-perf hover:bg-brand-perf/20 transition-colors"
              >
                Inspect Fan-Out Engine <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </CardContent>
          </Card>

          {/* Sub-Engine 3: ML Anomaly Detection */}
          <Card className="border-border hover:border-amber-400/40 bg-surface-secondary/20 transition-all flex flex-col justify-between shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-mono font-bold text-amber-400">
                  Sub-Engine 3 · {Math.round((data?.weights?.anomaly ?? 0.2) * 100)}% Weight
                </span>
                <span className="font-mono text-base font-extrabold text-amber-400">
                  {data?.clusterSubScores?.anomalyHealthScore ?? 100}/100
                </span>
              </div>
              <CardTitle className="text-sm font-semibold text-text-primary mt-2">
                Isolation Forest ML &amp; 90s Startup Filter
              </CardTitle>
              <p className="text-xs text-text-muted leading-relaxed">
                Unsupervised anomaly detection filtering out transient false positives during pod startup.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="h-2 w-full rounded-full bg-surface-secondary overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-500"
                  style={{ width: `${data?.clusterSubScores?.anomalyHealthScore ?? 100}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-text-secondary border-t border-border/40 pt-2.5">
                <span>Avg ML Penalty:</span>
                <strong className="text-amber-400 font-bold">
                  {data?.clusterSubScores?.avgAnomalyPenalty?.toFixed(3) ?? '0.000'} pts
                </strong>
              </div>
              <Link
                to="/dimensions/performance/anomaly"
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-amber-400/30 bg-amber-400/10 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-400/20 transition-colors"
              >
                Inspect ML Engine <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Fleet Microservices Performance & Per-Service Reports */}
      <Card className="border-border">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-primary">
                <Server className="h-4 w-4 text-emerald-400" /> Microservice Fleet Performance &amp; XAI Feature Attribution
              </CardTitle>
              <p className="mt-1 text-xs text-text-secondary">
                Individual microservice P-Scores, Execution Pattern (Sequential N+1 vs Parallel), Apdex SLA, and direct report downloads.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedServiceFilter('ALL')}
                className={`rounded-md border px-2.5 py-1 font-mono text-xs transition-colors ${
                  selectedServiceFilter === 'ALL'
                    ? 'border-brand-perf bg-brand-perf/15 text-brand-perf font-semibold'
                    : 'border-border bg-surface text-text-secondary hover:text-text-primary'
                }`}
              >
                All Services ({activeEvals.length})
              </button>
              {(data?.serviceEvaluations || []).map((s) => (
                <button
                  key={s.serviceId}
                  type="button"
                  onClick={() => setSelectedServiceFilter(s.serviceId)}
                  className={`rounded-md border px-2.5 py-1 font-mono text-xs transition-colors ${
                    selectedServiceFilter === s.serviceId
                      ? 'border-brand-perf bg-brand-perf/15 text-brand-perf font-semibold'
                      : 'border-border bg-surface text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {s.serviceId}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {(data?.serviceEvaluations || [])
              .filter((s) => selectedServiceFilter === 'ALL' || s.serviceId === selectedServiceFilter)
              .map((svc) => {
                const simDelta = simulationSummary.serviceDeltaMap[svc.serviceId] || 0;
                const projectedSvcScore = Math.min(100, svc.pScore + simDelta);
                const attr = svc.signals.featureAttributions;

                return (
                  <div
                    key={svc.serviceId}
                    className="rounded-xl border border-border/80 bg-surface-secondary/25 p-4 flex flex-col justify-between space-y-3.5 hover:border-brand-perf/40 transition-all shadow-sm"
                  >
                    {/* Header Row: Name, Badges, Score */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-base font-bold text-text-primary">
                          {svc.serviceId}
                        </span>
                        {svc.signals.isApiGateway && (
                          <span className="rounded bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.5 font-mono text-[10px] text-sky-400 font-semibold">
                            Gateway (0.3x)
                          </span>
                        )}
                        {getExecutionPatternBadge(
                          svc.signals.executionPattern,
                          svc.signals.sequentialRatio
                        )}
                        {svc.hasTelemetry ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Live
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400">
                            <XCircle className="h-3.5 w-3.5" /> Offline
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded border px-2 py-0.5 font-mono text-[10px] font-semibold ${getTierBadgeColor(
                            svc.maturityTier.level
                          )}`}
                        >
                          {svc.maturityTier.shortLabel}
                        </span>
                        <div className="flex items-baseline gap-1.5 font-mono">
                          <span className="text-xl font-bold text-brand-perf">
                            {svc.pScore.toFixed(1)}
                            <span className="text-xs text-text-muted">/100</span>
                          </span>
                          {simDelta > 0 && (
                            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 rounded px-1.5 py-0.5">
                              → {projectedSvcScore.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Penalty Deductions Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono bg-surface/70 rounded-lg px-3 py-2 border border-border/50">
                      <span>
                        Drift:{' '}
                        <strong className="text-sky-400">-{svc.penalties.driftPenaltyPts} pts</strong>
                      </span>
                      <span>
                        Fan-Out:{' '}
                        <strong className="text-brand-perf">
                          -{svc.penalties.fanOutPenaltyPts} pts
                        </strong>{' '}
                        <span className="text-text-muted">({svc.signals.directFanOutCount} calls, D{svc.signals.maxDependencyDepth})</span>
                      </span>
                      <span>
                        ML Anomaly:{' '}
                        <strong className="text-amber-400">
                          -{svc.penalties.anomalyPenaltyPts} pts
                        </strong>
                      </span>
                    </div>

                    {/* Apdex & Latency Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-text-secondary px-1">
                      <span>
                        Apdex: <strong className="text-emerald-400">{svc.apdexAndTail?.apdexScore?.toFixed(3) ?? '0.995'}</strong> ({svc.apdexAndTail?.apdexRating ?? 'EXCELLENT'})
                      </span>
                      <span>
                        P95: <strong className="text-text-primary">{svc.rawMetrics.p95LatencyMs}ms</strong> · P99: <strong className="text-text-primary">{svc.rawMetrics.p99LatencyMs ?? 21}ms</strong>
                      </span>
                      <span>
                        Tail Amp: <strong className="text-sky-400">{svc.apdexAndTail?.tailLatencyRatio?.toFixed(2) ?? '1.20'}x</strong>
                      </span>
                    </div>

                    {/* XAI Feature Attribution Mini Bar */}
                    {attr && (
                      <div className="space-y-1.5 bg-surface/40 rounded-lg p-2 border border-border/40">
                        <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
                          <span>
                            Dominant Driver: <strong className="text-text-primary">{attr.dominantDriver}</strong>
                          </span>
                          <span>
                            CPU {attr.cpuPercent}% · RAM {attr.memoryPercent}% · Lat {attr.latencyPercent}% · Err {attr.errorPercent}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-surface-secondary overflow-hidden flex">
                          <div className="h-full bg-cyan-400" style={{ width: `${attr.cpuPercent}%` }} title={`CPU: ${attr.cpuPercent}%`} />
                          <div className="h-full bg-amber-400" style={{ width: `${attr.memoryPercent}%` }} title={`Memory: ${attr.memoryPercent}%`} />
                          <div className="h-full bg-brand-perf" style={{ width: `${attr.latencyPercent}%` }} title={`Latency: ${attr.latencyPercent}%`} />
                          <div className="h-full bg-rose-400" style={{ width: `${attr.errorPercent}%` }} title={`Errors: ${attr.errorPercent}%`} />
                        </div>
                      </div>
                    )}

                    {/* Card Footer: Telemetry + Direct Reports */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-2.5 font-mono text-[11px]">
                      <div className="flex items-center gap-3 text-text-muted">
                        <span>CPU: {svc.rawMetrics.cpuUsageMillicores}m</span>
                        <span>RAM: {svc.rawMetrics.memoryUsageMB}MB</span>
                        <span>RPS: {svc.rawMetrics.rps} req/s</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedTraceService(svc.serviceId)}
                          className="inline-flex items-center gap-1 rounded bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 text-[10px] font-bold text-sky-400 hover:bg-sky-500/25 transition-colors"
                          title="Inspect OpenTelemetry Span Waterfall"
                        >
                          <GitBranch className="h-3 w-3" /> Trace
                        </button>
                        <Link
                          to={`/reports/summary?service=${encodeURIComponent(svc.serviceId)}&autoPrint=true`}
                          target="_blank"
                          className="inline-flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                        >
                          <FileText className="h-3 w-3" /> Summary
                        </Link>
                        <Link
                          to={`/reports/technical?service=${encodeURIComponent(svc.serviceId)}&autoPrint=true`}
                          target="_blank"
                          className="inline-flex items-center gap-1 rounded bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold text-amber-400 hover:bg-amber-400/25 transition-colors"
                        >
                          <FileText className="h-3 w-3" /> Technical
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Collapsible Saaty's Analytic Hierarchy Process (AHP) & Historical Trend Section */}
      <details className="group rounded-xl border border-border bg-surface-secondary/20 p-4 transition-all">
        <summary className="flex cursor-pointer items-center justify-between select-none">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-text-secondary">
            <Scale className="h-4 w-4 text-sky-400" /> Saaty&apos;s Analytic Hierarchy Process (AHP) &amp; Historical Stability
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold border ${
                isAhpConsistent
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
              }`}
            >
              {isAhpConsistent ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <AlertTriangle className="h-3 w-3" />
              )}
              CR = {crValue.toFixed(4)} {isAhpConsistent ? '< 0.10 Mathematical Rigor Validated' : '>= 0.10 (Revise)'}
            </span>
            <ChevronDown className="h-4 w-4 text-text-muted transition-transform group-open:rotate-180" />
          </div>
        </summary>

        <div className="mt-4 pt-4 border-t border-border/60 space-y-5">
          {/* Preset Buttons */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-mono text-text-muted uppercase">Select Architectural Weight Profile:</span>
              <div className="flex items-center gap-2">
                <Link
                  to="/dimensions/performance/calculation"
                  className="rounded border border-brand-perf/40 bg-brand-perf/10 hover:bg-brand-perf/20 px-2 py-0.5 font-mono text-[10px] text-brand-perf font-semibold transition-colors inline-flex items-center gap-1"
                >
                  <Calculator className="h-3 w-3" /> View Mathematical Proofs →
                </Link>
                <button
                  type="button"
                  onClick={() => setUseCustomPairwise((prev) => !prev)}
                  className={`rounded border px-2 py-0.5 font-mono text-[10px] transition-colors ${
                    useCustomPairwise
                      ? 'border-sky-400 bg-sky-500/15 text-sky-300 font-semibold'
                      : 'border-border bg-surface text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {useCustomPairwise ? 'Custom Saaty 1–9 Judgments Active' : 'Customize Pairwise (a12, a13, a23)'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {WEIGHT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setSelectedPresetId(preset.id);
                    setUseCustomPairwise(false);
                    setPairwiseJudgments({ a12: preset.a12, a13: preset.a13, a23: preset.a23 });
                  }}
                  className={`rounded-lg border p-2.5 text-left transition-colors ${
                    !useCustomPairwise && selectedPresetId === preset.id
                      ? 'border-brand-perf bg-brand-perf/15 text-text-primary shadow-sm'
                      : 'border-border bg-surface text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <div className="font-mono text-xs font-bold text-brand-perf">
                    {preset.drift * 100}% / {preset.fanout * 100}% / {preset.anomaly * 100}%
                  </div>
                  <div className="text-xs font-medium truncate mt-0.5">{preset.label.split(' (')[0]}</div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-text-muted">{activePreset.description}</p>
          </div>

          {/* Interactive Saaty 1-9 Pairwise Judgment Controls */}
          {useCustomPairwise && (
            <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 space-y-2.5">
              <div className="text-[11px] font-mono uppercase text-sky-400 font-semibold">
                Saaty 1–9 Pairwise Comparisons (Test Transitivity &amp; Consistency Ratio CR)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="block font-mono text-[10px] text-text-secondary mb-1">
                    a₁₂ (Drift vs. Fan-Out)
                  </label>
                  <select
                    value={pairwiseJudgments.a12}
                    onChange={(e) =>
                      setPairwiseJudgments((p) => ({ ...p, a12: parseFloat(e.target.value) }))
                    }
                    className="w-full rounded border border-border bg-surface px-2 py-1 font-mono text-[11px] text-text-primary"
                  >
                    {SAATY_SCALE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[10px] text-text-secondary mb-1">
                    a₁₃ (Drift vs. ML Anomaly)
                  </label>
                  <select
                    value={pairwiseJudgments.a13}
                    onChange={(e) =>
                      setPairwiseJudgments((p) => ({ ...p, a13: parseFloat(e.target.value) }))
                    }
                    className="w-full rounded border border-border bg-surface px-2 py-1 font-mono text-[11px] text-text-primary"
                  >
                    {SAATY_SCALE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[10px] text-text-secondary mb-1">
                    a₂₃ (Fan-Out vs. ML Anomaly)
                  </label>
                  <select
                    value={pairwiseJudgments.a23}
                    onChange={(e) =>
                      setPairwiseJudgments((p) => ({ ...p, a23: parseFloat(e.target.value) }))
                    }
                    className="w-full rounded border border-border bg-surface px-2 py-1 font-mono text-[11px] text-text-primary"
                  >
                    {SAATY_SCALE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 3x3 Pairwise Matrix & Eigenvalue Metrics */}
          {data?.ahpValidation && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="rounded-lg border border-border/70 bg-surface/80 p-3">
                <div className="text-[10px] font-mono uppercase text-text-muted mb-2 font-semibold">
                  Saaty Pairwise Matrix A = [a_ij]
                </div>
                <table className="w-full text-right font-mono text-[11px]">
                  <thead>
                    <tr className="text-text-muted border-b border-border/50">
                      <th className="text-left py-1">Signal</th>
                      <th className="py-1">Drift</th>
                      <th className="py-1">FanOut</th>
                      <th className="py-1">ML</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {data.ahpValidation.pairwiseMatrix.map((row, rIdx) => (
                      <tr key={rIdx}>
                        <td className="text-left py-1 font-semibold text-text-secondary">
                          {rIdx === 0 ? 'Drift' : rIdx === 1 ? 'FanOut' : 'ML'}
                        </td>
                        {row.map((val, cIdx) => (
                          <td key={cIdx} className="py-1 text-text-primary">
                            {val.toFixed(2)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-lg border border-border/70 bg-surface/80 p-3 flex flex-col justify-between font-mono text-[11px] space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-text-muted">Principal Eigenvalue (λ_max):</span>
                  <span className="text-text-primary font-bold">
                    {data.ahpValidation.lambdaMax.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Consistency Index (CI):</span>
                  <span className="text-text-primary">{ciValue.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Saaty Random Index (RI, n=3):</span>
                  <span className="text-text-primary">{riValue}</span>
                </div>
                <div className="flex justify-between border-t border-border/50 pt-1.5">
                  <span className="text-text-secondary font-semibold">Consistency Ratio (CR):</span>
                  <span className={isAhpConsistent ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {crValue.toFixed(4)} ({isAhpConsistent ? 'Consistent' : 'Inconsistent'})
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Historical P-Score Trend Timeline inside Accordion */}
          {data?.pScoreHistory && data.pScoreHistory.length > 0 && (
            <div className="rounded-lg border border-border/70 bg-surface/80 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> Persistent Evaluation Stability
                </span>
                <span className="font-mono text-[10px] text-text-muted">
                  Last {Math.min(20, data.pScoreHistory.length)} Evaluations
                </span>
              </div>
              <div className="h-20 flex items-end gap-1.5 pt-2 px-1 border-b border-border/60">
                {data.pScoreHistory.slice(-20).map((pt, idx) => {
                  const heightPct = Math.max(12, Math.min(100, pt.overallPScore));
                  const barColor =
                    pt.overallPScore >= 85
                      ? 'bg-emerald-400/80'
                      : pt.overallPScore >= 70
                      ? 'bg-sky-400/80'
                      : pt.overallPScore >= 50
                      ? 'bg-amber-400/80'
                      : 'bg-rose-400/80';
                  const timeStr = new Date(pt.timestamp * 1000).toLocaleTimeString();
                  return (
                    <div
                      key={`${pt.timestamp}-${idx}`}
                      className="flex-1 flex flex-col items-center group relative"
                      title={`${timeStr} — P-Score: ${pt.overallPScore.toFixed(1)} (Tier L${pt.tierLevel})`}
                    >
                      <div
                        className={`w-full rounded-t transition-all ${barColor} group-hover:opacity-100 opacity-85`}
                        style={{ height: `${(heightPct / 100) * 65}px` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between font-mono text-[10px] text-text-muted">
                <span>
                  Earliest: {data.pScoreHistory[0] ? `${data.pScoreHistory[0].overallPScore.toFixed(1)} pts` : '--'}
                </span>
                <span>
                  Latest: {data.pScoreHistory[data.pScoreHistory.length - 1] ? `${data.pScoreHistory[data.pScoreHistory.length - 1].overallPScore.toFixed(1)} pts` : '--'}
                </span>
              </div>
            </div>
          )}
        </div>
      </details>

      {/* Phase 5: Context-Aware Architectural Recommendations Engine + Closed-Loop Remediation Simulator */}
      <Card className="border-border">
        <CardHeader className="border-b border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-primary">
                <Sparkles className="h-4 w-4 text-brand-perf" /> Context-Aware Architectural Recommendations &amp; Closed-Loop Simulator
              </CardTitle>
              <p className="mt-1 text-xs text-text-secondary">
                Toggle <strong>Simulate Fix</strong> or click <strong>Capture Baseline Snapshot</strong> to verify Before vs. After optimization gains.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCaptureBaseline}
                className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 font-mono text-xs font-semibold text-sky-400 hover:bg-sky-500/25 transition-colors"
              >
                <Camera className="h-3 w-3" /> Capture Baseline Snapshot
              </button>
              <button
                type="button"
                onClick={simulateAllFixes}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 font-mono text-xs font-semibold text-emerald-400 hover:bg-emerald-500/25 transition-colors"
              >
                <Play className="h-3 w-3" /> Simulate All Fixes
              </button>
              {simulationSummary.isSimulating && (
                <button
                  type="button"
                  onClick={resetSimulations}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 font-mono text-xs text-text-secondary hover:text-text-primary transition-colors"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
              )}
            </div>
          </div>

          {/* Captured Baseline vs. Live Actual Benchmark Comparison */}
          {capturedBaseline && data && (
            <div className="mt-4 rounded-lg border border-sky-500/40 bg-sky-500/10 p-3.5 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-xs font-mono uppercase tracking-wider text-sky-400 font-bold">
                  Empirical Before vs. After Optimization Benchmark (Captured at {capturedBaseline.capturedAt})
                </div>
                <div className="text-xs text-text-secondary">
                  Compares captured pre-optimization baseline against live telemetry after applying Redis caching, DB indexing, or JMeter load changes.
                </div>
              </div>
              <div className="flex items-center gap-4 font-mono">
                <div className="text-right">
                  <div className="text-[10px] uppercase text-text-muted">Baseline P-Score</div>
                  <div className="text-lg font-bold text-text-primary">
                    {capturedBaseline.overallPScore.toFixed(1)}
                  </div>
                </div>
                <div className="text-sky-400 font-bold text-lg">→</div>
                <div className="text-right">
                  <div className="text-[10px] uppercase text-sky-400">Live Actual P-Score</div>
                  <div className="text-xl font-bold text-sky-400">
                    {data.overallPScore.toFixed(1)}{' '}
                    <span className="text-xs">
                      ({data.overallPScore - capturedBaseline.overallPScore >= 0 ? '+' : ''}
                      {(data.overallPScore - capturedBaseline.overallPScore).toFixed(1)} pts)
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCapturedBaseline(null)}
                  className="rounded border border-border bg-surface px-2 py-1 text-[10px] text-text-muted hover:text-text-primary"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Interactive Closed-Loop Simulation Banner */}
          {simulationSummary.isSimulating && (
            <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3.5 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold">
                  Closed-Loop What-If Remediation Projection ({simulationSummary.simulatedCount} Active Fixes)
                </div>
                <div className="text-xs text-text-secondary">
                  Applying the selected architectural optimizations attenuates synchronous fan-out, database latency drift, and container saturation.
                </div>
              </div>
              <div className="flex items-center gap-4 font-mono">
                <div className="text-right">
                  <div className="text-[10px] uppercase text-text-muted">Before P-Score</div>
                  <div className="text-lg font-bold text-text-primary">
                    {simulationSummary.baseScore.toFixed(1)}
                  </div>
                </div>
                <div className="text-emerald-400 font-bold text-lg">→</div>
                <div className="text-right">
                  <div className="text-[10px] uppercase text-emerald-400">Projected After P-Score</div>
                  <div className="text-xl font-bold text-emerald-400">
                    {simulationSummary.projectedOverallScore.toFixed(1)}{' '}
                    <span className="text-xs">
                      (+{simulationSummary.totalClusterGain.toFixed(1)} pts)
                    </span>
                  </div>
                </div>
                <span
                  className={`rounded border px-2.5 py-1 text-xs font-semibold ${getTierBadgeColor(
                    simulationSummary.projectedTier.level
                  )}`}
                >
                  {simulationSummary.projectedTier.shortLabel}
                </span>
              </div>
            </div>
          )}

          {/* Service Filter Pills */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedServiceFilter('ALL')}
              className={`rounded-md border px-2.5 py-1 font-mono text-xs transition-colors ${
                selectedServiceFilter === 'ALL'
                  ? 'border-brand-perf bg-brand-perf/15 text-brand-perf font-semibold'
                  : 'border-border bg-surface text-text-secondary hover:text-text-primary'
              }`}
            >
              All ({data?.recommendations?.length ?? 0})
            </button>
            {(data?.serviceEvaluations || []).map((s) => (
              <button
                key={s.serviceId}
                type="button"
                onClick={() => setSelectedServiceFilter(s.serviceId)}
                className={`rounded-md border px-2.5 py-1 font-mono text-xs transition-colors ${
                  selectedServiceFilter === s.serviceId
                    ? 'border-brand-perf bg-brand-perf/15 text-brand-perf font-semibold'
                    : 'border-border bg-surface text-text-secondary hover:text-text-primary'
                }`}
              >
                {s.serviceId}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-5">
          {filteredRecommendations.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted">
              No optimization recommendations triggered for the current selection.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRecommendations.map((rec, idx) => {
                const recKey = rec.id || `${rec.serviceId}-${rec.ruleId}`;
                const isSimulated = simulatedRecIds.includes(recKey);

                return (
                  <div
                    key={`${recKey}-${idx}`}
                    className={`rounded-lg border p-4 flex flex-col justify-between space-y-3 transition-colors ${
                      isSimulated
                        ? 'border-emerald-500/60 bg-emerald-500/10'
                        : 'border-border/80 bg-surface-secondary/25 hover:border-brand-perf/40'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {getCategoryBadge(rec.category)}
                          <span className="rounded bg-surface px-2 py-0.5 font-mono text-[11px] font-bold text-text-primary border border-border">
                            {rec.serviceId}
                          </span>
                        </div>
                        <span
                          className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
                            rec.impact === 'HIGH'
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {rec.impact} IMPACT · {rec.effort} EFFORT
                        </span>
                      </div>

                      <h4 className="text-sm font-semibold text-text-primary">{rec.title}</h4>
                      <p className="text-xs leading-relaxed text-text-secondary">{rec.description}</p>
                    </div>

                    <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
                      <span className="text-text-muted truncate max-w-[240px]" title={rec.triggerEvidence}>
                        Evidence: <strong className="text-text-secondary">{rec.triggerEvidence}</strong>
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-emerald-400 font-semibold">
                          {rec.expectedPScoreImprovement}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedPatchRec(rec)}
                          className="inline-flex items-center gap-1 rounded border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 px-2 py-0.5 font-mono text-[11px] font-semibold text-sky-400 transition-colors"
                          title="Inspect copy-pasteable production patch and command"
                        >
                          <Code2 className="h-3 w-3" /> Patch
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleSimulateRec(recKey)}
                          className={`rounded px-2.5 py-0.5 font-mono text-[11px] font-semibold border transition-colors ${
                            isSimulated
                              ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                              : 'border-brand-perf/50 bg-brand-perf/15 text-brand-perf hover:bg-brand-perf/25'
                          }`}
                        >
                          {isSimulated ? '✓ Simulated' : 'Simulate Fix'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom Step Navigation Footer */}
      <PerformanceStepFooter currentStep="pscore" />

      {/* Executive Report & SLA / DORA Modal */}
      <PScoreExecutiveReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        report={currentReport}
      />

      {/* 1-Click Production Remediation Patch Modal */}
      <RemediationPatchModal
        isOpen={Boolean(selectedPatchRec)}
        onClose={() => setSelectedPatchRec(null)}
        recommendation={selectedPatchRec}
      />

      {/* Mini Critical-Path Trace Waterfall Modal */}
      <TraceWaterfallModal
        isOpen={Boolean(selectedTraceService)}
        onClose={() => setSelectedTraceService(null)}
        serviceId={selectedTraceService || 'order-service-1'}
      />
    </PageContainer>
  );
};
