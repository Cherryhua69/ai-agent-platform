from app.modules.agent.repository import AgentRepository
from app.modules.agent.models import AgentModel
from app.modules.agent.schemas import AgentCreate, AgentUpdate
from app.modules.workflow.models import WorkflowModel
from app.modules.workflow.repository import WorkflowRepository
from app.core.database import Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def test_create_agent_draft():
    repo = AgentRepository()
    agent = repo.create(AgentCreate(name="售后政策助手", scenario="售后问答"))

    assert agent.id.startswith("agent_")
    assert agent.name == "售后政策助手"
    assert agent.status == "draft"


def test_agent_repository_persists_agents_with_session_factory():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine, tables=[AgentModel.__table__, WorkflowModel.__table__])
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    writer = AgentRepository(session_factory=session_factory)
    created = writer.create(AgentCreate(name="售后政策助手", scenario="售后问答"))

    reader = AgentRepository(session_factory=session_factory)
    agents = reader.list()

    assert [agent.id for agent in agents] == [created.id]
    assert agents[0].name == "售后政策助手"
    assert agents[0].scenario == "售后问答"
    assert agents[0].workflow_id == f"flow_{created.id}"
    assert WorkflowRepository(session_factory=session_factory).get(created.workflow_id) is not None


def test_agent_repository_backfills_missing_workflow_for_persisted_agent():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine, tables=[AgentModel.__table__, WorkflowModel.__table__])
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    with session_factory() as session:
        session.add(AgentModel(id="agent_without_workflow", name="历史智能体", scenario="历史数据", status="draft"))
        session.commit()

    repo = AgentRepository(session_factory=session_factory)
    agents = repo.list()

    assert [agent.id for agent in agents] == ["agent_without_workflow"]
    assert WorkflowRepository(session_factory=session_factory).get("flow_agent_without_workflow") is not None


def test_agent_repository_updates_and_deletes_persisted_agents():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine, tables=[AgentModel.__table__, WorkflowModel.__table__])
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    repo = AgentRepository(session_factory=session_factory)
    created = repo.create(AgentCreate(name="售后政策助手", scenario="售后问答"))

    updated = repo.update(created.id, AgentUpdate(name="退款审核助手", scenario="退款条件审核"))

    assert updated is not None
    assert updated.name == "退款审核助手"
    assert updated.scenario == "退款条件审核"

    assert repo.delete(created.id) is True
    assert repo.list() == []
    assert WorkflowRepository(session_factory=session_factory).get(created.workflow_id) is None
    assert repo.delete(created.id) is False
