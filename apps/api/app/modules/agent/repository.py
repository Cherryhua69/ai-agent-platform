from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.modules.agent.models import AgentModel
from app.modules.agent.schemas import AgentCreate, AgentRead


class AgentRepository:
    def __init__(self, session_factory: sessionmaker[Session] | None = None) -> None:
        self._session_factory = session_factory
        self._agents: dict[str, AgentRead] = {}

    def create(self, payload: AgentCreate) -> AgentRead:
        agent_id = f"agent_{uuid4().hex[:8]}"
        agent = AgentRead(
            id=agent_id,
            name=payload.name,
            scenario=payload.scenario,
            owner="陈晓",
            status="draft",
            modelPolicy=payload.model_policy,
            workflowId=f"flow_{agent_id}",
            knowledgeBaseIds=["kb-after-sale", "kb-warranty"],
            toolIds=["tool-ticket", "tool-order"],
        )

        if self._session_factory:
            with self._session_factory() as session:
                session.add(
                    AgentModel(
                        id=agent.id,
                        name=agent.name,
                        scenario=agent.scenario,
                        status=agent.status,
                        model_policy=agent.model_policy,
                    )
                )
                session.commit()
            return agent

        self._agents[agent_id] = agent
        return agent

    def list(self) -> list[AgentRead]:
        if self._session_factory:
            with self._session_factory() as session:
                models = session.scalars(select(AgentModel).order_by(AgentModel.created_at.asc())).all()
            return [self._to_read_model(agent) for agent in models]

        return list(self._agents.values())

    def _to_read_model(self, agent: AgentModel) -> AgentRead:
        return AgentRead(
            id=agent.id,
            name=agent.name,
            scenario=agent.scenario,
            owner="陈晓",
            status=agent.status,
            modelPolicy=agent.model_policy,
            workflowId=f"flow_{agent.id}",
            knowledgeBaseIds=["kb-after-sale", "kb-warranty"],
            toolIds=["tool-ticket", "tool-order"],
        )
