from app.modules.agent.repository import AgentRepository
from app.modules.agent.models import AgentModel
from app.modules.agent.schemas import AgentCreate
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
    Base.metadata.create_all(engine, tables=[AgentModel.__table__])
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    writer = AgentRepository(session_factory=session_factory)
    created = writer.create(AgentCreate(name="售后政策助手", scenario="售后问答"))

    reader = AgentRepository(session_factory=session_factory)
    agents = reader.list()

    assert [agent.id for agent in agents] == [created.id]
    assert agents[0].name == "售后政策助手"
    assert agents[0].scenario == "售后问答"
    assert agents[0].workflow_id == f"flow_{created.id}"
