import numpy as np
import pandas as pd
from typing import Dict, Any

# Normalizes disparate telemetry units (CPU millicores, RAM megabytes, latency milliseconds, RPS)
# into a standardized [0.0, 1.0] interval using predetermined Kubernetes operational bounds.
class TelemetryNormalizer:
    # Defines standard production min-max bounding thresholds for container workloads.
    def __init__(self):
        self.bounds = {
            'cpu_millicores': {'min': 0.0, 'max': 2000.0},
            'memory_mb': {'min': 0.0, 'max': 4096.0},
            'p95_latency_ms': {'min': 0.0, 'max': 2000.0},
            'p99_latency_ms': {'min': 0.0, 'max': 5000.0},
            'error_rate': {'min': 0.0, 'max': 1.0},
            'rps': {'min': 0.0, 'max': 2000.0}
        }

    # Scales an individual metric value using Min-Max scaling and clamps the result between 0.0 and 1.0.
    def normalize_feature(self, value: float, feature_name: str) -> float:
        if feature_name not in self.bounds:
            return min(1.0, max(0.0, value))
        
        f_min = self.bounds[feature_name]['min']
        f_max = self.bounds[feature_name]['max']
        
        if f_max == f_min:
            return 0.0
            
        norm_val = (value - f_min) / (f_max - f_min)
        return float(np.clip(norm_val, 0.0, 1.0))

    # Iterates over a telemetry record dictionary and creates normalized companion fields for numeric entries.
    def normalize_record(self, record: Dict[str, Any]) -> Dict[str, float]:
        normalized = {}
        for k, v in record.items():
            if isinstance(v, (int, float)):
                normalized[f"{k}_norm"] = self.normalize_feature(float(v), k)
            else:
                normalized[k] = v
        return normalized
