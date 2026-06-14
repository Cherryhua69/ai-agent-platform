from fastapi import APIRouter, HTTPException, status

from app.core.database import SessionLocal
from app.modules.model_provider.repository import ModelProviderRepository
from app.modules.model_provider.schemas import (
    ModelProviderCreate,
    ModelProviderRead,
    ModelProviderTestRequest,
    ModelProviderTestResponse,
    ModelProviderUpdate,
)
from app.modules.model_provider.service import LangChainModelClient

router = APIRouter(prefix="/api/model-providers", tags=["model-providers"])
repo = ModelProviderRepository(session_factory=SessionLocal)
model_client = LangChainModelClient()


@router.get("", response_model=list[ModelProviderRead])
def list_model_providers() -> list[ModelProviderRead]:
    return repo.list()


@router.post("", response_model=ModelProviderRead, status_code=status.HTTP_201_CREATED)
def create_model_provider(payload: ModelProviderCreate) -> ModelProviderRead:
    return repo.create(payload)


@router.put("/{provider_id}", response_model=ModelProviderRead)
def update_model_provider(provider_id: str, payload: ModelProviderUpdate) -> ModelProviderRead:
    provider = repo.update(provider_id, payload)
    if provider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model provider not found")
    return provider


@router.post("/{provider_id}/test", response_model=ModelProviderTestResponse)
def test_model_provider(provider_id: str, payload: ModelProviderTestRequest) -> ModelProviderTestResponse:
    provider = repo.get(provider_id)
    if provider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model provider not found")

    try:
        result = model_client.invoke(provider, payload.prompt)
    except Exception as exc:
        repo.set_status(provider_id, "offline")
        return ModelProviderTestResponse(status="failed", output=str(exc))

    repo.set_status(provider_id, "online")
    return ModelProviderTestResponse(status="success", output=result.content)
