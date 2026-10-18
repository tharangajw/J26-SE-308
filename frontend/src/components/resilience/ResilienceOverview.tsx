import React from 'react';
import { 
  Shield, Brain, CheckCircle, Flame, Trash2, Activity, 
  Cpu, HardDrive, Clock, AlertTriangle, RotateCcw, Server,
  TrendingUp, History, Sparkles
} from 'lucide-react';
import type {
  FaultMetrics, AiFailurePrediction, ActiveFault, ActiveChaosEvent,
  SelfHealingMetrics, RecentActivity
} from '../../data/mockData';
import './ResilienceOverview.css';

interface ResilienceOverviewProps {
  metrics: FaultMetrics;
  aiPrediction: AiFailurePrediction;
  activeFaults: ActiveFault[];
  activeChaosEvent: ActiveChaosEvent | null;
  selfHealing: SelfHealingMetrics;
  activities: RecentActivity[];
  activityFilter: 'ALL' | 'INJECT' | 'HEAL' | 'ALERT';
  filteredActivities: RecentActivity[];
  setActivityFilter: (filter: 'ALL' | 'INJECT' | 'HEAL' | 'ALERT') => void;
  setActivities: (acts: RecentActivity[]) => void;
  clearAllChaos: () => void;
  healService: (targetId: string) => void;
}

export const ResilienceOverview: React.FC<ResilienceOverviewProps> = ({
  metrics,
  aiPrediction,
  activeFaults,
  activeChaosEvent,
  selfHealing,
  activities,
  activityFilter,
  filteredActivities,
  setActivityFilter,
  setActivities,
  clearAllChaos,
  healService
}) => {
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

  return (
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
  );
};
