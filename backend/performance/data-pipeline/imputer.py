import pandas as pd
import numpy as np

# Handles missing telemetry data points caused by Prometheus scrape gaps or network drops
# using a hybrid strategy of forward-filling and two-way linear interpolation.
class TelemetryImputer:
    # Initializes the imputer with a configurable maximum allowable gap threshold (in seconds).
    def __init__(self, max_gap_seconds: int = 30):
        self.max_gap_seconds = max_gap_seconds

    # Identifies numerical columns in the DataFrame and executes forward-fill (up to 3 intervals)
    # followed by bidirectional linear interpolation, zero-filling any remaining unresolvable NaNs.
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
