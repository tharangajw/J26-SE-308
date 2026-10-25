import os
import time
import urllib.request
import urllib.parse
import json
import concurrent.futures
from typing import Dict, List, Any, Optional
import numpy as np
from isolation_forest import AnomalyDetectionService


SAATY_SCALE_VALUES = np.array(
    [
        1.0 / 9.0,
        1.0 / 8.0,
        1.0 / 7.0,
        1.0 / 6.0,
        1.0 / 5.0,
        1.0 / 4.0,
        1.0 / 3.0,
        1.0 / 2.0,
        1.0,
        2.0,
        3.0,
        4.0,
        5.0,
        6.0,
        7.0,
        8.0,
        9.0,
    ],
    dtype=float,
)


# Quantizes an arbitrary continuous importance ratio to the closest discrete
# value on Saaty's 1-9 fundamental Analytic Hierarchy Process (AHP) scale.
def _snap_to_saaty_scale(ratio: float) -> float:
    idx = int(np.argmin(np.abs(SAATY_SCALE_VALUES - ratio)))
    return float(SAATY_SCALE_VALUES[idx])


# Core evaluation engine that calculates composite P-Scores, validates AHP consistency,
# evaluates Apdex and tail-latency ratios, and simulates remediation impact projections.
class PScoreAndRecommendationEngine:
    # Initializes scoring weights (drift 0.4, fan-out 0.4, anomaly 0.2), links the ML anomaly
    # detector, and loads historical P-Score evaluations for trend visualization.
    def __init__(
        self,
        detector: AnomalyDetectionService,
        collector_url: str = "http://telemetry-collector:8787",
        history_path: Optional[str] = None,
    ):
        self.detector = detector
        self.collector_url = collector_url
        self.default_weights = {
            "drift": 0.40,
            "fanout": 0.40,
            "anomaly": 0.20,
        }
        self.history_path = history_path or os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "data",
            "pscore_history.json",
        )
        self.pscore_history: List[Dict[str, Any]] = []
        self.max_history_points = 40
        self._last_recorded_ts = 0.0
        self._load_pscore_history()

    # Loads the recent sliding history of cluster P-Score snapshots from persistent JSON storage.
    def _load_pscore_history(self) -> None:
        try:
            if os.path.exists(self.history_path):
                with open(self.history_path, "r", encoding="utf-8") as f:
                    loaded = json.load(f)
                if isinstance(loaded, list):
                    self.pscore_history = loaded[-self.max_history_points :]
        except Exception:
            self.pscore_history = []

    # Writes the in-memory P-Score trend history to disk for persistent dashboard charting.
    def _persist_pscore_history(self) -> None:
        try:
            os.makedirs(os.path.dirname(self.history_path), exist_ok=True)
            with open(self.history_path, "w", encoding="utf-8") as f:
                json.dump(self.pscore_history, f, indent=2)
        except Exception:
            pass

    # Records a new time-stamped cluster score snapshot with throttling (every 15s or on score shift)
    # to maintain an informative historical trajectory without flooding disk I/O.
    def _record_pscore_snapshot(
        self,
        overall_pscore: float,
        drift_health: float,
        fanout_health: float,
        anomaly_health: float,
        cluster_apdex: float,
    ) -> List[Dict[str, Any]]:
        if overall_pscore <= 0:
            return self.pscore_history

        now = time.time()
        last_score = (
            float(self.pscore_history[-1].get("overallPScore", -1.0))
            if self.pscore_history
            else -1.0
        )
        score_changed = abs(overall_pscore - last_score) >= 0.2

        if not self.pscore_history or (now - self._last_recorded_ts) >= 15.0 or score_changed:
            entry = {
                "timestampMs": int(now * 1000),
                "timeSlot": time.strftime("%H:%M:%S", time.localtime(now)),
                "overallPScore": round(overall_pscore, 1),
                "driftHealthScore": round(drift_health, 1),
                "fanOutHealthScore": round(fanout_health, 1),
                "anomalyHealthScore": round(anomaly_health, 1),
                "apdexScore": round(cluster_apdex * 100.0, 1),
            }
            self.pscore_history.append(entry)
            if len(self.pscore_history) > self.max_history_points:
                del self.pscore_history[
                    0 : len(self.pscore_history) - self.max_history_points
                ]
            self._last_recorded_ts = now
            self._persist_pscore_history()

        return self.pscore_history

    def _fetch_json(self, path: str, timeout: float = 8.0) -> Optional[Dict[str, Any]]:
        urls = [
            f"http://localhost:8787{path}",
            f"{self.collector_url}{path}",
            f"http://127.0.0.1:8787{path}",
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

    # Validates weighting matrix mathematically via Saaty's Analytic Hierarchy Process (AHP),
    # verifying that the Consistency Ratio (CR) remains below the strict 0.10 threshold.
    @staticmethod
    def compute_ahp_validation(
        w_drift: float = 0.40,
        w_fanout: float = 0.40,
        w_anomaly: float = 0.20,
        a12: Optional[float] = None,
        a13: Optional[float] = None,
        a23: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Computes Saaty's Analytic Hierarchy Process (AHP) 3x3 Pairwise Comparison Matrix,
        Principal Eigenvector priority weights, Principal Eigenvalue (lambda_max),
        Consistency Index (CI), and Consistency Ratio (CR < 0.10).
        Supports explicit Saaty 1-9 pairwise judgments (a12, a13, a23) or quantizes target weight ratios
        onto Saaty's discrete fundamental scale.
        """
        total = max(1e-6, w_drift + w_fanout + w_anomaly)
        target_w = np.array(
            [w_drift / total, w_fanout / total, w_anomaly / total], dtype=float
        )

        val_12 = (
            float(np.clip(a12, 1.0 / 9.0, 9.0))
            if a12 is not None
            else _snap_to_saaty_scale(target_w[0] / max(1e-4, target_w[1]))
        )
        val_13 = (
            float(np.clip(a13, 1.0 / 9.0, 9.0))
            if a13 is not None
            else _snap_to_saaty_scale(target_w[0] / max(1e-4, target_w[2]))
        )
        val_23 = (
            float(np.clip(a23, 1.0 / 9.0, 9.0))
            if a23 is not None
            else _snap_to_saaty_scale(target_w[1] / max(1e-4, target_w[2]))
        )

        matrix = np.array(
            [
                [1.0, round(val_12, 3), round(val_13, 3)],
                [round(1.0 / val_12, 3), 1.0, round(val_23, 3)],
                [round(1.0 / val_13, 3), round(1.0 / val_23, 3), 1.0],
            ],
            dtype=float,
        )

        eigvals, eigvecs = np.linalg.eig(matrix)
        max_idx = int(np.argmax(np.real(eigvals)))
        lambda_max = float(np.real(eigvals[max_idx]))

        # If explicit pairwise judgments were provided, derive priority weights from the principal eigenvector
        if a12 is not None or a13 is not None or a23 is not None:
            principal_vec = np.abs(np.real(eigvecs[:, max_idx]))
            vec_sum = float(np.sum(principal_vec))
            w = principal_vec / vec_sum if vec_sum > 0 else target_w
        else:
            w = target_w

        n = 3
        ci = max(0.0, (lambda_max - n) / (n - 1))
        ri_3 = 0.58  # Saaty Random Index for n=3
        cr = ci / ri_3

        norm_weights = {
            "drift": round(float(w[0]), 3),
            "fanout": round(float(w[1]), 3),
            "anomaly": round(float(w[2]), 3),
        }
        criteria_labels = [
            "Historical Latency Drift (C1)",
            "Call-Tree Fan-Out Amplification (C2)",
            "Isolation Forest ML Anomaly (C3)",
        ]

        return {
            "criteria": criteria_labels,
            "labels": criteria_labels,
            "normalizedWeights": norm_weights,
            "weights": norm_weights,
            "pairwiseJudgments": {
                "a12": round(val_12, 3),
                "a13": round(val_13, 3),
                "a23": round(val_23, 3),
            },
            "pairwiseMatrix": matrix.tolist(),
            "lambdaMax": round(lambda_max, 4),
            "consistencyIndexCI": round(ci, 4),
            "consistencyIndex": round(ci, 4),
            "randomIndexRI": ri_3,
            "randomIndex": ri_3,
            "consistencyRatioCR": round(cr, 4),
            "consistencyRatio": round(cr, 4),
            "isConsistent": bool(cr < 0.10),
            "threshold": 0.10,
        }

    # Computes Tail-Latency amplification (P99/P95) and Application Performance Index (Apdex)
    # assessing user satisfaction against target latency (50ms) and frustration threshold (200ms).
    @staticmethod
    def compute_apdex_and_tail(
        avg_lat_ms: float, p95_lat_ms: float, p99_lat_ms: float, error_count: int = 0
    ) -> Dict[str, Any]:
        """
        Computes Tail-Latency Amplification Ratio (P99 / P95) and Apdex Score (T = 50ms, 4T = 200ms).
        """
        effective_p95 = max(0.5, p95_lat_ms if p95_lat_ms > 0 else avg_lat_ms)
        effective_p99 = max(effective_p95, p99_lat_ms if p99_lat_ms > 0 else effective_p95)
        tail_ratio = (
            round(effective_p99 / effective_p95, 2)
            if p95_lat_ms > 0 or avg_lat_ms > 0
            else 1.0
        )

        # Apdex calculation with Target T = 50ms, Frustration 4T = 200ms
        T = 50.0
        if avg_lat_ms <= 0 and p95_lat_ms <= 0:
            apdex = 0.0
        else:
            if effective_p99 <= T:
                satisfied_ratio = 0.99
                tolerating_ratio = 0.01
            elif effective_p95 <= T:
                satisfied_ratio = 0.95
                tolerating_ratio = 0.04 if effective_p99 <= 4 * T else 0.02
            elif avg_lat_ms <= T:
                satisfied_ratio = max(0.50, 1.0 - (effective_p95 - T) / (3 * T) * 0.45)
                tolerating_ratio = max(0.10, 1.0 - satisfied_ratio - 0.05)
            else:
                satisfied_ratio = max(0.05, 0.50 * (T / max(T, avg_lat_ms)))
                tolerating_ratio = max(0.10, 0.45 * (4 * T / max(4 * T, effective_p95)))

            error_penalty = min(0.5, error_count * 0.05)
            apdex = max(
                0.0, min(1.0, satisfied_ratio + 0.5 * tolerating_ratio - error_penalty)
            )

        apdex = round(apdex, 3)
        if apdex >= 0.94:
            rating = "EXCELLENT"
        elif apdex >= 0.85:
            rating = "GOOD"
        elif apdex >= 0.70:
            rating = "FAIR"
        else:
            rating = "POOR"

        return {
            "tailLatencyRatio": tail_ratio,
            "apdexScore": apdex,
            "apdexRating": rating,
            "apdexThresholdMs": 50.0,
        }

    # Categorizes the 0-100 P-Score into four standardized enterprise maturity tiers:
    # Level 1 Foundational, Level 2 Developing, Level 3 Tuned, and Level 4 Optimized.
    @staticmethod
    def map_score_to_tier(p_score: float) -> Dict[str, Any]:
        if p_score >= 85.0:
            return {
                "level": 4,
                "tier": "Level 4: Optimized (Proactive & Self-Optimizing)",
                "shortLabel": "Level 4: Optimized",
                "summary": "Sub-millisecond drift stability, well-attenuated call trees, and zero ML runtime anomalies.",
            }
        if p_score >= 70.0:
            return {
                "level": 3,
                "tier": "Level 3: Resilient & Tuned (Managed)",
                "shortLabel": "Level 3: Resilient & Tuned",
                "summary": "Healthy latency baselines with moderate synchronous fan-out couplings.",
            }
        if p_score >= 50.0:
            return {
                "level": 2,
                "tier": "Level 2: Developing (Reactive)",
                "shortLabel": "Level 2: Developing",
                "summary": "Noticeable call-tree amplification or latency drift requiring targeted caching or indexing.",
            }
        return {
            "level": 1,
            "tier": "Level 1: Foundational (Unoptimized / High Risk)",
            "shortLabel": "Level 1: Foundational",
            "summary": "Severe latency regression, deep synchronous N+1 fan-out, or active resource saturation.",
        }

    # Evaluates context-specific rules (DB indexing, Redis caching, container footprint)
    # and projects quantifiable point gains for both individual services and the cluster.
    def evaluate_service_recommendations(
        self,
        service_id: str,
        drift_data: Dict[str, Any],
        fanout_data: Dict[str, Any],
        anomaly_res: Dict[str, Any],
        prom_metrics: Dict[str, Any],
        weights: Dict[str, float],
        active_service_count: int,
    ) -> List[Dict[str, Any]]:
        recommendations: List[Dict[str, Any]] = []

        drift_score = float(drift_data.get("driftScore") or 0.0)
        live_p95 = float(
            drift_data.get("liveP95LatencyMs") or prom_metrics.get("p95LatencyMs") or 0.0
        )
        baseline_p95 = float(drift_data.get("historicalBaselineMs") or 0.0)

        fanout_score = float(fanout_data.get("attenuatedFanOutScore") or 0.0)
        direct_fanout = int(fanout_data.get("directFanOutCount") or 0)
        max_depth = int(fanout_data.get("maxDependencyDepth") or 1)
        exec_pattern = str(fanout_data.get("executionPattern") or "SINGLE")
        seq_ratio = float(fanout_data.get("sequentialRatio") or 0.0)
        downstream = fanout_data.get("downstreamServices") or []
        topology = fanout_data.get("callTreeTopology") or []

        anomaly_score = float(anomaly_res.get("anomaly_score") or 0.0)
        cpu_m = float(prom_metrics.get("cpuUsageMillicores") or 0.0)
        mem_mb = float(prom_metrics.get("memoryUsageMB") or 0.0)

        db_nodes = [
            n
            for n in topology
            if "database" in str(n.get("role", "")).lower()
            or "persistence" in str(n.get("role", "")).lower()
            or "mongo" in str(n.get("serviceId", "")).lower()
            or "postgres" in str(n.get("serviceId", "")).lower()
        ]
        max_db_node = max(
            db_nodes, key=lambda n: float(n.get("spanDurationMs") or 0.0), default=None
        )
        db_latency_ms = (
            float(max_db_node.get("spanDurationMs") or 0.0) if max_db_node else 0.0
        )
        db_name = str(max_db_node.get("serviceId")) if max_db_node else f"{service_id}-db"

        n_svcs = max(1, active_service_count)

        # Rule 1: Database Indexing & Query Optimization
        if drift_score >= 0.15 or db_latency_ms >= 20.0 or live_p95 >= 30.0:
            eff_drift = max(drift_score, min(0.35, db_latency_ms / 400.0))
            svc_gain = round(eff_drift * 0.65 * weights["drift"] * 100.0, 2)
            svc_gain = max(1.5, svc_gain)
            cluster_gain = round(svc_gain / n_svcs, 2)
            recommendations.append(
                {
                    "id": f"{service_id}-REC-DB-01",
                    "ruleId": "REC-DB-01",
                    "serviceId": service_id,
                    "category": "DATABASE_INDEXING",
                    "title": f"Add Compound Indexing & Connection Pooling on {db_name}",
                    "impact": "HIGH"
                    if (drift_score >= 0.4 or db_latency_ms >= 45.0)
                    else "MEDIUM",
                    "effort": "MEDIUM",
                    "description": (
                        f"Downstream persistence node '{db_name}' recorded {db_latency_ms:.1f}ms span duration "
                        f"(Service P95={live_p95:.1f}ms vs Baseline={baseline_p95:.1f}ms). "
                        "Adding compound indexes on high-cardinality filter fields reduces sequential collection scans."
                    ),
                    "expectedPScoreImprovement": f"+{svc_gain:.1f} pts on {service_id}",
                    "projectedServiceDeltaPts": svc_gain,
                    "projectedClusterDeltaPts": cluster_gain,
                    "triggerEvidence": (
                        f"DB Node: {db_name} ({db_latency_ms:.1f}ms) | P95: {live_p95:.1f}ms | DriftScore: {drift_score:.3f}"
                    ),
                }
            )

        # Rule 2: Redis / In-Memory Tiered Caching & Parallel Promise.all Decoupling
        if direct_fanout >= 1 and (fanout_score >= 0.15 or max_depth >= 2 or exec_pattern == "SEQUENTIAL_N_PLUS_1"):
            ds_list = ", ".join(downstream) if downstream else "downstream nodes"
            reduction_factor = 0.65 if exec_pattern == "SEQUENTIAL_N_PLUS_1" else 0.55
            svc_gain = round(fanout_score * reduction_factor * weights["fanout"] * 100.0, 2)
            svc_gain = max(2.0, svc_gain)
            cluster_gain = round(svc_gain / n_svcs, 2)
            pattern_desc = (
                f"Detected sequential N+1 waterfall execution ({seq_ratio * 100:.0f}% non-overlapping spans); "
                "parallelizing independent downstream calls with Promise.all and Redis read-through caching eliminates serial blocking."
                if exec_pattern == "SEQUENTIAL_N_PLUS_1"
                else "Caching frequent read payloads in Redis eliminates redundant synchronous hops."
            )
            recommendations.append(
                {
                    "id": f"{service_id}-REC-CACHE-02",
                    "ruleId": "REC-CACHE-02",
                    "serviceId": service_id,
                    "category": "REDIS_CACHING",
                    "title": (
                        f"Parallelize Sequential N+1 Fan-Out & Add Redis Cache on {service_id}"
                        if exec_pattern == "SEQUENTIAL_N_PLUS_1"
                        else f"Introduce Redis Read-Through Cache for {service_id} Fan-Out"
                    ),
                    "impact": "HIGH" if (fanout_score >= 0.35 or exec_pattern == "SEQUENTIAL_N_PLUS_1") else "MEDIUM",
                    "effort": "LOW",
                    "description": (
                        f"'{service_id}' makes {direct_fanout} direct synchronous calls ({ds_list}) across "
                        f"call-tree depth {max_depth}. {pattern_desc}"
                    ),
                    "expectedPScoreImprovement": f"+{svc_gain:.1f} pts on {service_id}",
                    "projectedServiceDeltaPts": svc_gain,
                    "projectedClusterDeltaPts": cluster_gain,
                    "triggerEvidence": (
                        f"Direct Fan-Out: {direct_fanout} ({ds_list}) | Mode: {exec_pattern} | Depth: {max_depth} | FanOutScore: {fanout_score:.3f}"
                    ),
                }
            )

        # Rule 3: Container Base-Image & HPA Autoscaling Optimization
        if anomaly_score >= 0.15 or mem_mb >= 45.0 or cpu_m >= 250.0:
            eff_anom = max(anomaly_score, 0.18)
            svc_gain = round(eff_anom * 0.70 * weights["anomaly"] * 100.0, 2)
            svc_gain = max(1.2, svc_gain)
            cluster_gain = round(svc_gain / n_svcs, 2)
            recommendations.append(
                {
                    "id": f"{service_id}-REC-OPT-03",
                    "ruleId": "REC-OPT-03",
                    "serviceId": service_id,
                    "category": "CONTAINER_BASE_IMAGE",
                    "title": f"Optimize Container Footprint & HPA Thresholds for {service_id}",
                    "impact": "HIGH" if anomaly_score >= 0.5 else "MEDIUM",
                    "effort": "MEDIUM",
                    "description": (
                        f"Live container footprint is {mem_mb:.1f} MB RAM / {cpu_m:.1f}m CPU (ML Anomaly Score={anomaly_score:.3f}). "
                        "Migrating to slim/distroless base images and tuning HPA target CPU to 65% reduces spin-up lag."
                    ),
                    "expectedPScoreImprovement": f"+{svc_gain:.1f} pts on {service_id}",
                    "projectedServiceDeltaPts": svc_gain,
                    "projectedClusterDeltaPts": cluster_gain,
                    "triggerEvidence": (
                        f"RAM: {mem_mb:.1f}MB | CPU: {cpu_m:.1f}m | Isolation Forest Score: {anomaly_score:.3f}"
                    ),
                }
            )

        return recommendations

    # Executes end-to-end cluster performance evaluation: aggregates drift, fan-out, and anomaly
    # scores across active services, computes the composite P-Score, and generates prescriptive remediations.
    def evaluate_cluster_pscore(
        self,
        requested_services: Optional[List[str]] = None,
        latest_overrides: Optional[Dict[str, Dict[str, Any]]] = None,
        custom_weights: Optional[Dict[str, float]] = None,
        pairwise_judgments: Optional[Dict[str, Optional[float]]] = None,
    ) -> Dict[str, Any]:
        start_t = time.perf_counter()

        w_drift = float((custom_weights or {}).get("drift", self.default_weights["drift"]))
        w_fanout = float((custom_weights or {}).get("fanout", self.default_weights["fanout"]))
        w_anomaly = float((custom_weights or {}).get("anomaly", self.default_weights["anomaly"]))
        pw = pairwise_judgments or {}
        ahp_info = self.compute_ahp_validation(
            w_drift,
            w_fanout,
            w_anomaly,
            a12=pw.get("a12"),
            a13=pw.get("a13"),
            a23=pw.get("a23"),
        )
        weights = ahp_info["normalizedWeights"]

        # 1. Discover active services
        services: List[str] = []
        discovery = self._fetch_json("/api/telemetry/discovered-services") or {}
        if requested_services:
            services = [s.strip() for s in requested_services if s.strip()]
        else:
            app_svcs = discovery.get("applicationServices") or []
            all_svcs = discovery.get("allServices") or []
            services = app_svcs if app_svcs else all_svcs

        if not services:
            return {
                "engine": "Python FastAPI Composite P-Score & Recommendation Engine",
                "evaluatedAt": int(time.time() * 1000),
                "overallPScore": 0.0,
                "maturityTier": self.map_score_to_tier(0.0),
                "weights": weights,
                "ahpValidation": ahp_info,
                "pScoreHistory": self.pscore_history,
                "serviceEvaluations": [],
                "recommendations": [],
            }

        query_str = urllib.parse.quote(",".join(services))
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            fut_snap = executor.submit(self._fetch_json, f"/api/telemetry/snapshot?services={query_str}")
            fut_phase3 = executor.submit(self._fetch_json, f"/api/telemetry/phase3?services={query_str}")
            snap_resp = fut_snap.result() or {}
            phase3_resp = fut_phase3.result() or {}

        snapshots_map = {
            s.get("serviceId"): s
            for s in (snap_resp.get("snapshots") or [])
            if s.get("serviceId")
        }
        drift_map = {
            d.get("serviceId"): d
            for d in (phase3_resp.get("historicalDriftAnalysis") or [])
            if d.get("serviceId")
        }
        fanout_map = {
            f.get("serviceId"): f
            for f in (phase3_resp.get("fanOutTopologyAnalysis") or [])
            if f.get("serviceId")
        }

        service_evaluations: List[Dict[str, Any]] = []
        all_recommendations: List[Dict[str, Any]] = []
        active_count = max(1, len(services))

        for svc_id in services:
            snap = snapshots_map.get(svc_id) or {}
            prom = snap.get("prometheus") or {}
            loki = snap.get("loki") or {}
            k8s = snap.get("k8s") or {}

            drift_info = drift_map.get(svc_id) or {}
            fanout_info = fanout_map.get(svc_id) or {}

            raw_k8s_uptime = k8s.get("uptimeSeconds")
            k8s_source_ok = bool((snap.get("sources") or {}).get("kubernetes"))

            override = (latest_overrides or {}).get(svc_id)
            if (
                override
                and isinstance(override.get("feature_vector"), list)
                and len(override["feature_vector"]) == 4
            ):
                vec = override["feature_vector"]
                ov_uptime = override.get("pod_uptime_sec")
                if ov_uptime is not None:
                    uptime_sec = float(ov_uptime)
                elif raw_k8s_uptime is not None and (k8s_source_ok or float(raw_k8s_uptime) > 0):
                    uptime_sec = float(raw_k8s_uptime)
                else:
                    uptime_sec = 120.0
                anom_res = self.detector.predict(vec, uptime_sec)
            else:
                cpu_norm = min(
                    1.0, max(0.0, float(prom.get("cpuUsageMillicores") or 0.0) / 1000.0)
                )
                mem_norm = min(
                    1.0, max(0.0, float(prom.get("memoryUsageMB") or 0.0) / 512.0)
                )
                lat_norm = min(
                    1.0, max(0.0, float(prom.get("p95LatencyMs") or 0.0) / 200.0)
                )
                loki_err = float(loki.get("errorCount") or 0.0)
                loki_tot = float(loki.get("totalCount") or 0.0)
                err_norm = min(
                    1.0,
                    max(
                        0.0,
                        (loki_err / loki_tot) if loki_tot > 0 else (loki_err / 10.0),
                    ),
                )
                if raw_k8s_uptime is not None and (k8s_source_ok or float(raw_k8s_uptime) > 0):
                    uptime_sec = float(raw_k8s_uptime)
                else:
                    uptime_sec = 120.0
                vec = [
                    round(cpu_norm, 3),
                    round(mem_norm, 3),
                    round(lat_norm, 3),
                    round(err_norm, 3),
                ]
                anom_res = self.detector.predict(vec, uptime_sec)

            drift_score = round(
                min(1.0, max(0.0, float(drift_info.get("driftScore") or 0.0))), 3
            )
            fanout_score = round(
                min(
                    1.0,
                    max(0.0, float(fanout_info.get("attenuatedFanOutScore") or 0.0)),
                ),
                3,
            )
            anomaly_score = round(
                min(1.0, max(0.0, float(anom_res.get("anomaly_score") or 0.0))), 3
            )

            drift_penalty = drift_score * weights["drift"]
            fanout_penalty = fanout_score * weights["fanout"]
            anomaly_penalty = anomaly_score * weights["anomaly"]
            total_penalty = drift_penalty + fanout_penalty + anomaly_penalty

            p_score = round(max(0.0, min(100.0, 100.0 * (1.0 - total_penalty))), 1)
            tier_info = self.map_score_to_tier(p_score)

            avg_lat = float(prom.get("avgResponseTimeMs") or 0.0)
            p95_lat = float(prom.get("p95LatencyMs") or 0.0)
            p99_lat = float(prom.get("p99LatencyMs") or 0.0)
            err_cnt = int(loki.get("errorCount") or 0)
            apdex_tail = self.compute_apdex_and_tail(avg_lat, p95_lat, p99_lat, err_cnt)

            recs = self.evaluate_service_recommendations(
                svc_id,
                drift_info,
                fanout_info,
                anom_res,
                prom,
                weights,
                active_count,
            )
            all_recommendations.extend(recs)

            has_telemetry = bool(
                drift_info.get("hasTelemetry")
                or fanout_info.get("hasTelemetry")
                or prom.get("cpuUsageMillicores", 0) > 0
                or prom.get("memoryUsageMB", 0) > 0
                or prom.get("avgResponseTimeMs", 0) > 0
                or k8s.get("podReplicaCount", 0) > 0
                or k8s.get("uptimeSeconds", 0) > 0
                or svc_id in snapshots_map
            )

            service_evaluations.append(
                {
                    "serviceId": svc_id,
                    "hasTelemetry": has_telemetry,
                    "pScore": p_score,
                    "maturityTier": tier_info,
                    "apdexAndTail": apdex_tail,
                    "signals": {
                        "driftScore": drift_score,
                        "driftLevel": drift_info.get("driftLevel", "NO_DRIFT"),
                        "liveP95LatencyMs": float(
                            drift_info.get("liveP95LatencyMs") or p95_lat
                        ),
                        "historicalBaselineMs": float(
                            drift_info.get("historicalBaselineMs") or 0.0
                        ),
                        "fanOutScore": fanout_score,
                        "fanOutLevel": fanout_info.get("fanOutLevel", "LOW"),
                        "directFanOutCount": int(
                            fanout_info.get("directFanOutCount") or 0
                        ),
                        "maxDependencyDepth": int(
                            fanout_info.get("maxDependencyDepth") or 1
                        ),
                        "executionPattern": fanout_info.get("executionPattern", "SINGLE"),
                        "sequentialRatio": float(fanout_info.get("sequentialRatio") or 0.0),
                        "isApiGateway": bool(fanout_info.get("isApiGateway")),
                        "attenuationFactor": float(
                            fanout_info.get("attenuationFactor") or 1.0
                        ),
                        "anomalyScore": anomaly_score,
                        "isAnomaly": bool(anom_res.get("is_anomaly")),
                        "prefiltered": bool(anom_res.get("prefiltered")),
                        "featureAttributions": anom_res.get("feature_attributions"),
                    },
                    "penalties": {
                        "driftPenaltyPts": round(drift_penalty * 100.0, 2),
                        "fanOutPenaltyPts": round(fanout_penalty * 100.0, 2),
                        "anomalyPenaltyPts": round(anomaly_penalty * 100.0, 2),
                        "totalPenaltyPts": round(total_penalty * 100.0, 2),
                    },
                    "rawMetrics": {
                        "cpuUsageMillicores": float(
                            prom.get("cpuUsageMillicores") or 0.0
                        ),
                        "memoryUsageMB": float(prom.get("memoryUsageMB") or 0.0),
                        "avgResponseTimeMs": avg_lat,
                        "p95LatencyMs": p95_lat,
                        "p99LatencyMs": p99_lat,
                        "rps": float(prom.get("rps") or 0.0),
                        "uptimeSeconds": round(uptime_sec, 1),
                    },
                }
            )

        active_evals = [e for e in service_evaluations if e["hasTelemetry"]]
        if active_evals:
            overall_p_score = round(
                sum(e["pScore"] for e in active_evals) / len(active_evals), 1
            )
            avg_drift_score = round(
                sum(e["signals"]["driftScore"] for e in active_evals)
                / len(active_evals),
                3,
            )
            avg_fanout_score = round(
                sum(e["signals"]["fanOutScore"] for e in active_evals)
                / len(active_evals),
                3,
            )
            avg_anomaly_score = round(
                sum(e["signals"]["anomalyScore"] for e in active_evals)
                / len(active_evals),
                3,
            )
            cluster_apdex = round(
                sum(e["apdexAndTail"]["apdexScore"] for e in active_evals)
                / len(active_evals),
                3,
            )
            cluster_tail_ratio = round(
                sum(e["apdexAndTail"]["tailLatencyRatio"] for e in active_evals)
                / len(active_evals),
                2,
            )
        else:
            overall_p_score = 0.0
            avg_drift_score = 0.0
            avg_fanout_score = 0.0
            avg_anomaly_score = 0.0
            cluster_apdex = 0.0
            cluster_tail_ratio = 1.0

        drift_health = round(100.0 * (1.0 - avg_drift_score), 1)
        fanout_health = round(100.0 * (1.0 - avg_fanout_score), 1)
        anomaly_health = round(100.0 * (1.0 - avg_anomaly_score), 1)

        history_records = self._record_pscore_snapshot(
            overall_p_score,
            drift_health,
            fanout_health,
            anomaly_health,
            cluster_apdex,
        )

        eval_ms = round((time.perf_counter() - start_t) * 1000.0, 2)

        return {
            "engine": "Python 3.11 FastAPI Composite P-Score, AHP & XAI Recommendation Engine",
            "evaluatedAt": int(time.time() * 1000),
            "evaluationLatencyMs": eval_ms,
            "overallPScore": overall_p_score,
            "maturityTier": self.map_score_to_tier(overall_p_score),
            "weights": weights,
            "ahpValidation": ahp_info,
            "clusterApdex": {
                "apdexScore": cluster_apdex,
                "tailLatencyRatio": cluster_tail_ratio,
                "rating": "EXCELLENT"
                if cluster_apdex >= 0.94
                else "GOOD"
                if cluster_apdex >= 0.85
                else "FAIR"
                if cluster_apdex >= 0.70
                else "POOR",
            },
            "clusterSubScores": {
                "driftHealthScore": drift_health,
                "fanOutHealthScore": fanout_health,
                "anomalyHealthScore": anomaly_health,
                "avgDriftPenalty": avg_drift_score,
                "avgFanOutPenalty": avg_fanout_score,
                "avgAnomalyPenalty": avg_anomaly_score,
                "avgApdexScore": cluster_apdex,
                "avgTailLatencyRatio": cluster_tail_ratio,
            },
            "pScoreHistory": history_records,
            "discoveredServices": discovery,
            "serviceEvaluations": service_evaluations,
            "recommendations": all_recommendations,
        }
