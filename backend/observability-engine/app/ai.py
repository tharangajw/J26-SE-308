"""Provider adapters for observability root-cause analysis."""

import json
import os
import time
from typing import Any

import requests


GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-3-5-sonnet-latest")
AI_TIMEOUT_SECONDS = float(os.getenv("AI_TIMEOUT_SECONDS", "45"))

SCHEMA = {
    "summary": "string",
    "root_cause": "string",
    "recommendations": ["string"],
    "severity": "Critical|High|Medium|Low",
    "affected_services": ["string"],
    "evidence": ["string"],
}


def _prompt(snapshot: dict[str, Any]) -> str:
    return f"""You are an observability SRE performing root-cause analysis.
Analyze this correlated Prometheus, Loki, and Jaeger telemetry snapshot:
{json.dumps(snapshot, indent=2)}

Return ONLY valid JSON matching this schema, with no markdown:
{json.dumps(SCHEMA)}"""


def _parse_json(value: str) -> dict[str, Any]:
    cleaned = value.strip().removeprefix("```json").removesuffix("```").strip()
    return json.loads(cleaned)


def _demo(provider: str, elapsed: int = 0) -> dict[str, Any]:
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
    }


def analyze_with_gemini(snapshot: dict[str, Any]) -> dict[str, Any]:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return _demo("gemini")
    started = time.perf_counter()
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
        params={"key": key},
        json={"contents": [{"parts": [{"text": _prompt(snapshot)}]}], "generationConfig": {"responseMimeType": "application/json"}},
        timeout=AI_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    output = response.json()["candidates"][0]["content"]["parts"][0]["text"]
    return {**_parse_json(output), "provider": "gemini", "mode": "live", "model": GEMINI_MODEL, "ai_response_time_ms": round((time.perf_counter() - started) * 1000)}


def analyze_with_claude(snapshot: dict[str, Any]) -> dict[str, Any]:
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key:
        return _demo("claude")
    started = time.perf_counter()
    response = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
        json={"model": CLAUDE_MODEL, "max_tokens": 1200, "system": "Return only valid JSON. Do not use markdown.", "messages": [{"role": "user", "content": _prompt(snapshot)}]},
        timeout=AI_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    output = response.json()["content"][0]["text"]
    return {**_parse_json(output), "provider": "claude", "mode": "live", "model": CLAUDE_MODEL, "ai_response_time_ms": round((time.perf_counter() - started) * 1000)}


def analyze(provider: str, snapshot: dict[str, Any]) -> dict[str, Any]:
    return analyze_with_gemini(snapshot) if provider == "gemini" else analyze_with_claude(snapshot)
