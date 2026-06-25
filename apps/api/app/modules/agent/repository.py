from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.modules.agent.models import AgentModel
from app.modules.agent.schemas import AgentCreate, AgentRead, AgentUpdate
from app.modules.workflow.repository import WorkflowRepository


class AgentRepository:
    def __init__(
        self,
        session_factory: sessionmaker[Session] | None = None,
        workflow_repository: WorkflowRepository | None = None,
    ) -> None:
        self._session_factory = session_factory
        self._workflow_repository = workflow_repository
        self._agents: dict[str, AgentRead] = {}

    def create(self, payload: AgentCreate) -> AgentRead:
        agent_id = f"agent_{uuid4().hex[:8]}"
        agent = AgentRead(
            id=agent_id,
            name=payload.name,
            scenario=payload.scenario,
            owner="陈晓",
            status="draft",
            modelPolicy="gpt-4.1 + fallback",
            workflowId=f"flow_{agent_id}",
            knowledgeBaseIds=[],
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
                    )
                )
                session.commit()
            self._create_default_workflow(agent.id, agent.name)
            return agent

        self._agents[agent_id] = agent
        self._create_default_workflow(agent.id, agent.name)
        return agent

    def list(self) -> list[AgentRead]:
        if self._session_factory:
            with self._session_factory() as session:
                models = session.scalars(select(AgentModel).order_by(AgentModel.created_at.asc())).all()
            agents = [self._to_read_model(agent) for agent in models]
            for agent in agents:
                self._create_default_workflow(agent.id, agent.name)
            return agents

        return list(self._agents.values())

    def update(self, agent_id: str, payload: AgentUpdate) -> AgentRead | None:
        if self._session_factory:
            with self._session_factory() as session:
                agent = session.get(AgentModel, agent_id)
                if agent is None:
                    return None

                agent.name = payload.name
                agent.scenario = payload.scenario
                session.commit()
                session.refresh(agent)
                return self._to_read_model(agent)

        agent = self._agents.get(agent_id)
        if agent is None:
            return None

        updated = agent.model_copy(update={"name": payload.name, "scenario": payload.scenario})
        self._agents[agent_id] = updated
        return updated

    def delete(self, agent_id: str) -> bool:
        if self._session_factory:
            with self._session_factory() as session:
                agent = session.get(AgentModel, agent_id)
                if agent is None:
                    return False

                session.delete(agent)
                session.commit()
                self._delete_agent_workflows(agent_id)
                return True

        deleted = self._agents.pop(agent_id, None) is not None
        if deleted:
            self._delete_agent_workflows(agent_id)
        return deleted

    def _to_read_model(self, agent: AgentModel) -> AgentRead:
        return AgentRead(
            id=agent.id,
            name=agent.name,
            scenario=agent.scenario,
            owner="陈晓",
            status=agent.status,
            modelPolicy="gpt-4.1 + fallback",
            workflowId=f"flow_{agent.id}",
            knowledgeBaseIds=[],
            toolIds=["tool-ticket", "tool-order"],
        )

    def _create_default_workflow(self, agent_id: str, agent_name: str) -> None:
        workflow_repository = self._workflow_repository
        if workflow_repository is None and self._session_factory is not None:
            workflow_repository = WorkflowRepository(session_factory=self._session_factory)

        if workflow_repository is not None:
            workflow_repository.create_default_for_agent(agent_id, agent_name)

    def _delete_agent_workflows(self, agent_id: str) -> None:
        workflow_repository = self._workflow_repository
        if workflow_repository is None and self._session_factory is not None:
            workflow_repository = WorkflowRepository(session_factory=self._session_factory)

        if workflow_repository is not None:
            workflow_repository.delete_by_agent(agent_id)
