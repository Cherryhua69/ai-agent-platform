from pydantic import BaseModel, ConfigDict, Field


class AgentCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=1)
    scenario: str = Field(min_length=1)
    model_policy: str = Field(default="gpt-4.1 + fallback", alias="modelPolicy", min_length=1)


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
