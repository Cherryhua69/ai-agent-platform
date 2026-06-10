from uuid import uuid4

from app.modules.agent.schemas import AgentCreate, AgentRead


class AgentRepository:
    def __init__(self) -> None:
        self._agents: dict[str, AgentRead] = {}

    def create(self, payload: AgentCreate) -> AgentRead:
        agent_id = f"agent_{uuid4().hex[:8]}"
        agent = AgentRead(
            id=agent_id,
            name=payload.name,
            scenario=payload.scenario,
            status="draft",
        )
        self._agents[agent_id] = agent
        return agent

    def list(self) -> list[AgentRead]:
        return list(self._agents.values())
