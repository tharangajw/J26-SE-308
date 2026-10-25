import json
import os
import sys
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


KUBERNETES_URL = os.getenv("KUBERNETES_URL", "http://localhost:8001").rstrip("/")
TIMEOUT_SECONDS = float(os.getenv("KUBERNETES_TIMEOUT_SECONDS", "2"))


class KubernetesConnectionError(Exception):
    pass


def _get_json(path: str) -> dict[str, Any]:
    request = Request(f"{KUBERNETES_URL}{path}", headers={"Accept": "application/json"})
    try:
        with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return json.loads(response.read())
    except HTTPError as error:
        if error.code == 403:
            detail = "Kubernetes denied access. Check kubectl proxy host rules and current-user permissions."
        else:
            detail = f"Kubernetes API returned HTTP {error.code}."
        raise KubernetesConnectionError(detail) from error
    except (URLError, TimeoutError, json.JSONDecodeError) as error:
        raise KubernetesConnectionError(f"Cannot read Kubernetes API at {KUBERNETES_URL}.") from error


def get_cluster_snapshot() -> dict[str, Any]:
    try:
        pods_response = _get_json("/api/v1/pods?limit=500")
        deployments_response = _get_json("/apis/apps/v1/deployments?limit=500")
        hpas_response = _get_json("/apis/autoscaling/v2/horizontalpodautoscalers?limit=500")
    except KubernetesConnectionError as error:
        return {"connected": False, "validation": None, "error": str(error)}

    pods = pods_response.get("items", [])
    deployments = deployments_response.get("items", [])
    hpas = []
    for hpa in hpas_response.get("items", []):
        cpu_metric = next(
            (metric for metric in hpa.get("status", {}).get("currentMetrics", [])
             if metric.get("resource", {}).get("name") == "cpu"),
            {},
        )
        cpu_target = next(
            (metric for metric in hpa.get("spec", {}).get("metrics", [])
             if metric.get("resource", {}).get("name") == "cpu"),
            {},
        )
        hpas.append({
            "name": hpa.get("metadata", {}).get("name", "unnamed"),
            "namespace": hpa.get("metadata", {}).get("namespace", "default"),
            "currentReplicas": hpa.get("status", {}).get("currentReplicas", 0),
            "desiredReplicas": hpa.get("status", {}).get(
                "desiredReplicas", hpa.get("spec", {}).get("minReplicas", 0)
            ),
            "currentCpuPercent": cpu_metric.get("resource", {}).get("current", {}).get("averageUtilization"),
            "targetCpuPercent": cpu_target.get("resource", {}).get("target", {}).get("averageUtilization"),
        })

    restart_count = sum(
        container.get("restartCount", 0)
        for pod in pods
        for container in pod.get("status", {}).get("containerStatuses", [])
    )
    desired_replicas = sum(deployment.get("spec", {}).get("replicas", 0) for deployment in deployments)
    ready_replicas = sum(deployment.get("status", {}).get("readyReplicas", 0) for deployment in deployments)

    return {
        "connected": True,
        "validation": {
            "podCount": len(pods),
            "podRestartCount": restart_count,
            "deploymentCount": len(deployments),
            "desiredReplicas": desired_replicas,
            "readyReplicas": ready_replicas,
            "hpas": hpas,
            "circuitBreaker": {
                "configured": False,
                "status": "NOT_MEASURED",
                "reason": "Connect a service-mesh or application circuit-breaker metrics source to measure this result.",
            },
        },
        "error": None,
    }


if __name__ == "__main__":
    result = get_cluster_snapshot()
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["connected"] else 1)
