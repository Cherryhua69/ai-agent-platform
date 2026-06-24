from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.modules.trace.models import RunModel, TraceStepModel, utc_now
from app.modules.trace.schemas import RecentRunRead, RunTraceCreate, RunTraceRead, TraceStepCreate, TraceStepRead


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
                    run_category=payload.run_category,
                    failure_reason=payload.failure_reason,
                    cost_cny=payload.cost_cny,
                    final_output=payload.final_output,
                )
            )
            for index, step in enumerate(payload.steps):
                session.add(self._step_to_model(payload.id, index, step))
            session.commit()

        return RunTraceRead(**payload.model_dump(by_alias=True))

    @staticmethod
    def _summary_status(status: str) -> str:
        return "success" if status == "success" else "failed"

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

    def list_recent(self, agent_names: dict[str, str] | None = None, limit: int = 6) -> list[RecentRunRead]:
        agent_names = agent_names or {}
        if self._session_factory:
            with self._session_factory() as session:
                runs = session.scalars(select(RunModel).order_by(RunModel.created_at.desc()).limit(limit)).all()
                return [self._run_to_recent_model(run, agent_names.get(run.agent_id, run.agent_id)) for run in runs]

        return []

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
            runCategory=run.run_category,
            failureReason=run.failure_reason,
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

    def _run_to_recent_model(self, run: RunModel, agent_name: str) -> RecentRunRead:
        return RecentRunRead(
            id=run.id,
            agentId=run.agent_id,
            agentName=agent_name,
            runTime=run.created_at,
            failureReason=run.failure_reason or "无",
            runCategory=run.run_category,
            status=self._summary_status(run.status),
        )

    def _seed_trace(self, run_id: str) -> RunTraceRead:
        return RunTraceRead(
            id=run_id,
            agentId="agent-after-sale",
            status="blocked",
            runCategory="test",
            failureReason="create_ticket degraded",
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
