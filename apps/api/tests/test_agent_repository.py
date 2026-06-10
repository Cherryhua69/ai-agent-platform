from app.modules.agent.repository import AgentRepository
from app.modules.agent.schemas import AgentCreate


def test_create_agent_draft():
    repo = AgentRepository()
    agent = repo.create(AgentCreate(name="售后政策助手", scenario="售后问答"))

    assert agent.id.startswith("agent_")
    assert agent.name == "售后政策助手"
    assert agent.status == "draft"
