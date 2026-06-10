from pydantic import BaseModel, Field


class AgentCreate(BaseModel):
    name: str = Field(min_length=1)
    scenario: str = Field(min_length=1)


class AgentRead(BaseModel):
    id: str
    name: str
    scenario: str
    status: str
