from fastapi import APIRouter, status

from app.modules.knowledge.repository import KnowledgeRepository
from app.modules.knowledge.schemas import (
    KnowledgeBaseCreate,
    KnowledgeBaseRead,
    KnowledgeDocumentCreate,
    KnowledgeDocumentRead,
    KnowledgeProcessingJobRead,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
)

router = APIRouter(prefix="/api/knowledge-bases", tags=["knowledge-bases"])
repo = KnowledgeRepository()


@router.get("", response_model=list[KnowledgeBaseRead])
def list_knowledge_bases() -> list[KnowledgeBaseRead]:
    return repo.list_knowledge_bases()


@router.post("", response_model=KnowledgeBaseRead, status_code=status.HTTP_201_CREATED)
def create_knowledge_base(payload: KnowledgeBaseCreate) -> KnowledgeBaseRead:
    return repo.create_knowledge_base(payload)


@router.post("/{knowledge_base_id}/documents", response_model=KnowledgeDocumentRead, status_code=status.HTTP_201_CREATED)
def add_document(knowledge_base_id: str, payload: KnowledgeDocumentCreate) -> KnowledgeDocumentRead:
    return repo.add_document(knowledge_base_id, payload)


@router.post(
    "/{knowledge_base_id}/processing-jobs",
    response_model=KnowledgeProcessingJobRead,
    status_code=status.HTTP_201_CREATED,
)
def create_processing_job(knowledge_base_id: str) -> KnowledgeProcessingJobRead:
    return repo.create_processing_job(knowledge_base_id)


@router.post("/{knowledge_base_id}/search", response_model=KnowledgeSearchResponse)
def search_knowledge_base(knowledge_base_id: str, payload: KnowledgeSearchRequest) -> KnowledgeSearchResponse:
    del knowledge_base_id
    return repo.search(payload.query)
