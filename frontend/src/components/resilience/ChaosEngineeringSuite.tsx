import React, { useEffect, useState } from 'react';
import { 
  Flame, 
  Activity, 
  Trash2, 
  Play, 
  Terminal, 
  CheckCircle2, 
  Layers, 
  ShieldCheck, 
  Radio, 
  BarChart3,
  History,
  Clock
} from 'lucide-react';
import {
  mockFaultTypes,
  type Service,
  type CardSetting,
  type ActiveFault,
  type ActiveChaosEvent,
  type KubernetesValidationSnapshot
} from '../../data/mockData';
import './ChaosEngineeringSuite.css';

interface ChaosEngineeringSuiteProps {
  services: Service[];
  activeFaults: ActiveFault[];
  activeChaosEvent: ActiveChaosEvent | null;
  coreProductConnected: boolean;
  kubernetesValidation: KubernetesValidationSnapshot | null;
  kubernetesConnected: boolean;
  cardSettings: Record<string, CardSetting>;
  onInjectFault: (
    faultType: string,
    target: string,
    duration: number,
    latencyMs: number,
    errorRate: number,
    engine?: 'Docker Compose' | 'Chaos Mesh'
  ) => void;
  onHealService: (serviceId: string) => void;
  onClearAllChaos: () => void;
  onUpdateCardSetting: (faultId: string, key: keyof CardSetting, value: string | number) => void;
}

interface ChaosExperimentRecord {
  experimentName: string;
  serviceName: string;
  faultType: string;
  injectedAt: string;
  durationSec: number;
  status: 'RUNNING' | 'RECOVERED' | 'INTERRUPTED';
  completedAt?: string;
  recoveryTimeSec?: number;
  scoreBefore: number;
  scoreDuring?: number;
  scoreAfter?: number;
  availabilityBefore: number;
  availabilityDuring?: number;
  availabilityAfter?: number;
}

interface ChaosMeshTarget {
  id: string;
  namespace: string;
  podName: string;
  name: string;
  status: string;
}

const faultLabels: Record<string, string> = {
  HIGH_CPU: 'CPU Stress', HIGH_MEMORY: 'Memory Pressure', CASCADING_FAILURE: 'Cascading Outage',
  API_ERROR: 'API Error Spike', LATENCY: 'Network Latency', SERVICE_DOWN: 'Service Outage', RATE_LIMIT: 'Rate Limit',
  POD_RESTART: 'Pod Restart'
};

