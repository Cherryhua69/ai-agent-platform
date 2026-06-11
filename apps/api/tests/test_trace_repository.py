from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.modules.trace.models import RunModel, TraceStepModel
from app.modules.trace.repository import TraceRepository
from app.modules.trace.schemas import RunTraceCreate, TraceStepCreate


def test_trace_repository_persists_run_and_steps_with_session_factory():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine, tables=[RunModel.__table__, TraceStepModel.__table__])
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    writer = TraceRepository(session_factory=session_factory)
    created = writer.create_run(
        RunTraceCreate(
            id="run_real_001",
            agentId="agent-after-sale",
            status="blocked",
            costCny=0.18,
            steps=[
                TraceStepCreate(
                    id="step_input",
                    type="trigger",
                    title="用户输入",
                    status="success",
                    latencyMs=18,
                    inputSummary="订单 ORD-2048 售后政策咨询",
                ),
                TraceStepCreate(
                    id="step_tool_health",
                    type="tool",
                    title="检查工具健康状态",
                    status="failed",
                    latencyMs=42,
                    errorMessage="create_ticket degraded",
                ),
            ],
        )
    )

    reader = TraceRepository(session_factory=session_factory)
    loaded = reader.get_trace(created.id)

    assert loaded.id == "run_real_001"
    assert loaded.agent_id == "agent-after-sale"
    assert loaded.cost_cny == 0.18
    assert [step.id for step in loaded.steps] == ["step_input", "step_tool_health"]
    assert loaded.steps[1].error_message == "create_ticket degraded"
