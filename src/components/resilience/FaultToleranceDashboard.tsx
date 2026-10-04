import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, Zap, Activity, Cpu, HardDrive, Clock, 
  AlertTriangle, RotateCcw, CheckCircle, Server, 
  Database, TrendingUp, Play, Flame, RefreshCw,
  Sparkles, X, Brain, Trash2, History
} from 'lucide-react';
import {
  mockFaultToleranceServices,
  mockFaultTypes,
  mockInitialFaultMetrics,
  mockDefaultCardSettings,
  mockInitialActivities,
  generateInitialHistory,
  type Service,
  type FaultMetrics,
  type HistoryPoint,
  type CardSetting,
  type ActiveFault,
  type ActiveChaosEvent,
  type AiRecommendation,
  type RecentActivity,
  type AiFailurePrediction,
  type SelfHealingMetrics
} from '../../data/mockData';
import { ChaosEngineeringSuite } from './ChaosEngineeringSuite';
import { TelemetryTrends } from './TelemetryTrends';
import './FaultToleranceDashboard.css';

export const FaultToleranceDashboard: React.FC = () => {
  const [isSimulation, setIsSimulation] = useState(true);
  const [metrics, setMetrics] = useState<FaultMetrics>(mockInitialFaultMetrics);
  const [history, setHistory] = useState<HistoryPoint[]>(generateInitialHistory());
  const [services, setServices] = useState<Service[]>(mockFaultToleranceServices);
  const [mainViewMode, setMainViewMode] = useState<'overview' | 'telemetry' | 'chaos'>('overview');

  const [cardSettings, setCardSettings] = useState<Record<string, CardSetting>>(mockDefaultCardSettings);

  const [activeFaults, setActiveFaults] = useState<ActiveFault[]>([]);
  const [activeChaosEvent, setActiveChaosEvent] = useState<ActiveChaosEvent | null>(null);

  const [activities, setActivities] = useState<RecentActivity[]>(mockInitialActivities);
  const [activityFilter, setActivityFilter] = useState<'ALL' | 'INJECT' | 'HEAL' | 'ALERT'>('ALL');

  const [aiPrediction, setAiPrediction] = useState<AiFailurePrediction>({
    failureProbability: 12,
    riskLevel: 'LOW',
    predictedFailureTimeSec: 0,
    targetService: 'None (Healthy)',
    confidence: 94.8
  });

  const [selfHealing] = useState<SelfHealingMetrics>({
    podRestartSuccessRate: 98.5,
    replicaReplacementSuccessRate: 100,
    hpaEffectiveness: 95.0,
    circuitBreakerEffectiveness: 96.8
  });

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<AiRecommendation[]>([]);

  const simulationRef = useRef(isSimulation);
  simulationRef.current = isSimulation;

  const servicesRef = useRef(services);
  servicesRef.current = services;

  const activeFaultsRef = useRef(activeFaults);
  activeFaultsRef.current = activeFaults;

  const logActivity = (type: RecentActivity['type'], title: string, description: string, status: RecentActivity['status']) => {
    const newAct: RecentActivity = {
      id: `act-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type,
      title,
      description,
      status
    };
    setActivities(prev => [newAct, ...prev.slice(0, 29)]);
  };

  const updateCardSetting = (faultId: string, key: keyof CardSetting, value: string | number) => {
    setCardSettings(prev => ({
      ...prev,
      [faultId]: {
        ...prev[faultId],
        [key]: value
      }
    }));
  };

  // Check backend availability (gracefully falls back to mock live simulation)
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch('http://localhost:3010/api/resilience/score');
        if (res.ok) {
          const data = await res.json();
          setMetrics(data.metrics);
          if (data.services && data.services.length > 0) {
            setServices(data.services);
          }
          setIsSimulation(false);
        }
      } catch {
        setIsSimulation(true);
      }
    };
    checkBackend();
    const interval = setInterval(checkBackend, 5000);
    return () => clearInterval(interval);
  }, []);

  // Main Simulation Loop driven by mock telemetry engine
  useEffect(() => {
    const runSimulationStep = () => {
      if (!simulationRef.current || !autoRefresh) return;

      const currentServices = servicesRef.current;

      const offlineCount = currentServices.filter(s => s.status === 'OFFLINE').length;
      const degradedCount = currentServices.filter(s => s.status === 'DEGRADED').length;

      let baseCpu = 0;
      let baseMem = 0;
      let baseLatency = 0;
      let baseErrorRate = 0;
      let totalRestarts = 0;

      currentServices.forEach(s => {
        totalRestarts += s.restarts;

        if (s.status === 'OFFLINE') {
          baseLatency += 1200;
          baseErrorRate += 22;
          baseCpu += 2;
          baseMem += 5;
        } else if (s.status === 'DEGRADED') {
          const fType = s.faultType;
          if (fType === 'LATENCY') {
            baseLatency += 2500;
            baseCpu += s.cpu + (Math.random() * 8 - 4);
            baseMem += s.memory + (Math.random() * 4 - 2);
            baseErrorRate += Math.random() * 1.2;
          } else if (fType === 'API_ERROR') {
            baseErrorRate += 35;
            baseLatency += s.latency + 150 + Math.random() * 100;
            baseCpu += s.cpu + 10;
            baseMem += s.memory + 5;
          } else if (fType === 'HIGH_CPU') {
            baseCpu += 94 + (Math.random() * 5);
            baseMem += s.memory + 15;
            baseLatency += s.latency + 400;
            baseErrorRate += 2.5;
          } else if (fType === 'HIGH_MEMORY') {
            baseMem += 92 + (Math.random() * 5);
            baseCpu += s.cpu + 15;
            baseLatency += s.latency + 300;
            baseErrorRate += 1.8;
          } else if (fType === 'RATE_LIMIT') {
            baseErrorRate += 15 + Math.random() * 10;
            baseLatency += s.latency + 200;
            baseCpu += s.cpu + 5;
            baseMem += s.memory + 5;
          } else {
            baseLatency += 800;
            baseErrorRate += 15;
            baseCpu += 45;
            baseMem += 55;
          }
        } else {
          const flucCpu = s.cpu + (Math.random() * 6 - 3);
          const flucMem = s.memory + (Math.random() * 4 - 2);
          const flucLat = s.latency + (Math.random() * 10 - 5);
          
          baseCpu += flucCpu;
          baseMem += flucMem;
          baseLatency += flucLat;
          baseErrorRate += Math.random() * 0.3;
        }
      });

      const avgCpu = Math.min(100, Math.max(0, Math.floor(baseCpu / currentServices.length)));
      const avgMem = Math.min(100, Math.max(0, Math.floor(baseMem / currentServices.length)));
      const avgLatency = Math.floor(baseLatency / currentServices.length);
      const avgErrorRate = parseFloat(Math.min(100, Math.max(0, baseErrorRate / currentServices.length)).toFixed(2));
      
      const availability = offlineCount > 0 
        ? parseFloat((99.9 - (offlineCount * 4.5) - (Math.random() * 0.5)).toFixed(2))
        : parseFloat(Math.max(0, 99.9 - (avgErrorRate * 0.2)).toFixed(2));

      let score = 0;
      const rules = {
        availability: availability > 99.0,
        cpu: avgCpu < 70,
        memory: avgMem < 75,
        errorRate: avgErrorRate < 1.0,
        restarts: totalRestarts < 2
      };

      if (rules.availability) score += 20;
      if (rules.cpu) score += 20;
      if (rules.memory) score += 20;
      if (rules.errorRate) score += 20;
      if (rules.restarts) score += 20;

      const failoverSuccess = (offlineCount > 0 || degradedCount > 0) ? (offlineCount > 1 ? 65 : 80) : 100;

      let maturity: FaultMetrics['maturity'] = 'Initial';
      if (score >= 90) maturity = 'Optimized';
      else if (score >= 70) maturity = 'Mature';
      else if (score >= 50) maturity = 'Developing';

      // Novelty 1: Dynamic AI Failure Prediction Engine
      const activeFList = activeFaultsRef.current;
      if (activeFList.length > 0) {
        const topFault = activeFList[0];
        const prob = Math.min(98, Math.max(70, Math.floor(68 + activeFList.length * 12)));
        setAiPrediction({
          failureProbability: prob,
          riskLevel: prob > 85 ? 'CRITICAL' : 'HIGH',
          predictedFailureTimeSec: topFault.remainingSec,
          targetService: topFault.targetId,
          confidence: 96.4
        });
      } else {
        const baseProb = Math.min(25, Math.floor(avgCpu * 0.2 + avgErrorRate * 4));
        setAiPrediction({
          failureProbability: baseProb,
          riskLevel: baseProb > 20 ? 'MEDIUM' : 'LOW',
          predictedFailureTimeSec: 0,
          targetService: 'None (System Nominal)',
          confidence: 94.8
        });
      }

      const newMetrics: FaultMetrics = {
        cpu: avgCpu,
        memory: avgMem,
        availability,
        latency: avgLatency,
        errorRate: avgErrorRate,
        restarts: totalRestarts,
        mttr: (offlineCount > 0 || degradedCount > 0) ? 18 : 12,
        failoverSuccess,
        score,
        maturity
      };

      setMetrics(newMetrics);

      setHistory(prev => {
        const next = [...prev];
        if (next.length >= 25) next.shift();
        next.push({
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          cpu: avgCpu,
          memory: avgMem,
          latency: avgLatency,
          errorRate: avgErrorRate,
          availability,
          score
        });
        return next;
      });
    };

    const interval = setInterval(runSimulationStep, 2000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Active fault countdown & healing
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveFaults(prevFaults => {
        const now = Date.now();
        const updated: ActiveFault[] = [];

        prevFaults.forEach(f => {
          const remainingSec = Math.ceil((f.endTime - now) / 1000);
          if (remainingSec <= 0) {
            healService(f.targetId);
          } else {
            updated.push({ ...f, remainingSec });
          }
        });

        return updated;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const healService = (serviceId: string) => {
    if (serviceId === 'all') {
      setServices(prev => prev.map(s => ({ ...s, status: 'ONLINE', faultType: null })));
      setActiveFaults([]);
      logActivity('HEAL', 'Full Cluster Healed', 'Cleared all active chaos experiments. All microservices online.', 'success');
    } else {
      setServices(prev => prev.map(s => {
        if (s.id === serviceId) {
          return { ...s, status: 'ONLINE', faultType: null };
        }
        return s;
      }));
      logActivity('HEAL', `Service Recovered`, `Restored service '${serviceId}' to ONLINE health state.`, 'success');
    }

    setActiveChaosEvent(prev => {
      if (prev && (prev.targetId === serviceId || serviceId === 'all')) {
        return { ...prev, status: 'Recovered / Self-Healed', recoveryTime: '15s' };
      }
      return prev;
    });
  };

  const injectChaosFault = async (fType: string, target = 'gateway', duration = 15, latencyMs = 2500, errorRate = 35) => {
    const faultMeta = mockFaultTypes.find(f => f.id === fType) || mockFaultTypes[0];
    const now = Date.now();
    const endTime = now + duration * 1000;

    logActivity('INJECT', `Chaos Experiment: ${faultMeta.name}`, `Target: ${target === 'all' ? 'Cluster Wide' : target} | Duration: ${duration}s`, 'danger');

    const newFaultObj: ActiveFault = {
      id: `${target}-${fType}-${now}`,
      targetId: target,
      faultType: fType,
      faultName: faultMeta.name,
      badgeClass: faultMeta.badgeClass,
      duration,
      endTime,
      remainingSec: duration
    };

    setActiveFaults(prev => [...prev.filter(f => f.targetId !== target || target === 'all'), newFaultObj]);

    setActiveChaosEvent({
      service: target === 'all' ? 'All Microservices' : services.find(s => s.id === target)?.name || target,
      targetId: target,
      time: new Date().toLocaleTimeString(),
      type: faultMeta.name,
      status: 'Injected (Active Fault)'
    });

    if (!isSimulation) {
      try {
        await fetch('http://localhost:3010/api/chaos/inject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            serviceId: target, 
            faultType: fType, 
            duration, 
            latencyMs, 
            errorRate 
          })
        });
      } catch (err) {
        console.error('Failed to trigger backend chaos:', err);
      }
    }

    if (fType === 'CASCADING_FAILURE' || target === 'all') {
      setServices(prev => prev.map(s => ({
        ...s,
        status: s.id === 'gateway' ? 'OFFLINE' : 'DEGRADED',
        faultType: s.id === 'gateway' ? 'SERVICE_DOWN' : 'API_ERROR',
        restarts: s.restarts + 1
      })));
    } else {
      setServices(prev => prev.map(s => {
        if (s.id === target) {
          return {
            ...s,
            status: fType === 'SERVICE_DOWN' ? 'OFFLINE' : 'DEGRADED',
            faultType: fType,
            restarts: fType === 'SERVICE_DOWN' ? s.restarts + 1 : s.restarts
          };
        }
        return s;
      }));
    }
  };

  const clearAllChaos = async () => {
    if (!isSimulation) {
      try {
        await fetch('http://localhost:3010/api/chaos/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err) {
        console.error('Failed to clear backend chaos:', err);
      }
    }

    healService('all');
    setActiveChaosEvent(null);
  };

  const resetMetrics = () => {
    setServices(mockFaultToleranceServices);
    setHistory(generateInitialHistory());
    setActiveChaosEvent(null);
    setActiveFaults([]);
    logActivity('SYSTEM', 'Telemetry System Reset', 'Reset all telemetry stream metrics and cluster service state to default baseline.', 'info');
  };

  const generateAiRecommendations = (m: FaultMetrics, activeF: ActiveFault[]): AiRecommendation[] => {
    const recs: AiRecommendation[] = [];

    if (activeF.length > 0) {
      activeF.forEach(f => {
        if (f.faultType === 'LATENCY') {
          recs.push({
            level: 'critical',
            icon: 'Clock',
            title: `Network Latency Injection Detected on ${f.targetId}`,
            detail: `High latency delays API response times. Client requests will time out.`,
            action: 'Enable API response caching (Redis), optimize connection pooling, and tune circuit breaker latency thresholds.'
          });
        } else if (f.faultType === 'API_ERROR') {
          recs.push({
            level: 'critical',
            icon: 'AlertTriangle',
            title: `API 500 Error Spike Active on ${f.targetId}`,
            detail: `Internal server errors injected. Upstream clients are receiving failed responses.`,
            action: 'Implement retry policies with exponential backoff and activate fallback static responses.'
          });
        } else if (f.faultType === 'HIGH_CPU') {
          recs.push({
            level: 'critical',
            icon: 'Cpu',
            title: `CPU Burn / Stress Active on ${f.targetId}`,
            detail: `Target node CPU usage is forced above 90%. System compute bottlenecks are throttling throughput.`,
            action: 'Trigger Horizontal Pod Autoscaler (HPA), scale out replicas, and inspect high CPU thread traces.'
          });
        } else if (f.faultType === 'HIGH_MEMORY') {
          recs.push({
            level: 'critical',
            icon: 'HardDrive',
            title: `High RAM Pressure Active on ${f.targetId}`,
            detail: `Memory usage exceeds 90%. Danger of Kubernetes OOMKilled container restarts.`,
            action: 'Increase container memory limits in Helm/K8s manifests and run heap memory leak profiler.'
          });
        } else if (f.faultType === 'RATE_LIMIT') {
          recs.push({
            level: 'warning',
            icon: 'ShieldAlert',
            title: `HTTP 429 Rate Limiting Active`,
            detail: `Throttling requests on ${f.targetId}. Clients receive HTTP 429 Too Many Requests.`,
            action: 'Implement client-side sliding window rate limiters and prioritize high-priority API tokens.'
          });
        } else if (f.faultType === 'CASCADING_FAILURE') {
          recs.push({
            level: 'critical',
            icon: 'Flame',
            title: `Cascading Multi-Service Outage In Progress`,
            detail: `Multiple microservices failing in sequence. Cascading failure degrades overall SLA availability.`,
            action: 'Activate Bulkhead pattern to isolate failing services and prevent outage propagation across API gateway.'
          });
        }
      });
    }

    if (m.availability < 99.0) {
      recs.push({
        level: 'critical',
        icon: 'ShieldAlert',
        title: 'Availability Below SLA Target (99.0%)',
        detail: `Current availability is ${m.availability}%. SLA threshold violated.`,
        action: 'Inspect load balancer routing rules and verify health check endpoints.'
      });
    }

    if (m.cpu >= 70) {
      recs.push({
        level: 'warning',
        icon: 'TrendingUp',
        title: 'Elevated Cluster CPU Utilization',
        detail: `Average CPU utilization is at ${m.cpu}%. Exceeds 70% threshold.`,
        action: 'Consider auto-scaling pod count or optimizing hot code paths.'
      });
    }

    if (m.score === 100 && activeF.length === 0) {
      recs.push({
        level: 'info',
        icon: 'CheckCircle',
        title: 'System Operating at Maximum Resilience',
        detail: 'All 5 resilience scoring rules are currently satisfied (+100 pts).',
        action: 'Execute scheduled chaos experiments using the Fault Injection Cards below.'
      });
    }

    return recs.length > 0 ? recs : [{
      level: 'info',
      icon: 'CheckCircle',
      title: 'All Systems Stable',
      detail: 'No active anomalies detected.',
      action: 'Continue monitoring real-time metrics.'
    }];
  };

  const handleOpenAiPanel = () => {
    setAiPanelOpen(true);
    setAiLoading(true);
    setAiRecommendations([]);
    setTimeout(() => {
      const recs = generateAiRecommendations(metrics, activeFaults);
      setAiRecommendations(recs);
      setAiLoading(false);
      logActivity('AI_RECOMMEND', 'AI Insights Engine', `Evaluated system health and generated ${recs.length} actionable insights.`, 'info');
    }, 1000);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'color-success';
    if (score >= 70) return 'color-warning';
    return 'color-danger';
  };

  const getMaturityBadge = (maturity: string) => {
    switch (maturity) {
      case 'Optimized': return 'badge-optimized';
      case 'Mature': return 'badge-mature';
      case 'Developing': return 'badge-developing';
      default: return 'badge-initial';
    }
  };

  const filteredActivities = activities.filter(act => {
    if (activityFilter === 'INJECT') return act.type === 'INJECT';
    if (activityFilter === 'HEAL') return act.type === 'HEAL';
    if (activityFilter === 'ALERT') return act.type === 'RULE_ALERT';
    return true;
  });

  return (
    <div className="ft-dashboard-scope">
      {/* Top Bar Header */}
      <header className="app-header">
        <div className="header-brand">
          <Shield className="brand-icon" size={28} />
          <div>
            <h1>RESILIENCE SHIELD AI</h1>
            <p className="subtitle">Real-Time Chaos Engineering &amp; Fault Tolerance Platform</p>
          </div>
        </div>

        <div className="header-controls">
          {isSimulation ? (
            <span className="mode-badge simulation">
              <Zap size={14} className="pulse-icon" /> SIMULATION MODE (Mock Telemetry Active)
            </span>
          ) : (
            <span className="mode-badge live">
              <Activity size={14} className="pulse-icon" /> LIVE CLUSTER METRICS
            </span>
          )}
          <button className="btn-icon" onClick={resetMetrics} title="Reset All Metrics">
            <RotateCcw size={16} />
          </button>
          <button 
            className={`btn-icon ${autoRefresh ? 'active' : ''}`} 
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? "Pause stream" : "Resume stream"}
          >
            <RefreshCw size={16} className={autoRefresh ? 'spinning' : ''} />
          </button>

          <button
            id="ai-recommendations-btn"
            className="btn-ai-recommend"
            onClick={handleOpenAiPanel}
            title="Get AI Recommendations"
          >
            <Sparkles size={16} className="ai-sparkle-icon" />
            <span>AI Insights</span>
          </button>
        </div>
      </header>

      {/* Subheader Navigation Tabs */}
      <div className="view-mode-tabs-bar">
        <button 
          className={`view-mode-tab ${mainViewMode === 'overview' ? 'active' : ''}`}
          onClick={() => setMainViewMode('overview')}
        >
          <Shield size={15} />
          <span>Resilience &amp; Health Overview</span>
        </button>
        <button 
          className={`view-mode-tab ${mainViewMode === 'chaos' ? 'active' : ''}`}
          onClick={() => setMainViewMode('chaos')}
        >
          <Flame size={15} className="text-danger" />
          <span>Chaos Engineering Fault Injection Suite</span>
        </button>
        <button 
          className={`view-mode-tab ${mainViewMode === 'telemetry' ? 'active' : ''}`}
          onClick={() => setMainViewMode('telemetry')}
        >
          <TrendingUp size={15} className="text-primary" />
          <span>Historical Telemetry Trends</span>
        </button>
      </div>

      {/* Section 2: Telemetry Data Sources Pipeline Bar
      <div className="telemetry-pipeline-bar">
        <span className="pipeline-title"><Radio size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> Telemetry Pipeline:</span>
        {mockTelemetrySources.map(ts => (
          <div key={ts.name} className="pipeline-badge" title={`${ts.name} (${ts.category})`}>
            <span className="pipeline-dot"></span>
            <strong>{ts.name}</strong>
            <span style={{ fontSize: '10px', opacity: 0.7 }}>({ts.category})</span>
          </div>
        ))}
      </div> */}

      {/* Main Content Area - Render Only Active View Mode */}
      <main className="dashboard-grid">
        {/* VIEW MODE 1: Resilience Overview */}
        {mainViewMode === 'overview' && (
          <>
            {/* Row 1: Resilience Gauges & Rules & AI Failure Prediction & Tracker */}
            <section className="row-hero">
              {/* Gauge: Resilience Score */}
              <div className="glass-card score-card">
                <h2><Shield size={16} className="card-title-icon" /> Current Resilience Score</h2>
                <div className="score-display">
                  <div className={`score-ring ${getScoreColor(metrics.score)}`}>
                    <span className="score-value">{metrics.score}</span>
                    <span className="score-denominator">/ 100</span>
                  </div>
                </div>
                <div className="score-footer">
                  <span className="lbl">Maturity Level:</span>
                  <span className={`badge ${getMaturityBadge(metrics.maturity)}`}>
                    {metrics.maturity}
                  </span>
                </div>
              </div>

              {/* Novelty 1: AI Failure Prediction Engine Card */}
              <div className="glass-card prediction-card">
                <div className="prediction-header">
                  <span className="prediction-title">
                    <Brain size={16} /> AI Failure Prediction Engine
                  </span>
                  <span className={`prediction-risk-badge risk-${aiPrediction.riskLevel.toLowerCase()}`}>
                    {aiPrediction.riskLevel} RISK
                  </span>
                </div>
                
                <div className="prediction-prob-ring">
                  <div className="prob-val">{aiPrediction.failureProbability}%</div>
                  <div className="prob-lbl">Failure Probability (ML Predicted)</div>
                </div>

                <div className="prediction-metrics-list">
                  <div className="pred-row">
                    <span>At-Risk Service:</span>
                    <strong><code>{aiPrediction.targetService}</code></strong>
                  </div>
                  {aiPrediction.predictedFailureTimeSec > 0 && (
                    <div className="pred-row">
                      <span>Forecasted Outage In:</span>
                      <strong style={{ color: '#f87171' }}>~{aiPrediction.predictedFailureTimeSec}s</strong>
                    </div>
                  )}
                  <div className="pred-row">
                    <span>ML Confidence:</span>
                    <strong>{aiPrediction.confidence}%</strong>
                  </div>
                </div>
              </div>

              {/* Rule Engine Breakdown */}
              <div className="glass-card rules-card">
                <h2><CheckCircle size={16} className="card-title-icon" /> Scoring Engine Rules (Rule-Based)</h2>
                <div className="rules-list">
                  <div className={`rule-item ${metrics.availability > 99.0 ? 'passed' : 'failed'}`}>
                    <CheckCircle size={16} className="rule-icon" />
                    <span className="rule-desc">Availability &gt; 99.0%</span>
                    <span className="rule-points">+20 pts</span>
                  </div>
                  <div className={`rule-item ${metrics.cpu < 70 ? 'passed' : 'failed'}`}>
                    <CheckCircle size={16} className="rule-icon" />
                    <span className="rule-desc">CPU Avg Load &lt; 70%</span>
                    <span className="rule-points">+20 pts</span>
                  </div>
                  <div className={`rule-item ${metrics.memory < 75 ? 'passed' : 'failed'}`}>
                    <CheckCircle size={16} className="rule-icon" />
                    <span className="rule-desc">Memory Avg Load &lt; 75%</span>
                    <span className="rule-points">+20 pts</span>
                  </div>
                  <div className={`rule-item ${metrics.errorRate < 1.0 ? 'passed' : 'failed'}`}>
                    <CheckCircle size={16} className="rule-icon" />
                    <span className="rule-desc">Request Error Rate &lt; 1.0%</span>
                    <span className="rule-points">+20 pts</span>
                  </div>
                  <div className={`rule-item ${metrics.restarts < 2 ? 'passed' : 'failed'}`}>
                    <CheckCircle size={16} className="rule-icon" />
                    <span className="rule-desc">Pod Restart Count &lt; 2</span>
                    <span className="rule-points">+20 pts</span>
                  </div>
                </div>
              </div>

              {/* Active Chaos Tracker */}
              <div className="glass-card status-log-card">
                <div className="card-header-flex">
                  <h2><Flame size={16} className="card-title-icon" /> Active Chaos Fault Tracker</h2>
                  {activeFaults.length > 0 && (
                    <button className="btn-heal-all" onClick={clearAllChaos}>
                      <Trash2 size={12} /> Clear &amp; Heal All
                    </button>
                  )}
                </div>
                
                <div className="log-container">
                  {activeFaults.length > 0 ? (
                    <div className="active-faults-list">
                      {activeFaults.map(f => (
                        <div key={f.id} className="active-fault-item">
                          <div className="fault-item-header">
                            <span className={`ft-badge ${f.badgeClass}`}>{f.faultName}</span>
                            <span className="fault-target">Target: <code>{f.targetId}</code></span>
                          </div>
                          <div className="fault-progress-bar">
                            <div 
                              className="fault-progress-fill" 
                              style={{ width: `${(f.remainingSec / f.duration) * 100}%` }}
                            ></div>
                          </div>
                          <div className="fault-item-footer">
                            <span>Healing in: <strong>{f.remainingSec}s</strong></span>
                            <button className="btn-heal-single" onClick={() => healService(f.targetId)}>
                              Heal Now
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : activeChaosEvent ? (
                    <div className={`log-event-box ${activeChaosEvent.status.toLowerCase().includes('recovered') ? 'recovered' : 'injected'}`}>
                      <div className="event-header">
                        <Flame className="event-icon" size={16} />
                        <strong>Chaos Event Status</strong>
                      </div>
                      <p>Target: <code>{activeChaosEvent.service}</code></p>
                      <p>Type: {activeChaosEvent.type}</p>
                      <div className="event-footer">
                        <span className="status-badge">{activeChaosEvent.status}</span>
                        {activeChaosEvent.recoveryTime && (
                          <span className="time-badge">MTTR: {activeChaosEvent.recoveryTime}</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="log-empty">
                      <Activity size={32} className="pulse-icon text-text-dim" />
                      <p>No active chaos faults running.</p>
                      <p className="subtext">Configure parameters and click Inject Fault Experiment inside any card below.</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Telemetry Metrics Cards Grid */}
            <section className="metrics-grid">
              <div className="glass-card metric-item">
                <div className="metric-header">
                  <Cpu size={18} className="text-primary" />
                  <span>CPU Usage</span>
                </div>
                <div className={`metric-value ${metrics.cpu >= 70 ? 'fail-val' : ''}`}>{metrics.cpu}%</div>
                <div className="metric-status">Target &lt; 70%</div>
              </div>

              <div className="glass-card metric-item">
                <div className="metric-header">
                  <HardDrive size={18} className="text-accent" />
                  <span>Memory Usage</span>
                </div>
                <div className={`metric-value ${metrics.memory >= 75 ? 'fail-val' : ''}`}>{metrics.memory}%</div>
                <div className="metric-status">Target &lt; 75%</div>
              </div>

              <div className="glass-card metric-item">
                <div className="metric-header">
                  <CheckCircle size={18} className="text-success" />
                  <span>Availability</span>
                </div>
                <div className={`metric-value ${metrics.availability < 99 ? 'fail-val' : ''}`}>
                  {metrics.availability}%
                </div>
                <div className="metric-status">Target &gt; 99.0%</div>
              </div>

              <div className="glass-card metric-item">
                <div className="metric-header">
                  <Clock size={18} className="text-warning" />
                  <span>Response Time</span>
                </div>
                <div className={`metric-value ${metrics.latency > 300 ? 'warning-val' : ''}`}>{metrics.latency} ms</div>
                <div className="metric-status">Average API Latency</div>
              </div>

              <div className="glass-card metric-item">
                <div className="metric-header">
                  <AlertTriangle size={18} className="text-danger" />
                  <span>Error Rate</span>
                </div>
                <div className={`metric-value ${metrics.errorRate >= 1.0 ? 'fail-val' : ''}`}>
                  {metrics.errorRate}%
                </div>
                <div className="metric-status">Target &lt; 1.0%</div>
              </div>

              <div className="glass-card metric-item">
                <div className="metric-header">
                  <Server size={18} />
                  <span>Pod Restarts</span>
                </div>
                <div className={`metric-value ${metrics.restarts >= 2 ? 'fail-val' : ''}`}>
                  {metrics.restarts}
                </div>
                <div className="metric-status">Target &lt; 2 restarts</div>
              </div>

              <div className="glass-card metric-item">
                <div className="metric-header">
                  <RotateCcw size={18} className="text-success" />
                  <span>MTTR</span>
                </div>
                <div className="metric-value">{metrics.mttr}s</div>
                <div className="metric-status">Mean Time to Repair</div>
              </div>

              <div className="glass-card metric-item">
                <div className="metric-header">
                  <TrendingUp size={18} className="text-primary" />
                  <span>Failover Success</span>
                </div>
                <div className="metric-value">{metrics.failoverSuccess}%</div>
                <div className="metric-status">Redirection Rate</div>
              </div>
            </section>

            {/* Novelty 4: Self-Healing Assessment Engine Panel */}
            <section className="self-healing-card">
              <div className="self-healing-header">
                <h3>
                  <Activity size={18} /> Self-Healing Assessment Engine (Kubernetes Validation)
                </h3>
                <span className="mode-badge live" style={{ margin: 0, fontSize: '10px' }}>
                  KUBERNETES AUTONOMOUS RECOVERY ACTIVE
                </span>
              </div>
              <div className="self-healing-grid">
                <div className="sh-metric-box">
                  <div className="sh-metric-val">{selfHealing.podRestartSuccessRate}%</div>
                  <div className="sh-metric-lbl">Pod Auto-Restart Success</div>
                </div>
                <div className="sh-metric-box">
                  <div className="sh-metric-val">{selfHealing.replicaReplacementSuccessRate}%</div>
                  <div className="sh-metric-lbl">Replica Replacement Success</div>
                </div>
                <div className="sh-metric-box">
                  <div className="sh-metric-val">{selfHealing.hpaEffectiveness}%</div>
                  <div className="sh-metric-lbl">HPA Auto-Scaling Effectiveness</div>
                </div>
                <div className="sh-metric-box">
                  <div className="sh-metric-val">{selfHealing.circuitBreakerEffectiveness}%</div>
                  <div className="sh-metric-lbl">Circuit Breaker Effectiveness</div>
                </div>
              </div>
            </section>

            {/* Elegant Recent Activities & System Audit Trail Section (Full Width at Bottom) */}
            <section className="activities-card-section">
              <div className="activities-header-full">
                <div className="activities-title-area">
                  <div className="activity-header-icon">
                    <History size={22} />
                  </div>
                  <div className="activities-title-text">
                    <h2>
                      Recent Activities &amp; System Audit Trail
                      <span className="live-log-badge">● LOGGING LIVE</span>
                    </h2>
                    <p className="sub">Chronological stream of chaos fault injections, cluster self-healing events, and rule triggers</p>
                  </div>
                </div>

                <div className="activities-controls-full">
                  <button 
                    className={`activity-tab-btn ${activityFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setActivityFilter('ALL')}
                  >
                    <Activity size={13} /> All ({activities.length})
                  </button>
                  <button 
                    className={`activity-tab-btn ${activityFilter === 'INJECT' ? 'active' : ''}`}
                    onClick={() => setActivityFilter('INJECT')}
                  >
                    <Flame size={13} className="text-danger" /> Chaos Faults
                  </button>
                  <button 
                    className={`activity-tab-btn ${activityFilter === 'HEAL' ? 'active' : ''}`}
                    onClick={() => setActivityFilter('HEAL')}
                  >
                    <CheckCircle size={13} className="text-success" /> Self-Healing
                  </button>
                  <button 
                    className={`activity-tab-btn ${activityFilter === 'ALERT' ? 'active' : ''}`}
                    onClick={() => setActivityFilter('ALERT')}
                  >
                    <AlertTriangle size={13} className="text-warning" /> Alerts
                  </button>

                  {activities.length > 0 && (
                    <button className="btn-clear-log-full" onClick={() => setActivities([])}>
                      <Trash2 size={13} /> Clear Log
                    </button>
                  )}
                </div>
              </div>

              <div className="timeline-stream">
                {filteredActivities.length > 0 ? (
                  filteredActivities.map(act => {
                    let IconComponent = Activity;
                    if (act.type === 'INJECT') IconComponent = Flame;
                    else if (act.type === 'HEAL') IconComponent = CheckCircle;
                    else if (act.type === 'RULE_ALERT') IconComponent = AlertTriangle;
                    else if (act.type === 'AI_RECOMMEND') IconComponent = Sparkles;

                    return (
                      <div key={act.id} className="timeline-entry">
                        <div className={`timeline-badge-pill status-${act.status}`}>
                          <IconComponent size={18} />
                        </div>
                        <div className="timeline-body">
                          <div className="timeline-top-row">
                            <span className="timeline-entry-title">
                              {act.title}
                            </span>
                            <span className="timeline-time-tag">{act.timestamp}</span>
                          </div>
                          <p className="timeline-entry-desc">{act.description}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="log-empty" style={{ padding: '30px 0' }}>
                    <History size={32} className="pulse-icon text-text-dim" style={{ marginBottom: '8px' }} />
                    <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>No recent audit events logged for this filter category.</p>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {/* VIEW MODE 2: Historical Telemetry Trends */}
        {mainViewMode === 'telemetry' && (
          <TelemetryTrends history={history} />
        )}

        {/* VIEW MODE 3: Chaos Engineering Fault Injection Suite */}
        {mainViewMode === 'chaos' && (
          <ChaosEngineeringSuite
            services={services}
            activeFaults={activeFaults}
            activeChaosEvent={activeChaosEvent}
            cardSettings={cardSettings}
            onInjectFault={injectChaosFault}
            onHealService={healService}
            onClearAllChaos={clearAllChaos}
            onUpdateCardSetting={updateCardSetting}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer-bar">
        <p>© 2026 Resilience Shield Engine. Real-Time Fault Tolerance Assessment &amp; Chaos Engineering Studio.</p>
        <div className="db-sync-info">
          <Database size={12} />
          <span>Synced with Resilience Assessment Engine</span>
        </div>
      </footer>

      {/* AI Recommendations Slide-in Drawer */}
      {aiPanelOpen && (
        <div className="ai-panel-overlay" onClick={() => setAiPanelOpen(false)}>
          <div className="ai-panel" onClick={e => e.stopPropagation()}>
            <div className="ai-panel-header">
              <div className="ai-panel-title">
                <Brain size={20} className="ai-brain-icon" />
                <div>
                  <h2>AI Resilience Advisor</h2>
                  <p>Smart recommendations based on active chaos telemetry</p>
                </div>
              </div>
              <button className="ai-close-btn" onClick={() => setAiPanelOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="ai-panel-body">
              {aiLoading ? (
                <div className="ai-loading">
                  <div className="ai-loading-orb"></div>
                  <p>Analysing system metrics &amp; chaos patterns...</p>
                  <span>Evaluating fault tolerance playbooks</span>
                </div>
              ) : (
                <div className="ai-recs-list">
                  {aiRecommendations.map((rec, i) => {
                    return (
                      <div key={i} className={`ai-rec-card ai-rec-${rec.level}`}>
                        <div className="ai-rec-header">
                          <Brain size={16} className="ai-rec-icon" />
                          <strong>{rec.title}</strong>
                          <span className={`ai-rec-badge ai-badge-${rec.level}`}>
                            {rec.level.toUpperCase()}
                          </span>
                        </div>
                        <p className="ai-rec-detail">{rec.detail}</p>
                        <div className="ai-rec-action">
                          <Sparkles size={11} />
                          <span>{rec.action}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="ai-panel-footer">
              <button className="btn-ai-refresh" onClick={handleOpenAiPanel}>
                <RefreshCw size={13} /> Refresh Analysis
              </button>
              <span>Based on {new Date().toLocaleTimeString()} snapshot</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
