from pydantic import BaseModel, Field


class ReleaseGateRead(BaseModel):
    id: str
    agent_id: str = Field(alias="agentId")
    status: str
    reasons: list[str]
    checked_at: str = Field(alias="checkedAt")
    audit_id: str = Field(alias="auditId")
