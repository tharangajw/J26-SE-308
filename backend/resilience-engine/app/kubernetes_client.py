# Reads Kubernetes health data and manages authorized Chaos Mesh experiments.
import json
import os
import re
import sys
import threading
import uuid
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


KUBERNETES_URL = os.getenv("KUBERNETES_URL", "http://localhost:8001").rstrip("/")
TIMEOUT_SECONDS = float(os.getenv("KUBERNETES_TIMEOUT_SECONDS", "2"))
CORE_PRODUCT_SERVICES = {
    "api-gateway": {"api-gateway", "gateway"},
    "book-service": {"book-service"},
    "order-service": {"order-service"},
    "user-service": {"user-service"},
}
_POD_HISTORY_LOCK = threading.Lock()
_LAST_CORE_POD_UIDS: dict[str, set[str]] = {}
_OBSERVED_POD_REPLACEMENTS: dict[str, int] = {service: 0 for service in CORE_PRODUCT_SERVICES}


class KubernetesConnectionError(Exception):
    pass


# Retrieves and decodes a JSON response from the Kubernetes API proxy.
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


# Sends an authenticated JSON request through the Kubernetes API proxy.
def _request_json(method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
    data = json.dumps(body).encode() if body is not None else None
    request = Request(
        f"{KUBERNETES_URL}{path}",
        data=data,
        method=method,
        headers={"Accept": "application/json", "Content-Type": "application/json"},
    )
    try:
        with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return json.loads(response.read()) if response.status != 204 else {}
    except HTTPError as error:
        detail = error.read().decode(errors="replace")
        raise KubernetesConnectionError(f"Kubernetes API returned HTTP {error.code}: {detail[:500]}") from error
    except (URLError, TimeoutError, json.JSONDecodeError) as error:
        raise KubernetesConnectionError(f"Cannot reach Kubernetes API at {KUBERNETES_URL}.") from error


# Lists running application Pods that can be targeted by Chaos Mesh.
def get_chaos_targets() -> dict[str, Any]:
    try:
        crds = _get_json("/apis/chaos-mesh.org/v1alpha1")
        kinds = {resource.get("kind") for resource in crds.get("resources", [])}
        required = {"PodChaos", "NetworkChaos", "StressChaos"}
        missing = sorted(required - kinds)
        if missing:
            return {"connected": True, "ready": False, "targets": [], "error": f"Chaos Mesh CRDs are missing: {', '.join(missing)}."}
        pod_items = _get_json("/api/v1/pods?limit=500").get("items", [])
        targets = []
        for pod in pod_items:
            metadata = pod.get("metadata", {})
            namespace = metadata.get("namespace", "default")
            name = metadata.get("name", "")
            phase = pod.get("status", {}).get("phase", "Unknown")
            if not name or phase != "Running" or metadata.get("deletionTimestamp") or namespace in {"kube-system", "kube-public", "kube-node-lease", "chaos-mesh", "docker-desktop"}:
                continue
            labels = metadata.get("labels", {})
            identifiers = {name.lower()}
            identifiers.update(str(labels.get(key, "")).lower() for key in ("app", "app.kubernetes.io/name", "app.kubernetes.io/instance", "name"))
            service_name = next((service for service, aliases in CORE_PRODUCT_SERVICES.items()
                                 if any(identifier == alias or identifier.startswith(f"{alias}-") for identifier in identifiers for alias in aliases)), None)
            if service_name is None:
                continue
            targets.append({
                "id": f"{namespace}/{name}",
                "namespace": namespace,
                "podName": name,
                "name": service_name,
                "status": phase,
            })
        return {"connected": True, "ready": True, "targets": targets, "error": None}
    except KubernetesConnectionError as error:
        return {"connected": False, "ready": False, "targets": [], "error": str(error)}


# Validates a requested fault and creates its Chaos Mesh custom resource.
def create_chaos_experiment(payload: dict[str, Any]) -> dict[str, Any]:
    namespace = str(payload.get("namespace", ""))
    pod_name = str(payload.get("podName", ""))
    fault_type = str(payload.get("faultType", ""))
    all_targets = pod_name == "all"
    duration = payload.get("duration", 15)
    latency_ms = payload.get("latencyMs", 2500)
    if all_targets:
        if fault_type not in {"SERVICE_DOWN", "LATENCY"}:
            raise KubernetesConnectionError("Choose one Kubernetes Pod for this Chaos Mesh fault.")
        discovered = get_chaos_targets()
        targets = discovered.get("targets", [])
        if not discovered.get("ready") or not targets:
            raise KubernetesConnectionError(discovered.get("error") or "No running core-product Pods are available.")
        selector_pods: dict[str, list[str]] = {}
        for target in targets:
            selector_pods.setdefault(target["namespace"], []).append(target["podName"])
        selector = {"namespaces": sorted(selector_pods), "pods": selector_pods}
        namespace = targets[0]["namespace"]
        pod_name = "all"
        target_pod = targets[0]
        pod = _get_json(f"/api/v1/namespaces/{target_pod['namespace']}/pods/{target_pod['podName']}")
    else:
        if not re.fullmatch(r"[a-z0-9]([-a-z0-9]*[a-z0-9])?", namespace) or not re.fullmatch(r"[a-z0-9]([-a-z0-9]*[a-z0-9])?", pod_name):
            raise KubernetesConnectionError("Choose a valid Kubernetes namespace and pod target.")
        pod = _get_json(f"/api/v1/namespaces/{namespace}/pods/{pod_name}")
        selector = {"namespaces": [namespace], "pods": {namespace: [pod_name]}}
    if not isinstance(duration, int) or not 1 <= duration <= 300:
        raise KubernetesConnectionError("Chaos Mesh duration must be from 1 to 300 seconds.")
    if pod.get("status", {}).get("phase") != "Running":
        raise KubernetesConnectionError("The selected Kubernetes pod is not Running.")
    resources = _get_json("/apis/chaos-mesh.org/v1alpha1").get("resources", [])
    kinds = {resource.get("kind") for resource in resources}
    name = f"dashboard-{fault_type.lower().replace('_', '-')}-{uuid.uuid4().hex[:10]}"
    if fault_type == "SERVICE_DOWN":
        kind = "PodChaos"
        spec = {"action": "pod-failure", "mode": "all" if all_targets else "one", "duration": f"{duration}s", "selector": selector}
    elif fault_type == "POD_RESTART":
        kind = "PodChaos"
        spec = {"action": "pod-kill", "mode": "one", "duration": f"{duration}s", "selector": selector}
    elif fault_type == "LATENCY":
        kind = "NetworkChaos"
        spec = {"action": "delay", "mode": "all" if all_targets else "one", "duration": f"{duration}s", "selector": selector, "delay": {"latency": f"{max(1, min(int(latency_ms), 30000))}ms"}}
    elif fault_type == "API_ERROR":
        kind = "HTTPChaos"
        error_rate = payload.get("errorRate", 35)
        if not isinstance(error_rate, (int, float)) or not 1 <= error_rate <= 100:
            raise KubernetesConnectionError("HTTP 500 pod percentage must be from 1 to 100.")
        containers = pod.get("spec", {}).get("containers", [])
        ports = [port.get("containerPort") for container in containers for port in container.get("ports", []) if isinstance(port.get("containerPort"), int)]
        if not ports:
            raise KubernetesConnectionError("The selected pod does not declare an HTTP container port for HTTPChaos.")
        spec = {
            "mode": "fixed-percent",
            "value": str(round(error_rate)),
            "duration": f"{duration}s",
            "selector": selector,
            "target": "Response",
            "port": ports[0],
            "replace": {"code": 500},
        }
    elif fault_type in {"HIGH_CPU", "HIGH_MEMORY"}:
        kind = "StressChaos"
        stressors = {"cpu": {"workers": 1, "load": 90}} if fault_type == "HIGH_CPU" else {"memory": {"workers": 1, "size": "128MiB"}}
        spec = {"mode": "one", "duration": f"{duration}s", "selector": selector, "stressors": stressors}
    else:
        raise KubernetesConnectionError(f"{fault_type} is not currently supported by the Chaos Mesh integration.")
    if kind not in kinds:
        raise KubernetesConnectionError(f"Chaos Mesh {kind} CRD is not installed.")
    resource = {"apiVersion": "chaos-mesh.org/v1alpha1", "kind": kind, "metadata": {"name": name, "namespace": namespace}, "spec": spec}
    resource_name = {"PodChaos": "podchaos", "NetworkChaos": "networkchaos", "StressChaos": "stresschaos", "HTTPChaos": "httpchaos"}[kind]
    _request_json("POST", f"/apis/chaos-mesh.org/v1alpha1/namespaces/{namespace}/{resource_name}", resource)
    return {"name": name, "namespace": namespace, "podName": pod_name, "targetName": "All Microservices" if all_targets else None, "kind": kind, "faultType": fault_type, "duration": duration}


# Deletes dashboard-managed Chaos Mesh experiments from the cluster.
def clear_chaos_experiments() -> dict[str, Any]:
    cleared = 0
    for kind in ("podchaos", "networkchaos", "stresschaos", "httpchaos"):
        try:
            items = _get_json(f"/apis/chaos-mesh.org/v1alpha1/{kind}").get("items", [])
        except KubernetesConnectionError:
            continue
        for item in items:
            metadata = item.get("metadata", {})
            if not metadata.get("name", "").startswith("dashboard-"):
                continue
            namespace = metadata.get("namespace", "default")
            _request_json("DELETE", f"/apis/chaos-mesh.org/v1alpha1/namespaces/{namespace}/{kind}/{metadata['name']}")
            cleared += 1
    return {"cleared": cleared}


# Collects core-product Pod, deployment, restart, and HPA health data.
def get_cluster_snapshot() -> dict[str, Any]:
    try:
        pods_response = _get_json("/api/v1/pods?limit=500")
        deployments_response = _get_json("/apis/apps/v1/deployments?limit=500")
        hpas_response = _get_json("/apis/autoscaling/v2/horizontalpodautoscalers?limit=500")
    except KubernetesConnectionError as error:
        return {"connected": False, "validation": None, "error": str(error)}

    # Identifies which core-product service owns a Kubernetes resource.
    def core_service_for(resource: dict[str, Any]) -> str | None:
        metadata = resource.get("metadata", {})
        identifiers = {str(metadata.get("name", "")).lower()}
        labels = metadata.get("labels", {})
        identifiers.update(str(labels.get(key, "")).lower() for key in ("app", "app.kubernetes.io/name", "app.kubernetes.io/instance", "name"))
        return next((service for service, aliases in CORE_PRODUCT_SERVICES.items()
                     if any(identifier == alias or identifier.startswith(f"{alias}-") for identifier in identifiers for alias in aliases)), None)

    pods = pods_response.get("items", [])
    core_pods = [(pod, core_service_for(pod)) for pod in pods]
    core_pods = [(pod, service) for pod, service in core_pods if service and not pod.get("metadata", {}).get("deletionTimestamp")]
    deployments = deployments_response.get("items", [])
    core_deployments = [deployment for deployment in deployments if core_service_for(deployment)]
    chaos_failed_pods: set[str] = set()
    try:
        pod_chaos_items = _get_json("/apis/chaos-mesh.org/v1alpha1/podchaos?limit=500").get("items", [])
    except KubernetesConnectionError:
        pod_chaos_items = []
    for experiment in pod_chaos_items:
        metadata = experiment.get("metadata", {})
        spec = experiment.get("spec", {})
        conditions = experiment.get("status", {}).get("conditions", [])
        injected = any(condition.get("type") == "AllInjected" and condition.get("status") == "True" for condition in conditions)
        recovered = any(condition.get("type") == "AllRecovered" and condition.get("status") == "True" for condition in conditions)
        if not metadata.get("name", "").startswith("dashboard-") or spec.get("action") != "pod-failure" or not injected or recovered:
            continue
        for record in experiment.get("status", {}).get("experiment", {}).get("containerRecords", []):
            target_id = record.get("id")
            if target_id:
                chaos_failed_pods.add(str(target_id))
    hpas = []
    core_deployment_names = {str(item.get("metadata", {}).get("name", "")) for item in core_deployments}
    core_namespaces = {str(item.get("metadata", {}).get("namespace", "default")) for item in core_deployments}
    for hpa in hpas_response.get("items", []):
        hpa_metadata = hpa.get("metadata", {})
        if hpa_metadata.get("namespace", "default") not in core_namespaces or hpa.get("spec", {}).get("scaleTargetRef", {}).get("name") not in core_deployment_names:
            continue
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

    container_restarts_by_service = {
        service_name: sum(
            container.get("restartCount", 0)
            for pod, pod_service in core_pods if pod_service == service_name
            for container in pod.get("status", {}).get("containerStatuses", [])
        )
        for service_name in CORE_PRODUCT_SERVICES
    }
    current_uids_by_service = {
        service_name: {
            str(pod.get("metadata", {}).get("uid") or pod.get("metadata", {}).get("name", ""))
            for pod, pod_service in core_pods
            if pod_service == service_name
        }
        for service_name in CORE_PRODUCT_SERVICES
    }
    with _POD_HISTORY_LOCK:
        for service_name, current_uids in current_uids_by_service.items():
            previous_uids = _LAST_CORE_POD_UIDS.get(service_name)
            if previous_uids is not None and current_uids:
                replacement_count = len(current_uids - previous_uids)
                if replacement_count:
                    _OBSERVED_POD_REPLACEMENTS[service_name] += replacement_count
            if current_uids:
                _LAST_CORE_POD_UIDS[service_name] = current_uids
        replacement_counts = dict(_OBSERVED_POD_REPLACEMENTS)
    restart_count = sum(container_restarts_by_service.values()) + sum(replacement_counts.values())
    desired_replicas = sum(deployment.get("spec", {}).get("replicas", 0) for deployment in core_deployments)
    ready_replicas = sum(deployment.get("status", {}).get("readyReplicas", 0) for deployment in core_deployments)
    service_summaries = []
    core_pod_summaries = []
    for service_name in CORE_PRODUCT_SERVICES:
        service_pods = [pod for pod, name in core_pods if name == service_name]
        service_summaries.append({
            "name": service_name,
            "podCount": len(service_pods),
            "readyPodCount": sum(1 for pod in service_pods if pod.get("status", {}).get("phase") == "Running" and all(c.get("ready", False) for c in pod.get("status", {}).get("containerStatuses", [])) and f"{pod.get('metadata', {}).get('namespace', 'default')}/{pod.get('metadata', {}).get('name', '')}" not in chaos_failed_pods),
            "restartCount": container_restarts_by_service[service_name] + replacement_counts[service_name],
        })
        for pod in service_pods:
            metadata = pod.get("metadata", {})
            pod_status = pod.get("status", {})
            container_statuses = pod_status.get("containerStatuses", [])
            target_id = f"{metadata.get('namespace', 'default')}/{metadata.get('name', '')}"
            pod_is_ready = bool(container_statuses) and all(container.get("ready", False) for container in container_statuses) and target_id not in chaos_failed_pods
            core_pod_summaries.append({
                "id": target_id,
                "namespace": metadata.get("namespace", "default"),
                "podName": metadata.get("name", ""),
                "name": service_name,
                "phase": pod_status.get("phase", "Unknown"),
                "ready": pod_is_ready,
                "chaosFaultActive": target_id in chaos_failed_pods,
                "restartCount": sum(container.get("restartCount", 0) for container in container_statuses),
                "port": next((port.get("containerPort") for container in pod.get("spec", {}).get("containers", []) for port in container.get("ports", []) if isinstance(port.get("containerPort"), int)), None),
            })

    ready_pod_count = sum(1 for pod in core_pod_summaries if pod["ready"] and pod["phase"] == "Running")
    ready_replicas = min(ready_replicas, ready_pod_count)

    return {
        "connected": True,
        "validation": {
            "podCount": len(core_pods),
            "podRestartCount": restart_count,
            "deploymentCount": len(core_deployments),
            "desiredReplicas": desired_replicas,
            "readyReplicas": ready_replicas,
            "coreServices": service_summaries,
            "corePods": core_pod_summaries,
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
