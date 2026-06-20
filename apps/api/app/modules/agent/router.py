from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from app.core.database import SessionLocal
from app.modules.agent.repository import AgentRepository
from app.modules.agent.run_service import AgentRunService
from app.modules.agent.schemas import AgentCreate, AgentRead, AgentRunRequest, AgentUpdate
from app.modules.knowledge.repository import KnowledgeRepository
from app.modules.model_provider.repository import ModelProviderRepository
from app.modules.model_provider.service import LangChainModelClient
from app.modules.trace.repository import TraceRepository
from app.modules.trace.schemas import RunTraceRead
from app.modules.workflow.graph_compiler import GraphCompiler
from app.modules.workflow.graph_executor import GraphExecutor
from app.modules.workflow.node_registry import NodeRegistry
from app.modules.workflow.repository import WorkflowRepository

router = APIRouter(prefix="/api/agents", tags=["agents"])
repo = AgentRepository(session_factory=SessionLocal)
model_providers = ModelProviderRepository(session_factory=SessionLocal)
knowledge = KnowledgeRepository(session_factory=SessionLocal)
model_client = LangChainModelClient()
workflows = WorkflowRepository(session_factory=SessionLocal)
graph_executor = GraphExecutor(GraphCompiler(NodeRegistry(model_providers, knowledge, model_client)))
run_service = AgentRunService(
    traces=TraceRepository(session_factory=SessionLocal),
    model_providers=model_providers,
    knowledge=knowledge,
    model_client=model_client,
    workflows=workflows,
    graph_executor=graph_executor,
)


@router.get("", response_model=list[AgentRead])
def list_agents() -> list[AgentRead]:
    return repo.list()


@router.post("", response_model=AgentRead, status_code=status.HTTP_201_CREATED)
def create_agent(payload: AgentCreate) -> AgentRead:
    return repo.create(payload)


@router.patch("/{agent_id}", response_model=AgentRead)
def update_agent(agent_id: str, payload: AgentUpdate) -> AgentRead:
    agent = repo.update(agent_id, payload)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return agent


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent(agent_id: str) -> None:
    deleted = repo.delete(agent_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")


@router.post("/{agent_id}/runs", response_model=RunTraceRead, status_code=status.HTTP_201_CREATED)
def simulate_agent_run(agent_id: str, payload: AgentRunRequest | None = None) -> RunTraceRead:
    return run_service.simulate_run(agent_id, payload)


@router.post("/{agent_id}/runs/stream")
def stream_agent_run(agent_id: str, payload: AgentRunRequest | None = None) -> StreamingResponse:
    return StreamingResponse(
        run_service.stream_run(agent_id, payload),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
