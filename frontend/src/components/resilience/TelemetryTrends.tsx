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
import './TelemetryTrends.css';

interface TelemetryTrendsProps {
  history: HistoryPoint[];
}

export const TelemetryTrends: React.FC<TelemetryTrendsProps> = ({ history }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'system' | 'traffic'>('overview');
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d' | 'all'>('24h');
  const rangeMs = { '1h': 60 * 60 * 1000, '6h': 6 * 60 * 60 * 1000, '24h': 24 * 60 * 60 * 1000, '7d': 7 * 24 * 60 * 60 * 1000 };
  const rangeStart = timeRange === 'all' ? 0 : Date.now() - rangeMs[timeRange];
  const filteredHistory = history
    .filter(point => {
      const time = Date.parse(point.timestamp);
      return Number.isFinite(time) && time >= rangeStart;
    })
    .sort((first, second) => Date.parse(first.timestamp) - Date.parse(second.timestamp));
  const sampleStep = Math.max(1, Math.ceil(filteredHistory.length / 2500));
  const chartHistory = filteredHistory.filter((_, index) => index % sampleStep === 0 || index === filteredHistory.length - 1);
  const formatTimestamp = (value: unknown) => {
    if (typeof value !== 'string') return String(value ?? '');
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

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

        <div className="chart-header" style={{ marginTop: '-12px', marginBottom: '16px' }}>
          <p className="subtitle">Showing {filteredHistory.length.toLocaleString()} samples</p>
          <div className="tab-buttons">
            {(['1h', '6h', '24h', '7d', 'all'] as const).map(range => (
              <button key={range} className={timeRange === range ? 'active' : ''} onClick={() => setTimeRange(range)}>
                {range === 'all' ? 'All saved' : range}
              </button>
            ))}
          </div>
        </div>

        <div className="chart-container">
          {chartHistory.length === 0 ? (
            <div className="empty-history-message">No saved telemetry is available for this time range yet.</div>
          ) : activeTab === 'overview' && (
            <RechartsContainer width="100%" height={380}>
              <RechartsAreaChart data={chartHistory}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <RechartsCartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <RechartsXAxis dataKey="timestamp" stroke="#64748b" tickFormatter={formatTimestamp} minTickGap={32} />
                <RechartsYAxis domain={[0, 100]} stroke="#64748b" />
                <RechartsTooltip labelFormatter={formatTimestamp} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }} />
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

          {chartHistory.length > 0 && activeTab === 'system' && (
            <RechartsContainer width="100%" height={380}>
              <RechartsLineChart data={chartHistory}>
                <RechartsCartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <RechartsXAxis dataKey="timestamp" stroke="#64748b" tickFormatter={formatTimestamp} minTickGap={32} />
                <RechartsYAxis domain={[0, 100]} stroke="#64748b" />
                <RechartsTooltip labelFormatter={formatTimestamp} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }} />
                <RechartsLine type="monotone" dataKey="cpu" stroke="#10b981" strokeWidth={2} dot={false} name="CPU Load (%)" />
                <RechartsLine type="monotone" dataKey="memory" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Memory Load (%)" />
              </RechartsLineChart>
            </RechartsContainer>
          )}

          {chartHistory.length > 0 && activeTab === 'traffic' && (
            <RechartsContainer width="100%" height={380}>
              <RechartsLineChart data={chartHistory}>
                <RechartsCartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <RechartsXAxis dataKey="timestamp" stroke="#64748b" tickFormatter={formatTimestamp} minTickGap={32} />
                <RechartsYAxis stroke="#64748b" />
                <RechartsTooltip labelFormatter={formatTimestamp} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }} />
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
