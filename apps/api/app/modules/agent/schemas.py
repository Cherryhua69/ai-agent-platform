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
    workflow_id: str = Field(alias="workflowId")
    knowledge_base_ids: list[str] = Field(alias="knowledgeBaseIds")
    tool_ids: list[str] = Field(alias="toolIds")
