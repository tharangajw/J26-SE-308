from pydantic import BaseModel, ConfigDict, Field


class ResilienceMetrics(BaseModel):
    model_config = ConfigDict(extra="forbid")

    availability: float = Field(ge=0, le=100)
    cpu: float = Field(ge=0, le=100)
    memory: float = Field(ge=0, le=100)
    errorRate: float = Field(ge=0, le=100)
    restarts: float = Field(ge=0)
    mttr: float = Field(ge=0)
    latency: float = Field(ge=0)
    failoverSuccess: float = Field(ge=0, le=100)
