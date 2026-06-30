import hashlib
import json
import re
from time import perf_counter
from uuid import uuid4

from sqlalchemy import delete, inspect, select
from sqlalchemy.orm import Session, sessionmaker

from app.modules.knowledge.document_parser import BasicDocumentParser, DocumentParser
from app.modules.knowledge.embedding_service import EmbeddingService, NullEmbeddingService
from app.modules.knowledge.models import (
    KnowledgeBaseModel,
    KnowledgeDocumentModel,
    KnowledgeProcessingJobModel,
    KnowledgeSegmentModel,
    utc_now,
)
from app.modules.knowledge.schemas import (
    KnowledgeAnswerResponse,
    KnowledgeBaseCreate,
    KnowledgeBaseRead,
    KnowledgeBaseUpdate,
    KnowledgeCitationRead,
    KnowledgeDocumentCreate,
    KnowledgeDocumentRead,
    KnowledgeProcessingJobRead,
    KnowledgeSearchMatch,
    KnowledgeSearchResponse,
    KnowledgeSegmentRead,
)
from app.modules.knowledge.vector_store import NullVectorStore, VectorStore
from app.modules.model_provider.models import ModelProviderModel
from app.modules.model_provider.repository import ModelProviderRepository
from app.modules.model_provider.service import LangChainModelClient
from app.modules.trace.repository import TraceRepository
from app.modules.trace.schemas import RunTraceCreate, TraceStepCreate


