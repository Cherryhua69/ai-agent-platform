from fastapi import APIRouter, status

from app.core.database import SessionLocal
from app.modules.agent.repository import AgentRepository
from app.modules.agent.run_service import AgentRunService
from app.modules.agent.schemas import AgentCreate, AgentRead, AgentRunRequest
from app.modules.knowledge.repository import KnowledgeRepository
from app.modules.model_provider.repository import ModelProviderRepository
from app.modules.trace.repository import TraceRepository
from app.modules.trace.schemas import RunTraceRead

router = APIRouter(prefix="/api/agents", tags=["agents"])
repo = AgentRepository(session_factory=SessionLocal)
run_service = AgentRunService(
    traces=TraceRepository(session_factory=SessionLocal),
    model_providers=ModelProviderRepository(session_factory=SessionLocal),
    knowledge=KnowledgeRepository(session_factory=SessionLocal),
)


@router.get("", response_model=list[AgentRead])
def list_agents() -> list[AgentRead]:
    return repo.list()


@router.post("", response_model=AgentRead, status_code=status.HTTP_201_CREATED)
def create_agent(payload: AgentCreate) -> AgentRead:
    return repo.create(payload)


@router.post("/{agent_id}/runs", response_model=RunTraceRead, status_code=status.HTTP_201_CREATED)
def simulate_agent_run(agent_id: str, payload: AgentRunRequest | None = None) -> RunTraceRead:
    return run_service.simulate_run(agent_id, payload)
