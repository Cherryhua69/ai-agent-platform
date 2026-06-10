from fastapi import APIRouter

from app.modules.trace.schemas import RunTraceRead, TraceStepRead

router = APIRouter(prefix="/api/runs", tags=["traces"])


@router.get("/{run_id}/trace", response_model=RunTraceRead)
def get_run_trace(run_id: str) -> RunTraceRead:
    return RunTraceRead(
        id=run_id,
        agent_id="agent-after-sale",
        status="blocked",
        steps=[
            TraceStepRead(
                id="step_tool_health",
                type="tool",
                title="检查工具健康状态",
                status="failed",
                latency_ms=42,
                error_message="create_ticket degraded",
            )
        ],
    )
