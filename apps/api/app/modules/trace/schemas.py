from pydantic import BaseModel, Field


class TraceStepRead(BaseModel):
    id: str
    type: str
    title: str
    status: str
    latency_ms: int = Field(alias="latencyMs")
    input_summary: str | None = Field(default=None, alias="inputSummary")
    output_summary: str | None = Field(default=None, alias="outputSummary")
    error_message: str | None = Field(default=None, alias="errorMessage")


class TraceStepCreate(TraceStepRead):
    pass


class RunTraceRead(BaseModel):
    id: str
    agent_id: str = Field(alias="agentId")
    status: str
    cost_cny: float = Field(alias="costCny")
    steps: list[TraceStepRead] = Field(default_factory=list)


class RunTraceCreate(RunTraceRead):
    steps: list[TraceStepCreate] = Field(default_factory=list)
