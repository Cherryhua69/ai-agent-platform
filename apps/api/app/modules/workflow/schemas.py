from pydantic import BaseModel, Field


class WorkflowNodeRead(BaseModel):
    id: str
    type: str
    name: str
    status: str
    position: dict[str, float] = Field(default_factory=dict)
    config: dict[str, object] = Field(default_factory=dict)


class WorkflowRead(BaseModel):
    id: str
    agent_id: str = Field(alias="agentId")
    name: str
    status: str
    tool_health_status: str = Field(alias="toolHealthStatus")
    nodes: list[WorkflowNodeRead] = Field(default_factory=list)
