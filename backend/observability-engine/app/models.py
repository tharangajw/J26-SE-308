from typing import Any

from pydantic import BaseModel, Field


class TelemetrySnapshot(BaseModel):
    metrics: dict[str, float]
    logs: dict[str, Any]
    traces: dict[str, float]
    sources: dict[str, bool]
    lastUpdated: str


class ObservabilityCalculation(BaseModel):
    oScore: float
    cciIndex: int
    blindSpotCount: int
    status: str
    maturity: str
    ahp: dict[str, Any]
    cciData: dict[str, Any]
    scoreBreakdown: dict[str, float]


class ObservabilityResponse(BaseModel):
    telemetry: TelemetrySnapshot
    calculation: ObservabilityCalculation
    history: list[dict[str, Any]] = Field(default_factory=list)


class AIAnalysisRequest(BaseModel):
    provider: str = "gemini"
    snapshot: dict[str, Any] = Field(default_factory=dict)


class AIRemediationRequest(BaseModel):
    provider: str = "gemini"
    report: dict[str, Any] = Field(default_factory=dict)
