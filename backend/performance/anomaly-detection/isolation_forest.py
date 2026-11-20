import json
import os
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from typing import Dict, Any, List, Optional
from prefilter import PodStartupFilter


# Unsupervised anomaly detection service combining scikit-learn Isolation Forest
# with a 90-second Kubernetes startup pre-filter and Explainable AI (XAI) attribution.
class AnomalyDetectionService:
    # Initializes model hyperparameters (contamination, n_estimators), sets up the startup
    # suppression filter, and loads historical training snapshots from disk.
    def __init__(
        self,
        contamination: float = 0.05,
        n_estimators: int = 100,
        storage_path: Optional[str] = None,
    ):
        self.contamination = contamination
        self.n_estimators = n_estimators
        self.model = IsolationForest(
            contamination=self.contamination,
            n_estimators=self.n_estimators,
            random_state=42,
        )
        self.prefilter = PodStartupFilter(startup_window_sec=90.0)
        self.is_trained = False
        self.baseline_medians = np.array([0.15, 0.15, 0.10, 0.0])
        self.feature_names = [
            "CPU Saturation",
            "Memory Footprint",
            "P95 Latency Spike",
            "Error Rate Surge",
        ]
        self.storage_path = storage_path or os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "data",
            "real_training_samples.json",
        )
        self.real_training_samples: List[List[float]] = []
        self.max_training_samples = 1000
        self._samples_since_last_fit = 0

        # Live runtime tracking for Cao & Long 90s false-positive reduction calculation
        self.raw_outlier_count = 0
        self.suppressed_startup_outlier_count = 0

        self._load_and_fit_real_model()

    # Loads persisted telemetry samples from storage and fits the model;
    # falls back to a deterministic reference lattice if real samples are not yet available.
    def _load_and_fit_real_model(self) -> None:
        """Loads persisted real telemetry vectors from disk and fits the Isolation Forest model."""
        try:
            if os.path.exists(self.storage_path):
                with open(self.storage_path, "r", encoding="utf-8") as f:
                    loaded = json.load(f)
                if isinstance(loaded, list):
                    self.real_training_samples = [
                        [float(x) for x in row[:4]]
                        for row in loaded
                        if isinstance(row, list) and len(row) == 4
                    ]
        except Exception:
            self.real_training_samples = []

        if len(self.real_training_samples) >= 2:
            self._fit_on_samples(np.array(self.real_training_samples, dtype=float))
        else:
            # Deterministic reference lattice across normal operational bounds [0.02..0.40]
            # used only until live container snapshots are ingested
            grid_vals = np.linspace(0.02, 0.38, 10)
            lattice = [
                [float(c), float(m), float(c * 0.8), 0.0]
                for c in grid_vals
                for m in grid_vals
            ]
            self.model.fit(np.array(lattice, dtype=float))
            self.is_trained = True

    # Fits the Isolation Forest with verified training observations
    # and computes feature median baselines for subsequent XAI attribution.
    def _fit_on_samples(self, data: np.ndarray) -> None:
        if len(data) < 2:
            return
        self.model.fit(data)
        self.baseline_medians = np.median(data, axis=0)
        self.is_trained = True

    # Persists collected real telemetry vectors into the data directory
    # so learned cluster patterns survive service restarts.
    def _persist_training_samples(self) -> None:
        try:
            os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump(self.real_training_samples, f)
        except Exception:
            pass

    # Ingests live telemetry vectors outside the 90s startup window into an online buffer
    # and periodically refits the Isolation Forest to adapt to genuine cluster patterns.
    def record_real_telemetry_sample(
        self, feature_vector: List[float], pod_uptime_sec: float
    ) -> None:
        """
        Records a real normalized telemetry vector (outside the 90s startup window)
        and incrementally refits the Isolation Forest model on real cluster behavior.
        """
        if len(feature_vector) != 4:
            return
        if self.prefilter.is_in_startup_window(pod_uptime_sec):
            return
        if all(float(v) <= 0.0 for v in feature_vector):
            return

        clean_vec = [round(float(np.clip(v, 0.0, 1.0)), 4) for v in feature_vector]
        self.real_training_samples.append(clean_vec)
        if len(self.real_training_samples) > self.max_training_samples:
            del self.real_training_samples[
                0 : len(self.real_training_samples) - self.max_training_samples
            ]

        self._samples_since_last_fit += 1
        # Refit immediately during early collection or every 5 new snapshots
        if len(self.real_training_samples) <= 20 or self._samples_since_last_fit >= 5:
            self._fit_on_samples(np.array(self.real_training_samples, dtype=float))
            self._persist_training_samples()
            self._samples_since_last_fit = 0

    # Implements Explainable AI (XAI) via single-feature ablation to determine percentage
    # contributions of CPU, RAM, latency, and error rate, identifying the root-cause driver.
    def compute_feature_attributions(
        self, feature_vector: list, full_decision_score: float
    ) -> Dict[str, Any]:
        """
        Explainable AI (XAI): Computes marginal feature attribution percentages
        by ablating each feature to its normal operational median and measuring
        the Isolation Forest decision-function shift + magnitude exceedance.
        """
        vec = np.array(feature_vector, dtype=float)
        raw_impacts = np.zeros(4, dtype=float)

        for i in range(4):
            ablated = vec.copy()
            ablated[i] = self.baseline_medians[i]
            ablated_score = float(self.model.decision_function(ablated.reshape(1, -1))[0])
            marginal_shift = max(0.0, ablated_score - full_decision_score)
            exceedance = max(0.0, vec[i] - self.baseline_medians[i])
            raw_impacts[i] = marginal_shift * 2.5 + exceedance + (vec[i] * 0.15)

        total = float(np.sum(raw_impacts))
        if total <= 1e-6:
            pcts = [25.0, 25.0, 25.0, 25.0]
        else:
            pcts = [round(float(w / total * 100.0), 1) for w in raw_impacts]
            diff = round(100.0 - sum(pcts), 1)
            max_idx = int(np.argmax(pcts))
            pcts[max_idx] = round(pcts[max_idx] + diff, 1)

        dominant_idx = int(np.argmax(pcts))
        return {
            "cpuPercent": pcts[0],
            "memoryPercent": pcts[1],
            "latencyPercent": pcts[2],
            "errorPercent": pcts[3],
            "dominantDriver": self.feature_names[dominant_idx],
        }

    # Predicts runtime anomalies by verifying pod uptime against the startup window,
    # computing Isolation Forest outlier scores, and attributing dominant metric drivers.
    def predict(
        self,
        feature_vector: list,
        pod_uptime_sec: float = 120.0,
        record_for_training: bool = True,
    ) -> Dict[str, Any]:
        X = np.array(feature_vector, dtype=float).reshape(1, -1)
        decision_score = float(self.model.decision_function(X)[0])
        raw_pred_is_outlier = bool(self.model.predict(X)[0] == -1)
        attributions = self.compute_feature_attributions(feature_vector, decision_score)

        if raw_pred_is_outlier:
            self.raw_outlier_count += 1

        # Step 1: Pre-filter check (Cao & Long 90s rule)
        if self.prefilter.is_in_startup_window(pod_uptime_sec):
            if raw_pred_is_outlier:
                self.suppressed_startup_outlier_count += 1
            live_fpr_reduction = (
                round(
                    (self.suppressed_startup_outlier_count / self.raw_outlier_count) * 100.0,
                    2,
                )
                if self.raw_outlier_count > 0
                else 0.0
            )
            return {
                "is_anomaly": False,
                "anomaly_score": 0.0,
                "decision_function_score": 0.0,
                "prefiltered": True,
                "reason": f"Pod in startup window ({pod_uptime_sec}s < 90s)",
                "feature_attributions": attributions,
                "false_positive_reduction_percent": live_fpr_reduction,
                "trained_samples_count": len(self.real_training_samples),
            }

        # Feed real post-warmup observation into online training buffer
        if record_for_training:
            self.record_real_telemetry_sample(feature_vector, pod_uptime_sec)

        # Step 2: Isolation Forest Inference
        raw_anomaly_score = max(0.0, 0.25 - (decision_score * 3.5))
        norm_anomaly_score = min(1.0, float(raw_anomaly_score))

        return {
            "is_anomaly": raw_pred_is_outlier,
            "anomaly_score": round(norm_anomaly_score, 3),
            "decision_function_score": round(decision_score, 4),
            "prefiltered": False,
            "reason": f"Isolation Forest Evaluation (Primary Driver: {attributions['dominantDriver']})",
            "feature_attributions": attributions,
            "trained_samples_count": len(self.real_training_samples),
        }

    # Computes Precision, Recall, and False-Positive Reduction by testing model predictions
    # and startup suppression efficiency against labeled ground-truth benchmark datasets.
    def benchmark_performance(
        self, ground_truth_dataset: pd.DataFrame
    ) -> Dict[str, float]:
        """
        Evaluates Precision, Recall, and False-Positive Reduction against ground truth annotations.
        """
        tp, fp, fn, tn = 0, 0, 0, 0
        raw_fp = 0  # False positives without 90s pre-filter

        for _, row in ground_truth_dataset.iterrows():
            features = [
                row["cpu_norm"],
                row["memory_norm"],
                row["latency_norm"],
                row["error_rate"],
            ]
            uptime = row.get("pod_uptime_sec", 120.0)
            actual_label = row["is_anomaly"]  # True/False

            X = np.array(features, dtype=float).reshape(1, -1)
            raw_pred = self.model.predict(X)[0] == -1
            if raw_pred and not actual_label:
                raw_fp += 1

            result = self.predict(features, uptime, record_for_training=False)
            pred = result["is_anomaly"]

            if pred and actual_label:
                tp += 1
            elif pred and not actual_label:
                fp += 1
            elif not pred and actual_label:
                fn += 1
            else:
                tn += 1

        precision = tp / (tp + fp) if (tp + fp) > 0 else 1.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 1.0
        if raw_fp > 0:
            fpr_reduction = ((raw_fp - fp) / raw_fp) * 100.0
        elif self.raw_outlier_count > 0:
            fpr_reduction = (
                self.suppressed_startup_outlier_count / self.raw_outlier_count
            ) * 100.0
        else:
            fpr_reduction = 0.0

        return {
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "false_positive_reduction_percent": round(fpr_reduction, 2),
        }
