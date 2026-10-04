import React from 'react';
import { Flame, Activity, Trash2, Play } from 'lucide-react';
import {
  mockFaultTypes,
  type Service,
  type CardSetting,
  type ActiveFault,
  type ActiveChaosEvent
} from '../../data/mockData';
import './ChaosEngineeringSuite.css';

interface ChaosEngineeringSuiteProps {
  services: Service[];
  activeFaults: ActiveFault[];
  activeChaosEvent: ActiveChaosEvent | null;
  cardSettings: Record<string, CardSetting>;
  onInjectFault: (
    faultType: string,
    target: string,
    duration: number,
    latencyMs: number,
    errorRate: number
  ) => void;
  onHealService: (serviceId: string) => void;
  onClearAllChaos: () => void;
  onUpdateCardSetting: (faultId: string, key: keyof CardSetting, value: string | number) => void;
}

export const ChaosEngineeringSuite: React.FC<ChaosEngineeringSuiteProps> = ({
  services,
  activeFaults,
  activeChaosEvent,
  cardSettings,
  onInjectFault,
  onHealService,
  onClearAllChaos,
  onUpdateCardSetting
}) => {
  return (
    <section className="chaos-lab-section">
      <div className="glass-card chaos-card">
        <div className="chaos-header">
          <Flame size={24} className="chaos-title-icon" />
          <div>
            <h2>Chaos Engineering Fault Injection Suite</h2>
            <p>Configure parameters and inject chaos experiments directly from each self-contained fault type card below</p>
          </div>
        </div>

        {/* Active Chaos Tracker inside Chaos Suite */}
        <div
          className="status-log-card-in-chaos"
          style={{ marginBottom: '20px', padding: '16px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '12px', border: '1px solid rgba(244, 63, 94, 0.25)' }}
        >
          <div className="card-header-flex">
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Flame size={16} className="text-danger" /> Active Chaos Fault Tracker
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
              <div className="log-empty" style={{ padding: '16px 0' }}>
                <Activity size={24} className="pulse-icon text-text-dim" />
                <p style={{ fontSize: '13px', margin: '4px 0 0 0' }}>No active chaos faults running.</p>
                <p className="subtext" style={{ fontSize: '12px' }}>Click "Inject Fault Experiment" inside any card below to launch an experiment.</p>
              </div>
            )}
          </div>
        </div>

        {/* Self-Contained Fault Cards Grid */}
        <div className="fault-cards-studio-grid">
          {mockFaultTypes.map(f => {
            const settings = cardSettings[f.id] || { target: 'gateway', duration: 15, latencyMs: 2500, errorRate: 35 };

            return (
              <div key={f.id} className="fault-card-standalone">
                <div className="fc-header">
                  <span className={`ft-badge ${f.badgeClass}`}>{f.name}</span>
                </div>
                <p className="fc-desc">{f.desc}</p>

                <div className="fc-controls">
                  {/* Target Selector */}
                  <div className="fc-group">
                    <label>Target Microservice:</label>
                    <select
                      className="chaos-select-sm"
                      value={settings.target}
                      onChange={e => onUpdateCardSetting(f.id, 'target', e.target.value)}
                    >
                      <option value="all">⚡ ALL MICROSERVICES (Cluster Wide)</option>
                      {services.map(s => (
                        <option key={s.id} value={s.id}>{s.name} (Port :{s.port})</option>
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
                      <label>API Error Rate Spike: <strong>{settings.errorRate}%</strong></label>
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
                  onClick={() => onInjectFault(f.id, settings.target, settings.duration, settings.latencyMs, settings.errorRate)}
                >
                  <Play size={14} fill="currentColor" /> INJECT FAULT EXPERIMENT
                </button>
              </div>
            );
          })}
        </div>

        {/* Microservice Health Grid */}
        <h3 className="section-subheading">Services Cluster Health</h3>
        <div className="services-grid">
          {services.map(s => {
            const isOffline = s.status === 'OFFLINE';
            const isDegraded = s.status === 'DEGRADED';
            return (
              <div key={s.id} className={`service-item-card ${s.status.toLowerCase()}`}>
                <div className="svc-header">
                  <span className="svc-port">:{s.port}</span>
                  <span className={`svc-indicator ${s.status.toLowerCase()}`}></span>
                </div>
                <h3>{s.name}</h3>

                <div className="svc-stats">
                  <div className="stat-sub">
                    <span>Restarts:</span>
                    <strong>{s.restarts}</strong>
                  </div>
                  <div className="stat-sub">
                    <span>Status:</span>
                    <strong className={`status-${s.status.toLowerCase()}`}>
                      {s.status} {s.faultType ? `(${s.faultType})` : ''}
                    </strong>
                  </div>
                </div>

                <div className="action-container">
                  {isOffline || isDegraded ? (
                    <button className="btn-heal-card" onClick={() => onHealService(s.id)}>
                      Heal Service
                    </button>
                  ) : (
                    <button
                      className="btn-chaos"
                      onClick={() => onInjectFault('SERVICE_DOWN', s.id, 15, 2500, 35)}
                    >
                      <Play size={12} fill="currentColor" /> Inject Fault
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
