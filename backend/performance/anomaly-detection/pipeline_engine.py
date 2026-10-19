import time
import urllib.request
import urllib.parse
import json
from typing import Dict, List, Any, Optional
import numpy as np
import pandas as pd


class LiveTelemetryPipelineEngine:
    """
    Phase 2: Real-Time Telemetry Preprocessing, 5s Grid Alignment, Imputation,
    and Min-Max [0, 1] Normalization Engine written in Python (Pandas & NumPy).
    Zero random/synthetic fallback data.
    """

    def __init__(self, collector_url: str = "http://telemetry-collector:8787"):
        self.collector_url = collector_url
        # Rolling history of real snapshots per service: service_id -> list of raw dicts
        self.history_buffer: Dict[str, List[Dict[str, Any]]] = {}
        self.max_buffer_len = 36  # 3 minutes of 5s samples

        self.bounds = {
            "cpu_millicores": {"min": 0.0, "max": 2000.0},
            "memory_mb": {"min": 0.0, "max": 4096.0},
            "p95_latency_ms": {"min": 0.0, "max": 2000.0},
            "p99_latency_ms": {"min": 0.0, "max": 5000.0},
            "rps": {"min": 0.0, "max": 1000.0},
            "error_rate": {"min": 0.0, "max": 1.0},
        }

    def _fetch_json(self, path: str, timeout: float = 3.5) -> Optional[Dict[str, Any]]:
        urls = [
            f"{self.collector_url}{path}",
            f"http://localhost:8787{path}",
        ]
        for url in urls:
            try:
                req = urllib.request.Request(url, method="GET")
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    if resp.status == 200:
                        return json.loads(resp.read().decode("utf-8"))
            except Exception:
                continue
        return None

    def normalize_value(self, value: float, feature: str) -> float:
        b = self.bounds.get(feature)
        if not b or b["max"] <= b["min"]:
            return float(np.clip(value, 0.0, 1.0))
        norm = (float(value) - b["min"]) / (b["max"] - b["min"])
        return round(float(np.clip(norm, 0.0, 1.0)), 4)

    def ingest_live_snapshot(self, snap: Dict[str, Any]) -> Dict[str, Any]:
        service_id = snap.get("serviceId", "unknown")
        ts_ms = int(snap.get("timestamp") or int(time.time() * 1000))
        prom = snap.get("prometheus") or {}
        loki = snap.get("loki") or {}
        k8s = snap.get("k8s") or {}

        cpu = prom.get("cpuUsageMillicores")
        mem = prom.get("memoryUsageMB")
        p95 = prom.get("p95LatencyMs")
        p99 = prom.get("p99LatencyMs")
        avg_lat = prom.get("avgResponseTimeMs")
        rps = prom.get("rps")
        errors = int(loki.get("errorCount") or 0)
        replicas = int(k8s.get("podReplicaCount") or (1 if (cpu or mem or avg_lat) else 0))

        record = {
            "service_id": service_id,
            "timestamp_ms": ts_ms,
            "cpu_millicores": float(cpu) if cpu is not None else np.nan,
            "memory_mb": float(mem) if mem is not None else np.nan,
            "p95_latency_ms": float(p95) if p95 is not None else np.nan,
            "p99_latency_ms": float(p99) if p99 is not None else np.nan,
            "avg_latency_ms": float(avg_lat) if avg_lat is not None else np.nan,
            "rps": float(rps) if rps is not None else np.nan,
            "error_count": errors,
            "replica_count": replicas,
        }

        buf = self.history_buffer.setdefault(service_id, [])
        buf.append(record)
        if len(buf) > self.max_buffer_len:
            del buf[0 : len(buf) - self.max_buffer_len]

        return record

    def process_service_pipeline(
        self,
        service_id: str,
        imputation_method: str = "linear_interpolation",
    ) -> Dict[str, Any]:
        """
        Fetches live snapshot from Telemetry Collector (:8787), appends to time-series buffer,
        runs Pandas 5-second grid alignment, missing value imputation, and Min-Max [0, 1] scaling.
        """
        encoded = urllib.parse.quote(service_id)
        snap_resp = self._fetch_json(f"/api/telemetry/snapshot?services={encoded}")
        snapshots = (snap_resp or {}).get("snapshots") or []

        target_snap = None
        for s in snapshots:
            if s.get("serviceId") == service_id:
                target_snap = s
                break
        if not target_snap and snapshots:
            target_snap = snapshots[0]

        if target_snap:
            self.ingest_live_snapshot(target_snap)

        buf = self.history_buffer.get(service_id, [])
        if not buf:
            return {
                "serviceId": service_id,
                "hasTelemetry": False,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "pipelineEngine": "Python Pandas + NumPy Preprocessing Pipeline",
                "pipelineStatus": "NO_TELEMETRY_DATA",
                "rawInputs": {
                    "cpuUsageMillicores": 0.0,
                    "memoryUsageMB": 0.0,
                    "p95LatencyMs": 0.0,
                    "p99LatencyMs": 0.0,
                    "rps": 0.0,
                    "errorCount": 0,
                    "replicaCount": 0,
                },
                "imputedMetrics": {
                    "missingValuesDetected": 0,
                    "imputedFields": [],
                    "imputationMethod": imputation_method,
                    "samplesInWindow": 0,
                },
                "normalizedFeatures": {
                    "normalizedCpu": 0.0,
                    "normalizedMemory": 0.0,
                    "normalizedLatency": 0.0,
                    "normalizedRps": 0.0,
                    "normalizedErrorRate": 0.0,
                    "normalizedAvailability": 0.0,
                },
                "processedVectors": [0.0, 0.0, 0.0, 0.0, 0.0],
                "timeSeriesGrid": [],
            }

        df = pd.DataFrame(buf)
        df["grid_ts_ms"] = (df["timestamp_ms"] // 5000) * 5000

        numeric_cols = [
            "cpu_millicores",
            "memory_mb",
            "p95_latency_ms",
            "p99_latency_ms",
            "avg_latency_ms",
            "rps",
            "error_count",
            "replica_count",
        ]

        grid_df = df.groupby("grid_ts_ms", as_index=False)[numeric_cols].mean()
        grid_df = grid_df.sort_values("grid_ts_ms").reset_index(drop=True)

        # Reindex to continuous 5-second UTC grid if multiple points exist
        if len(grid_df) >= 2:
            min_ts = int(grid_df["grid_ts_ms"].min())
            max_ts = int(grid_df["grid_ts_ms"].max())
            # Cap grid range to last 2 minutes
            min_ts = max(min_ts, max_ts - 120_000)
            full_grid = pd.DataFrame({"grid_ts_ms": list(range(min_ts, max_ts + 5000, 5000))})
            grid_df = pd.merge(full_grid, grid_df, on="grid_ts_ms", how="left")

        # Count missing cells before imputation
        feature_cols = ["cpu_millicores", "memory_mb", "p95_latency_ms", "p99_latency_ms", "rps"]
        missing_mask = grid_df[feature_cols].isna()
        missing_count = int(missing_mask.sum().sum())
        imputed_field_names = [
            col for col in feature_cols if bool(missing_mask[col].any())
        ]

        # Apply Pandas imputation
        imputed_df = grid_df.copy()
        if imputation_method == "zero_fill":
            imputed_df[numeric_cols] = imputed_df[numeric_cols].fillna(0.0)
        elif imputation_method == "forward_fill":
            imputed_df[numeric_cols] = imputed_df[numeric_cols].ffill().bfill().fillna(0.0)
        else:
            imputed_df[numeric_cols] = (
                imputed_df[numeric_cols]
                .interpolate(method="linear", limit_direction="both")
                .ffill()
                .bfill()
                .fillna(0.0)
            )

        latest = imputed_df.iloc[-1]
        raw_cpu = round(float(latest["cpu_millicores"]), 2)
        raw_mem = round(float(latest["memory_mb"]), 2)
        raw_p95 = round(float(latest["p95_latency_ms"]), 2)
        raw_p99 = round(float(latest["p99_latency_ms"]), 2)
        raw_rps = round(float(latest["rps"]), 2)
        raw_err = int(round(float(latest["error_count"])))
        raw_rep = int(round(float(latest["replica_count"])))

        has_telemetry = bool(raw_cpu > 0 or raw_mem > 0 or raw_p95 > 0 or raw_rps > 0)

        norm_cpu = self.normalize_value(raw_cpu, "cpu_millicores")
        norm_mem = self.normalize_value(raw_mem, "memory_mb")
        norm_lat = self.normalize_value(raw_p95, "p95_latency_ms")
        norm_rps = self.normalize_value(raw_rps, "rps")
        norm_err = round(min(1.0, raw_err / 100.0), 4)
        norm_avail = 1.0 if (has_telemetry and raw_rep > 0) else 0.0

        # Build time-series array for charts
        ts_records = []
        for idx, row in imputed_df.tail(15).iterrows():
            ts_val = int(row["grid_ts_ms"])
            was_missing = bool(missing_mask.loc[idx].any()) if idx in missing_mask.index else False
            c_val = round(float(row["cpu_millicores"]), 2)
            m_val = round(float(row["memory_mb"]), 2)
            l_val = round(float(row["p95_latency_ms"]), 2)
            r_val = round(float(row["rps"]), 2)
            ts_records.append(
                {
                    "timeSlot": time.strftime("%H:%M:%S", time.gmtime(ts_val / 1000.0)),
                    "timestampMs": ts_val,
                    "serviceId": service_id,
                    "isImputed": was_missing,
                    "raw": {
                        "cpuMillicores": c_val,
                        "memoryMB": m_val,
                        "latencyMs": l_val,
                        "requestRateRps": r_val,
                    },
                    "normalized": {
                        "cpuMillicores": self.normalize_value(c_val, "cpu_millicores"),
                        "memoryMB": self.normalize_value(m_val, "memory_mb"),
                        "latencyMs": self.normalize_value(l_val, "p95_latency_ms"),
                        "requestRateRps": self.normalize_value(r_val, "rps"),
                    },
                }
            )

        return {
            "serviceId": service_id,
            "hasTelemetry": has_telemetry,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "pipelineEngine": "Python 3.11 (Pandas DataFrame 5s Resample + NumPy Min-Max Scaler)",
            "pipelineStatus": "COMPLETED_SUCCESSFULLY" if has_telemetry else "NO_ACTIVE_METRICS",
            "rawInputs": {
                "cpuUsageMillicores": raw_cpu,
                "memoryUsageMB": raw_mem,
                "p95LatencyMs": raw_p95,
                "p99LatencyMs": raw_p99,
                "rps": raw_rps,
                "errorCount": raw_err,
                "replicaCount": raw_rep if has_telemetry else 0,
            },
            "imputedMetrics": {
                "missingValuesDetected": missing_count,
                "imputedFields": imputed_field_names,
                "imputationMethod": f"Pandas {imputation_method} (5s UTC grid)",
                "samplesInWindow": len(imputed_df),
            },
            "normalizedFeatures": {
                "normalizedCpu": norm_cpu,
                "normalizedMemory": norm_mem,
                "normalizedLatency": norm_lat,
                "normalizedRps": norm_rps,
                "normalizedErrorRate": norm_err,
                "normalizedAvailability": norm_avail,
            },
            "processedVectors": [norm_cpu, norm_mem, norm_lat, norm_err, norm_avail],
            "timeSeriesGrid": ts_records,
        }
