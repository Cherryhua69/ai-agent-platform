from uuid import uuid4

from sqlalchemy import delete, func, inspect, select
from sqlalchemy.orm import Session, sessionmaker

from app.modules.knowledge.models import KnowledgeBaseModel, KnowledgeDocumentModel
from app.modules.knowledge.schemas import (
    KnowledgeBaseCreate,
    KnowledgeBaseRead,
    KnowledgeBaseUpdate,
    KnowledgeDocumentCreate,
    KnowledgeDocumentRead,
    KnowledgeProcessingJobRead,
    KnowledgeSearchMatch,
    KnowledgeSearchResponse,
)
from app.modules.model_provider.models import ModelProviderModel


class KnowledgeRepository:
    def __init__(self, session_factory: sessionmaker[Session] | None = None) -> None:
        self._session_factory = session_factory
        self._knowledge_bases: dict[str, KnowledgeBaseRead] = {}
        self._documents: dict[str, list[KnowledgeDocumentRead]] = {}
        
    def create_knowledge_base(self, payload: KnowledgeBaseCreate) -> KnowledgeBaseRead:
        knowledge_base_id = f"kb_{uuid4().hex[:8]}"
        retrieval_strategy = payload.retrieval_strategy or self._format_retrieval_strategy(payload.retrieval_mode)
        knowledge_base = KnowledgeBaseRead(
            id=knowledge_base_id,
            name=payload.name,
            description=payload.description,
            source=payload.source,
            embeddingModelProviderId=payload.embedding_model_provider_id,
            embeddingModelProviderName=None,
            chunkStrategy=payload.chunk_strategy,
            chunkSize=payload.chunk_size,
            chunkOverlap=payload.chunk_overlap,
            retrievalMode=payload.retrieval_mode,
            topK=payload.top_k,
            similarityThreshold=payload.similarity_threshold,
            returnCitations=payload.return_citations,
            documentCount=0,
            retrievalStrategy=retrieval_strategy,
            qualityScore=0,
            status="draft",
        )

        if self._session_factory:
            with self._session_factory() as session:
                embedding_provider = self._get_valid_embedding_provider(session, payload.embedding_model_provider_id)
                session.add(
                    KnowledgeBaseModel(
                        id=knowledge_base.id,
                        name=knowledge_base.name,
                        description=knowledge_base.description,
                        source=knowledge_base.source,
                        embedding_model_provider_id=knowledge_base.embedding_model_provider_id,
                        chunk_strategy=knowledge_base.chunk_strategy,
                        chunk_size=knowledge_base.chunk_size,
                        chunk_overlap=knowledge_base.chunk_overlap,
                        retrieval_mode=knowledge_base.retrieval_mode,
                        top_k=knowledge_base.top_k,
                        similarity_threshold=knowledge_base.similarity_threshold,
                        return_citations=knowledge_base.return_citations,
                        document_count=knowledge_base.document_count,
                        retrieval_strategy=knowledge_base.retrieval_strategy,
                        quality_score=knowledge_base.quality_score,
                        status=knowledge_base.status,
                    )
                )
                session.commit()
            return knowledge_base.model_copy(update={"embedding_model_provider_name": embedding_provider.name if embedding_provider else None})

        self._validate_in_memory_embedding_provider(payload.embedding_model_provider_id)
        knowledge_base = knowledge_base.model_copy(
            update={
                "embedding_model_provider_name": self._embedding_provider_name_from_memory(payload.embedding_model_provider_id)
            }
        )
        self._knowledge_bases[knowledge_base_id] = knowledge_base
        self._documents[knowledge_base_id] = []
        return knowledge_base

    def update_knowledge_base(self, knowledge_base_id: str, payload: KnowledgeBaseUpdate) -> KnowledgeBaseRead | None:
        retrieval_strategy = self._format_retrieval_strategy(payload.retrieval_mode)

        if self._session_factory:
            with self._session_factory() as session:
                knowledge_base = session.get(KnowledgeBaseModel, knowledge_base_id)
                if knowledge_base is None:
                    return None
                embedding_provider = self._get_valid_embedding_provider(session, payload.embedding_model_provider_id)
                knowledge_base.name = payload.name
                knowledge_base.description = payload.description
                knowledge_base.source = payload.source
                knowledge_base.embedding_model_provider_id = payload.embedding_model_provider_id
                knowledge_base.chunk_strategy = payload.chunk_strategy
                knowledge_base.chunk_size = payload.chunk_size
                knowledge_base.chunk_overlap = payload.chunk_overlap
                knowledge_base.retrieval_mode = payload.retrieval_mode
                knowledge_base.top_k = payload.top_k
                knowledge_base.similarity_threshold = payload.similarity_threshold
                knowledge_base.return_citations = payload.return_citations
                knowledge_base.retrieval_strategy = retrieval_strategy
                knowledge_base.status = "draft" if payload.embedding_model_provider_id is None else knowledge_base.status
                session.commit()
                return self._to_read_model(knowledge_base, embedding_provider_name=embedding_provider.name if embedding_provider else None)

        self._validate_in_memory_embedding_provider(payload.embedding_model_provider_id)
        current = self._knowledge_bases.get(knowledge_base_id)
        if current is None:
            return None
        updated = current.model_copy(
            update={
                "name": payload.name,
                "description": payload.description,
                "source": payload.source,
                "embedding_model_provider_id": payload.embedding_model_provider_id,
                "embedding_model_provider_name": self._embedding_provider_name_from_memory(payload.embedding_model_provider_id),
                "chunk_strategy": payload.chunk_strategy,
                "chunk_size": payload.chunk_size,
                "chunk_overlap": payload.chunk_overlap,
                "retrieval_mode": payload.retrieval_mode,
                "top_k": payload.top_k,
                "similarity_threshold": payload.similarity_threshold,
                "return_citations": payload.return_citations,
                "retrieval_strategy": retrieval_strategy,
                "status": "draft" if payload.embedding_model_provider_id is None else current.status,
            }
        )
        self._knowledge_bases[knowledge_base_id] = updated
        return updated

    def list_knowledge_bases(self) -> list[KnowledgeBaseRead]:
        if self._session_factory:
            with self._session_factory() as session:
                models = session.scalars(select(KnowledgeBaseModel).order_by(KnowledgeBaseModel.created_at.asc())).all()
                provider_names: dict[str, str] = {}
                bind = session.get_bind()
                if inspect(bind).has_table("model_providers"):
                    provider_names = {
                        provider.id: provider.name
                        for provider in session.scalars(select(ModelProviderModel)).all()
                    }
            knowledge_bases = [
                self._to_read_model(item, embedding_provider_name=provider_names.get(item.embedding_model_provider_id))
                for item in models
            ]
            return knowledge_bases

        return [*self._knowledge_bases.values()]

    def list_documents(self, knowledge_base_id: str) -> list[KnowledgeDocumentRead] | None:
        if self._session_factory:
            with self._session_factory() as session:
                knowledge_base = session.get(KnowledgeBaseModel, knowledge_base_id)
                if knowledge_base is None:
                    return None
                models = session.scalars(
                    select(KnowledgeDocumentModel)
                    .where(KnowledgeDocumentModel.knowledge_base_id == knowledge_base_id)
                    .order_by(KnowledgeDocumentModel.created_at.desc())
                ).all()
                return [self._document_to_read_model(item) for item in models]

        if knowledge_base_id not in self._knowledge_bases:
            return None
        return self._documents.get(knowledge_base_id, [])

    def delete_knowledge_base(self, knowledge_base_id: str) -> bool:
        if self._session_factory:
            with self._session_factory() as session:
                knowledge_base = session.get(KnowledgeBaseModel, knowledge_base_id)
                if knowledge_base is None:
                    return False
                session.execute(delete(KnowledgeDocumentModel).where(KnowledgeDocumentModel.knowledge_base_id == knowledge_base_id))
                session.delete(knowledge_base)
                session.commit()
                return True

        if knowledge_base_id not in self._knowledge_bases:
            return False
        self._knowledge_bases.pop(knowledge_base_id, None)
        self._documents.pop(knowledge_base_id, None)
        return True

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

    def _to_read_model(self, knowledge_base: KnowledgeBaseModel, embedding_provider_name: str | None = None) -> KnowledgeBaseRead:
        return KnowledgeBaseRead(
            id=knowledge_base.id,
            name=knowledge_base.name,
            description=knowledge_base.description,
            source=knowledge_base.source,
            embeddingModelProviderId=knowledge_base.embedding_model_provider_id,
            embeddingModelProviderName=embedding_provider_name,
            chunkStrategy=knowledge_base.chunk_strategy,
            chunkSize=knowledge_base.chunk_size,
            chunkOverlap=knowledge_base.chunk_overlap,
            retrievalMode=knowledge_base.retrieval_mode,
            topK=knowledge_base.top_k,
            similarityThreshold=knowledge_base.similarity_threshold,
            returnCitations=knowledge_base.return_citations,
            documentCount=knowledge_base.document_count,
            retrievalStrategy=knowledge_base.retrieval_strategy,
            qualityScore=knowledge_base.quality_score,
            status=knowledge_base.status,
        )

    def _document_to_read_model(self, document: KnowledgeDocumentModel) -> KnowledgeDocumentRead:
        return KnowledgeDocumentRead(
            id=document.id,
            name=document.name,
            mimeType=document.mime_type,
            sizeKb=document.size_kb,
            status=document.status,
            segmentMode="通用",
            characterCount=0,
            hitCount=0,
            createdAt=document.created_at.strftime("%Y-%m-%d %H:%M") if document.created_at else None,
        )

    def _get_valid_embedding_provider(
        self, session: Session, provider_id: str | None
    ) -> ModelProviderModel | None:
        if provider_id is None:
            return None
        provider = session.get(ModelProviderModel, provider_id)
        if provider is None:
            raise ValueError("Embedding model provider not found")
        if provider.model_purpose != "embedding":
            raise ValueError("Embedding model provider must use embedding purpose")
        return provider

    def _validate_in_memory_embedding_provider(self, provider_id: str | None) -> None:
        if provider_id is not None:
            raise ValueError("Embedding model provider not found")

    def _embedding_provider_name_from_memory(self, provider_id: str | None) -> str | None:
        del provider_id
        return None

    def _format_retrieval_strategy(self, retrieval_mode: str) -> str:
        return "Hybrid" if retrieval_mode == "hybrid" else "Vector"
