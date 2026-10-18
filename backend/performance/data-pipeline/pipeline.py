import pandas as pd
from typing import List, Dict, Any
from imputer import TelemetryImputer
from normalizer import TelemetryNormalizer

class DataPipelineEngine:
    def __init__(self):
        self.imputer = TelemetryImputer()
        self.normalizer = TelemetryNormalizer()

    def process_raw_snapshots(self, snapshots: List[Dict[str, Any]]) -> pd.DataFrame:
        if not snapshots:
            return pd.DataFrame()

        rows = []
        for snap in snapshots:
            prom = snap.get('prometheus', {})
            k8s = snap.get('k8s', {})
            row = {
                'service_id': snap.get('serviceId'),
                'timestamp': snap.get('timestamp'),
                'cpu_millicores': prom.get('cpuUsageMillicores', 0.0),
                'memory_mb': prom.get('memoryUsageMB', 0.0),
                'p95_latency_ms': prom.get('p95LatencyMs', 0.0),
                'p99_latency_ms': prom.get('p99LatencyMs', 0.0),
                'rps': prom.get('rps', 0.0),
                'pod_replicas': k8s.get('podReplicaCount', 1),
                'spin_up_lag_sec': k8s.get('podSpinUpLagSec', 0.0)
            }
            rows.append(row)

        df = pd.DataFrame(rows)
        
        # 1. Align Timestamps (5-second resample grid)
        df['datetime'] = pd.to_datetime(df['timestamp'], unit='ms')
        df = df.sort_values('datetime')
        
        # 2. Impute Scrape Gaps
        df = self.imputer.impute_missing_telemetry(df)
        
        # 3. 0-1 Normalization
        norm_cols = {}
        for col in ['cpu_millicores', 'memory_mb', 'p95_latency_ms', 'p99_latency_ms', 'rps']:
            norm_cols[f'{col}_norm'] = df[col].apply(lambda v: self.normalizer.normalize_feature(v, col))
            
        norm_df = pd.DataFrame(norm_cols)
        result_df = pd.concat([df, norm_df], axis=1)
        
        return result_df