class KnowledgeRepository:
    def __init__(
        self,
        session_factory: sessionmaker[Session] | None = None,
        vector_store: VectorStore | None = None,
        embedding_service: EmbeddingService | None = None,
        document_parser: DocumentParser | None = None,
        model_provider_repository: ModelProviderRepository | None = None,
        model_client: LangChainModelClient | None = None,
        traces: TraceRepository | None = None,
    ) -> None:
        self._session_factory = session_factory
        self._vector_store = vector_store or NullVectorStore()
        self._embedding_service = embedding_service or NullEmbeddingService()
        self._document_parser = document_parser or BasicDocumentParser()
        self._model_provider_repository = model_provider_repository
        self._model_client = model_client or LangChainModelClient()
        self._traces = traces
        self._knowledge_bases: dict[str, KnowledgeBaseRead] = {}
        self._documents: dict[str, list[KnowledgeDocumentRead]] = {}
        self._document_content: dict[str, str] = {}
        self._segments: dict[str, list[dict[str, str | int]]] = {}
        self._processing_jobs: dict[str, list[KnowledgeProcessingJobRead]] = {}
        
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
        self._processing_jobs[knowledge_base_id] = []
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
                session.execute(delete(KnowledgeProcessingJobModel).where(KnowledgeProcessingJobModel.knowledge_base_id == knowledge_base_id))
                session.execute(delete(KnowledgeSegmentModel).where(KnowledgeSegmentModel.knowledge_base_id == knowledge_base_id))
                session.execute(delete(KnowledgeDocumentModel).where(KnowledgeDocumentModel.knowledge_base_id == knowledge_base_id))
                session.delete(knowledge_base)
                session.commit()
                self._vector_store.delete_knowledge_base(knowledge_base_id)
                return True

        if knowledge_base_id not in self._knowledge_bases:
            return False
        self._knowledge_bases.pop(knowledge_base_id, None)
        documents = self._documents.pop(knowledge_base_id, None) or []
        for document in documents:
            self._document_content.pop(document.id, None)
        self._segments.pop(knowledge_base_id, None)
        self._processing_jobs.pop(knowledge_base_id, None)
        self._vector_store.delete_knowledge_base(knowledge_base_id)
        return True

    def add_document(self, knowledge_base_id: str, payload: KnowledgeDocumentCreate) -> KnowledgeDocumentRead | None:
        character_count = len(payload.content or "")
        document = KnowledgeDocumentRead(
            id=f"doc_{uuid4().hex[:8]}",
            name=payload.name,
            mimeType=payload.mime_type,
            sizeKb=payload.size_kb,
            status="uploaded",
            characterCount=character_count,
        )

        if self._session_factory:
            with self._session_factory() as session:
                if session.get(KnowledgeBaseModel, knowledge_base_id) is None:
                    return None
                session.add(
                    KnowledgeDocumentModel(
                        id=document.id,
                        knowledge_base_id=knowledge_base_id,
                        name=document.name,
                        mime_type=document.mime_type,
                        size_kb=document.size_kb,
                        content=payload.content,
                        character_count=character_count,
                        status=document.status,
                    )
                )
                session.commit()
            return document

        if knowledge_base_id not in self._knowledge_bases:
            return None
        self._documents.setdefault(knowledge_base_id, []).append(document)
        self._document_content[document.id] = payload.content or ""
        return document

    def delete_document(self, knowledge_base_id: str, document_id: str) -> bool:
        if self._session_factory:
            with self._session_factory() as session:
                knowledge_base = session.get(KnowledgeBaseModel, knowledge_base_id)
                document = session.get(KnowledgeDocumentModel, document_id)
                if knowledge_base is None or document is None or document.knowledge_base_id != knowledge_base_id:
                    return False
                session.execute(delete(KnowledgeSegmentModel).where(KnowledgeSegmentModel.document_id == document_id))
                session.delete(document)
                remaining_count = len(
                    session.scalars(
                        select(KnowledgeDocumentModel).where(KnowledgeDocumentModel.knowledge_base_id == knowledge_base_id)
                    ).all()
                ) - 1
                knowledge_base.document_count = max(remaining_count, 0)
                if knowledge_base.document_count == 0:
                    knowledge_base.quality_score = 0
                    knowledge_base.status = "draft"
                session.commit()
                self._vector_store.delete_document(knowledge_base_id, document_id)
                return True

        if knowledge_base_id not in self._knowledge_bases:
            return False
        documents = self._documents.get(knowledge_base_id, [])
        if not any(document.id == document_id for document in documents):
            return False
        self._documents[knowledge_base_id] = [document for document in documents if document.id != document_id]
        self._document_content.pop(document_id, None)
        self._segments[knowledge_base_id] = [
            segment
            for segment in self._segments.get(knowledge_base_id, [])
            if str(segment["document_id"]) != document_id
        ]
        current = self._knowledge_bases[knowledge_base_id]
        remaining_count = len(self._documents[knowledge_base_id])
        self._knowledge_bases[knowledge_base_id] = current.model_copy(
            update={
                "document_count": remaining_count,
                "quality_score": current.quality_score if remaining_count else 0,
                "status": current.status if remaining_count else "draft",
            }
        )
        self._vector_store.delete_document(knowledge_base_id, document_id)
        return True

    def create_processing_job(self, knowledge_base_id: str) -> KnowledgeProcessingJobRead | None:
        if self._session_factory:
            with self._session_factory() as session:
                if session.get(KnowledgeBaseModel, knowledge_base_id) is None:
                    return None
                job_model = KnowledgeProcessingJobModel(
                    id=f"job_{uuid4().hex[:8]}",
                    knowledge_base_id=knowledge_base_id,
                    status="queued",
                )
                session.add(job_model)
                session.commit()
                return self._job_to_read_model(job_model)

        if knowledge_base_id not in self._knowledge_bases:
            return None
        job = KnowledgeProcessingJobRead(
            id=f"job_{uuid4().hex[:8]}",
            knowledgeBaseId=knowledge_base_id,
            status="queued",
            chunksCreated=0,
            createdAt=self._format_datetime(utc_now()),
        )
        self._processing_jobs.setdefault(knowledge_base_id, []).insert(0, job)
        return job

    def run_processing_job(self, job_id: str) -> KnowledgeProcessingJobRead | None:
        if self._session_factory:
            with self._session_factory() as session:
                job_model = session.get(KnowledgeProcessingJobModel, job_id)
                if job_model is None:
                    return None
                knowledge_base = session.get(KnowledgeBaseModel, job_model.knowledge_base_id)
                if knowledge_base is None:
                    return None
                job_model.status = "running"
                job_model.started_at = utc_now()
                session.commit()
                documents = session.scalars(
                    select(KnowledgeDocumentModel).where(
                        KnowledgeDocumentModel.knowledge_base_id == job_model.knowledge_base_id
                    )
                ).all()
                session.execute(
                    delete(KnowledgeSegmentModel).where(
                        KnowledgeSegmentModel.knowledge_base_id == job_model.knowledge_base_id
                    )
                )
                segments: list[KnowledgeSegmentModel] = []
                try:
                    for document in documents:
                        content = self._document_parser.parse(
                            name=document.name,
                            mime_type=document.mime_type,
                            content=document.content,
                        )
                        chunks = self._split_content(content, knowledge_base.chunk_size, knowledge_base.chunk_overlap)
                        document.character_count = len(content)
                        document.status = "available" if chunks else "empty"
                        document.error_message = None
                        for position, chunk in enumerate(chunks, start=1):
                            segments.append(
                                KnowledgeSegmentModel(
                                    id=f"seg_{uuid4().hex[:8]}",
                                    knowledge_base_id=job_model.knowledge_base_id,
                                    document_id=document.id,
                                    position=position,
                                    content=chunk,
                                    character_count=len(chunk),
                                    token_count=len(chunk.split()),
                                    index_node_hash=self._hash_segment(document.id, position, chunk),
                                    status="available",
                                )
                            )
                except ValueError as exc:
                    error_message = str(exc)
                    session.execute(
                        delete(KnowledgeSegmentModel).where(
                            KnowledgeSegmentModel.knowledge_base_id == job_model.knowledge_base_id
                        )
                    )
                    for document in documents:
                        document.status = "failed"
                        document.error_message = error_message
                    knowledge_base.quality_score = 0
                    knowledge_base.status = "stale"
                    job_model.status = "failed"
                    job_model.chunks_created = 0
                    job_model.error_message = error_message
                    job_model.finished_at = utc_now()
                    session.commit()
                    return self._job_to_read_model(job_model)
                session.add_all(segments)
                knowledge_base.document_count = len(documents)
                knowledge_base.quality_score = 88 if segments else 0
                knowledge_base.status = "ready" if segments else "draft"
                session.commit()
                try:
                    embeddings = self._embedding_service.embed_documents(
                        [segment.content for segment in segments],
                        provider_id=knowledge_base.embedding_model_provider_id,
                    )
                    if segments:
                        self._vector_store.upsert_segments(segments, embeddings=embeddings)
                except RuntimeError as exc:
                    error_message = str(exc)
                    session.execute(
                        delete(KnowledgeSegmentModel).where(
                            KnowledgeSegmentModel.knowledge_base_id == job_model.knowledge_base_id
                        )
                    )
                    for document in documents:
                        document.status = "failed"
                        document.error_message = error_message
                    knowledge_base.quality_score = 0
                    knowledge_base.status = "stale"
                    job_model.status = "failed"
                    job_model.chunks_created = 0
                    job_model.error_message = error_message
                    job_model.finished_at = utc_now()
                    session.commit()
                    return self._job_to_read_model(job_model)

                job_model.status = "succeeded"
                job_model.chunks_created = len(segments)
                job_model.finished_at = utc_now()
                session.commit()
                return self._job_to_read_model(job_model)

        for knowledge_base_id, jobs in self._processing_jobs.items():
            job = next((item for item in jobs if item.id == job_id), None)
            if job is not None:
                break
        else:
            return None
        current = self._knowledge_bases[knowledge_base_id]
        running_job = job.model_copy(
            update={
                "status": "running",
                "started_at": self._format_datetime(utc_now()),
            }
        )
        jobs[jobs.index(job)] = running_job
        documents = self._documents.get(knowledge_base_id, [])
        segments: list[dict[str, str | int]] = []
        updated_documents: list[KnowledgeDocumentRead] = []
        try:
            for document in documents:
                content = self._document_parser.parse(
                    name=document.name,
                    mime_type=document.mime_type,
                    content=self._document_content.get(document.id),
                )
                chunks = self._split_content(content, current.chunk_size, current.chunk_overlap)
                updated_documents.append(
                    document.model_copy(
                        update={
                            "status": "available" if chunks else "empty",
                            "character_count": len(content),
                            "error_message": None,
                        }
                    )
                )
                for position, chunk in enumerate(chunks, start=1):
                    segments.append(
                        {
                            "id": f"seg_{uuid4().hex[:8]}",
                            "knowledge_base_id": knowledge_base_id,
                            "document_id": document.id,
                            "document_name": document.name,
                            "position": position,
                            "content": chunk,
                        }
                    )
        except ValueError as exc:
            error_message = str(exc)
            self._segments[knowledge_base_id] = []
            self._documents[knowledge_base_id] = [
                document.model_copy(update={"status": "failed", "error_message": error_message})
                for document in documents
            ]
            self._knowledge_bases[knowledge_base_id] = current.model_copy(
                update={"document_count": len(documents), "quality_score": 0, "status": "stale"}
            )
            failed_job = running_job.model_copy(
                update={
                    "status": "failed",
                    "chunks_created": 0,
                    "error_message": error_message,
                    "finished_at": self._format_datetime(utc_now()),
                }
            )
            jobs[jobs.index(running_job)] = failed_job
            return failed_job
        self._documents[knowledge_base_id] = updated_documents
        try:
            embeddings = self._embedding_service.embed_documents(
                [str(segment["content"]) for segment in segments],
                provider_id=current.embedding_model_provider_id,
            )
            if segments:
                self._vector_store.upsert_segments(segments, embeddings=embeddings)
        except RuntimeError as exc:
            error_message = str(exc)
            self._segments[knowledge_base_id] = []
            self._documents[knowledge_base_id] = [
                document.model_copy(update={"status": "failed", "error_message": error_message})
                for document in updated_documents
            ]
            self._knowledge_bases[knowledge_base_id] = current.model_copy(
                update={"document_count": len(documents), "quality_score": 0, "status": "stale"}
            )
            failed_job = running_job.model_copy(
                update={
                    "status": "failed",
                    "chunks_created": 0,
                    "error_message": error_message,
                    "finished_at": self._format_datetime(utc_now()),
                }
            )
            jobs[jobs.index(running_job)] = failed_job
            return failed_job
        self._segments[knowledge_base_id] = segments
        self._knowledge_bases[knowledge_base_id] = current.model_copy(
            update={"document_count": len(documents), "quality_score": 88 if segments else 0, "status": "ready" if segments else "draft"}
        )
        completed_job = running_job.model_copy(
            update={
                "status": "succeeded",
                "chunks_created": len(segments),
                "finished_at": self._format_datetime(utc_now()),
            }
        )
        jobs[jobs.index(running_job)] = completed_job
        return completed_job

    def run_pending_processing_jobs(self) -> list[KnowledgeProcessingJobRead]:
        if self._session_factory:
            with self._session_factory() as session:
                pending_jobs = session.scalars(
                    select(KnowledgeProcessingJobModel)
                    .where(KnowledgeProcessingJobModel.status.in_(["queued", "running"]))
                    .order_by(KnowledgeProcessingJobModel.created_at.asc())
                ).all()
                job_ids = [job.id for job in pending_jobs]
            return [job for job_id in job_ids if (job := self.run_processing_job(job_id)) is not None]

        pending_job_ids = [
            job.id
            for jobs in self._processing_jobs.values()
            for job in jobs
            if job.status in {"queued", "running"}
        ]
        return [job for job_id in pending_job_ids if (job := self.run_processing_job(job_id)) is not None]

    def list_processing_jobs(self, knowledge_base_id: str) -> list[KnowledgeProcessingJobRead] | None:
        if self._session_factory:
            with self._session_factory() as session:
                if session.get(KnowledgeBaseModel, knowledge_base_id) is None:
                    return None
                models = session.scalars(
                    select(KnowledgeProcessingJobModel)
                    .where(KnowledgeProcessingJobModel.knowledge_base_id == knowledge_base_id)
                    .order_by(KnowledgeProcessingJobModel.created_at.desc())
                ).all()
                return [self._job_to_read_model(item) for item in models]

        if knowledge_base_id not in self._knowledge_bases:
            return None
        return self._processing_jobs.get(knowledge_base_id, [])

    def list_document_segments(self, knowledge_base_id: str, document_id: str) -> list[KnowledgeSegmentRead] | None:
        if self._session_factory:
            with self._session_factory() as session:
                if session.get(KnowledgeBaseModel, knowledge_base_id) is None:
                    return None
                document = session.get(KnowledgeDocumentModel, document_id)
                if document is None or document.knowledge_base_id != knowledge_base_id:
                    return None
                segments = session.scalars(
                    select(KnowledgeSegmentModel)
                    .where(KnowledgeSegmentModel.knowledge_base_id == knowledge_base_id)
                    .where(KnowledgeSegmentModel.document_id == document_id)
                    .order_by(KnowledgeSegmentModel.position.asc())
                ).all()
                return [self._segment_to_read_model(item) for item in segments]

        if knowledge_base_id not in self._knowledge_bases:
            return None
        if not any(document.id == document_id for document in self._documents.get(knowledge_base_id, [])):
            return None
        segments = [
            segment
            for segment in self._segments.get(knowledge_base_id, [])
            if str(segment["document_id"]) == document_id
        ]
        segments.sort(key=lambda item: int(item["position"]))
        return [
            KnowledgeSegmentRead(
                id=str(segment["id"]),
                knowledgeBaseId=knowledge_base_id,
                documentId=document_id,
                position=int(segment["position"]),
                content=str(segment["content"]),
                characterCount=len(str(segment["content"])),
                tokenCount=len(str(segment["content"]).split()),
                status="available",
                indexNodeHash=None,
            )
            for segment in segments
        ]

    def search(
        self,
        query: str,
        knowledge_base_id: str | None = None,
        top_k: int | None = None,
        similarity_threshold: float | None = None,
        return_citations: bool | None = None,
    ) -> KnowledgeSearchResponse | None:
        if knowledge_base_id is None:
            return KnowledgeSearchResponse(
                query=query,
                matches=[
                    KnowledgeSearchMatch(
                        documentId="doc_refund_policy",
                        text="退款政策要求先校验订单状态，并在高风险写操作前触发人工确认。",
                        content="退款政策要求先校验订单状态，并在高风险写操作前触发人工确认。",
                        score=0.91,
                    )
                ],
            )

        if self._session_factory:
            with self._session_factory() as session:
                knowledge_base = session.get(KnowledgeBaseModel, knowledge_base_id)
                if knowledge_base is None:
                    return None
                rows = session.execute(
                    select(KnowledgeSegmentModel, KnowledgeDocumentModel)
                    .join(KnowledgeDocumentModel, KnowledgeDocumentModel.id == KnowledgeSegmentModel.document_id)
                    .where(KnowledgeSegmentModel.knowledge_base_id == knowledge_base_id)
                    .where(KnowledgeSegmentModel.status == "available")
                ).all()
                vector_response = self._search_with_vector_store(
                    session=session,
                    knowledge_base=knowledge_base,
                    query=query,
                    top_k=top_k,
                    similarity_threshold=similarity_threshold,
                    return_citations=return_citations,
                )
                if vector_response is not None:
                    self._increment_hits(session, vector_response.matches)
                    session.commit()
                    return vector_response
                scored = [
                    (segment, document, self._score_segment(query, segment.content))
                    for segment, document in rows
                ]
                matches = self._build_search_response(
                    query,
                    scored,
                    top_k=top_k if top_k is not None else knowledge_base.top_k,
                    similarity_threshold=similarity_threshold if similarity_threshold is not None else knowledge_base.similarity_threshold,
                    return_citations=return_citations if return_citations is not None else knowledge_base.return_citations,
                )
                self._increment_hits(session, matches.matches)
                session.commit()
                return matches

        if knowledge_base_id not in self._knowledge_bases:
            return None
        knowledge_base = self._knowledge_bases[knowledge_base_id]
        document_map = {document.id: document for document in self._documents.get(knowledge_base_id, [])}
        scored_memory = []
        for segment in self._segments.get(knowledge_base_id, []):
            document = document_map.get(str(segment["document_id"]))
            if document is None:
                continue
            scored_memory.append((segment, document, self._score_segment(query, str(segment["content"]))))
        return self._build_search_response(
            query,
            scored_memory,
            top_k=top_k if top_k is not None else knowledge_base.top_k,
            similarity_threshold=similarity_threshold if similarity_threshold is not None else knowledge_base.similarity_threshold,
            return_citations=return_citations if return_citations is not None else knowledge_base.return_citations,
        )

    def answer(self, query: str, knowledge_base_id: str) -> KnowledgeAnswerResponse | None:
        search_result = self.search(query, knowledge_base_id=knowledge_base_id)
        if search_result is None:
            return None
        if self._model_provider_repository is None:
            raise ValueError("No default LLM model provider configured")
        provider = self._model_provider_repository.get(model_purpose="llm")
        if provider is None:
            raise ValueError("No default LLM model provider configured")

        prompt = self._build_answer_prompt(query, search_result)
        result = self._model_client.invoke(provider, prompt)
        return KnowledgeAnswerResponse(
            query=query,
            answer=result.content,
            matches=search_result.matches,
            citations=search_result.citations,
            modelProviderId=provider.id,
            modelProviderName=provider.name,
        )

    def stream_answer(self, query: str, knowledge_base_id: str):
        run_id = f"rag_{uuid4().hex[:8]}"
        started_at = perf_counter()
        yield self._json_event("retrieval_started", runId=run_id, query=query)
        search_result = self.search(query, knowledge_base_id=knowledge_base_id)
        if search_result is None:
            yield self._json_event("error", runId=run_id, message="Knowledge base not found")
            return
        retrieval_latency_ms = int((perf_counter() - started_at) * 1000)
        yield self._json_event(
            "retrieval_completed",
            runId=run_id,
            matchCount=len(search_result.matches),
            citations=[citation.model_dump(by_alias=True) for citation in search_result.citations],
        )

        if self._model_provider_repository is None:
            yield self._json_event("error", runId=run_id, message="No default LLM model provider configured")
            return
        provider = self._model_provider_repository.get(model_purpose="llm")
        if provider is None:
            yield self._json_event("error", runId=run_id, message="No default LLM model provider configured")
            return

        prompt = self._build_answer_prompt(query, search_result)
        llm_started_at = perf_counter()
        answer_chunks: list[str] = []
        for chunk in self._model_client.stream(provider, prompt):
            answer_chunks.append(chunk)
            yield self._json_event("answer_delta", runId=run_id, text=chunk)

        answer = "".join(answer_chunks)
        llm_latency_ms = int((perf_counter() - llm_started_at) * 1000)
        self._persist_rag_trace(
            run_id=run_id,
            knowledge_base_id=knowledge_base_id,
            query=query,
            answer=answer,
            match_count=len(search_result.matches),
            citation_count=len(search_result.citations),
            retrieval_latency_ms=retrieval_latency_ms,
            llm_latency_ms=llm_latency_ms,
            model_provider_name=provider.name,
        )
        yield self._json_event(
            "completed",
            runId=run_id,
            answer=answer,
            citations=[citation.model_dump(by_alias=True) for citation in search_result.citations],
        )

    def _persist_rag_trace(
        self,
        *,
        run_id: str,
        knowledge_base_id: str,
        query: str,
        answer: str,
        match_count: int,
        citation_count: int,
        retrieval_latency_ms: int,
        llm_latency_ms: int,
        model_provider_name: str,
    ) -> None:
        if self._traces is None:
            return
        self._traces.create_run(
            RunTraceCreate(
                id=run_id,
                agentId=knowledge_base_id,
                status="success",
                runCategory="rag",
                failureReason=None,
                costCny=0.0,
                finalOutput=answer[:2000],
                steps=[
                    TraceStepCreate(
                        id=f"{run_id}_retrieval",
                        type="retrieval",
                        title="知识库检索",
                        status="success",
                        latencyMs=retrieval_latency_ms,
                        inputSummary=query,
                        outputSummary=f"命中 {match_count} 个片段，引用 {citation_count} 个来源",
                    ),
                    TraceStepCreate(
                        id=f"{run_id}_llm",
                        type="llm",
                        title="RAG 回答生成",
                        status="success",
                        latencyMs=llm_latency_ms,
                        inputSummary=f"模型：{model_provider_name}",
                        outputSummary=answer[:1000],
                    ),
                ],
            )
        )

    def _json_event(self, event_type: str, **payload: object) -> str:
        return json.dumps({"type": event_type, **payload}, ensure_ascii=False) + "\n"

    def _build_answer_prompt(self, query: str, search_result: KnowledgeSearchResponse) -> str:
        if not search_result.matches:
            context = "未检索到可用知识库分段。"
        else:
            context_lines = []
            for index, match in enumerate(search_result.matches, start=1):
                source = match.document_name or match.document_id
                position = match.position or index
                content = match.content or match.text or ""
                context_lines.append(f"[{index}] 来源：{source} #{position}\n{content}")
            context = "\n\n".join(context_lines)

        return (
            "你是企业知识库问答助手。请仅基于给定知识库片段回答用户问题；"
            "如果片段不足以回答，请明确说明无法从当前知识库确认。"
            "回答末尾保留引用编号，例如 [1]。\n\n"
            f"用户问题：{query}\n\n"
            f"知识库片段：\n{context}"
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
            characterCount=document.character_count,
            hitCount=document.hit_count,
            errorMessage=document.error_message,
            createdAt=document.created_at.strftime("%Y-%m-%d %H:%M") if document.created_at else None,
        )

    def _job_to_read_model(self, job: KnowledgeProcessingJobModel) -> KnowledgeProcessingJobRead:
        return KnowledgeProcessingJobRead(
            id=job.id,
            knowledgeBaseId=job.knowledge_base_id,
            status=job.status,
            chunksCreated=job.chunks_created,
            errorMessage=job.error_message,
            createdAt=self._format_datetime(job.created_at),
            startedAt=self._format_datetime(job.started_at),
            finishedAt=self._format_datetime(job.finished_at),
        )

    def _segment_to_read_model(self, segment: KnowledgeSegmentModel) -> KnowledgeSegmentRead:
        return KnowledgeSegmentRead(
            id=segment.id,
            knowledgeBaseId=segment.knowledge_base_id,
            documentId=segment.document_id,
            position=segment.position,
            content=segment.content,
            characterCount=segment.character_count,
            tokenCount=segment.token_count,
            status=segment.status,
            indexNodeHash=segment.index_node_hash,
        )

    def _format_datetime(self, value) -> str | None:
        return value.strftime("%Y-%m-%d %H:%M") if value else None

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

    def _split_content(self, content: str, chunk_size: int, chunk_overlap: int) -> list[str]:
        normalized = content.strip()
        if not normalized:
            return []
        size = max(chunk_size, 1)
        overlap = min(max(chunk_overlap, 0), size - 1)
        chunks: list[str] = []
        start = 0
        while start < len(normalized):
            chunk = normalized[start : start + size].strip()
            if chunk:
                chunks.append(chunk)
            if start + size >= len(normalized):
                break
            start += size - overlap
        return chunks

    def _document_source_content(self, name: str, content: str | None) -> str:
        if content:
            return content
        if "refund" in name.lower():
            return "退款政策要求先校验订单状态，并在高风险写操作前触发人工确认。"
        return name

    def _score_segment(self, query: str, content: str) -> float:
        terms = [term for term in re.split(r"\s+", query.lower().strip()) if term]
        if not terms:
            return 0.0
        lowered = content.lower()
        hits = sum(1 for term in terms if term in lowered)
        return round(hits / len(terms), 4)

    def _hash_segment(self, document_id: str, position: int, content: str) -> str:
        return hashlib.sha256(f"{document_id}:{position}:{content}".encode("utf-8")).hexdigest()

    def _build_search_response(
        self,
        query: str,
        scored: list[tuple[KnowledgeSegmentModel, KnowledgeDocumentModel, float]]
        | list[tuple[dict[str, str | int], KnowledgeDocumentRead, float]],
        top_k: int,
        similarity_threshold: float,
        return_citations: bool,
    ) -> KnowledgeSearchResponse:
        filtered = [item for item in scored if item[2] >= similarity_threshold and item[2] > 0]
        filtered.sort(key=lambda item: item[2], reverse=True)
        matches: list[KnowledgeSearchMatch] = []
        citations: list[KnowledgeCitationRead] = []
        for segment, document, score in filtered[:top_k]:
            if isinstance(segment, KnowledgeSegmentModel):
                segment_id = segment.id
                document_id = document.id
                document_name = document.name
                content = segment.content
                position = segment.position
            else:
                segment_id = str(segment["id"])
                document_id = str(segment["document_id"])
                document_name = str(segment["document_name"])
                content = str(segment["content"])
                position = int(segment["position"])
            matches.append(
                KnowledgeSearchMatch(
                    segmentId=segment_id,
                    documentId=document_id,
                    documentName=document_name,
                    content=content,
                    text=content,
                    position=position,
                    score=score,
                    metadata={"retriever": "local_keyword"},
                )
            )
            if return_citations:
                citations.append(
                    KnowledgeCitationRead(
                        segmentId=segment_id,
                        documentId=document_id,
                        documentName=document_name,
                        snippet=content[:240],
                        position=position,
                    )
                )
        return KnowledgeSearchResponse(query=query, matches=matches, citations=citations)

    def _search_with_vector_store(
        self,
        session: Session,
        knowledge_base: KnowledgeBaseModel,
        query: str,
        top_k: int | None = None,
        similarity_threshold: float | None = None,
        return_citations: bool | None = None,
    ) -> KnowledgeSearchResponse | None:
        effective_top_k = top_k if top_k is not None else knowledge_base.top_k
        effective_similarity_threshold = (
            similarity_threshold if similarity_threshold is not None else knowledge_base.similarity_threshold
        )
        effective_return_citations = return_citations if return_citations is not None else knowledge_base.return_citations
        query_embeddings = self._embedding_service.embed_documents(
            [query],
            provider_id=knowledge_base.embedding_model_provider_id,
        )
        if not query_embeddings or not query_embeddings[0]:
            return None
        vector_results = self._vector_store.search(
            knowledge_base.id,
            query_embedding=query_embeddings[0],
            top_k=effective_top_k,
            similarity_threshold=effective_similarity_threshold,
        )
        if not vector_results:
            return None
        segment_ids = [result.segment_id for result in vector_results]
        rows = session.execute(
            select(KnowledgeSegmentModel, KnowledgeDocumentModel)
            .join(KnowledgeDocumentModel, KnowledgeDocumentModel.id == KnowledgeSegmentModel.document_id)
            .where(KnowledgeSegmentModel.id.in_(segment_ids))
        ).all()
        row_by_segment_id = {segment.id: (segment, document) for segment, document in rows}
        scored = [
            (*row_by_segment_id[result.segment_id], result.score)
            for result in vector_results
            if result.segment_id in row_by_segment_id
        ]
        if not scored:
            return None
        response = self._build_search_response(
            query,
            scored,
            top_k=effective_top_k,
            similarity_threshold=effective_similarity_threshold,
            return_citations=effective_return_citations,
        )
        for match in response.matches:
            match.metadata = {"retriever": "vector"}
        return response

    def _increment_hits(self, session: Session, matches: list[KnowledgeSearchMatch]) -> None:
        for match in matches:
            if match.segment_id:
                segment = session.get(KnowledgeSegmentModel, match.segment_id)
                if segment:
                    segment.hit_count += 1
            document = session.get(KnowledgeDocumentModel, match.document_id)
            if document:
                document.hit_count += 1
