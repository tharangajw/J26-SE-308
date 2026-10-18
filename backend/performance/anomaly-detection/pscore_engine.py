import time
import urllib.request
import urllib.parse
import json
from typing import Dict, List, Any, Optional
from isolation_forest import AnomalyDetectionService


class PScoreAndRecommendationEngine:
    """
    Phase 4 & 5: Composite Performance Efficiency Scoring Engine (P-Score),
    4-Tier Maturity Mapper, and Context-Aware Recommendation Rules Engine in Python.
    """

    def __init__(
        self,
        detector: AnomalyDetectionService,
        collector_url: str = "http://telemetry-collector:8787",
    ):
        self.detector = detector
        self.collector_url = collector_url
        self.weights = {
            "drift": 0.40,
            "fanout": 0.40,
            "anomaly": 0.20,
        }

    def _fetch_json(self, path: str, timeout: float = 4.0) -> Optional[Dict[str, Any]]:
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

    def evaluate_service_recommendations(
        self,
        service_id: str,
        drift_data: Dict[str, Any],
        fanout_data: Dict[str, Any],
        anomaly_res: Dict[str, Any],
        prom_metrics: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        recommendations: List[Dict[str, Any]] = []

        drift_score = float(drift_data.get("driftScore") or 0.0)
        live_p95 = float(drift_data.get("liveP95LatencyMs") or prom_metrics.get("p95LatencyMs") or 0.0)
        baseline_p95 = float(drift_data.get("historicalBaselineMs") or 0.0)

        fanout_score = float(fanout_data.get("attenuatedFanOutScore") or 0.0)
        direct_fanout = int(fanout_data.get("directFanOutCount") or 0)
        max_depth = int(fanout_data.get("maxDependencyDepth") or 1)
        downstream = fanout_data.get("downstreamServices") or []
        topology = fanout_data.get("callTreeTopology") or []

        anomaly_score = float(anomaly_res.get("anomaly_score") or 0.0)
        cpu_m = float(prom_metrics.get("cpuUsageMillicores") or 0.0)
        mem_mb = float(prom_metrics.get("memoryUsageMB") or 0.0)

        # Find highest database node span duration in call-tree topology
        db_nodes = [
            n
            for n in topology
            if "database" in str(n.get("role", "")).lower()
            or "persistence" in str(n.get("role", "")).lower()
            or "mongo" in str(n.get("serviceId", "")).lower()
            or "postgres" in str(n.get("serviceId", "")).lower()
        ]
        max_db_node = max(db_nodes, key=lambda n: float(n.get("spanDurationMs") or 0.0), default=None)
        db_latency_ms = float(max_db_node.get("spanDurationMs") or 0.0) if max_db_node else 0.0
        db_name = str(max_db_node.get("serviceId")) if max_db_node else f"{service_id}-db"

        # Rule 1: Database Indexing & Query Optimization
        if drift_score >= 0.15 or db_latency_ms >= 20.0 or live_p95 >= 30.0:
            recommendations.append(
                {
                    "ruleId": "REC-DB-01",
                    "serviceId": service_id,
                    "category": "DATABASE_INDEXING",
                    "title": f"Add Compound Indexing & Connection Pooling on {db_name}",
                    "impact": "HIGH" if (drift_score >= 0.4 or db_latency_ms >= 45.0) else "MEDIUM",
                    "effort": "MEDIUM",
                    "description": (
                        f"Downstream persistence node '{db_name}' recorded {db_latency_ms:.1f}ms span duration "
                        f"(Service P95={live_p95:.1f}ms vs Baseline={baseline_p95:.1f}ms). "
                        "Adding compound indexes on high-cardinality filter fields reduces sequential collection scans."
                    ),
                    "expectedPScoreImprovement": "+8 to +15 P-Score pts",
                    "triggerEvidence": (
                        f"DB Node: {db_name} ({db_latency_ms:.1f}ms) | P95: {live_p95:.1f}ms | DriftScore: {drift_score:.3f}"
                    ),
                }
            )

        # Rule 2: Redis / In-Memory Tiered Caching & Async Decoupling
        if direct_fanout >= 2 or fanout_score >= 0.25 or max_depth >= 3:
            ds_list = ", ".join(downstream) if downstream else "downstream nodes"
            recommendations.append(
                {
                    "ruleId": "REC-CACHE-02",
                    "serviceId": service_id,
                    "category": "REDIS_CACHING",
                    "title": f"Introduce Redis Read-Through Cache for {service_id} Fan-Out",
                    "impact": "HIGH" if fanout_score >= 0.35 else "MEDIUM",
                    "effort": "LOW",
                    "description": (
                        f"'{service_id}' makes {direct_fanout} direct synchronous calls ({ds_list}) across "
                        f"call-tree depth {max_depth}. Caching frequent read payloads in Redis eliminates redundant synchronous hops."
                    ),
                    "expectedPScoreImprovement": "+10 to +18 P-Score pts",
                    "triggerEvidence": (
                        f"Direct Fan-Out: {direct_fanout} ({ds_list}) | Max Depth: {max_depth} | FanOutScore: {fanout_score:.3f}"
                    ),
                }
            )

        # Rule 3: Container Base-Image & HPA Autoscaling Optimization
        if anomaly_score >= 0.25 or mem_mb >= 45.0 or cpu_m >= 250.0:
            recommendations.append(
                {
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
                    "expectedPScoreImprovement": "+6 to +12 P-Score pts",
                    "triggerEvidence": (
                        f"RAM: {mem_mb:.1f}MB | CPU: {cpu_m:.1f}m | Isolation Forest Score: {anomaly_score:.3f}"
                    ),
                }
            )

        return recommendations

    def evaluate_cluster_pscore(
        self,
        requested_services: Optional[List[str]] = None,
        latest_overrides: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        start_t = time.perf_counter()

        # 1. Discover active services if not explicitly provided
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
                "weights": self.weights,
                "serviceEvaluations": [],
                "recommendations": [],
            }

        query_str = urllib.parse.quote(",".join(services))
        snap_resp = self._fetch_json(f"/api/telemetry/snapshot?services={query_str}") or {}
        phase3_resp = self._fetch_json(f"/api/telemetry/phase3?services={query_str}") or {}

        snapshots_map = {
            s.get("serviceId"): s for s in (snap_resp.get("snapshots") or []) if s.get("serviceId")
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

        for svc_id in services:
            snap = snapshots_map.get(svc_id) or {}
            prom = snap.get("prometheus") or {}
            loki = snap.get("loki") or {}
            k8s = snap.get("k8s") or {}

            drift_info = drift_map.get(svc_id) or {}
            fanout_info = fanout_map.get(svc_id) or {}

            # Check if there is a live load-test override in latest_telemetry
            override = (latest_overrides or {}).get(svc_id)
            if override and isinstance(override.get("feature_vector"), list) and len(override["feature_vector"]) == 4:
                vec = override["feature_vector"]
                uptime_sec = float(override.get("pod_uptime_sec") or 120.0)
                anom_res = override.get("prediction") or self.detector.predict(vec, uptime_sec)
            else:
                cpu_norm = min(1.0, max(0.0, float(prom.get("cpuUsageMillicores") or 0.0) / 1000.0))
                mem_norm = min(1.0, max(0.0, float(prom.get("memoryUsageMB") or 0.0) / 512.0))
                lat_norm = min(1.0, max(0.0, float(prom.get("p95LatencyMs") or 0.0) / 200.0))
                err_norm = min(1.0, max(0.0, float(loki.get("errorCount") or 0.0) / 10.0))
                uptime_sec = float(k8s.get("uptimeSeconds") or 180.0)
                if uptime_sec <= 0:
                    uptime_sec = 180.0
                vec = [round(cpu_norm, 3), round(mem_norm, 3), round(lat_norm, 3), round(err_norm, 3)]
                anom_res = self.detector.predict(vec, uptime_sec)

            drift_score = round(min(1.0, max(0.0, float(drift_info.get("driftScore") or 0.0))), 3)
            fanout_score = round(
                min(1.0, max(0.0, float(fanout_info.get("attenuatedFanOutScore") or 0.0))), 3
            )
            anomaly_score = round(min(1.0, max(0.0, float(anom_res.get("anomaly_score") or 0.0))), 3)

            drift_penalty = drift_score * self.weights["drift"]
            fanout_penalty = fanout_score * self.weights["fanout"]
            anomaly_penalty = anomaly_score * self.weights["anomaly"]
            total_penalty = drift_penalty + fanout_penalty + anomaly_penalty

            p_score = round(max(0.0, min(100.0, 100.0 * (1.0 - total_penalty))), 1)
            tier_info = self.map_score_to_tier(p_score)

            recs = self.evaluate_service_recommendations(
                svc_id, drift_info, fanout_info, anom_res, prom
            )
            all_recommendations.extend(recs)

            has_telemetry = bool(
                prom.get("cpuUsageMillicores", 0) > 0
                or prom.get("memoryUsageMB", 0) > 0
                or prom.get("avgResponseTimeMs", 0) > 0
                or fanout_info.get("hasTelemetry")
            )

            service_evaluations.append(
                {
                    "serviceId": svc_id,
                    "hasTelemetry": has_telemetry,
                    "pScore": p_score,
                    "maturityTier": tier_info,
                    "signals": {
                        "driftScore": drift_score,
                        "driftLevel": drift_info.get("driftLevel", "NO_DRIFT"),
                        "liveP95LatencyMs": float(
                            drift_info.get("liveP95LatencyMs") or prom.get("p95LatencyMs") or 0.0
                        ),
                        "historicalBaselineMs": float(drift_info.get("historicalBaselineMs") or 0.0),
                        "fanOutScore": fanout_score,
                        "fanOutLevel": fanout_info.get("fanOutLevel", "LOW"),
                        "directFanOutCount": int(fanout_info.get("directFanOutCount") or 0),
                        "maxDependencyDepth": int(fanout_info.get("maxDependencyDepth") or 1),
                        "isApiGateway": bool(fanout_info.get("isApiGateway")),
                        "attenuationFactor": float(fanout_info.get("attenuationFactor") or 1.0),
                        "anomalyScore": anomaly_score,
                        "isAnomaly": bool(anom_res.get("is_anomaly")),
                        "prefiltered": bool(anom_res.get("prefiltered")),
                    },
                    "penalties": {
                        "driftPenaltyPts": round(drift_penalty * 100.0, 2),
                        "fanOutPenaltyPts": round(fanout_penalty * 100.0, 2),
                        "anomalyPenaltyPts": round(anomaly_penalty * 100.0, 2),
                        "totalPenaltyPts": round(total_penalty * 100.0, 2),
                    },
                    "rawMetrics": {
                        "cpuUsageMillicores": float(prom.get("cpuUsageMillicores") or 0.0),
                        "memoryUsageMB": float(prom.get("memoryUsageMB") or 0.0),
                        "avgResponseTimeMs": float(prom.get("avgResponseTimeMs") or 0.0),
                        "p95LatencyMs": float(prom.get("p95LatencyMs") or 0.0),
                        "rps": float(prom.get("rps") or 0.0),
                    },
                }
            )

        active_evals = [e for e in service_evaluations if e["hasTelemetry"]]
        if active_evals:
            overall_p_score = round(
                sum(e["pScore"] for e in active_evals) / len(active_evals), 1
            )
            avg_drift_score = round(
                sum(e["signals"]["driftScore"] for e in active_evals) / len(active_evals), 3
            )
            avg_fanout_score = round(
                sum(e["signals"]["fanOutScore"] for e in active_evals) / len(active_evals), 3
            )
            avg_anomaly_score = round(
                sum(e["signals"]["anomalyScore"] for e in active_evals) / len(active_evals), 3
            )
        else:
            overall_p_score = 0.0
            avg_drift_score = 0.0
            avg_fanout_score = 0.0
            avg_anomaly_score = 0.0

        eval_ms = round((time.perf_counter() - start_t) * 1000.0, 2)

        return {
            "engine": "Python 3.11 FastAPI Composite P-Score & Context-Aware Recommendation Engine",
            "evaluatedAt": int(time.time() * 1000),
            "evaluationLatencyMs": eval_ms,
            "overallPScore": overall_p_score,
            "maturityTier": self.map_score_to_tier(overall_p_score),
            "weights": self.weights,
            "clusterSubScores": {
                "driftHealthScore": round(100.0 * (1.0 - avg_drift_score), 1),
                "fanOutHealthScore": round(100.0 * (1.0 - avg_fanout_score), 1),
                "anomalyHealthScore": round(100.0 * (1.0 - avg_anomaly_score), 1),
                "avgDriftPenalty": avg_drift_score,
                "avgFanOutPenalty": avg_fanout_score,
                "avgAnomalyPenalty": avg_anomaly_score,
            },
            "discoveredServices": discovery,
            "serviceEvaluations": service_evaluations,
            "recommendations": all_recommendations,
        }
