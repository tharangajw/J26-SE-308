import pandas as pd
import numpy as np

class TelemetryImputer:
    """
    Imputes missing values in time-series telemetry resulting from Prometheus scrape gaps
    or network delays using forward fill and linear interpolation.
    """
    def __init__(self, max_gap_seconds: int = 30):
        self.max_gap_seconds = max_gap_seconds

    def impute_missing_telemetry(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.empty:
            return df
        
        df_imputed = df.copy()
        numeric_cols = df_imputed.select_dtypes(include=[np.number]).columns
        
        # Forward-fill short scrape gaps, then apply linear interpolation
        df_imputed[numeric_cols] = df_imputed[numeric_cols].ffill(limit=3)
        df_imputed[numeric_cols] = df_imputed[numeric_cols].interpolate(method='linear', limit_direction='both')
        df_imputed[numeric_cols] = df_imputed[numeric_cols].fillna(0.0)
        
        return df_imputed
