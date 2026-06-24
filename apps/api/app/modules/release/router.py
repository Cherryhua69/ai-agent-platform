from fastapi import APIRouter

from app.core.database import SessionLocal
from app.modules.evaluation.repository import EvaluationRepository
from app.modules.knowledge.repository import KnowledgeRepository
from app.modules.release.schemas import ReleaseGateRead
from app.modules.release.service import ReleaseGateService
from app.modules.tool.repository import ToolRepository

router = APIRouter(tags=["release-gates"])

service = ReleaseGateService(
    tools=ToolRepository(session_factory=SessionLocal),
    knowledge=KnowledgeRepository(session_factory=SessionLocal),
    evaluations=EvaluationRepository(session_factory=SessionLocal),
)


@router.post("/api/agents/{agent_id}/release-gates/check", response_model=ReleaseGateRead)
def check_release_gate(agent_id: str) -> ReleaseGateRead:
    """检查指定智能体发布门禁，汇总工具、知识库和评测风险。"""
    return service.check(agent_id)


@router.get("/api/release-gates", response_model=list[ReleaseGateRead])
def list_release_gates() -> list[ReleaseGateRead]:
    """查询发布门禁列表，返回默认演示智能体的当前门禁状态。"""
    return [service.check("agent-after-sale")]
