import { calculateOScore } from '../../lib/ahpEngine';

export const INITIAL_MOCK_HISTORY = Array.from({ length: 20 }).map((_, i) => ({
  timestamp: new Date(Date.now() - (20 - i) * 10000).toISOString(),
  oscore: 85 + Math.random() * 10 - 5,
  cci_index: 90 + Math.random() * 8 - 4,
  blind_spot_count: Math.random() > 0.8 ? 1 : 0
}));

const _details = {
  metrics_coverage_rate: 0.98,
  system_error_rate: 0.02,
  service_latency_p95_ms: 120.5,
  service_count: 6,
  log_structural_integrity: 0.99,
  log_error_count: 42,
  trace_id_propagation_rate: 0.95,
  avg_trace_duration_ms: 85.2
};

export const INITIAL_MOCK_DATA = {
  oscore: calculateOScore(
    _details.metrics_coverage_rate,
    _details.trace_id_propagation_rate,
    _details.log_structural_integrity,
    1,  // one blind spot in initial state
    2
  ),
  details: _details,
  scoring_weights: {
    blind_spot_penalty: 2
  }
};

export const INITIAL_MOCK_CCI = {
  cci_index: 92,
  total_events: 15,
  matched_events: 12,
  blind_spots: [
    { timestamp_utc: new Date().toISOString(), has_metric: true, has_trace: false, has_log: true, missing_pillars: ['Jaeger Trace'] }
  ],
  pillar_coverage: { metric: 0.98, trace: 0.85, log: 0.95 },
  event_source: 'prometheus'
};
