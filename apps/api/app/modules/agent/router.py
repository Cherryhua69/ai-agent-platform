from fastapi import APIRouter, status

from app.modules.agent.repository import AgentRepository
from app.modules.agent.schemas import AgentCreate, AgentRead

router = APIRouter(prefix="/api/agents", tags=["agents"])
repo = AgentRepository()


@router.get("", response_model=list[AgentRead])
def list_agents() -> list[AgentRead]:
    return repo.list()


@router.post("", response_model=AgentRead, status_code=status.HTTP_201_CREATED)
def create_agent(payload: AgentCreate) -> AgentRead:
    return repo.create(payload)
