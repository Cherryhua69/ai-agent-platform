from fastapi import APIRouter, status

from app.core.database import SessionLocal
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
repo = KnowledgeRepository(session_factory=SessionLocal)


@router.get("", response_model=list[KnowledgeBaseRead])
def list_knowledge_bases() -> list[KnowledgeBaseRead]:
    """查询全部知识库配置，供知识库页面列表和智能体绑定选择使用。"""
    return repo.list_knowledge_bases()


@router.post("", response_model=KnowledgeBaseRead, status_code=status.HTTP_201_CREATED)
def create_knowledge_base(payload: KnowledgeBaseCreate) -> KnowledgeBaseRead:
    """创建知识库配置，记录向量库、嵌入模型和同步策略信息。"""
    return repo.create_knowledge_base(payload)


@router.post("/{knowledge_base_id}/documents", response_model=KnowledgeDocumentRead, status_code=status.HTTP_201_CREATED)
def add_document(knowledge_base_id: str, payload: KnowledgeDocumentCreate) -> KnowledgeDocumentRead:
    """向指定知识库添加文档，并返回文档入库后的基础状态。"""
    return repo.add_document(knowledge_base_id, payload)


@router.post(
    "/{knowledge_base_id}/processing-jobs",
    response_model=KnowledgeProcessingJobRead,
    status_code=status.HTTP_201_CREATED,
)
def create_processing_job(knowledge_base_id: str) -> KnowledgeProcessingJobRead:
    """为指定知识库创建处理任务，驱动文档解析、切分和向量化流程。"""
    return repo.create_processing_job(knowledge_base_id)


@router.post("/{knowledge_base_id}/search", response_model=KnowledgeSearchResponse)
def search_knowledge_base(knowledge_base_id: str, payload: KnowledgeSearchRequest) -> KnowledgeSearchResponse:
    """在指定知识库内执行检索，返回匹配片段和相关性分数。"""
    del knowledge_base_id
    return repo.search(payload.query)
