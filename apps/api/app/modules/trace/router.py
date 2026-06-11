from fastapi import APIRouter

from app.modules.trace.schemas import RunTraceRead, TraceStepRead

router = APIRouter(prefix="/api/runs", tags=["traces"])


@router.get("/{run_id}/trace", response_model=RunTraceRead)
def get_run_trace(run_id: str) -> RunTraceRead:
    return RunTraceRead(
        id=run_id,
        agentId="agent-after-sale",
        status="blocked",
        costCny=0.09,
        steps=[
            TraceStepRead(
                id="step_input",
                type="trigger",
                title="用户输入",
                status="success",
                latencyMs=18,
                inputSummary="订单 ORD-2048 售后政策咨询",
            ),
            TraceStepRead(
                id="step_retrieval",
                type="retrieval",
                title="Hybrid Retrieval",
                status="success",
                latencyMs=320,
                outputSummary="命中售后政策库 5 个片段",
            ),
            TraceStepRead(
                id="step_tool_health",
                type="tool",
                title="检查工具健康状态",
                status="failed",
                latencyMs=42,
                errorMessage="create_ticket degraded",
            ),
        ],
    )
