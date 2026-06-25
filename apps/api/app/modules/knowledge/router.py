from fastapi import APIRouter, HTTPException, Response, status

from app.core.database import SessionLocal
from app.modules.knowledge.repository import KnowledgeRepository
from app.modules.knowledge.schemas import (
    KnowledgeBaseCreate,
    KnowledgeBaseRead,
    KnowledgeBaseUpdate,
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
    try:
        return repo.create_knowledge_base(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/{knowledge_base_id}", response_model=KnowledgeBaseRead)
def update_knowledge_base(knowledge_base_id: str, payload: KnowledgeBaseUpdate) -> KnowledgeBaseRead:
    """更新知识库基础配置，包括嵌入模型、切分策略和检索参数。"""
    try:
        knowledge_base = repo.update_knowledge_base(knowledge_base_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if knowledge_base is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")
    return knowledge_base


@router.delete("/{knowledge_base_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_knowledge_base(knowledge_base_id: str) -> Response:
    """删除知识库资源，并清理当前底座中关联的文档记录。"""
    deleted = repo.delete_knowledge_base(knowledge_base_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{knowledge_base_id}/documents", response_model=list[KnowledgeDocumentRead])
def list_documents(knowledge_base_id: str) -> list[KnowledgeDocumentRead]:
    """查询指定知识库已上传的文档列表。"""
    documents = repo.list_documents(knowledge_base_id)
    if documents is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")
    return documents


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
