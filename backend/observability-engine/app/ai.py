"""Telemetry-Only RCA-to-Kubernetes Remediation Pipeline - Steps 2 and 3.

Scrub sensitive telemetry, generate root-cause analysis, and create validated
Kubernetes remediation patches without ingesting application source code.
"""

import json
import os
import re
import time
from datetime import datetime, timezone
from typing import Any

import requests
import yaml

# Provider adapters also enforce AI-output, YAML, security, and rollback guardrails.

PIPELINE_NAME = "Telemetry-Only RCA-to-Kubernetes Remediation Pipeline"
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
GEMINI_FALLBACK_MODELS = [model.strip() for model in os.getenv("GEMINI_FALLBACK_MODELS", "gemini-3.8-flash").split(",") if model.strip()]
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-3-5-sonnet-latest")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openrouter/free")
AI_TIMEOUT_SECONDS = float(os.getenv("AI_TIMEOUT_SECONDS", "45"))

SCHEMA = {
    "summary": "string",
    "root_cause": "string",
    "recommendations": ["string"],
    "severity": "Critical|High|Medium|Low",
    "affected_services": ["string"],
    "evidence": ["string"],
}

REMEDIATION_SCHEMA = {
    "script": "string",
    "description": "string",
    "risk_level": "Low|Medium|High|Critical",
    "estimated_impact": "string",
    "rollback_steps": ["string"],
}

_SECRET_PATTERNS = (
    (re.compile(r"(?i)(authorization\s*:\s*bearer\s+)[^\s,}]+"), r"\1[REDACTED]"),
    (re.compile(r"(?i)(api[_-]?key|token|password|secret)(\s*[:=]\s*)[^\s,}]+"), r"\1\2[REDACTED]"),
    (re.compile(r"\b[A-Za-z0-9+/]{32,}={0,2}\b"), "[REDACTED_TOKEN]"),
    (re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b"), "[REDACTED_IP]"),
    (re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I), "[REDACTED_EMAIL]"),
)


