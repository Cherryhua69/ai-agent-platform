from datetime import datetime
from zoneinfo import ZoneInfo
from zoneinfo import ZoneInfoNotFoundError

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.modules.trace.models import RunModel, TraceStepModel, utc_now
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
            runCategory="production",
            failureReason="create_ticket degraded",
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
    assert loaded.run_category == "production"
    assert loaded.failure_reason == "create_ticket degraded"
    assert loaded.cost_cny == 0.18
    assert [step.id for step in loaded.steps] == ["step_input", "step_tool_health"]
    assert loaded.steps[1].error_message == "create_ticket degraded"


def test_trace_repository_lists_recent_runs_with_summary_fields():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine, tables=[RunModel.__table__, TraceStepModel.__table__])
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    repo = TraceRepository(session_factory=session_factory)
    repo.create_run(
        RunTraceCreate(
            id="run_test_001",
            agentId="agent-after-sale",
            status="failed",
            runCategory="test",
            failureReason="create_ticket timeout",
            costCny=0.01,
            steps=[],
        )
    )
    repo.create_run(
        RunTraceCreate(
            id="run_prod_001",
            agentId="agent-contract-review",
            status="success",
            runCategory="production",
            failureReason=None,
            costCny=0.02,
            steps=[],
        )
    )

    recent = repo.list_recent(
        agent_names={
            "agent-after-sale": "售后政策助手",
            "agent-contract-review": "合同审阅助手",
        }
    )

    assert [run.id for run in recent] == ["run_prod_001", "run_test_001"]
    assert recent[0].agent_name == "合同审阅助手"
    assert recent[0].run_time is not None
    assert recent[0].run_category == "production"
    assert recent[0].failure_reason == "无"
    assert recent[0].status == "success"
    assert recent[1].run_category == "test"
    assert recent[1].failure_reason == "create_ticket timeout"
    assert recent[1].status == "failed"


def test_trace_repository_returns_no_recent_runs_when_database_is_empty():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine, tables=[RunModel.__table__, TraceStepModel.__table__])
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    repo = TraceRepository(session_factory=session_factory)

    assert repo.list_recent(agent_names={}) == []


def test_run_created_at_uses_local_computer_time():
    created_at = utc_now()
    try:
        local_now = datetime.now(ZoneInfo("Asia/Shanghai")).replace(tzinfo=None)
    except ZoneInfoNotFoundError:
        local_now = datetime.now().replace(tzinfo=None)

    assert created_at.tzinfo is None
    assert abs((local_now - created_at).total_seconds()) < 5


def test_run_created_at_does_not_require_tzdata(monkeypatch):
    import app.modules.trace.models as trace_models

    def missing_timezone(_key: str):
        raise ZoneInfoNotFoundError("No time zone found")

    monkeypatch.setattr(trace_models, "ZoneInfo", missing_timezone)

    created_at = trace_models.utc_now()

    assert created_at.tzinfo is None
    assert abs((datetime.now() - created_at).total_seconds()) < 5
