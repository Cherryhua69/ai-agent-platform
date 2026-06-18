from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.modules.workflow.models import WorkflowModel
from app.modules.workflow.schemas import WorkflowRead, WorkflowTestRead, WorkflowUpdate

LLM_DESCRIPTION = "AI 基于检索到的知识库内容结合用户问题，生成清晰、有帮助的回答。"
DEFAULT_TRIGGER_INPUT_FIELDS = []


class WorkflowRepository:
    def __init__(self, session_factory: sessionmaker[Session] | None = None) -> None:
        self._session_factory = session_factory
        self._workflows: dict[str, WorkflowRead] = {}
        self._seed_workflows = [
            WorkflowRead(
                id="workflow-after-sale",
                agentId="agent-after-sale",
                name="售后工单 Agentflow",
                status="blocked",
                toolHealthStatus="degraded",
                nodes=[
                    {
                        "id": "node-trigger",
                        "type": "trigger",
                        "name": "用户输入",
                        "status": "success",
                        "config": {"inputFields": DEFAULT_TRIGGER_INPUT_FIELDS},
                    }
                ],
            )
        ]

    def create_default_for_agent(self, agent_id: str, agent_name: str) -> WorkflowRead:
        workflow = WorkflowRead(
            id=f"flow_{agent_id}",
            agentId=agent_id,
            name=f"{agent_name} 工作流",
            status="draft",
            toolHealthStatus="online",
            nodes=[
                {
                    "id": "node-trigger",
                    "type": "trigger",
                    "name": "用户输入",
                    "status": "success",
                    "position": {"x": 80, "y": 160},
                    "config": {"inputFields": DEFAULT_TRIGGER_INPUT_FIELDS},
                }
            ],
            edges=[],
            viewport={"x": 0, "y": 0, "zoom": 1},
        )

        if self._session_factory:
            with self._session_factory() as session:
                existing = session.get(WorkflowModel, workflow.id)
                if existing is None:
                    session.add(self._to_model(workflow))
                    session.commit()
                return workflow

        self._workflows[workflow.id] = workflow
        return workflow

    def list(self) -> list[WorkflowRead]:
        if self._session_factory:
            with self._session_factory() as session:
                models = session.scalars(select(WorkflowModel).order_by(WorkflowModel.created_at.asc())).all()
            persisted = [self._to_read_model(model) for model in models]
            persisted_ids = {workflow.id for workflow in persisted}
            return [*[workflow for workflow in self._seed_workflows if workflow.id not in persisted_ids], *persisted]

        return [*self._seed_workflows, *self._workflows.values()]

    def get(self, workflow_id: str) -> WorkflowRead | None:
        if self._session_factory:
            with self._session_factory() as session:
                workflow = session.get(WorkflowModel, workflow_id)
                if workflow is not None:
                    return self._to_read_model(workflow)

        seeded = next((workflow for workflow in self._seed_workflows if workflow.id == workflow_id), None)
        if seeded is not None:
            return seeded

        return self._workflows.get(workflow_id)

    def get_by_agent_id(self, agent_id: str) -> WorkflowRead | None:
        if self._session_factory:
            with self._session_factory() as session:
                workflow = session.scalar(
                    select(WorkflowModel)
                    .where(WorkflowModel.agent_id == agent_id)
                    .order_by(WorkflowModel.updated_at.desc())
                )
                if workflow is not None:
                    return self._to_read_model(workflow)

        seeded = next((workflow for workflow in self._seed_workflows if workflow.agent_id == agent_id), None)
        if seeded is not None:
            return seeded
        return next((workflow for workflow in self._workflows.values() if workflow.agent_id == agent_id), None)

    def update(self, workflow_id: str, payload: WorkflowUpdate) -> WorkflowRead | None:
        if self._session_factory:
            with self._session_factory() as session:
                workflow = session.get(WorkflowModel, workflow_id)
                if workflow is None:
                    seeded = next((item for item in self._seed_workflows if item.id == workflow_id), None)
                    if seeded is not None:
                        workflow = self._to_model(seeded)
                        session.add(workflow)
                        session.flush()
                if workflow is None:
                    return None

                workflow.name = payload.name
                workflow.status = payload.status
                workflow.tool_health_status = payload.tool_health_status
                workflow.nodes = [node.model_dump(by_alias=True) for node in payload.nodes]
                workflow.edges = [edge.model_dump(by_alias=True) for edge in payload.edges]
                workflow.viewport = payload.viewport.model_dump()
                session.commit()
                session.refresh(workflow)
                return self._to_read_model(workflow)

        workflow = self._workflows.get(workflow_id)
        if workflow is None:
            return None

        updated = workflow.model_copy(
            update={
                "name": payload.name,
                "status": payload.status,
                "tool_health_status": payload.tool_health_status,
                "nodes": payload.nodes,
                "edges": payload.edges,
                "viewport": payload.viewport,
            }
        )
        self._workflows[workflow_id] = updated
        return updated

    def delete_by_agent(self, agent_id: str) -> None:
        if self._session_factory:
            with self._session_factory() as session:
                workflows = session.scalars(select(WorkflowModel).where(WorkflowModel.agent_id == agent_id)).all()
                for workflow in workflows:
                    session.delete(workflow)
                session.commit()
            return

        for workflow_id, workflow in list(self._workflows.items()):
            if workflow.agent_id == agent_id:
                del self._workflows[workflow_id]

    def run_test(self, workflow_id: str, user_input: str) -> WorkflowTestRead | None:
        workflow = self.get(workflow_id)
        if workflow is None:
            return None

        return WorkflowTestRead(
            id=f"workflow_test_{uuid4().hex[:8]}",
            workflowId=workflow_id,
            status="success",
            input=user_input,
            output=f"已基于当前工作流完成测试响应：{user_input}",
        )

    def _to_model(self, workflow: WorkflowRead) -> WorkflowModel:
        return WorkflowModel(
            id=workflow.id,
            agent_id=workflow.agent_id,
            name=workflow.name,
            status=workflow.status,
            tool_health_status=workflow.tool_health_status,
            nodes=[node.model_dump(by_alias=True) for node in workflow.nodes],
            edges=[edge.model_dump(by_alias=True) for edge in workflow.edges],
            viewport=workflow.viewport.model_dump(),
        )

    def _to_read_model(self, workflow: WorkflowModel) -> WorkflowRead:
        return WorkflowRead(
            id=workflow.id,
            agentId=workflow.agent_id,
            name=workflow.name,
            status=workflow.status,
            toolHealthStatus=workflow.tool_health_status,
            nodes=workflow.nodes,
            edges=workflow.edges,
            viewport=workflow.viewport or {"x": 0, "y": 0, "zoom": 1},
        )
