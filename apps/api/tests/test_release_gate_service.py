from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone

from app.core.database import Base
from app.modules.evaluation.models import EvaluationCaseModel, EvaluationDatasetModel, EvaluationRunModel
from app.modules.evaluation.repository import EvaluationRepository
from app.modules.evaluation.schemas import EvaluationCaseCreate, EvaluationDatasetCreate, EvaluationRunCreate
from app.modules.knowledge.models import KnowledgeBaseModel, KnowledgeDocumentModel
from app.modules.knowledge.repository import KnowledgeRepository
from app.modules.knowledge.schemas import KnowledgeBaseCreate
from app.modules.release.service import ReleaseGateService
from app.modules.tool.models import McpServerModel, ToolModel
from app.modules.tool.repository import ToolRepository
from app.modules.tool.schemas import ToolCreate


def test_release_gate_service_aggregates_real_resource_statuses():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(
        engine,
        tables=[
            ToolModel.__table__,
            McpServerModel.__table__,
            KnowledgeBaseModel.__table__,
            KnowledgeDocumentModel.__table__,
            EvaluationDatasetModel.__table__,
            EvaluationCaseModel.__table__,
            EvaluationRunModel.__table__,
        ],
    )
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    tools = ToolRepository(session_factory=session_factory)
    knowledge = KnowledgeRepository(session_factory=session_factory)
    evaluations = EvaluationRepository(session_factory=session_factory)

    tools.create_tool(
        ToolCreate(
            name="create_ticket",
            type="mcp",
            credential="ticket-prod",
            permission="Developer + Operator",
            schema={"input": {"type": "object"}},
        )
    )
    knowledge_base = knowledge.create_knowledge_base(
        KnowledgeBaseCreate(name="保修政策库", source="PDF", retrievalStrategy="Hybrid")
    )
    dataset = evaluations.create_dataset(EvaluationDatasetCreate(name="售后门禁集"))
    evaluations.add_case(
        dataset.id,
        EvaluationCaseCreate(name="refund-ticket-create", input="用户要求退款并创建工单", expected="触发人工确认"),
    )
    evaluations.run(dataset.id, EvaluationRunCreate(agentId="agent-after-sale"))

    gate = ReleaseGateService(tools=tools, knowledge=knowledge, evaluations=evaluations).check("agent-after-sale")

    assert gate.status == "blocked"
    assert "工具健康异常：create_ticket degraded" in gate.reasons
    assert "关键评测用例失败：refund-ticket-create" in gate.reasons
    assert f"知识库索引状态未全部 ready：{knowledge_base.id} processing" in gate.reasons
    assert "高风险权限：refund_request 需要人工确认" in gate.reasons


def test_release_gate_checked_at_uses_current_utc_time():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(
        engine,
        tables=[
            ToolModel.__table__,
            McpServerModel.__table__,
            KnowledgeBaseModel.__table__,
            KnowledgeDocumentModel.__table__,
            EvaluationDatasetModel.__table__,
            EvaluationCaseModel.__table__,
            EvaluationRunModel.__table__,
        ],
    )
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    before = datetime.now(timezone.utc)
    gate = ReleaseGateService(
        tools=ToolRepository(session_factory=session_factory),
        knowledge=KnowledgeRepository(session_factory=session_factory),
        evaluations=EvaluationRepository(session_factory=session_factory),
    ).check("agent-after-sale")
    after = datetime.now(timezone.utc)

    checked_at = datetime.fromisoformat(gate.checked_at.replace("Z", "+00:00"))
    assert before <= checked_at <= after
