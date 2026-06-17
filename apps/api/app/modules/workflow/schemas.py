from pydantic import BaseModel, Field


class WorkflowNodeRead(BaseModel):
    id: str
    type: str
    name: str
    status: str
    description: str | None = None
    position: dict[str, float] = Field(default_factory=dict)
    config: dict[str, object] = Field(default_factory=dict)


class WorkflowEdgeRead(BaseModel):
    id: str
    source: str
    target: str
    source_handle: str | None = Field(default=None, alias="sourceHandle")
    target_handle: str | None = Field(default=None, alias="targetHandle")


class WorkflowViewportRead(BaseModel):
    x: float = 0
    y: float = 0
    zoom: float = 1


class WorkflowRead(BaseModel):
    id: str
    agent_id: str = Field(alias="agentId")
    name: str
    status: str
    tool_health_status: str = Field(alias="toolHealthStatus")
    nodes: list[WorkflowNodeRead] = Field(default_factory=list)
    edges: list[WorkflowEdgeRead] = Field(default_factory=list)
    viewport: WorkflowViewportRead = Field(default_factory=WorkflowViewportRead)


class WorkflowUpdate(BaseModel):
    name: str
    status: str
    tool_health_status: str = Field(alias="toolHealthStatus")
    nodes: list[WorkflowNodeRead] = Field(default_factory=list)
    edges: list[WorkflowEdgeRead] = Field(default_factory=list)
    viewport: WorkflowViewportRead = Field(default_factory=WorkflowViewportRead)


class WorkflowTestRequest(BaseModel):
    input: str = Field(min_length=1)


class WorkflowTestRead(BaseModel):
    id: str
    workflow_id: str = Field(alias="workflowId")
    status: str
    input: str
    output: str
