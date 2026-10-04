import React, { useState } from 'react';
import {
  ResponsiveContainer as RechartsContainer,
  LineChart as RechartsLineChart,
  Line as RechartsLine,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
  CartesianGrid as RechartsCartesianGrid,
  Tooltip as RechartsTooltip,
  AreaChart as RechartsAreaChart,
  Area as RechartsArea
} from 'recharts';
import { type HistoryPoint } from '../../data/mockData';

interface TelemetryTrendsProps {
  history: HistoryPoint[];
}

export const TelemetryTrends: React.FC<TelemetryTrendsProps> = ({ history }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'system' | 'traffic'>('overview');

  return (
    <section className="charts-section">
      <div className="glass-card chart-card">
        <div className="chart-header">
          <div>
            <h2>Historical Telemetry Trends</h2>
            <p className="subtitle" style={{ marginTop: '4px' }}>Real-Time Prometheus &amp; Cluster Performance Graphs</p>
          </div>
          <div className="tab-buttons">
            <button
              className={activeTab === 'overview' ? 'active' : ''}
              onClick={() => setActiveTab('overview')}
            >
              Resilience Score
            </button>
            <button
              className={activeTab === 'system' ? 'active' : ''}
              onClick={() => setActiveTab('system')}
            >
              CPU &amp; Memory
            </button>
            <button
              className={activeTab === 'traffic' ? 'active' : ''}
              onClick={() => setActiveTab('traffic')}
            >
              Latency &amp; Errors
            </button>
          </div>
        </div>

        <div className="chart-container">
          {activeTab === 'overview' && (
            <RechartsContainer width="100%" height={380}>
              <RechartsAreaChart data={history}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <RechartsCartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <RechartsXAxis dataKey="timestamp" stroke="#64748b" />
                <RechartsYAxis domain={[0, 100]} stroke="#64748b" />
                <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }} />
                <RechartsArea
                  type="monotone"
                  dataKey="score"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorScore)"
                  name="Resilience Score"
                />
              </RechartsAreaChart>
            </RechartsContainer>
          )}

          {activeTab === 'system' && (
            <RechartsContainer width="100%" height={380}>
              <RechartsLineChart data={history}>
                <RechartsCartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <RechartsXAxis dataKey="timestamp" stroke="#64748b" />
                <RechartsYAxis domain={[0, 100]} stroke="#64748b" />
                <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }} />
                <RechartsLine type="monotone" dataKey="cpu" stroke="#10b981" strokeWidth={2} dot={false} name="CPU Load (%)" />
                <RechartsLine type="monotone" dataKey="memory" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Memory Load (%)" />
              </RechartsLineChart>
            </RechartsContainer>
          )}

          {activeTab === 'traffic' && (
            <RechartsContainer width="100%" height={380}>
              <RechartsLineChart data={history}>
                <RechartsCartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <RechartsXAxis dataKey="timestamp" stroke="#64748b" />
                <RechartsYAxis stroke="#64748b" />
                <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }} />
                <RechartsLine type="monotone" dataKey="latency" stroke="#f59e0b" strokeWidth={2} dot={false} name="Latency (ms)" />
                <RechartsLine type="monotone" dataKey="errorRate" stroke="#f43f5e" strokeWidth={2} dot={false} name="Error Rate (%)" />
              </RechartsLineChart>
            </RechartsContainer>
          )}
        </div>
      </div>
    </section>
  );
};
