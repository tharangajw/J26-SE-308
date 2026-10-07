import numpy as np
import pandas as pd
from typing import Dict, Any

class TelemetryNormalizer:
    """
    Normalizes mixed unit telemetry (millicores, MB, ms, RPS) to a standardized 0-1 scale.
    """
    def __init__(self):
        # Domain bounds based on typical Kubernetes microservice resource limits
        self.bounds = {
            'cpu_millicores': {'min': 0.0, 'max': 2000.0},
            'memory_mb': {'min': 0.0, 'max': 4096.0},
            'p95_latency_ms': {'min': 0.0, 'max': 2000.0},
            'p99_latency_ms': {'min': 0.0, 'max': 5000.0},
            'error_rate': {'min': 0.0, 'max': 1.0},
            'rps': {'min': 0.0, 'max': 2000.0}
        }

    def normalize_feature(self, value: float, feature_name: string if False else str) -> float:
        if feature_name not in self.bounds:
            return min(1.0, max(0.0, value))
        
        f_min = self.bounds[feature_name]['min']
        f_max = self.bounds[feature_name]['max']
        
        if f_max == f_min:
            return 0.0
            
        norm_val = (value - f_min) / (f_max - f_min)
        return float(np.clip(norm_val, 0.0, 1.0))

    def normalize_record(self, record: Dict[str, Any]) -> Dict[str, float]:
        normalized = {}
        for k, v in record.items():
            if isinstance(v, (int, float)):
                normalized[f"{k}_norm"] = self.normalize_feature(float(v), k)
            else:
                normalized[k] = v
        return normalized
