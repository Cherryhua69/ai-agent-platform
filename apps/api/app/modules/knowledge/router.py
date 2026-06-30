from fastapi import APIRouter, BackgroundTasks, HTTPException, Response, UploadFile, status
from fastapi.responses import StreamingResponse

from app.core.database import SessionLocal
from app.modules.knowledge.document_parser import extract_pdf_text
from app.modules.knowledge.embedding_service import ModelProviderEmbeddingService
from app.modules.knowledge.repository import KnowledgeRepository
from app.modules.knowledge.schemas import (
    KnowledgeAnswerRequest,
    KnowledgeAnswerResponse,
    KnowledgeBaseCreate,
    KnowledgeBaseRead,
    KnowledgeBaseUpdate,
    KnowledgeDocumentCreate,
    KnowledgeDocumentRead,
    KnowledgeProcessingJobRead,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
    KnowledgeSegmentRead,
)
from app.modules.knowledge.vector_store_factory import create_vector_store
from app.modules.model_provider.repository import ModelProviderRepository
from app.modules.model_provider.service import LangChainModelClient
from app.modules.trace.repository import TraceRepository

router = APIRouter(prefix="/api/knowledge-bases", tags=["knowledge-bases"])
model_provider_repo = ModelProviderRepository(session_factory=SessionLocal)
repo = KnowledgeRepository(
    session_factory=SessionLocal,
    embedding_service=ModelProviderEmbeddingService(provider_repository=model_provider_repo),
    vector_store=create_vector_store(),
    model_provider_repository=model_provider_repo,
    model_client=LangChainModelClient(),
    traces=TraceRepository(session_factory=SessionLocal),
)


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
    document = repo.add_document(knowledge_base_id, payload)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")
    return document


@router.delete("/{knowledge_base_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(knowledge_base_id: str, document_id: str) -> Response:
    """删除指定知识库中的单个文档，并清理该文档已生成的分段。"""
    deleted = repo.delete_document(knowledge_base_id, document_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge document not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{knowledge_base_id}/documents/upload",
    response_model=KnowledgeDocumentRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(knowledge_base_id: str, file: UploadFile) -> KnowledgeDocumentRead:
    """上传文本类知识库文件，先支持 txt 和 markdown。"""
    filename = file.filename or "untitled.txt"
    mime_type = (file.content_type or "text/plain").lower().split(";")[0]
    lowered_name = filename.lower()
    if mime_type not in {"text/plain", "text/markdown", "text/x-markdown", "application/pdf"} and not lowered_name.endswith(
        (".txt", ".md", ".markdown", ".pdf")
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported document type")

    raw_content = await file.read()
    if mime_type == "application/pdf" or lowered_name.endswith(".pdf"):
        mime_type = "application/pdf"
        try:
            content = extract_pdf_text(raw_content)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    else:
        try:
            content = raw_content.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Document must be UTF-8 text") from exc
    size_kb = max(1, (len(raw_content) + 1023) // 1024)
    document = repo.add_document(
        knowledge_base_id,
        KnowledgeDocumentCreate(name=filename, mimeType=mime_type, sizeKb=size_kb, content=content),
    )
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")
    return document


@router.get("/{knowledge_base_id}/documents/{document_id}/segments", response_model=list[KnowledgeSegmentRead])
def list_document_segments(knowledge_base_id: str, document_id: str) -> list[KnowledgeSegmentRead]:
    """查询指定文档已生成的知识分段，供前端预览切分结果。"""
    segments = repo.list_document_segments(knowledge_base_id, document_id)
    if segments is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge document not found")
    return segments


@router.post(
    "/{knowledge_base_id}/processing-jobs",
    response_model=KnowledgeProcessingJobRead,
    status_code=status.HTTP_201_CREATED,
)
def create_processing_job(knowledge_base_id: str, background_tasks: BackgroundTasks) -> KnowledgeProcessingJobRead:
    """为指定知识库创建处理任务，驱动文档解析、切分和向量化流程。"""
    job = repo.create_processing_job(knowledge_base_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")
    background_tasks.add_task(repo.run_processing_job, job.id)
    return job


@router.get("/{knowledge_base_id}/processing-jobs", response_model=list[KnowledgeProcessingJobRead])
def list_processing_jobs(knowledge_base_id: str) -> list[KnowledgeProcessingJobRead]:
    """查询指定知识库的处理任务记录，供前端展示最近一次处理状态。"""
    jobs = repo.list_processing_jobs(knowledge_base_id)
    if jobs is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")
    return jobs


@router.post("/{knowledge_base_id}/search", response_model=KnowledgeSearchResponse)
def search_knowledge_base(knowledge_base_id: str, payload: KnowledgeSearchRequest) -> KnowledgeSearchResponse:
    """在指定知识库内执行检索，返回匹配片段和相关性分数。"""
    result = repo.search(payload.query, knowledge_base_id=knowledge_base_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")
    return result


@router.post("/{knowledge_base_id}/answer", response_model=KnowledgeAnswerResponse)
def answer_knowledge_base(knowledge_base_id: str, payload: KnowledgeAnswerRequest) -> KnowledgeAnswerResponse:
    """基于知识库检索片段调用默认 LLM 生成回答，并返回引用来源。"""
    try:
        result = repo.answer(payload.query, knowledge_base_id=knowledge_base_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")
    return result


@router.post("/{knowledge_base_id}/answer/stream")
def stream_knowledge_base_answer(knowledge_base_id: str, payload: KnowledgeAnswerRequest) -> StreamingResponse:
    """以 NDJSON 流式返回 RAG 回答生成过程，并在完成后写入运行 Trace。"""
    return StreamingResponse(
        repo.stream_answer(payload.query, knowledge_base_id=knowledge_base_id),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
