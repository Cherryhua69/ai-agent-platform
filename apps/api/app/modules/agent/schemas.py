from pydantic import BaseModel, Field


class AgentCreate(BaseModel):
    name: str = Field(min_length=1)
    scenario: str = Field(min_length=1)


class AgentRead(BaseModel):
    id: str
    name: str
    scenario: str
    owner: str
    status: str
    model_policy: str = Field(alias="modelPolicy")
    workflow_id: str = Field(alias="workflowId")
    knowledge_base_ids: list[str] = Field(alias="knowledgeBaseIds")
    tool_ids: list[str] = Field(alias="toolIds")


class AgentRunRequest(BaseModel):
    user_input: str = Field(default="Order ORD-2048 asks whether refund is allowed", alias="userInput")
    model_provider_id: str | None = Field(default=None, alias="modelProviderId")
    knowledge_base_ids: list[str] = Field(default_factory=list, alias="knowledgeBaseIds")
