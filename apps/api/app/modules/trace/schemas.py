from datetime import datetime

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
    run_category: str = Field(default="test", alias="runCategory")
    failure_reason: str | None = Field(default=None, alias="failureReason")
    cost_cny: float = Field(alias="costCny")
    final_output: str | None = Field(default=None, alias="finalOutput")
    steps: list[TraceStepRead] = Field(default_factory=list)


class RunTraceCreate(RunTraceRead):
    steps: list[TraceStepCreate] = Field(default_factory=list)


class RecentRunRead(BaseModel):
    id: str
    agent_id: str = Field(alias="agentId")
    agent_name: str = Field(alias="agentName")
    run_time: datetime = Field(alias="runTime")
    failure_reason: str = Field(alias="failureReason")
    run_category: str = Field(alias="runCategory")
    status: str
