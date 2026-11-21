"""Discover services exposed by the configured telemetry and Kubernetes APIs."""

from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any
from urllib.parse import quote

import requests

from app.telemetry import (
    JAEGER_URL,
    LOKI_URL,
    PROMETHEUS_URL,
    TIMEOUT,
    backend_request_options,
)

_KUBERNETES_TOKEN_PATH = Path(
    "/var/run/secrets/kubernetes.io/serviceaccount/token"
)
_KUBERNETES_CA_PATH = Path(
    "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"
)
_service_lock = Lock()


def _get_json(
    base_url: str,
    path: str,
    params: dict[str, str] | None = None,
    *,
    headers: dict[str, str] | None = None,
    verify: str | bool | None = None,
) -> tuple[dict[str, Any] | None, str | None]:
    try:
        options = backend_request_options(base_url)
        if headers is not None:
            options["headers"] = headers
        if verify is not None:
            options["verify"] = verify
        response = requests.get(
            f"{base_url.rstrip('/')}{path}",
            params=params,
            timeout=TIMEOUT,
            **options,
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            return None, "The endpoint returned a non-object JSON response."
        return payload, None
    except requests.RequestException as exc:
        status = exc.response.status_code if exc.response is not None else None
        return None, f"HTTP {status}" if status else "Could not reach the configured endpoint."
    except ValueError as exc:
        return None, f"The endpoint returned invalid JSON: {exc}"


def _source(
    connected: bool,
    count: int = 0,
    error: str | None = None,
    **extra: Any,
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "configured": True,
        "connected": connected,
        "count": count,
    }
    if error:
        result["error"] = error
    result.update(extra)
    return result


def _add_service(
    services: dict[tuple[str | None, str], dict[str, Any]],
    name: str,
    source: str,
    namespace: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    normalized_name = name.strip()
    if not normalized_name:
        return
    key = (namespace, normalized_name)
    with _service_lock:
        service = services.setdefault(
            key,
            {
                "name": normalized_name,
                "namespace": namespace,
                "sources": [],
            },
        )
        if source not in service["sources"]:
            service["sources"].append(source)
        if details:
            service.update(details)


def _discover_prometheus(
    services: dict[tuple[str | None, str], dict[str, Any]],
) -> dict[str, Any]:
    payload, error = _get_json(PROMETHEUS_URL, "/api/v1/targets", {"state": "active"})
    if error or not payload or payload.get("status") != "success":
        return _source(
            False,
            error=error or "Prometheus did not return a successful target response.",
        )

    targets = payload.get("data", {}).get("activeTargets", [])
    discovered: set[str] = set()
    for target in targets if isinstance(targets, list) else []:
        labels = target.get("labels") or target.get("discoveredLabels") or {}
        name = next(
            (
                str(labels[key]).strip()
                for key in (
                    "service_name",
                    "service",
                    "app_service",
                    "app",
                    "job",
                    "application",
                )
                if labels.get(key)
            ),
            "",
        )
        if name:
            discovered.add(name)
            _add_service(services, name, "prometheus")
    return _source(True, len(discovered))


def _discover_jaeger(
    services: dict[tuple[str | None, str], dict[str, Any]],
) -> dict[str, Any]:
    payload, error = _get_json(JAEGER_URL, "/api/services")
    if error or not payload:
        return _source(False, error=error or "Jaeger returned no response.")
    names = payload.get("data", [])
    if not isinstance(names, list):
        return _source(False, error="Jaeger returned an invalid service list.")
    discovered = {str(name).strip() for name in names if str(name).strip()}
    for name in discovered:
        _add_service(services, name, "jaeger")
    return _source(True, len(discovered))


def _discover_loki() -> dict[str, Any]:
    try:
        response = requests.get(
            f"{LOKI_URL.rstrip('/')}/ready",
            timeout=TIMEOUT,
            **backend_request_options(LOKI_URL),
        )
        response.raise_for_status()
        return _source(True)
    except requests.RequestException as exc:
        status = exc.response.status_code if exc.response is not None else None
        message = f"HTTP {status}" if status else "Could not reach the configured endpoint."
        return _source(False, error=message)


def _kubernetes_config() -> tuple[str | None, dict[str, str], str | bool, str | None]:
    url = os.getenv("KUBERNETES_URL", "").strip()
    if not url and os.getenv("KUBERNETES_SERVICE_HOST"):
        host = os.environ["KUBERNETES_SERVICE_HOST"]
        port = os.getenv("KUBERNETES_SERVICE_PORT_HTTPS", "443")
        url = f"https://{host}:{port}"

    if not url:
        return None, {}, True, None

    token = os.getenv("KUBERNETES_BEARER_TOKEN", "").strip()
    if not token and _KUBERNETES_TOKEN_PATH.is_file():
        token = _KUBERNETES_TOKEN_PATH.read_text(encoding="utf-8").strip()
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    ca_path = os.getenv("KUBERNETES_CA_CERT", "").strip()
    if not ca_path and _KUBERNETES_CA_PATH.is_file():
        ca_path = str(_KUBERNETES_CA_PATH)
    verify: str | bool = ca_path or True
    namespace = os.getenv("KUBERNETES_NAMESPACE", "").strip() or None
    return url, headers, verify, namespace


def _kubernetes_list(
    base_url: str,
    api_path: str,
    headers: dict[str, str],
    verify: str | bool,
) -> tuple[list[dict[str, Any]] | None, str | None]:
    items: list[dict[str, Any]] = []
    continuation: str | None = None
    for _ in range(20):
        params = {"limit": "500"}
        if continuation:
            params["continue"] = continuation
        payload, error = _get_json(
            base_url, api_path, params, headers=headers, verify=verify
        )
        if error or not payload:
            return None, error or "Kubernetes returned no response."
        page = payload.get("items")
        if not isinstance(page, list):
            return None, "Kubernetes returned an invalid resource list."
        items.extend(item for item in page if isinstance(item, dict))
        continuation = payload.get("metadata", {}).get("continue")
        if not continuation:
            return items, None
    return items, "Kubernetes discovery stopped after 10,000 resources."


def _discover_kubernetes(
    services: dict[tuple[str | None, str], dict[str, Any]],
) -> dict[str, Any]:
    base_url, headers, verify, namespace = _kubernetes_config()
    if not base_url:
        return {
            "configured": False,
            "connected": False,
            "count": 0,
            "error": "Set KUBERNETES_URL or run the engine inside a Kubernetes cluster.",
        }

    path = (
        f"/api/v1/namespaces/{quote(namespace, safe='')}/services"
        if namespace
        else "/api/v1/services"
    )
    resources, error = _kubernetes_list(base_url, path, headers, verify)
    if error or resources is None:
        return _source(False, error=error or "Kubernetes returned no services.")
    deployment_path = (
        f"/apis/apps/v1/namespaces/{quote(namespace, safe='')}/deployments"
        if namespace
        else "/apis/apps/v1/deployments"
    )
    deployments, deployment_error = _kubernetes_list(
        base_url, deployment_path, headers, verify
    )
    workloads = []
    for deployment in deployments or []:
        metadata = deployment.get("metadata") or {}
        spec = deployment.get("spec") or {}
        status = deployment.get("status") or {}
        name = str(metadata.get("name") or "").strip()
        deployment_namespace = str(
            metadata.get("namespace") or namespace or ""
        ).strip() or None
        if name:
            workloads.append({
                "name": name,
                "namespace": deployment_namespace,
                "desiredReplicas": int(spec.get("replicas") or 0),
                "readyReplicas": int(status.get("readyReplicas") or 0),
                "availableReplicas": int(status.get("availableReplicas") or 0),
            })

    discovered: set[tuple[str | None, str]] = set()
    for resource in resources:
        metadata = resource.get("metadata") or {}
        name = str(metadata.get("name") or "").strip()
        resource_namespace = str(metadata.get("namespace") or namespace or "").strip() or None
        if not name or name == "kubernetes":
            continue
        spec = resource.get("spec") or {}
        ports = [
            {
                "name": port.get("name"),
                "port": port.get("port"),
                "protocol": port.get("protocol", "TCP"),
            }
            for port in spec.get("ports", [])
            if isinstance(port, dict)
        ]
        details = {
            "type": spec.get("type", "ClusterIP"),
            "clusterIP": spec.get("clusterIP"),
            "ports": ports,
        }
        _add_service(services, name, "kubernetes", resource_namespace, details)
        discovered.add((resource_namespace, name))
    return _source(
        True,
        len(discovered),
        namespace=namespace,
        workloads=workloads,
        workloadsError=deployment_error,
    )


def discover_services() -> dict[str, Any]:
    """Return discovered services and source health without exposing credentials."""
    services: dict[tuple[str | None, str], dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=4) as executor:
        prometheus_future = executor.submit(_discover_prometheus, services)
        loki_future = executor.submit(_discover_loki)
        jaeger_future = executor.submit(_discover_jaeger, services)
        kubernetes_future = executor.submit(_discover_kubernetes, services)
        sources = {
            "prometheus": prometheus_future.result(),
            "loki": loki_future.result(),
            "jaeger": jaeger_future.result(),
            "kubernetes": kubernetes_future.result(),
        }
    workloads = sources["kubernetes"].pop("workloads", [])
    sources["kubernetes"]["workloadsError"] = sources["kubernetes"].pop(
        "workloadsError", None
    )
    return {
        "services": sorted(
            services.values(),
            key=lambda item: (item["namespace"] or "", item["name"]),
        ),
        "workloads": workloads,
        "sources": sources,
        "discoveredAt": datetime.now(timezone.utc).isoformat(),
    }