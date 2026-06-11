from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.modules.knowledge.models import KnowledgeBaseModel, KnowledgeDocumentModel
from app.modules.knowledge.schemas import (
    KnowledgeBaseCreate,
    KnowledgeBaseRead,
    KnowledgeDocumentCreate,
    KnowledgeDocumentRead,
    KnowledgeProcessingJobRead,
    KnowledgeSearchMatch,
    KnowledgeSearchResponse,
)


class KnowledgeRepository:
    def __init__(self, session_factory: sessionmaker[Session] | None = None) -> None:
        self._session_factory = session_factory
        self._knowledge_bases: dict[str, KnowledgeBaseRead] = {}
        self._documents: dict[str, list[KnowledgeDocumentRead]] = {}
        self._seed_knowledge_base = KnowledgeBaseRead(
            id="kb-after-sale",
            name="售后政策库",
            source="上传 + 飞书预留",
            documentCount=128,
            retrievalStrategy="Hybrid + Rerank",
            qualityScore=92,
            status="ready",
        )

    def create_knowledge_base(self, payload: KnowledgeBaseCreate) -> KnowledgeBaseRead:
        knowledge_base_id = f"kb_{uuid4().hex[:8]}"
        knowledge_base = KnowledgeBaseRead(
            id=knowledge_base_id,
            name=payload.name,
            source=payload.source,
            documentCount=0,
            retrievalStrategy=payload.retrieval_strategy,
            qualityScore=0,
            status="processing",
        )

        if self._session_factory:
            with self._session_factory() as session:
                session.add(
                    KnowledgeBaseModel(
                        id=knowledge_base.id,
                        name=knowledge_base.name,
                        source=knowledge_base.source,
                        document_count=knowledge_base.document_count,
                        retrieval_strategy=knowledge_base.retrieval_strategy,
                        quality_score=knowledge_base.quality_score,
                        status=knowledge_base.status,
                    )
                )
                session.commit()
            return knowledge_base

        self._knowledge_bases[knowledge_base_id] = knowledge_base
        self._documents[knowledge_base_id] = []
        return knowledge_base

    def list_knowledge_bases(self) -> list[KnowledgeBaseRead]:
        if self._session_factory:
            with self._session_factory() as session:
                models = session.scalars(select(KnowledgeBaseModel).order_by(KnowledgeBaseModel.created_at.asc())).all()
            return [self._seed_knowledge_base, *[self._to_read_model(item) for item in models]]

        return [self._seed_knowledge_base, *self._knowledge_bases.values()]

    def add_document(self, knowledge_base_id: str, payload: KnowledgeDocumentCreate) -> KnowledgeDocumentRead:
        document = KnowledgeDocumentRead(
            id=f"doc_{uuid4().hex[:8]}",
            name=payload.name,
            mimeType=payload.mime_type,
            sizeKb=payload.size_kb,
            status="uploaded",
        )

        if self._session_factory:
            with self._session_factory() as session:
                session.add(
                    KnowledgeDocumentModel(
                        id=document.id,
                        knowledge_base_id=knowledge_base_id,
                        name=document.name,
                        mime_type=document.mime_type,
                        size_kb=document.size_kb,
                        status=document.status,
                    )
                )
                session.commit()
            return document

        self._documents.setdefault(knowledge_base_id, []).append(document)
        return document

    def create_processing_job(self, knowledge_base_id: str) -> KnowledgeProcessingJobRead:
        if self._session_factory:
            with self._session_factory() as session:
                knowledge_base = session.get(KnowledgeBaseModel, knowledge_base_id)
                if knowledge_base:
                    document_count = session.scalar(
                        select(func.count()).select_from(KnowledgeDocumentModel).where(
                            KnowledgeDocumentModel.knowledge_base_id == knowledge_base_id
                        )
                    )
                    knowledge_base.document_count = max(knowledge_base.document_count, document_count or 0)
                    knowledge_base.quality_score = 88
                    knowledge_base.status = "ready"
                    session.commit()

            return KnowledgeProcessingJobRead(
                id=f"job_{uuid4().hex[:8]}",
                knowledgeBaseId=knowledge_base_id,
                status="completed",
                chunksCreated=24,
            )

        if knowledge_base_id in self._knowledge_bases:
            current = self._knowledge_bases[knowledge_base_id]
            self._knowledge_bases[knowledge_base_id] = current.model_copy(
                update={"document_count": max(current.document_count, 1), "quality_score": 88, "status": "ready"}
            )
        return KnowledgeProcessingJobRead(
            id=f"job_{uuid4().hex[:8]}",
            knowledgeBaseId=knowledge_base_id,
            status="completed",
            chunksCreated=24,
        )

    def search(self, query: str) -> KnowledgeSearchResponse:
        return KnowledgeSearchResponse(
            query=query,
            matches=[
                KnowledgeSearchMatch(
                    documentId="doc_refund_policy",
                    text="退款政策要求先校验订单状态，并在高风险写操作前触发人工确认。",
                    score=0.91,
                )
            ],
        )

    def _to_read_model(self, knowledge_base: KnowledgeBaseModel) -> KnowledgeBaseRead:
        return KnowledgeBaseRead(
            id=knowledge_base.id,
            name=knowledge_base.name,
            source=knowledge_base.source,
            documentCount=knowledge_base.document_count,
            retrievalStrategy=knowledge_base.retrieval_strategy,
            qualityScore=knowledge_base.quality_score,
            status=knowledge_base.status,
        )
