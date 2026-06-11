from uuid import uuid4

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
    def __init__(self) -> None:
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
        self._knowledge_bases[knowledge_base_id] = knowledge_base
        self._documents[knowledge_base_id] = []
        return knowledge_base

    def list_knowledge_bases(self) -> list[KnowledgeBaseRead]:
        return [self._seed_knowledge_base, *self._knowledge_bases.values()]

    def add_document(self, knowledge_base_id: str, payload: KnowledgeDocumentCreate) -> KnowledgeDocumentRead:
        document = KnowledgeDocumentRead(
            id=f"doc_{uuid4().hex[:8]}",
            name=payload.name,
            mimeType=payload.mime_type,
            sizeKb=payload.size_kb,
            status="uploaded",
        )
        self._documents.setdefault(knowledge_base_id, []).append(document)
        return document

    def create_processing_job(self, knowledge_base_id: str) -> KnowledgeProcessingJobRead:
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
