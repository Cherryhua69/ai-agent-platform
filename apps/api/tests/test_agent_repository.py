from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.modules.agent.models import AgentModel
from app.modules.agent.repository import AgentRepository
from app.modules.agent.schemas import AgentCreate


def test_create_agent_draft_uses_submitted_model_policy():
    repo = AgentRepository()

    agent = repo.create(
        AgentCreate(
            name="售后政策助手",
            scenario="售后问答",
            modelPolicy="gpt-4.1-mini + strict citation",
        )
    )

    assert agent.id.startswith("agent_")
    assert agent.name == "售后政策助手"
    assert agent.status == "draft"
    assert agent.model_policy == "gpt-4.1-mini + strict citation"


def test_create_agent_draft_uses_python_model_policy_field_name():
    repo = AgentRepository()

    agent = repo.create(
        AgentCreate(
            name="鍞悗鏀跨瓥鍔╂墜",
            scenario="鍞悗闂瓟",
            model_policy="gpt-4.1-mini + internal policy",
        )
    )

    assert agent.model_policy == "gpt-4.1-mini + internal policy"


def test_create_agent_draft_keeps_default_model_policy_for_legacy_payloads():
    repo = AgentRepository()

    agent = repo.create(AgentCreate(name="售后政策助手", scenario="售后问答"))

    assert agent.model_policy == "gpt-4.1 + fallback"


def test_agent_repository_persists_model_policy_with_session_factory():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine, tables=[AgentModel.__table__])
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    writer = AgentRepository(session_factory=session_factory)
    created = writer.create(
        AgentCreate(
            name="售后政策助手",
            scenario="售后问答",
            modelPolicy="gpt-4.1-mini + strict citation",
        )
    )

    reader = AgentRepository(session_factory=session_factory)
    agents = reader.list()

    assert [agent.id for agent in agents] == [created.id]
    assert agents[0].name == "售后政策助手"
    assert agents[0].scenario == "售后问答"
    assert agents[0].workflow_id == f"flow_{created.id}"
    assert agents[0].model_policy == "gpt-4.1-mini + strict citation"