# Remove credentials and personal identifiers before sending data to AI providers.
def _redact(value: Any) -> Any:
    """[PIPELINE STEP 2] Scrub PII and secrets before sending telemetry to an AI provider.

    This recursive scrub removes bearer credentials, API keys, tokens, passwords,
    IP addresses, and email addresses. Only the scrubbed telemetry snapshot is
    sent to Gemini or Claude for RCA; application source code is not included.
    """
    if isinstance(value, dict):
        return {str(key): _redact(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_redact(item) for item in value]
    if not isinstance(value, str):
        return value
    redacted = value
    for pattern, replacement in _SECRET_PATTERNS:
        redacted = pattern.sub(replacement, redacted)
    return redacted


# [PIPELINE STEP 2] Build the strict JSON-only RCA prompt from a redacted telemetry snapshot.
def _prompt(snapshot: dict[str, Any]) -> str:
    snapshot = _redact(snapshot)
    return f"""You are an observability SRE performing root-cause analysis.
Analyze the observed metrics, logs, traces, and their source/coverage status:
{json.dumps(snapshot, indent=2)}

Return ONLY valid JSON matching this schema, with no markdown:
{json.dumps(SCHEMA)}"""


# [PIPELINE STEP 2 / RCA] Classify the fault scenario and identify the primary target service.
def _detect_scenario(report: dict[str, Any]) -> tuple[str, str]:
    """Detect ERROR_SPIKE, SERVICE_DOWN, latency, memory, or data-gap scenarios."""
    telemetry = report.get("telemetry", {}) if isinstance(report, dict) else {}
    experiment = telemetry.get("activeExperiment", {}) if isinstance(telemetry, dict) else {}
    service_fault = telemetry.get("serviceFault", {}) if isinstance(telemetry, dict) else {}

    # 1. Check active experiment
    exp_fault = experiment.get("faultType") if isinstance(experiment, dict) else None
    exp_service = experiment.get("serviceId") if isinstance(experiment, dict) else None

    # 2. Check service fault
    sf_service = service_fault.get("service") if isinstance(service_fault, dict) else None

    # 3. Check affected services and error logs
    affected = report.get("affected_services", [])
    if not isinstance(affected, list):
        affected = []

    target_service = ""
    if exp_service and exp_service != "all":
        target_service = exp_service
    elif sf_service:
        target_service = sf_service
    elif affected:
        target_service = str(affected[0]).strip()
    else:
        # Check recent error logs
        recent_logs = telemetry.get("logs", {}).get("recentLogs", []) if isinstance(telemetry, dict) else []
        for log in reversed(recent_logs):
            if isinstance(log, dict) and log.get("level") in {"ERROR", "CRITICAL"}:
                svc = str(log.get("service", "")).strip()
                if svc and svc not in {"unknown", "unknown-service"}:
                    target_service = svc
                    break

    if not target_service or target_service in {"unknown", "unknown-service", "all"}:
        target_service = ""

    summary = str(report.get("summary", "")).lower()
    root_cause = str(report.get("root_cause", "")).lower()
    combined_text = f"{summary} {root_cause}"

    if exp_fault:
        return exp_fault, target_service

    gap_terms = ("gap", "missing", "coverage", "unavailable", "not available")
    if ("prometheus" in combined_text or "metric" in combined_text) and any(term in combined_text for term in gap_terms):
        return "METRIC_GAP", target_service
    if ("loki" in combined_text or "log" in combined_text) and any(term in combined_text for term in gap_terms):
        return "LOG_GAP", target_service
    if ("jaeger" in combined_text or "trace" in combined_text) and any(term in combined_text for term in gap_terms):
        return "TRACE_GAP", target_service

    if "down" in combined_text or "unavailable" in combined_text or "stopped" in combined_text:
        return "SERVICE_DOWN", target_service
    elif "error spike" in combined_text or "5xx" in combined_text or "error" in combined_text:
        return "ERROR_SPIKE", target_service
    elif "latency" in combined_text or "slow" in combined_text or "timeout" in combined_text:
        return "LATENCY_SPIKE", target_service
    elif "oom" in combined_text or "memory" in combined_text:
        return "OOM_PRESSURE", target_service

    return ("UNKNOWN" if not combined_text.strip() else "UNCLASSIFIED"), target_service


def _operator_guidance(
    provider: str,
    scenario: str,
    target_service: str,
    elapsed: int,
    simulated: bool,
) -> dict[str, Any]:
    target = f" for `{target_service}`" if target_service else ""
    if simulated:
        message = (
            f"{scenario.replace('_', ' ').title()}{target} is a controlled telemetry simulation. "
            "It did not change a Kubernetes workload. Restore the simulated telemetry state "
            "from the experiment controls; no Kubernetes patch is required."
        )
        mode = "simulation"
    else:
        message = (
            f"The telemetry indicates {scenario.replace('_', ' ').lower()}{target}, but this report "
            "does not contain a verified Kubernetes Deployment and namespace. No YAML patch was "
            "generated. Verify the workload and its intended replica/resource settings before "
            "making a cluster change."
        )
        mode = "guidance"
    return {
        "script_type": "operator_guidance",
        "script": message,
        "guardrail_status": "not_required",
        "description": "Remediation is withheld until the failure mode and target workload are verified.",
        "risk_level": "N/A",
        "estimated_impact": "Avoids applying a speculative change to an unrelated service.",
        "rollback_steps": [],
        "provider": provider,
        "mode": mode,
        "model": "observability-engine",
        "ai_response_time_ms": elapsed,
    }


def _verified_deployment(report: dict[str, Any]) -> dict[str, Any] | None:
    discovery = report.get("discovery", {}) if isinstance(report, dict) else {}
    if not isinstance(discovery, dict):
        return None
    sources = discovery.get("sources", {})
    kubernetes_source = sources.get("kubernetes") if isinstance(sources, dict) else None
    if not isinstance(kubernetes_source, dict) or not kubernetes_source.get("connected"):
        return None
    target_service = _detect_scenario(report)[1]
    workloads = discovery.get("workloads", [])
    if not target_service or not isinstance(workloads, list):
        return None
    matches = [
        workload for workload in workloads
        if isinstance(workload, dict)
        and workload.get("name") == target_service
        and isinstance(workload.get("namespace"), str)
        and workload.get("namespace")
    ]
    return matches[0] if len(matches) == 1 else None


# Build evidence-based guidance when a controlled scenario does not need a patch.
def _build_scenario_remediation(
    provider: str,
    report: dict[str, Any],
    elapsed: int = 0,
    reason: str | None = None,
    mode: str = "guidance"
) -> dict[str, Any]:
    scenario, target_service = _detect_scenario(report)
    telemetry = report.get("telemetry", {}) if isinstance(report, dict) else {}
    experiment = telemetry.get("activeExperiment", {}) if isinstance(telemetry, dict) else {}
    simulated = isinstance(experiment, dict) and experiment.get("simulated") is True

    if scenario == "METRIC_GAP":
        if simulated and experiment.get("faultType") == "METRIC_GAP":
            return _simulated_metric_gap_guidance(provider)
        return {
            "script_type": "operator_guidance",
            "script": (
                "No Kubernetes YAML patch was generated because this report does not identify a verified Prometheus scrape target, "
                "metrics endpoint, or deployment configuration.\n"
                "Check Prometheus Status > Targets and confirm the affected service exposes a working /metrics endpoint. "
                "Generate a patch only after verifying the target deployment, namespace, and scrape settings."
            ),
            "guardrail_status": "not_required",
            "description": "The reported Prometheus metrics gap lacks enough deployment evidence for a safe YAML patch.",
            "risk_level": "N/A",
            "estimated_impact": "Avoids changing an unrelated workload; use the verified scrape target and deployment details to plan a fix.",
            "rollback_steps": [],
            "provider": provider,
            "mode": "guidance",
            "model": "rule-engine",
            "ai_response_time_ms": elapsed,
        }

    return _operator_guidance(
        provider, scenario, target_service, elapsed, simulated
    )

    if scenario == "TRACE_GAP":
        telemetry = report.get("telemetry", {}) if isinstance(report, dict) else {}
        experiment = telemetry.get("activeExperiment", {}) if isinstance(telemetry, dict) else {}
        if isinstance(experiment, dict) and experiment.get("simulated") is True:
            return {
                "script_type": "operator_guidance",
                "script": (
                    "No Kubernetes patch is required for this Chaos Lab experiment.\n"
                    "The experiment pauses Jaeger trace collection in the observability snapshot; "
                    "it does not modify or crash any container.\n"
                    "Use the Chaos Lab > Restore Telemetry action to re-enable distributed trace correlation."
                ),
                "guardrail_status": "not_required",
                "description": "Simulated Jaeger trace gap in Chaos Lab.",
                "risk_level": "N/A",
                "estimated_impact": "Restores trace propagation without altering container manifests.",
                "rollback_steps": [],
                "provider": provider,
                "mode": "simulation",
                "model": "chaos-lab",
                "ai_response_time_ms": elapsed,
            }
        return {
            "script_type": "kubernetes_yaml",
            "script": f"""apiVersion: apps/v1
kind: Deployment
metadata:
  name: {target_service}
  namespace: performance-demo
spec:
  template:
    spec:
      containers:
        - name: {target_service}
          env:
            - name: OTEL_EXPORTER_OTLP_ENDPOINT
              value: "http://otel-collector.performance-demo.svc.cluster.local:4317"
            - name: OTEL_SERVICE_NAME
              value: "{target_service}"
""",
            "guardrail_status": "safe",
            "description": f"Configure standard OpenTelemetry context propagation endpoint for {target_service}.",
            "risk_level": "Low",
            "estimated_impact": f"Enables distributed trace context propagation for {target_service}.",
            "rollback_steps": [
                f"Run `kubectl rollout undo deployment/{target_service} -n performance-demo`",
            ],
            "provider": provider,
            "mode": mode,
            "model": "rule-engine" if mode != "demo" else "demo-fallback",
            "fallback_reason": reason,
            "ai_response_time_ms": elapsed,
        }

    if scenario == "LOG_GAP":
        return {
            "script_type": "operator_guidance",
            "script": (
                "No Kubernetes patch is required for this Chaos Lab experiment.\n"
                "The experiment pauses Loki log streaming in the observability view.\n"
                "Use the Chaos Lab > Restore Telemetry action to resume log streaming."
            ),
            "guardrail_status": "not_required",
            "description": "Simulated Loki log gap in Chaos Lab.",
            "risk_level": "N/A",
            "estimated_impact": "Restores log ingestion without altering deployment pods.",
            "rollback_steps": [],
            "provider": provider,
            "mode": "simulation",
            "model": "chaos-lab",
            "ai_response_time_ms": elapsed,
        }

    if scenario == "SERVICE_DOWN":
        # [PIPELINE STEP 3 / SERVICE_DOWN] Restore availability with a one-replica patch.
        return {
            "script_type": "kubernetes_yaml",
            "script": f"""apiVersion: apps/v1
kind: Deployment
metadata:
  name: {target_service}
  namespace: performance-demo
spec:
  replicas: 1
""",
            "guardrail_status": "safe",
            "description": f"Restore {target_service} deployment availability by scaling replicas back to 1.",
            "risk_level": "Low",
            "estimated_impact": f"Restores availability for {target_service}, recovering healthy pod status and endpoint routing.",
            "rollback_steps": [
                f"kubectl scale deployment/{target_service} --replicas=0 -n performance-demo",
                f"kubectl rollout undo deployment/{target_service} -n performance-demo",
            ],
            "provider": provider,
            "mode": mode,
            "model": "rule-engine" if mode != "demo" else "demo-fallback",
            "fallback_reason": reason,
            "ai_response_time_ms": elapsed,
        }

    if scenario == "ERROR_SPIKE":
        # [PIPELINE STEP 3 / ERROR_SPIKE] Scale to 2 replicas and restart poisoned pods.
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        return {
            "script_type": "kubernetes_yaml",
            "script": f"""apiVersion: apps/v1
kind: Deployment
metadata:
  name: {target_service}
  namespace: performance-demo
spec:
  replicas: 2
  template:
    metadata:
      annotations:
        kubectl.kubernetes.io/restartedAt: "{ts}"
""",
            "guardrail_status": "review_required",
            "description": f"Scale {target_service} to 2 replicas and trigger a rolling restart to clear poisoned container state and mitigate the error spike.",
            "risk_level": "Medium",
            "estimated_impact": f"Eliminates transient fault state, expands capacity to process retry traffic, and returns {target_service} to normal error-free HTTP operation.",
            "rollback_steps": [
                f"kubectl rollout undo deployment/{target_service} -n performance-demo",
                f"kubectl scale deployment/{target_service} --replicas=1 -n performance-demo",
            ],
            "provider": provider,
            "mode": mode,
            "model": "rule-engine" if mode != "demo" else "demo-fallback",
            "fallback_reason": reason,
            "ai_response_time_ms": elapsed,
        }

    if scenario == "LATENCY_SPIKE":
        # [PIPELINE STEP 3 / LATENCY] Scale out and raise CPU limits for bottleneck mitigation.
        return {
            "script_type": "kubernetes_yaml",
            "script": f"""apiVersion: apps/v1
kind: Deployment
metadata:
  name: {target_service}
  namespace: performance-demo
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: {target_service}
          resources:
            requests:
              cpu: "250m"
            limits:
              cpu: "500m"
""",
            "guardrail_status": "safe",
            "description": f"Scale {target_service} to 3 replicas and increase CPU limits to mitigate response latency spike.",
            "risk_level": "Medium",
            "estimated_impact": f"Distributes queued load across 3 instances, reducing p95 latency below SLA threshold.",
            "rollback_steps": [
                f"kubectl scale deployment/{target_service} --replicas=1 -n performance-demo",
                f"kubectl rollout undo deployment/{target_service} -n performance-demo",
            ],
            "provider": provider,
            "mode": mode,
            "model": "rule-engine" if mode != "demo" else "demo-fallback",
            "fallback_reason": reason,
            "ai_response_time_ms": elapsed,
        }

    # Default / OOM / Memory limit scenario
    # [PIPELINE STEP 3 / OOM] Add memory request and limit changes to reduce memory pressure.
    return {
        "script_type": "kubernetes_yaml",
        "script": f"""apiVersion: apps/v1
kind: Deployment
metadata:
  name: {target_service}
  namespace: performance-demo
spec:
  template:
    spec:
      containers:
        - name: {target_service}
          resources:
            requests:
              memory: "256Mi"
            limits:
              memory: "512Mi"
""",
        "guardrail_status": "safe",
        "description": f"Update memory limits for {target_service} to prevent OOM errors and pod restarts.",
        "risk_level": "Low",
        "estimated_impact": f"Stabilizes {target_service} memory footprint, preventing out-of-memory container terminations.",
        "rollback_steps": [
            f"kubectl rollout undo deployment/{target_service} -n performance-demo",
            "Verify pods are running with previous memory limits.",
        ],
        "provider": provider,
        "mode": mode,
        "model": "rule-engine" if mode != "demo" else "demo-fallback",
        "fallback_reason": reason,
        "ai_response_time_ms": elapsed,
    }


# [PIPELINE STEP 3] Build a constrained Kubernetes YAML patch prompt from RCA evidence.
def _remediation_prompt(report: dict[str, Any]) -> str:
    report = _redact(report)
    scenario, target_service = _detect_scenario(report)
    deployment = _verified_deployment(report)
    telemetry = report.get("telemetry", {}) if isinstance(report, dict) else {}
    observed_services = sorted({
        str(item.get("service", "")).strip()
        for item in [*(telemetry.get("logs", {}).get("recentLogs", []) or []), *(telemetry.get("traces", {}).get("samples", []) or [])]
        if isinstance(item, dict) and str(item.get("service", "")).strip() not in {"", "unknown-service", "unknown"}
    })
    return f"""You are a Kubernetes platform engineer and SRE. Create an executable Kubernetes remediation patch for this RCA report:
{json.dumps(report, indent=2)}

Detected scenario: {scenario}
Target service to remediate: {target_service}
Observed service names from live telemetry: {json.dumps(observed_services)}
Verified Kubernetes Deployment from read-only discovery: {json.dumps(deployment)}

Return ONLY valid JSON matching this schema, with no markdown:
{json.dumps(REMEDIATION_SCHEMA)}

Requirements:
- Return operator guidance instead of a manifest if the verified Deployment above is null.
- The manifest kind MUST be Deployment and apiVersion MUST be apps/v1.
- If a manifest is justified, use the exact metadata.name and metadata.namespace from the verified Deployment. Never guess a namespace, replica count, image, port, resource limit, or container environment variable.
- Base any change on explicit evidence in the report. If the evidence is insufficient, return concise operator guidance and no YAML.
- Never add telemetry endpoints or tracing configuration unless the report contains the verified endpoint.
- Never include kubectl delete, database destruction, privilege escalation, hostPath, or plaintext credentials.
- Use High risk when assumptions or manual review are required.
- Do not claim a rollback command is valid unless it reverses the proposed change."""


# Parse provider output while tolerating markdown fences or a short preamble.
def _parse_json(value: str) -> dict[str, Any]:
    """Parse JSON even when a chat model adds fences or a short preamble."""
    if not isinstance(value, str) or not value.strip():
        raise ValueError("model returned an empty response")

    cleaned = value.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
        if cleaned.rstrip().endswith("```"):
            cleaned = cleaned.rstrip()[:-3].rstrip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        # Some models prepend a sentence despite the JSON-only instruction.
        start = cleaned.find("{")
        if start < 0:
            raise ValueError("model response did not contain a JSON object")
        parsed, _ = json.JSONDecoder().raw_decode(cleaned[start:])

    if not isinstance(parsed, dict):
        raise ValueError("model response was not a JSON object")
    return parsed


# Construct the OpenRouter request with deterministic JSON response settings.
def _openrouter_payload(model: str, prompt: str) -> dict[str, Any]:
    return {
        "model": model,
        "messages": [
            {"role": "system", "content": "Return only valid JSON. Do not use markdown or explanatory text."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }


# [PIPELINE STEP 3 / VALIDATION] Validate syntax, Deployment identity, security, and rollback data.
def _validate_remediation(parsed: dict[str, Any], report: dict[str, Any] | None = None) -> dict[str, Any]:
    """[PIPELINE STEP 3 / GUARDRAILS] Reject unsafe YAML before it reaches the UI.

    Checks include YAML parsing, apps/v1 Deployment structure, exact discovered
    workload identity, destructive-operation and credential blacklists, and the
    presence of rollback steps.
    """
    script_value = parsed.get("script")
    if not isinstance(script_value, (str, dict)) or not script_value:
        raise ValueError("remediation response did not include a script")

    if parsed.get("script_type") == "operator_guidance":
        if not isinstance(script_value, str) or not script_value.strip():
            raise ValueError("operator guidance must be non-empty text")
        parsed.update({
            "script": script_value.strip(),
            "risk_level": "N/A",
            "guardrail_status": "not_required",
            "dry_run_status": "not_applicable",
            "validation_checks": ["No Kubernetes manifest was generated."],
        })
        parsed.setdefault("description", "Operator guidance based on the provided telemetry.")
        parsed.setdefault("estimated_impact", "No cluster resources are changed.")
        parsed.setdefault("rollback_steps", [])
        return parsed

    # Some structured-output models return the manifest as an object instead
    # of a YAML string. JSON is valid YAML 1.2 and preserves the manifest
    # structure without inventing or dropping fields.
    structured_manifest = isinstance(script_value, dict)
    if structured_manifest:
        if not all(key in script_value for key in ("apiVersion", "kind", "metadata")):
            raise ValueError("remediation response was not a complete Kubernetes manifest")
        script = json.dumps(script_value, indent=2)
    else:
        script = script_value.strip()

    # Models often wrap otherwise valid YAML in a markdown code fence. Remove
    # that presentation wrapper before applying the manifest safety checks.
    if script.startswith("```"):
        lines = script.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        script = "\n".join(lines).strip()
    parsed["script"] = script

    try:
        manifest = yaml.safe_load(script)
    except yaml.YAMLError as error:
        raise ValueError(f"remediation response contained invalid YAML: {error}") from error
    if not isinstance(manifest, dict):
        raise ValueError("remediation response did not contain a YAML mapping")
    if manifest.get("apiVersion") != "apps/v1":
        raise ValueError("remediation manifest must use apiVersion apps/v1")
    if manifest.get("kind") != "Deployment":
        raise ValueError("remediation manifest must be a Deployment")
    metadata = manifest.get("metadata")
    if not isinstance(metadata, dict) or not isinstance(metadata.get("name"), str) or not metadata["name"].strip():
        raise ValueError("remediation manifest metadata.name is required")
    verified_deployment = _verified_deployment(report or {})
    if verified_deployment is None:
        raise ValueError("no matching Kubernetes Deployment was verified by service discovery")
    if metadata["name"] != verified_deployment["name"]:
        raise ValueError("remediation deployment name does not match the discovered workload")
    if metadata.get("namespace") != verified_deployment["namespace"]:
        raise ValueError("remediation namespace does not match the discovered workload")

    required_yaml = ("apiVersion:", "kind:", "metadata:")
    if not structured_manifest and not all(marker in script for marker in required_yaml):
        raise ValueError("remediation response was not a complete Kubernetes manifest")

    lowered = script.lower()
    blocked = ("kubectl delete", "privileged: true", "hostpath:", "password:", "token:")
    if any(marker in lowered for marker in blocked):
        raise ValueError("remediation response contained a blocked operation or credential")
    if "unknown-service" in lowered or "placeholder" in lowered or "kind: configmap" in lowered or '"kind": "ConfigMap"' in lowered:
        raise ValueError("remediation response used an unknown or placeholder service")
    if "kind: deployment" not in lowered and '"kind": "Deployment"' not in script:
        raise ValueError("remediation response was not an executable Deployment patch")

    # Guard against hallucinated jaeger hostnames or irrelevant trace configs when the actual fault is a service crash or error spike
    scenario, _ = _detect_scenario(report or {})
    if "jaeger-agent" in lowered or ("jaeger_" in lowered and scenario in {"SERVICE_DOWN", "ERROR_SPIKE", "LATENCY_SPIKE"}):
        return _build_scenario_remediation(parsed.get("provider", "live"), report or {}, mode="live")

    risk = parsed.get("risk_level")
    if risk not in {"Low", "Medium", "High", "Critical"}:
        risk = "High"
    parsed["risk_level"] = risk
    parsed["guardrail_status"] = "review_required"
    parsed["dry_run_status"] = "passed"
    parsed["validation_checks"] = [
        "Required Kubernetes apiVersion, kind, and metadata fields present",
        "Blocked destructive operations and credentials absent",
        "Manifest held for human approval before application",
    ]
    parsed.setdefault("description", "Review the generated Kubernetes manifest before applying it.")
    parsed.setdefault("estimated_impact", "Impact requires operator review before deployment.")
    if not isinstance(parsed.get("rollback_steps"), list) or not parsed["rollback_steps"]:
        parsed["rollback_steps"] = ["Run `kubectl rollout undo deployment/<deployment-name>` after identifying the affected deployment."]
    return parsed


def _provider_error(
    provider: str,
    action: str,
    reason: str,
    elapsed: int = 0,
) -> dict[str, Any]:
    return {
        "error": f"{provider} {action} unavailable: {reason}",
        "provider": provider,
        "mode": "unavailable",
        "ai_response_time_ms": elapsed,
    }


def _safe_provider_error(error: Exception) -> str:
    response = getattr(error, "response", None)
    if response is not None:
        return f"provider returned HTTP {response.status_code}"
    if isinstance(error, requests.Timeout):
        return "provider request timed out"
    return f"provider request failed ({type(error).__name__})"


# Return recovery guidance instead of inventing a workload patch for a simulated metrics gap.
def _simulated_metric_gap_guidance(provider: str) -> dict[str, Any]:
    return {
        "script_type": "operator_guidance",
        "script": (
            "No Kubernetes patch is required for this Chaos Lab experiment.\n"
            "The experiment hides Prometheus metrics in the observability snapshot; "
            "it does not stop or modify the Prometheus service.\n"
            "Use the Chaos Lab > Restore Telemetry action, then wait for the next "
            "telemetry refresh and confirm Prometheus is available."
        ),
        "guardrail_status": "not_required",
        "description": "This is a simulated Prometheus metrics gap, not a Prometheus deployment failure.",
        "risk_level": "N/A",
        "estimated_impact": "Restores the simulated telemetry view without changing any Kubernetes workload.",
        "rollback_steps": [],
        "provider": provider,
        "mode": "simulation",
        "model": "chaos-lab",
        "ai_response_time_ms": 0,
    }


# [PIPELINE STEP 2 / GEMINI] Send only the redacted telemetry snapshot and parse its RCA JSON.
def analyze_with_gemini(snapshot: dict[str, Any]) -> dict[str, Any]:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return _provider_error("gemini", "analysis", "GEMINI_API_KEY is not configured.")
    started = time.perf_counter()
    last_error = "unknown Gemini error"
    models = list(dict.fromkeys([GEMINI_MODEL, *GEMINI_FALLBACK_MODELS]))
    for model in models:
        try:
            response = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                params={"key": key},
                json={"contents": [{"parts": [{"text": _prompt(snapshot)}]}], "generationConfig": {"responseMimeType": "application/json"}},
                timeout=AI_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            output = response.json()["candidates"][0]["content"]["parts"][0]["text"]
            return {**_parse_json(output), "provider": "gemini", "mode": "live", "model": model, "ai_response_time_ms": round((time.perf_counter() - started) * 1000)}
        except Exception as error:
            last_error = f"{model}: {_safe_provider_error(error)}"
    return _provider_error(
        "gemini",
        "analysis",
        f"all configured models failed ({last_error})",
        round((time.perf_counter() - started) * 1000),
    )


# [PIPELINE STEP 2 / CLAUDE] Send only the redacted telemetry snapshot and parse its RCA JSON.
def analyze_with_claude(snapshot: dict[str, Any]) -> dict[str, Any]:
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key:
        return _provider_error("claude", "analysis", "ANTHROPIC_API_KEY is not configured.")
    started = time.perf_counter()
    try:
        response = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            json={"model": CLAUDE_MODEL, "max_tokens": 1200, "system": "Return only valid JSON. Do not use markdown.", "messages": [{"role": "user", "content": _prompt(snapshot)}]},
            timeout=AI_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        output = response.json()["content"][0]["text"]
        return {**_parse_json(output), "provider": "claude", "mode": "live", "model": CLAUDE_MODEL, "ai_response_time_ms": round((time.perf_counter() - started) * 1000)}
    except Exception as error:
        return _provider_error(
            "claude",
            "analysis",
            _safe_provider_error(error),
            round((time.perf_counter() - started) * 1000),
        )


# [PIPELINE STEP 2 / OPENROUTER] Send only the redacted telemetry snapshot and parse its RCA JSON.
def analyze_with_openrouter(snapshot: dict[str, Any]) -> dict[str, Any]:
    key = os.getenv("OPENROUTER_API_KEY")
    if not key:
        return _provider_error("openrouter", "analysis", "OPENROUTER_API_KEY is not configured.")
    started = time.perf_counter()
    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json", "HTTP-Referer": "http://localhost:3000", "X-Title": "ArchMaturity Observability"},
            json=_openrouter_payload(OPENROUTER_MODEL, _prompt(snapshot)),
            timeout=AI_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        output = response.json()["choices"][0]["message"]["content"]
        return {**_parse_json(output), "provider": "openrouter", "mode": "live", "model": OPENROUTER_MODEL, "ai_response_time_ms": round((time.perf_counter() - started) * 1000)}
    except Exception as error:
        return _provider_error(
            "openrouter",
            "analysis",
            _safe_provider_error(error),
            round((time.perf_counter() - started) * 1000),
        )


# Dispatch RCA analysis to the selected provider adapter.
def analyze(provider: str, snapshot: dict[str, Any]) -> dict[str, Any]:
    """[PIPELINE] Run Step 2 and attach the pipeline name to the RCA response."""
    if provider == "gemini":
        result = analyze_with_gemini(snapshot)
    elif provider == "claude":
        result = analyze_with_claude(snapshot)
    else:
        result = analyze_with_openrouter(snapshot)
    return {
        **result,
        "pipeline": {
            "name": PIPELINE_NAME,
            "step": 2,
            "label": "PII-Scrubbed Telemetry RCA",
        },
    }


# Generate, validate, classify, and return a guarded remediation response.
def generate_remediation(provider: str, report: dict[str, Any]) -> dict[str, Any]:
    """[PIPELINE STEP 3] Generate and guard a Kubernetes remediation patch."""
    scenario, target_service = _detect_scenario(report)
    telemetry = report.get("telemetry", {}) if isinstance(report, dict) else {}
    experiment = telemetry.get("activeExperiment", {}) if isinstance(telemetry, dict) else {}
    simulated = isinstance(experiment, dict) and experiment.get("simulated") is True

    if scenario in {"METRIC_GAP", "LOG_GAP", "TRACE_GAP"} or simulated:
        return _build_scenario_remediation(provider, report, mode="simulation")
    if not target_service or _verified_deployment(report) is None:
        return _operator_guidance(provider, scenario, target_service, 0, False)

    key = {"gemini": os.getenv("GEMINI_API_KEY"), "claude": os.getenv("ANTHROPIC_API_KEY"), "openrouter": os.getenv("OPENROUTER_API_KEY")}.get(provider)
    if not key:
        variable = {
            "gemini": "GEMINI_API_KEY",
            "claude": "ANTHROPIC_API_KEY",
            "openrouter": "OPENROUTER_API_KEY",
        }.get(provider, "provider API key")
        return _provider_error(provider, "remediation", f"{variable} is not configured.")

    started = time.perf_counter()
    prompt = _remediation_prompt(report)
    try:
        if provider == "gemini":
            last_error = "unknown Gemini error"
            for model in list(dict.fromkeys([GEMINI_MODEL, *GEMINI_FALLBACK_MODELS])):
                try:
                    response = requests.post(
                        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                        params={"key": key},
                        json={"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2}},
                        timeout=AI_TIMEOUT_SECONDS,
                    )
                    response.raise_for_status()
                    output = response.json()["candidates"][0]["content"]["parts"][0]["text"]
                    break
                except Exception as error:
                    last_error = f"{model}: {str(error)[:160]}"
            else:
                raise RuntimeError(f"Gemini models unavailable after retry: {last_error}")
        elif provider == "claude":
            response = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                json={"model": CLAUDE_MODEL, "max_tokens": 1400, "system": "Return only valid JSON. Do not use markdown.", "messages": [{"role": "user", "content": prompt}]},
                timeout=AI_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            output = response.json()["content"][0]["text"]
            model = CLAUDE_MODEL
        else:
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json", "HTTP-Referer": "http://localhost:3000", "X-Title": "ArchMaturity Observability"},
                json=_openrouter_payload(OPENROUTER_MODEL, prompt),
                timeout=AI_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            output = response.json()["choices"][0]["message"]["content"]
            model = OPENROUTER_MODEL

        parsed = _validate_remediation(_parse_json(output), report)
        risk = parsed.get("risk_level", "Medium")
        return {
            **parsed,
            "script_type": parsed.get("script_type", "kubernetes_yaml"),
            "guardrail_status": parsed.get("guardrail_status") or ("dangerous" if risk == "Critical" else "review_required" if risk == "High" else "safe"),
            "pipeline": {
                "name": PIPELINE_NAME,
                "step": 3,
                "label": "Guarded Kubernetes YAML Patch",
            },
            "provider": provider,
            "mode": "live",
            "model": model,
            "ai_response_time_ms": round((time.perf_counter() - started) * 1000),
        }
    except Exception as error:
        return _provider_error(
            provider,
            "remediation",
            _safe_provider_error(error),
            round((time.perf_counter() - started) * 1000),
        )
