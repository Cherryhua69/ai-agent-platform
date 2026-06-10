from uuid import uuid4

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(tags=["release-gates"])


class ReleaseGateRead(BaseModel):
    id: str
    agent_id: str = Field(alias="agentId")
    status: str
    reasons: list[str]
    checked_at: str = Field(alias="checkedAt")
    audit_id: str = Field(alias="auditId")


def build_release_gate(agent_id: str) -> ReleaseGateRead:
    return ReleaseGateRead(
        id=f"gate_{agent_id}",
        agentId=agent_id,
        status="blocked",
        reasons=[
            "工具健康异常：create_ticket degraded",
            "关键评测用例失败：refund-ticket-create",
            "知识库索引状态未全部 ready：kb-warranty stale",
            "高风险权限：refund_request 需要人工确认",
        ],
        checkedAt="2026-06-10T09:30:00.000Z",
        auditId=f"audit_{uuid4().hex[:8]}",
    )


@router.post("/api/agents/{agent_id}/release-gates/check", response_model=ReleaseGateRead)
def check_release_gate(agent_id: str) -> ReleaseGateRead:
    return build_release_gate(agent_id)


@router.get("/api/release-gates", response_model=list[ReleaseGateRead])
def list_release_gates() -> list[ReleaseGateRead]:
    return [build_release_gate("agent-after-sale")]
