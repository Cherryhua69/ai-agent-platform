from uuid import uuid4

from app.modules.trace.repository import TraceRepository
from app.modules.trace.schemas import RunTraceCreate, RunTraceRead, TraceStepCreate


class AgentRunService:
    def __init__(self, traces: TraceRepository) -> None:
        self._traces = traces

    def simulate_run(self, agent_id: str) -> RunTraceRead:
        run_id = f"run_{uuid4().hex[:8]}"
        return self._traces.create_run(
            RunTraceCreate(
                id=run_id,
                agentId=agent_id,
                status="blocked",
                costCny=0.09,
                steps=[
                    TraceStepCreate(
                        id=f"{run_id}_input",
                        type="trigger",
                        title="用户输入",
                        status="success",
                        latencyMs=18,
                        inputSummary="订单 ORD-2048 售后政策咨询",
                    ),
                    TraceStepCreate(
                        id=f"{run_id}_retrieval",
                        type="retrieval",
                        title="Hybrid Retrieval",
                        status="success",
                        latencyMs=320,
                        outputSummary="命中售后政策库 5 个片段",
                    ),
                    TraceStepCreate(
                        id=f"{run_id}_tool_health",
                        type="tool",
                        title="检查工具健康状态",
                        status="failed",
                        latencyMs=42,
                        errorMessage="create_ticket degraded",
                    ),
                ],
            )
        )
