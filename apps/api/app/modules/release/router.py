from fastapi import APIRouter

router = APIRouter(prefix="/api/agents", tags=["release-gates"])


@router.post("/{agent_id}/release-gates/check")
def check_release_gate(agent_id: str) -> dict[str, object]:
    return {
        "agentId": agent_id,
        "status": "blocked",
        "reasons": ["工具健康异常：create_ticket degraded", "关键评测用例失败"],
    }
