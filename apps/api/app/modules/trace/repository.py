from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.modules.trace.models import RunModel, TraceStepModel
from app.modules.trace.schemas import RunTraceCreate, RunTraceRead, TraceStepCreate, TraceStepRead


class TraceRepository:
    def __init__(self, session_factory: sessionmaker[Session] | None = None) -> None:
        self._session_factory = session_factory

    def create_run(self, payload: RunTraceCreate) -> RunTraceRead:
        if not self._session_factory:
            return RunTraceRead(**payload.model_dump(by_alias=True))

        with self._session_factory() as session:
            session.add(
                RunModel(
                    id=payload.id,
                    agent_id=payload.agent_id,
                    status=payload.status,
                    cost_cny=payload.cost_cny,
                    final_output=payload.final_output,
                )
            )
            for index, step in enumerate(payload.steps):
                session.add(self._step_to_model(payload.id, index, step))
            session.commit()

        return RunTraceRead(**payload.model_dump(by_alias=True))

    def get_trace(self, run_id: str) -> RunTraceRead:
        if self._session_factory:
            with self._session_factory() as session:
                run = session.get(RunModel, run_id)
                if run:
                    steps = session.scalars(
                        select(TraceStepModel)
                        .where(TraceStepModel.run_id == run_id)
                        .order_by(TraceStepModel.step_order.asc())
                    ).all()
                    return self._run_to_read_model(run, list(steps))

        return self._seed_trace(run_id)

    def _step_to_model(self, run_id: str, step_order: int, step: TraceStepCreate) -> TraceStepModel:
        return TraceStepModel(
            id=step.id,
            run_id=run_id,
            step_order=step_order,
            type=step.type,
            title=step.title,
            status=step.status,
            latency_ms=step.latency_ms,
            input_summary=step.input_summary,
            output_summary=step.output_summary,
            error_message=step.error_message,
        )

    def _run_to_read_model(self, run: RunModel, steps: list[TraceStepModel]) -> RunTraceRead:
        return RunTraceRead(
            id=run.id,
            agentId=run.agent_id,
            status=run.status,
            costCny=run.cost_cny,
            finalOutput=run.final_output,
            steps=[
                TraceStepRead(
                    id=step.id,
                    type=step.type,
                    title=step.title,
                    status=step.status,
                    latencyMs=step.latency_ms,
                    inputSummary=step.input_summary,
                    outputSummary=step.output_summary,
                    errorMessage=step.error_message,
                )
                for step in steps
            ],
        )

    def _seed_trace(self, run_id: str) -> RunTraceRead:
        return RunTraceRead(
            id=run_id,
            agentId="agent-after-sale",
            status="blocked",
            costCny=0.09,
            finalOutput=None,
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
