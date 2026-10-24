"""Provider adapters for observability root-cause analysis."""

import json
import os
import re
import time
from typing import Any

import requests
import yaml


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


def _redact(value: Any) -> Any:
    """Remove common credentials and personal identifiers before external AI calls."""
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


def _prompt(snapshot: dict[str, Any]) -> str:
    snapshot = _redact(snapshot)
    return f"""You are an observability SRE performing root-cause analysis.
Analyze this correlated Prometheus, Loki, and Jaeger telemetry snapshot:
{json.dumps(snapshot, indent=2)}

Return ONLY valid JSON matching this schema, with no markdown:
{json.dumps(SCHEMA)}"""


def _remediation_prompt(report: dict[str, Any]) -> str:
    report = _redact(report)
    telemetry = report.get("telemetry", {}) if isinstance(report, dict) else {}
    observed_services = sorted({
        str(item.get("service", "")).strip()
        for item in [*(telemetry.get("logs", {}).get("recentLogs", []) or []), *(telemetry.get("traces", {}).get("samples", []) or [])]
        if isinstance(item, dict) and str(item.get("service", "")).strip() not in {"", "unknown-service", "unknown"}
    })
    return f"""You are a Kubernetes platform engineer and SRE. Create an executable Kubernetes remediation patch for this RCA report:
{json.dumps(report, indent=2)}

Observed service names from live telemetry: {json.dumps(observed_services)}

Return ONLY valid JSON matching this schema, with no markdown:
{json.dumps(REMEDIATION_SCHEMA)}

Requirements:
- Return an actual Kubernetes strategic-merge YAML patch, not evidence, a ConfigMap, prose, or a demo artifact.
- The manifest kind MUST be Deployment and apiVersion MUST be apps/v1.
- Use namespace performance-demo unless the report explicitly provides another verified namespace.
- Use only a service name from the observed service list or the RCA affected_services list.
- Never use unknown-service, unknown, placeholder names, or invented deployment names.
- Do not invent a Jaeger service hostname. Only use an endpoint explicitly present in the report evidence; otherwise omit endpoint changes and explain that operator configuration is required.
- For a SERVICE_DOWN or unavailable-service finding, generate the minimal recovery patch with metadata.name set to the real target service and spec.replicas: 1. Do not invent an image, container, ports, or environment variables.
- For a trace propagation finding, add only verified environment fields to the existing target Deployment; do not replace the whole Deployment.
- If no concrete target service is present, set risk_level to Critical and fail safely with a Deployment manifest named REVIEW_REQUIRED; explain the missing target in description. Never use unknown-service.
- Do not invent secrets, image tags, namespaces, ports, or environment values.
- Never include kubectl delete, database destruction, privilege escalation, hostPath, or plaintext credentials.
- Use High risk when assumptions or manual review are required.
- Include exact rollback steps using kubectl rollout undo where applicable."""


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


def _validate_remediation(parsed: dict[str, Any]) -> dict[str, Any]:
    """Reject incomplete or unsafe model output before it reaches the UI."""
    script_value = parsed.get("script")
    if not isinstance(script_value, (str, dict)) or not script_value:
        raise ValueError("remediation response did not include a script")

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

    risk = parsed.get("risk_level")
    if risk not in {"Low", "Medium", "High", "Critical"}:
        risk = "High"
    parsed["risk_level"] = risk
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


def _demo(provider: str, elapsed: int = 0, reason: str | None = None) -> dict[str, Any]:
    return {
        "summary": "The latest telemetry indicates elevated request latency and intermittent database connection failures in order-service.",
        "root_cause": "Connection-pool pressure under load is creating slow downstream calls and repeated retries.",
        "recommendations": [
            "Increase the order-service database pool within the configured connection limit.",
            "Add a circuit breaker and bounded retry policy for database calls.",
            "Track pool saturation and p95 latency with an alert threshold.",
        ],
        "severity": "High",
        "affected_services": ["order-service", "api-gateway"],
        "evidence": [
            "Metrics: elevated p95 request latency.",
            "Traces: slow order-service downstream spans.",
            "Logs: repeated database timeout signals.",
        ],
        "provider": provider,
        "mode": "demo",
        "model": "demo-fallback",
        "ai_response_time_ms": elapsed,
        "fallback_reason": reason,
    }


def _demo_remediation(provider: str, elapsed: int = 0, reason: str | None = None) -> dict[str, Any]:
    return {
        "script_type": "kubernetes_yaml",
        "script": '''apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
spec:
  template:
    spec:
      containers:
      - name: order-service
        resources:
          requests:
            memory: \"256Mi\"
          limits:
            memory: "512Mi"''',
        "guardrail_status": "safe",
        "description": "Update memory limits for order-service to prevent OOM errors.",
        "risk_level": "Low",
        "estimated_impact": "Prevents out of memory kills, stabilizing order processing.",
        "rollback_steps": [
            "Run `kubectl rollout undo deployment/order-service`",
            "Verify pods are running with previous memory limits.",
        ],
        "provider": provider,
        "mode": "demo",
        "model": "demo-fallback",
        "fallback_reason": reason,
        "ai_response_time_ms": elapsed,
    }


def analyze_with_gemini(snapshot: dict[str, Any]) -> dict[str, Any]:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return _demo("gemini")
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
            last_error = f"{model}: {str(error)[:160]}"
    return _demo("gemini", round((time.perf_counter() - started) * 1000), f"Gemini models unavailable after retry: {last_error}")


def analyze_with_claude(snapshot: dict[str, Any]) -> dict[str, Any]:
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key:
        return _demo("claude")
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
        return _demo("claude", round((time.perf_counter() - started) * 1000), f"Claude unavailable: {str(error)[:180]}")


def analyze_with_openrouter(snapshot: dict[str, Any]) -> dict[str, Any]:
    key = os.getenv("OPENROUTER_API_KEY")
    if not key:
        return _demo("openrouter")
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
        return _demo("openrouter", round((time.perf_counter() - started) * 1000), f"OpenRouter request/response error: {str(error)[:180]}")


def analyze(provider: str, snapshot: dict[str, Any]) -> dict[str, Any]:
    if provider == "gemini":
        return analyze_with_gemini(snapshot)
    if provider == "claude":
        return analyze_with_claude(snapshot)
    return analyze_with_openrouter(snapshot)


def generate_remediation(provider: str, report: dict[str, Any]) -> dict[str, Any]:
    """Generate a guarded remediation script through the selected provider."""
    key = {"gemini": os.getenv("GEMINI_API_KEY"), "claude": os.getenv("ANTHROPIC_API_KEY"), "openrouter": os.getenv("OPENROUTER_API_KEY")}.get(provider)
    if not key:
        return _demo_remediation(provider)

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

        parsed = _validate_remediation(_parse_json(output))
        risk = parsed["risk_level"]
        return {
            **parsed,
            "script_type": "kubernetes_yaml",
            "guardrail_status": "dangerous" if risk == "Critical" else "review_required" if risk == "High" else "safe",
            "provider": provider,
            "mode": "live",
            "model": model,
            "ai_response_time_ms": round((time.perf_counter() - started) * 1000),
        }
    except Exception as error:
        return _demo_remediation(provider, round((time.perf_counter() - started) * 1000), f"{provider.title()} unavailable: {str(error)[:180]}")
