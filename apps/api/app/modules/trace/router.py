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
    agent_names = {agent.id: agent.name for agent in agents.list()}
    return repo.list_recent(agent_names=agent_names, limit=4)


@router.get("/{run_id}/trace", response_model=RunTraceRead)
def get_run_trace(run_id: str) -> RunTraceRead:
    return repo.get_trace(run_id)
