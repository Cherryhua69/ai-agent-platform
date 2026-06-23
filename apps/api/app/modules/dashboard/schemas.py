from pydantic import BaseModel, Field


class RunSuccessRateRead(BaseModel):
    value: int
    window_hours: int = Field(alias="windowHours")
    total_runs: int = Field(alias="totalRuns")
    successful_runs: int = Field(alias="successfulRuns")


class PendingAgentRead(BaseModel):
    id: str
    name: str
    description: str
    status: str


class DashboardSummaryRead(BaseModel):
    run_success_rate: RunSuccessRateRead = Field(alias="runSuccessRate")
    published_agents: int = Field(alias="publishedAgents")
    pending_agents: list[PendingAgentRead] = Field(alias="pendingAgents")
