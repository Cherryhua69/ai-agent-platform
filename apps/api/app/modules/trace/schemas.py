from pydantic import BaseModel, Field


class TraceStepRead(BaseModel):
    id: str
    type: str
    title: str
    status: str
    latency_ms: int
    input_summary: str | None = None
    output_summary: str | None = None
    error_message: str | None = None


class RunTraceRead(BaseModel):
    id: str
    agent_id: str
    status: str
    steps: list[TraceStepRead] = Field(default_factory=list)
