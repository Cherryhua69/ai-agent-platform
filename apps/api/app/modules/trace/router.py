from fastapi import APIRouter

from app.core.database import SessionLocal
from app.modules.trace.repository import TraceRepository
from app.modules.trace.schemas import RunTraceRead

router = APIRouter(prefix="/api/runs", tags=["traces"])
repo = TraceRepository(session_factory=SessionLocal)


@router.get("/{run_id}/trace", response_model=RunTraceRead)
def get_run_trace(run_id: str) -> RunTraceRead:
    return repo.get_trace(run_id)
