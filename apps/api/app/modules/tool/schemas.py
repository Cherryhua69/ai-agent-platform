from pydantic import BaseModel, Field


class McpServerCreate(BaseModel):
    name: str = Field(min_length=1)
    base_url: str = Field(alias="baseUrl", min_length=1)
    owner: str = Field(min_length=1)


class McpServerRead(BaseModel):
    id: str
    name: str
    base_url: str = Field(alias="baseUrl")
    owner: str
    status: str


class ToolCreate(BaseModel):
    name: str = Field(min_length=1)
    type: str = Field(min_length=1)
    credential: str = Field(min_length=1)
    permission: str = Field(min_length=1)
    tool_schema: dict[str, object] = Field(default_factory=dict, alias="schema")


class ToolRead(BaseModel):
    id: str
    name: str
    type: str
    credential: str
    permission: str
    health: str
    last_called_at: str = Field(alias="lastCalledAt")
    tool_schema: dict[str, object] = Field(default_factory=dict, alias="schema")


class ToolHealthRead(BaseModel):
    tool_id: str = Field(alias="toolId")
    status: str
    reason: str
