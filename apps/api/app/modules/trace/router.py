from fastapi import APIRouter

from app.core.database import SessionLocal
from app.modules.trace.repository import TraceRepository
from app.modules.agent.repository import AgentRepository
from app.modules.trace.schemas import RecentRunRead, RunTraceRead

router = APIRouter(prefix="/api/runs", tags=["traces"])
repo = TraceRepository(session_factory=SessionLocal)
agents = AgentRepository(session_factory=SessionLocal)


@router.get("/recent", response_model=list[RecentRunRead])
def list_recent_runs() -> list[RecentRunRead]:
    """查询最近运行记录，并补齐智能体名称供运行页面列表展示。"""
    agent_names = {agent.id: agent.name for agent in agents.list()}
    return repo.list_recent(agent_names=agent_names, limit=6)


@router.get("/{run_id}/trace", response_model=RunTraceRead)
def get_run_trace(run_id: str) -> RunTraceRead:
    """查询指定运行的完整追踪详情，包含步骤、日志和耗时信息。"""
    return repo.get_trace(run_id)