export const ChaosEngineeringSuite: React.FC<ChaosEngineeringSuiteProps> = ({
  services,
  activeFaults,
  activeChaosEvent,
  coreProductConnected,
  kubernetesValidation,
  kubernetesConnected,
  cardSettings,
  onInjectFault,
  onHealService,
  onClearAllChaos,
  onUpdateCardSetting
}) => {
  const [selectedEngine, setSelectedEngine] = useState<'Docker Compose' | 'Chaos Mesh'>('Chaos Mesh');
  const canInjectChaos = services.some(service => service.chaosSupported === true && service.status !== 'OFFLINE');
  const coreServiceNames = new Set(['api-gateway', 'book-service', 'user-service', 'order-service']);
  const coreServices = services.filter(service => coreServiceNames.has(service.name));
  const displayedServices: Service[] = selectedEngine === 'Chaos Mesh'
    ? (kubernetesConnected && kubernetesValidation
      ? kubernetesValidation.corePods.map(pod => ({
        id: pod.id,
        name: pod.name,
        type: 'Kubernetes Pod',
        status: pod.chaosFaultActive || pod.phase !== 'Running' ? 'OFFLINE' : pod.ready ? 'ONLINE' : 'DEGRADED',
        faultType: null,
        cpu: 0,
        memory: 0,
        latency: 0,
        errorRate: 0,
        restarts: pod.restartCount,
        port: pod.port,
        chaosSupported: true,
      }))
      : [])
    : services;
  const coreHealthyCount = coreServices.filter(service => service.status === 'ONLINE').length;
  const observedProcessRestarts = coreServices.reduce((total, service) => total + (service.restarts ?? 0), 0);
  const observedRecoveries = coreServices.reduce((total, service) => total + (service.recoveriesObserved ?? 0), 0);
  const hasProcessRestartMetrics = coreServices.some(service => service.restarts !== null);
  const isMeshActive = activeChaosEvent?.engine === 'Chaos Mesh';
  const composeFaultTypes = new Set(['SERVICE_DOWN', 'API_ERROR', 'LATENCY', 'RATE_LIMIT', 'HIGH_CPU', 'HIGH_MEMORY', 'CASCADING_FAILURE']);
  const [activeTab, setActiveTab] = useState<'EXPERIMENTS' | 'K8S_LOGS' | 'SELF_HEALING_AUDIT' | 'HISTORY'>('EXPERIMENTS');
  const [experimentHistory, setExperimentHistory] = useState<ChaosExperimentRecord[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(true);
  const [chaosMeshTargets, setChaosMeshTargets] = useState<ChaosMeshTarget[]>([]);
  const [chaosMeshError, setChaosMeshError] = useState('');

  useEffect(() => {
    if (selectedEngine !== 'Chaos Mesh') return;
    let active = true;
    fetch('http://localhost:3010/api/chaos/targets')
      .then(async response => {
        const result = await response.json() as { targets?: ChaosMeshTarget[]; error?: string };
        if (!response.ok) throw new Error(result.error || `Kubernetes target request failed (${response.status}).`);
        if (!active) return;
        setChaosMeshTargets(result.targets ?? []);
        setChaosMeshError(result.error || ((result.targets ?? []).length === 0
          ? 'No running core-product microservice Pods found in Kubernetes. Deploy api-gateway, book-service, order-service, and user-service to Kubernetes; Docker Compose services are not Chaos Mesh targets.'
          : ''));
      })
      .catch(error => {
        if (active) setChaosMeshError(error instanceof Error ? error.message : 'Unable to load Kubernetes pod targets.');
      });
    return () => { active = false; };
  }, [selectedEngine]);

  useEffect(() => {
    let active = true;
    const loadHistory = async () => {
      try {
        const response = await fetch('http://localhost:3010/api/resilience/chaos-history');
        if (!response.ok) throw new Error(`History request failed (${response.status}).`);
        const data = await response.json() as { experiments?: ChaosExperimentRecord[] };
        if (active) {
          setExperimentHistory(Array.isArray(data.experiments) ? data.experiments : []);
          setHistoryError('');
          setHistoryLoading(false);
        }
      } catch (error) {
        if (active) {
          setHistoryError(error instanceof Error ? error.message : 'Unable to load chaos experiment history.');
          setHistoryLoading(false);
        }
      }
    };
    void loadHistory();
    const timer = window.setInterval(loadHistory, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  return (
    <section className="chaos-lab-section">
      <div className="glass-card chaos-card">
        {/* Header with Title and Chaos Engine Framework Badges */}
        <div className="chaos-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Flame size={28} className="chaos-title-icon" />
            <div>
              <h2 style={{ margin: 0, fontSize: '18px' }}>Chaos Engineering Fault Injection Suite</h2>
              <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '12px' }}>
                Docker Compose service fault injection, monitored by <strong>Prometheus &amp; Grafana</strong>
              </p>
            </div>
          </div>

          <div className="chaos-engine-selector-box" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', background: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: '10px', border: '1px solid rgba(244,63,94,0.3)' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Chaos Framework:
            </span>
            {(['Chaos Mesh', 'Docker Compose'] as const).map(engine => (
              <button
                key={engine}
                type="button"
                aria-pressed={selectedEngine === engine}
                onClick={() => setSelectedEngine(engine)}
                style={{
                  padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                  background: selectedEngine === engine ? 'linear-gradient(135deg, #f43f5e, #e11d48)' : 'rgba(148,163,184,0.12)',
                  color: '#fff', border: `1px solid ${selectedEngine === engine ? '#f43f5e' : 'rgba(148,163,184,0.3)'}`,
                  cursor: 'pointer'
                }}
              >
                {engine}
              </button>
            ))}
          </div>
        </div>

        {selectedEngine === 'Chaos Mesh' && (
          <div role="status" style={{ margin: '-10px 0 18px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)', color: '#fbbf24', fontSize: '12px' }}>
            {chaosMeshError || (chaosMeshTargets.length
              ? `Connected to Kubernetes: ${chaosMeshTargets.length} running pod target(s). Cluster-wide outage and latency are available; pod restart, HTTP 500, CPU stress, and memory stress target one pod.`
              : 'Chaos Mesh targets Kubernetes Pods. Ensure the cluster is connected and Chaos Mesh PodChaos, NetworkChaos, StressChaos, and (for HTTP 500) HTTPChaos CRDs are installed.')}
          </div>
        )}

        {/* Telemetry & Observability Pipeline Indicator */}
        <div 
          className="telemetry-pipeline-strip"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '10px 16px',
            borderRadius: '10px',
            marginBottom: '20px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Radio size={14} className="text-primary pulse-icon" />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#f1f5f9', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              Telemetry Pipeline:
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px', color: '#93c5fd' }}>
              <BarChart3 size={13} /> <strong>Prometheus:</strong> Scrapes Metrics (CPU, Mem, Latency, Errors)
            </span>
            <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px', color: '#fcd34d' }}>
              <Layers size={13} /> <strong>Grafana:</strong> Dashboard Visualizations &amp; SLO Alerting
            </span>
            <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px', color: '#a7f3d0' }}>
              <Terminal size={13} /> <strong>Kubernetes Logs:</strong> Pod lifecycle &amp; Kubelet Probes
            </span>
            <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px', color: '#f43f5e' }}>
              <Flame size={13} /> <strong>{selectedEngine}:</strong> Active Injector
            </span>
          </div>
        </div>

        {/* Navigation Tabs for Chaos Suite Views */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
          <button
            onClick={() => setActiveTab('EXPERIMENTS')}
            style={{
              background: activeTab === 'EXPERIMENTS' ? 'rgba(244, 63, 94, 0.15)' : 'transparent',
              border: activeTab === 'EXPERIMENTS' ? '1px solid rgba(244, 63, 94, 0.4)' : '1px solid transparent',
              color: activeTab === 'EXPERIMENTS' ? '#fda4af' : '#94a3b8',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Flame size={14} /> Fault Experiment Studio
          </button>
          <button
            onClick={() => setActiveTab('K8S_LOGS')}
            style={{
              background: activeTab === 'K8S_LOGS' ? 'rgba(14, 165, 233, 0.15)' : 'transparent',
              border: activeTab === 'K8S_LOGS' ? '1px solid rgba(14, 165, 233, 0.4)' : '1px solid transparent',
              color: activeTab === 'K8S_LOGS' ? '#7dd3fc' : '#94a3b8',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Terminal size={14} /> Kubernetes &amp; Chaos Telemetry Logs
            {activeChaosEvent?.kubernetesLogs && activeChaosEvent.kubernetesLogs.length > 0 && (
              <span style={{ background: '#0284c7', color: '#fff', fontSize: '10px', padding: '1px 6px', borderRadius: '10px' }}>
                {activeChaosEvent.kubernetesLogs.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('SELF_HEALING_AUDIT')}
            style={{
              background: activeTab === 'SELF_HEALING_AUDIT' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              border: activeTab === 'SELF_HEALING_AUDIT' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
              color: activeTab === 'SELF_HEALING_AUDIT' ? '#6ee7b7' : '#94a3b8',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ShieldCheck size={14} /> Self-Healing Assessment Engine (Validation)
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            style={{
              background: activeTab === 'HISTORY' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
              border: activeTab === 'HISTORY' ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid transparent',
              color: activeTab === 'HISTORY' ? '#d8b4fe' : '#94a3b8',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <History size={14} /> Experiment History <span>({experimentHistory.length})</span>
          </button>
        </div>

        {/* TAB 1: EXPERIMENTS STUDIO */}
        {activeTab === 'EXPERIMENTS' && (
          <>
            {/* Active Chaos Tracker inside Chaos Suite */}
            <div
              className="status-log-card-in-chaos"
              style={{ marginBottom: '20px', padding: '16px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '12px', border: '1px solid rgba(244, 63, 94, 0.25)' }}
            >
              <div className="card-header-flex">
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <Flame size={16} className="text-danger" /> Active Chaos Fault Tracker &amp; Experiment Validator
                </h3>
                {activeFaults.length > 0 && (
                  <button className="btn-heal-all" onClick={onClearAllChaos}>
                    <Trash2 size={12} /> Clear &amp; Heal All
                  </button>
                )}
              </div>

              <div className="log-container" style={{ marginTop: '12px' }}>
                {activeFaults.length > 0 ? (
                  <div className="active-faults-list">
                    {activeFaults.map(f => (
                      <div key={f.id} className="active-fault-item">
                        <div className="fault-item-header">
                          <span className={`ft-badge ${f.badgeClass}`}>{f.faultName}</span>
                          <span className="fault-target">Target: <code>{f.targetId}</code></span>
                          <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: 'auto' }}>
                            Engine: <strong style={{ color: '#fb7185' }}>{selectedEngine}</strong>
                          </span>
                        </div>
                        <div className="fault-progress-bar">
                          <div
                            className="fault-progress-fill"
                            style={{ width: `${(f.remainingSec / f.duration) * 100}%` }}
                          ></div>
                        </div>
                        <div className="fault-item-footer">
                          <span>Healing in: <strong>{f.remainingSec}s</strong></span>
                          <button className="btn-heal-single" onClick={() => onHealService(f.targetId)}>
                            Trigger Self-Heal Now
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : activeChaosEvent && !activeChaosEvent.status.toLowerCase().includes('healed') && !activeChaosEvent.status.toLowerCase().includes('recovered') ? (
                  <div className="log-event-box injected">
                    <div className="event-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Flame className="event-icon" size={16} />
                        <strong>Active Experiment: {activeChaosEvent.experimentName || activeChaosEvent.type}</strong>
                      </div>
                      <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px' }}>
                        Engine: <strong>{activeChaosEvent.engine || selectedEngine}</strong>
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginTop: '10px' }}>
                      <div><span style={{ color: '#94a3b8', fontSize: '11px' }}>Target Service:</span> <br/><code>{activeChaosEvent.service}</code></div>
                      <div><span style={{ color: '#94a3b8', fontSize: '11px' }}>Injected Fault:</span> <br/><strong>{activeChaosEvent.type}</strong></div>
                      <div><span style={{ color: '#94a3b8', fontSize: '11px' }}>Status:</span> <br/><span className="status-badge">{activeChaosEvent.status}</span></div>
                    </div>
                  </div>
                ) : (
                  <div className="log-empty" style={{ padding: '16px 0' }}>
                    <Activity size={24} className="pulse-icon text-text-dim" />
                    <p style={{ fontSize: '13px', margin: '4px 0 0 0' }}>No active chaos faults running.</p>
                    <p className="subtext" style={{ fontSize: '12px' }}>
                      Select <strong>{selectedEngine}</strong> parameters and click "INJECT FAULT EXPERIMENT" inside any card below.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Self-Contained Fault Cards Grid */}
            <div className="fault-cards-studio-grid">
              {mockFaultTypes.map(f => {
                const settings = cardSettings[f.id] || { target: 'all', duration: 15, latencyMs: 2500, errorRate: 35 };
                const selectedTarget = settings.target === 'all'
                  || services.some(service => service.id === settings.target)
                  || chaosMeshTargets.some(target => target.id === settings.target)
                  ? settings.target
                  : 'all';
                const meshTarget = chaosMeshTargets.find(target => target.id === settings.target) ?? chaosMeshTargets[0];
                const activeTarget = selectedEngine === 'Chaos Mesh'
                  ? selectedTarget === 'all' ? 'all' : meshTarget?.id ?? ''
                  : selectedTarget;
                const requiresSingleTarget = ['HIGH_CPU', 'HIGH_MEMORY', 'CASCADING_FAILURE', 'POD_RESTART'].includes(f.id);
                const selectedTargetSupported = selectedEngine === 'Chaos Mesh'
                  ? selectedTarget === 'all'
                    ? chaosMeshTargets.length > 0 && ['SERVICE_DOWN', 'LATENCY'].includes(f.id)
                    : Boolean(meshTarget) && ['SERVICE_DOWN', 'POD_RESTART', 'API_ERROR', 'LATENCY', 'HIGH_CPU', 'HIGH_MEMORY'].includes(f.id)
                  : selectedTarget === 'all'
                    ? canInjectChaos && !requiresSingleTarget
                    : services.some(service => service.id === selectedTarget && service.chaosSupported === true && service.status !== 'OFFLINE');
                const runningFault = activeFaults.find(fault => fault.targetId === activeTarget && fault.faultType === f.id);

                return (
                  <div key={f.id} className="fault-card-standalone">
                    <div className="fc-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className={`ft-badge ${f.badgeClass}`}>{f.name}</span>
                      <span style={{ fontSize: '10px', color: '#fb7185', fontWeight: 600 }}>
                        {selectedEngine}
                      </span>
                    </div>
                    <p className="fc-desc">{f.desc}</p>

                    <div className="fc-controls">
                      {/* Target Selector */}
                      <div className="fc-group">
                        <label>Target Microservice:</label>
                        <select
                          className="chaos-select-sm"
                          data-engine={selectedEngine}
                          value={activeTarget}
                          onChange={e => onUpdateCardSetting(f.id, 'target', e.target.value)}
                        >
                          {!activeTarget && <option value="">No supported target available</option>}
                          {selectedEngine === 'Chaos Mesh' && chaosMeshTargets.map(target => (
                            <option key={target.id} value={target.id}>{target.name} — {target.namespace}/{target.podName} ({target.status})</option>
                          ))}
                          <option value="all">⚡ ALL MICROSERVICES (Cluster Wide)</option>
                          {services.map(s => (
                            <option key={s.id} value={s.id} hidden={selectedEngine === 'Chaos Mesh'}>
                              {s.name}{s.port ? ` (Port ${s.port})` : ''} — {s.status}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Duration Slider */}
                      <div className="fc-group">
                        <label>Duration: <strong>{settings.duration}s</strong></label>
                        <input
                          type="range"
                          min="5"
                          max="60"
                          value={settings.duration}
                          onChange={e => onUpdateCardSetting(f.id, 'duration', parseInt(e.target.value))}
                          className="chaos-slider-sm"
                        />
                      </div>

                      {/* Fault-specific parameters */}
                      {f.id === 'LATENCY' && (
                        <div className="fc-group">
                          <label>Injected Latency Delay: <strong>{settings.latencyMs} ms</strong></label>
                          <input
                            type="range"
                            min="500"
                            max="5000"
                            step="250"
                            value={settings.latencyMs}
                            onChange={e => onUpdateCardSetting(f.id, 'latencyMs', parseInt(e.target.value))}
                            className="chaos-slider-sm"
                          />
                        </div>
                      )}

                      {f.id === 'API_ERROR' && (
                        <div className="fc-group">
                          <label>{selectedEngine === 'Chaos Mesh' ? 'Affected Pod Percentage' : 'API Error Rate Spike'}: <strong>{settings.errorRate}%</strong></label>
                          <input
                            type="range"
                            min="10"
                            max="100"
                            step="5"
                            value={settings.errorRate}
                            onChange={e => onUpdateCardSetting(f.id, 'errorRate', parseInt(e.target.value))}
                            className="chaos-slider-sm"
                          />
                        </div>
                      )}
                    </div>

                    {/* Inject Button */}
                    <button
                      className="btn-trigger-chaos-card"
                      disabled={Boolean(runningFault) || !selectedTargetSupported || (selectedEngine === 'Docker Compose' && !composeFaultTypes.has(f.id))}
                      onClick={() => {
                        if (selectedEngine === 'Docker Compose' && selectedTarget === 'all' && !window.confirm(`Inject ${f.name} into all supported microservices for ${settings.duration} seconds?`)) return;
                        if (selectedEngine === 'Chaos Mesh' && activeTarget === 'all' && !window.confirm(`Inject ${f.name} into all ${chaosMeshTargets.length} core-product Pods for ${settings.duration} seconds?`)) return;
                        onInjectFault(f.id, activeTarget, settings.duration, settings.latencyMs, settings.errorRate, selectedEngine);
                      }}
                    >
                      <Play size={14} fill="currentColor" /> {runningFault ? `FAULT ACTIVE · ${runningFault.remainingSec}s` : selectedEngine === 'Chaos Mesh' ? !chaosMeshTargets.length ? 'NO KUBERNETES POD TARGETS' : selectedTarget === 'all' && !selectedTargetSupported ? 'SELECT ONE POD TARGET' : !selectedTargetSupported ? 'NOT SUPPORTED BY CHAOS MESH' : 'INJECT CHAOS MESH FAULT' : !canInjectChaos ? 'CHECK TOKEN AND SERVICE TARGETS' : requiresSingleTarget && selectedTarget === 'all' ? 'SELECT ONE SERVICE TARGET' : !selectedTargetSupported ? 'SELECT SUPPORTED TARGET' : !composeFaultTypes.has(f.id) ? 'NOT SUPPORTED FOR COMPOSE TARGET' : 'INJECT REAL SERVICE FAULT'}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* TAB 2: KUBERNETES & CHAOS TELEMETRY LOGS */}
        {activeTab === 'K8S_LOGS' && (
          <div style={{ background: '#0a0f1d', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={18} className="text-primary" />
                <h3 style={{ margin: 0, fontSize: '14px', color: '#f8fafc' }}>
                  Live Service Telemetry &amp; Docker Compose Fault Event Stream
                </h3>
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                Sources: <code>Docker Compose fault middleware</code> · <code>Prometheus</code> · <code>Live probe engine</code>
              </span>
            </div>

            <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: 'monospace', fontSize: '12px' }}>
              {activeChaosEvent?.kubernetesLogs && activeChaosEvent.kubernetesLogs.length > 0 ? (
                activeChaosEvent.kubernetesLogs.map((log, idx) => {
                  let badgeBg = 'rgba(59, 130, 246, 0.15)';
                  let badgeColor = '#93c5fd';
                  if (log.source === 'Kubernetes') { badgeBg = 'rgba(16, 185, 129, 0.15)'; badgeColor = '#6ee7b7'; }
                  if (log.source === 'Prometheus') { badgeBg = 'rgba(245, 158, 11, 0.15)'; badgeColor = '#fcd34d'; }
                  if (log.source === 'Grafana') { badgeBg = 'rgba(168, 85, 247, 0.15)'; badgeColor = '#e9d5ff'; }
                  if (log.source === 'Chaos Mesh' || log.source === 'Docker Compose') { badgeBg = 'rgba(244, 63, 94, 0.15)'; badgeColor = '#fda4af'; }

                  return (
                    <div 
                      key={idx}
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        borderLeft: `3px solid ${log.level === 'WARN' || log.level === 'ERROR' ? '#f43f5e' : '#0ea5e9'}`,
                        borderRadius: '4px',
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'flex-start'
                      }}
                    >
                      <span style={{ color: '#64748b', minWidth: '75px' }}>{log.timestamp}</span>
                      <span style={{ background: badgeBg, color: badgeColor, padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
                        {log.source}
                      </span>
                      <span style={{ color: log.level === 'WARN' ? '#fcd34d' : log.level === 'ERROR' ? '#fda4af' : '#cbd5e1', flex: 1 }}>
                        {log.message}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                  <Terminal size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                  <p style={{ margin: 0 }}>No chaos event logs recorded yet.</p>
                  <p style={{ fontSize: '11px', marginTop: '4px' }}>Launch a Chaos experiment to stream real-time Kubernetes pod and Prometheus alerts.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SELF-HEALING ASSESSMENT ENGINE (KUBERNETES VALIDATION) */}
        {activeTab === 'SELF_HEALING_AUDIT' && (
          <div style={{ background: 'rgba(15, 23, 42, 0.8)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={20} className="text-success" />
                  Live Microservice Self-Healing Signals
                </h3>
                <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '12px' }}>
                  {isMeshActive ? 'Uses Kubernetes-observed core-product Pod readiness and restart counts while the Chaos Mesh experiment is active.' : 'Uses Prometheus-discovered core-product services; Kubernetes-only pod and HPA results are not mixed into these values.'}
                </p>
              </div>

              <div style={{ background: coreProductConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', border: `1px solid ${coreProductConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`, padding: '6px 14px', borderRadius: '8px' }}>
                <span style={{ fontSize: '11px', color: coreProductConnected ? '#6ee7b7' : '#fcd34d', fontWeight: 700 }}>
                  {isMeshActive ? `KUBERNETES: ${kubernetesConnected ? 'CONNECTED' : 'NOT CONNECTED'}` : `CORE PROMETHEUS: ${coreProductConnected ? 'CONNECTED' : 'NOT CONNECTED'}`}
                </span>
              </div>
            </div>

            <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: '12px', lineHeight: 1.5 }}>
              {isMeshActive && kubernetesValidation
                ? `Kubernetes core-product Pod state refreshes every 5 seconds. Restarts are container restart counters; ready/desired replicas show current availability. CPU and memory usage require the Kubernetes Metrics API.`
                : coreProductConnected
                ? 'Service health is refreshed every 5 seconds from the core product Prometheus targets. Process restarts are detected from process_start_time_seconds since this resilience API started; recoveries count observed OFFLINE-to-HEALTHY transitions.'
                : 'Core product Prometheus is unavailable. Start its four services and Prometheus to show live microservice signals. Pod replacement and HPA require running these services as Kubernetes workloads.'}
            </p>

            {/* Validation Checklist Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Core Microservice Health</span>
                  <Activity size={16} className="text-text-muted" />
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
                  {isMeshActive ? kubernetesValidation ? `${kubernetesValidation.readyReplicas} / ${kubernetesValidation.desiredReplicas} healthy` : 'Unavailable' : coreProductConnected ? `${coreHealthyCount} / ${coreServices.length} healthy` : 'Unavailable'}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  {isMeshActive ? kubernetesValidation?.coreServices.map(service => `${service.name}: ${service.readyPodCount}/${service.podCount} ready`).join(' · ') || 'Waiting for Kubernetes core-product Pods' : coreServices.length ? coreServices.map(service => `${service.name}: ${service.status}${service.processUptimeSeconds != null ? `, uptime ${Math.floor(service.processUptimeSeconds)}s` : ''}`).join(' · ') : 'Core product services discovered from Prometheus'}
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#cbd5e1' }}>App Process Restarts</span>
                  <Activity size={16} className="text-text-muted" />
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
                  {isMeshActive ? kubernetesValidation ? `${kubernetesValidation.podRestartCount} observed` : 'Unavailable' : !coreProductConnected ? 'Unavailable' : hasProcessRestartMetrics ? `${observedProcessRestarts} observed` : 'Metrics unavailable'}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  {isMeshActive ? 'Container restarts and replaced Pod identities observed for the four core-product services since the collector started.' : 'Based on app process start-time changes since the resilience API started; not a lifetime Docker restart counter.'}
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Service Recovery Events</span>
                  <Activity size={16} className="text-text-muted" />
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
                  {isMeshActive ? kubernetesConnected ? 'Live Kubernetes state' : 'Unavailable' : coreProductConnected ? `${observedRecoveries} observed` : 'Unavailable'}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', lineHeight: 1.5 }}>
                  {isMeshActive ? 'Ready replicas refresh every 5 seconds; short outages between polls may not be counted.' : 'Count of OFFLINE-to-HEALTHY service transitions observed during polling; short outages between polls may not be counted.'}
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Kubernetes-Only Actions</span>
                  <ShieldCheck size={16} className="text-text-muted" />
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
                  {isMeshActive ? kubernetesValidation ? `${kubernetesValidation.readyReplicas}/${kubernetesValidation.desiredReplicas} replicas ready` : 'Unavailable' : coreProductConnected ? 'Not applicable' : 'Unavailable'}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  {isMeshActive ? `${kubernetesValidation?.hpas.length ?? 0} core-product HPA(s); circuit-breaker metrics are not instrumented.` : 'Pod replacement and HPA do not apply to Docker Compose services; circuit-breaker metrics are not instrumented in the core product.'}
                </div>
              </div>
            </div>

            {/* Metrics Snapshot Before vs After Chaos */}
            {activeChaosEvent?.metricsSnapshot && (
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#e2e8f0' }}>
                  Fault Experiment Snapshot (Application-Level)
                </h4>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '12px' }}>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Baseline Probe Availability:</span>{' '}
                    <strong style={{ color: '#6ee7b7' }}>{activeChaosEvent.metricsSnapshot.preChaosAvailability}%</strong>
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Estimated Degraded Availability:</span>{' '}
                    <strong style={{ color: '#fda4af' }}>{activeChaosEvent.metricsSnapshot.postChaosAvailability}%</strong>
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Configured Error Injection:</span>{' '}
                    <strong style={{ color: '#fcd34d' }}>+{activeChaosEvent.metricsSnapshot.errorRateSpike}%</strong>
                  </div>
                  {activeChaosEvent.metricsSnapshot.mttrObservedSec && (
                    <div>
                      <span style={{ color: '#94a3b8' }}>Measured Recovery Time (MTTR):</span>{' '}
                      <strong style={{ color: '#38bdf8' }}>{activeChaosEvent.metricsSnapshot.mttrObservedSec}s</strong>
                    </div>
                  )}
                </div>
                <p style={{ margin: '10px 0 0', color: '#64748b', fontSize: '11px' }}>
                  These values describe the application-level experiment; they are not Kubernetes pod or cluster measurements.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'HISTORY' && (
          <div style={{ background: 'rgba(15, 23, 42, 0.75)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', padding: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} style={{ color: '#c084fc' }} /> Recorded Chaos Experiments
              </h3>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Refreshes every 5 seconds · {experimentHistory.length} experiments</span>
            </div>
            {historyLoading && <p style={{ color: '#94a3b8', fontSize: '13px' }}>Loading experiment history…</p>}
            {historyError && <p style={{ color: '#fda4af', fontSize: '13px' }}>{historyError}. Check that the resilience API is running.</p>}
            {!historyLoading && !historyError && experimentHistory.length === 0 && (
              <p style={{ color: '#94a3b8', fontSize: '13px' }}>No experiments recorded yet. Inject a fault to add the first result.</p>
            )}
            {experimentHistory.length > 0 && (
              <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
                <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#0f172a', color: '#94a3b8' }}>
                    <tr>{['Started', 'Fault / Target', 'Duration', 'R-Score (before → during → after)', 'Availability (before → during → after)', 'Recovery', 'Status'].map(label =>
                      <th key={label} style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}>{label}</th>
                    )}</tr>
                  </thead>
                  <tbody>
                    {[...experimentHistory].reverse().map(experiment => (
                      <tr key={`${experiment.experimentName}-${experiment.injectedAt}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#cbd5e1' }}>
                        <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>{new Date(experiment.injectedAt).toLocaleString()}</td>
                        <td style={{ padding: '10px' }}><strong style={{ color: '#fda4af' }}>{faultLabels[experiment.faultType] ?? experiment.faultType}</strong><div style={{ color: '#64748b', marginTop: '3px' }}>{experiment.serviceName}</div></td>
                        <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>{experiment.durationSec}s</td>
                        <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>{experiment.scoreBefore} → {experiment.scoreDuring ?? '—'} → {experiment.scoreAfter ?? '—'}</td>
                        <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>{experiment.availabilityBefore}% → {experiment.availabilityDuring ?? '—'}% → {experiment.availabilityAfter ?? '—'}%</td>
                        <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>{experiment.recoveryTimeSec != null ? `${experiment.recoveryTimeSec}s` : experiment.completedAt ? 'Recovered' : '—'}</td>
                        <td style={{ padding: '10px', color: experiment.status === 'RECOVERED' ? '#6ee7b7' : experiment.status === 'RUNNING' ? '#fcd34d' : '#94a3b8' }}>{experiment.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab !== 'HISTORY' && <>
        {/* Microservice Health Grid */}
        <h3 className="section-subheading" style={{ marginTop: '24px' }}>Services Cluster Health</h3>
        {selectedEngine === 'Chaos Mesh' && displayedServices.length === 0 && <p className="empty-services-message">No Kubernetes core-product Pods found. Deploy the services to Kubernetes and make sure the Kubernetes API is connected.</p>}
        {selectedEngine === 'Docker Compose' && displayedServices.length === 0 && <p className="empty-services-message">No live service targets found. Start the core product and its Prometheus service on port 9090.</p>}
        <div className="services-grid">
          {displayedServices.map(s => {
            const isOffline = s.status === 'OFFLINE';
            const isDegraded = s.status === 'DEGRADED';
            return (
              <div key={s.id} className={`service-item-card ${s.status.toLowerCase()}`}>
                <div className="svc-header">
                  <span className="svc-port">{s.port ? `:${s.port}` : 'PORT —'}</span>
                  <span className={`svc-indicator ${s.status.toLowerCase()}`}></span>
                </div>
                <h3>{s.name}</h3>

                <div className="svc-stats">
                  <div className="stat-sub">
                    <span>Restarts:</span>
                    <strong>{s.restarts ?? 'N/A'}</strong>
                  </div>
                  <div className="stat-sub">
                    <span>Status:</span>
                    <strong className={`status-${s.status.toLowerCase()}`}>
                      {s.status} {s.faultType ? `(${s.faultType})` : ''}
                    </strong>
                  </div>
                </div>

                <div className="action-container">
                  {s.chaosSupported === false ? (
                    <span className="chaos-unavailable">Prometheus monitoring only. Set the shared token and rebuild both projects to enable HTTP fault injection.</span>
                  ) : isOffline || isDegraded ? (
                    <button className="btn-heal-card" onClick={() => onHealService(s.id)}>
                      Trigger Self-Healing
                    </button>
                  ) : (
                    <button
                      className="btn-chaos"
                      onClick={() => onInjectFault('SERVICE_DOWN', s.id, 15, 2500, 35, selectedEngine)}
                    >
                      <Play size={12} fill="currentColor" /> Inject via {selectedEngine}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </>}
      </div>
    </section>
  );
};
