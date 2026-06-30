from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.modules.knowledge.models import (
    KnowledgeBaseModel,
    KnowledgeDocumentModel,
    KnowledgeProcessingJobModel,
    KnowledgeSegmentModel,
)
from app.modules.knowledge.embedding_service import ModelProviderEmbeddingService
from app.modules.knowledge.repository import KnowledgeRepository
from app.modules.knowledge.schemas import KnowledgeBaseCreate, KnowledgeDocumentCreate
from app.modules.knowledge.vector_store import InMemoryVectorStore, QdrantVectorStore
from app.modules.knowledge import vector_store_factory
from app.modules.model_provider.models import ModelProviderModel
from app.modules.model_provider.repository import ModelProviderRepository
from app.modules.model_provider.schemas import ModelProviderCreate


class RecordingEmbeddingService:
    def __init__(self) -> None:
        self.provider_ids: list[str | None] = []
        self.text_batches: list[list[str]] = []

    def embed_documents(self, texts: list[str], provider_id: str | None = None) -> list[list[float]]:
        self.provider_ids.append(provider_id)
        self.text_batches.append(texts)
        return [[float(len(text)), 1.0] for text in texts]


class KeywordEmbeddingService:
    def embed_documents(self, texts: list[str], provider_id: str | None = None) -> list[list[float]]:
        del provider_id
        embeddings: list[list[float]] = []
        for text in texts:
            lowered = text.lower()
            embeddings.append([1.0, 0.0] if "alpha" in lowered else [0.0, 1.0])
        return embeddings


class FailingEmbeddingService:
    def embed_documents(self, texts: list[str], provider_id: str | None = None) -> list[list[float]]:
        del texts
        del provider_id
        raise RuntimeError("embedding backend unavailable")


class FailingDocumentParser:
    def parse(self, *, name: str, mime_type: str, content: str | None) -> str:
        del name
        del mime_type
        del content
        raise ValueError("unsupported document type: application/octet-stream")


class RecordingVectorStore:
    def __init__(self) -> None:
        self.upserts: list[tuple[list[object], list[list[float]]]] = []
        self.deleted: list[str] = []
        self.deleted_documents: list[tuple[str, str]] = []

    def upsert_segments(self, segments: list[object], embeddings: list[list[float]] | None = None) -> None:
        self.upserts.append((segments, embeddings or []))

    def delete_knowledge_base(self, knowledge_base_id: str) -> None:
        self.deleted.append(knowledge_base_id)

    def delete_document(self, knowledge_base_id: str, document_id: str) -> None:
        self.deleted_documents.append((knowledge_base_id, document_id))


KNOWLEDGE_TABLES = [
    KnowledgeBaseModel.__table__,
    KnowledgeDocumentModel.__table__,
    KnowledgeSegmentModel.__table__,
    KnowledgeProcessingJobModel.__table__,
]


def test_knowledge_repository_persists_base_and_documents_with_session_factory():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine, tables=KNOWLEDGE_TABLES)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)

    writer = KnowledgeRepository(session_factory=session_factory)
    created = writer.create_knowledge_base(
        KnowledgeBaseCreate(name="保修政策库", source="PDF", retrievalStrategy="Hybrid")
    )
    document = writer.add_document(
        created.id,
        KnowledgeDocumentCreate(
            name="warranty.txt",
            mimeType="text/plain",
            sizeKb=1,
            content="Warranty policy requires order verification before replacement.",
        ),
    )
    job = writer.create_processing_job(created.id)
    assert job is not None
    writer.run_processing_job(job.id)

    reader = KnowledgeRepository(session_factory=session_factory)
    knowledge_bases = reader.list_knowledge_bases()
    persisted = next(item for item in knowledge_bases if item.id == created.id)

    assert persisted.name == "保修政策库"
    assert persisted.document_count == 1
    assert persisted.quality_score == 88
    assert persisted.status == "ready"
    assert document.id.startswith("doc_")
    assert job.knowledge_base_id == created.id


def test_processing_job_embeds_segments_before_vector_store_upsert():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine, tables=KNOWLEDGE_TABLES)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    embedding_service = RecordingEmbeddingService()
    vector_store = RecordingVectorStore()
    repository = KnowledgeRepository(
        session_factory=session_factory,
        embedding_service=embedding_service,
        vector_store=vector_store,
    )
    created = repository.create_knowledge_base(
        KnowledgeBaseCreate(name="embedding boundary kb", source="upload", chunkSize=120, chunkOverlap=0)
    )
    repository.add_document(
        created.id,
        KnowledgeDocumentCreate(
            name="policy.txt",
            mimeType="text/plain",
            sizeKb=1,
            content="Refund policy requires status verification.",
        ),
    )

    queued_job = repository.create_processing_job(created.id)

    assert queued_job is not None
    assert queued_job.status == "queued"
    assert queued_job.chunks_created == 0
    assert embedding_service.text_batches == []
    assert vector_store.upserts == []

    job = repository.run_processing_job(queued_job.id)

    assert job is not None
    assert job.status == "succeeded"
    assert job.chunks_created == 1
    assert embedding_service.text_batches == [["Refund policy requires status verification."]]
    assert vector_store.upserts
    assert len(vector_store.upserts[0][0]) == 1
    assert vector_store.upserts[0][1] == [[float(len("Refund policy requires status verification.")), 1.0]]


def test_model_provider_embedding_service_uses_embedding_provider():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine, tables=[ModelProviderModel.__table__])
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    provider_repository = ModelProviderRepository(session_factory=session_factory)
    provider = provider_repository.create(
        ModelProviderCreate(
            name="Mock embedding",
            providerType="openai-compatible",
            modelPurpose="embedding",
            baseUrl="mock://local",
            model="mock-embedding",
            apiKey="sk-mock",
        )
    )
    service = ModelProviderEmbeddingService(provider_repository=provider_repository)

    embeddings = service.embed_documents(["first chunk", "second chunk"], provider_id=provider.id)

    assert embeddings == [[0.1, 0.2, 0.3], [0.1, 0.2, 0.3]]


def test_search_uses_vector_store_when_embeddings_are_available():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine, tables=KNOWLEDGE_TABLES)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    repository = KnowledgeRepository(
        session_factory=session_factory,
        embedding_service=KeywordEmbeddingService(),
        vector_store=InMemoryVectorStore(),
    )
    created = repository.create_knowledge_base(
        KnowledgeBaseCreate(
            name="vector search kb",
            source="upload",
            chunkSize=120,
            chunkOverlap=0,
            similarityThreshold=0,
        )
    )
    repository.add_document(
        created.id,
        KnowledgeDocumentCreate(name="alpha.txt", mimeType="text/plain", sizeKb=1, content="alpha vector content"),
    )
    repository.add_document(
        created.id,
        KnowledgeDocumentCreate(name="beta.txt", mimeType="text/plain", sizeKb=1, content="beta vector content"),
    )
    job = repository.create_processing_job(created.id)
    assert job is not None
    repository.run_processing_job(job.id)

    response = repository.search("alpha query", knowledge_base_id=created.id)

    assert response is not None
    assert response.matches[0].document_name == "alpha.txt"
    assert response.matches[0].metadata == {"retriever": "vector"}


def test_search_accepts_runtime_retrieval_overrides():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine, tables=KNOWLEDGE_TABLES)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    repository = KnowledgeRepository(session_factory=session_factory)
    created = repository.create_knowledge_base(
        KnowledgeBaseCreate(
            name="runtime overrides kb",
            source="upload",
            chunkSize=120,
            chunkOverlap=0,
            topK=10,
            similarityThreshold=0,
            returnCitations=True,
        )
    )
    repository.add_document(
        created.id,
        KnowledgeDocumentCreate(name="alpha-one.txt", mimeType="text/plain", sizeKb=1, content="alpha first policy"),
    )
    repository.add_document(
        created.id,
        KnowledgeDocumentCreate(name="alpha-two.txt", mimeType="text/plain", sizeKb=1, content="alpha second policy"),
    )
    job = repository.create_processing_job(created.id)
    assert job is not None
    repository.run_processing_job(job.id)

    response = repository.search(
        "alpha",
        knowledge_base_id=created.id,
        top_k=1,
        similarity_threshold=0,
        return_citations=False,
    )

    assert response is not None
    assert len(response.matches) == 1
    assert response.citations == []


def test_processing_job_parses_markdown_content_before_chunking():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine, tables=KNOWLEDGE_TABLES)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    embedding_service = RecordingEmbeddingService()
    repository = KnowledgeRepository(
        session_factory=session_factory,
        embedding_service=embedding_service,
        vector_store=InMemoryVectorStore(),
    )
    created = repository.create_knowledge_base(
        KnowledgeBaseCreate(name="markdown kb", source="upload", chunkSize=200, chunkOverlap=0)
    )
    repository.add_document(
        created.id,
        KnowledgeDocumentCreate(
            name="policy.md",
            mimeType="text/markdown",
            sizeKb=1,
            content="# Refund Policy\n\n- Verify order status before payment.",
        ),
    )

    queued_job = repository.create_processing_job(created.id)
    assert queued_job is not None
    job = repository.run_processing_job(queued_job.id)
    documents = repository.list_documents(created.id)

    assert job is not None
    assert job.status == "succeeded"
    assert embedding_service.text_batches == [["Refund Policy\n\nVerify order status before payment."]]
    assert documents is not None
    assert documents[0].character_count == len("Refund Policy\n\nVerify order status before payment.")


def test_processing_job_keeps_empty_document_empty_instead_of_using_file_name():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine, tables=KNOWLEDGE_TABLES)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    embedding_service = RecordingEmbeddingService()
    vector_store = RecordingVectorStore()
    repository = KnowledgeRepository(
        session_factory=session_factory,
        embedding_service=embedding_service,
        vector_store=vector_store,
    )
    created = repository.create_knowledge_base(
        KnowledgeBaseCreate(name="empty kb", source="upload", chunkSize=120, chunkOverlap=0)
    )
    repository.add_document(
        created.id,
        KnowledgeDocumentCreate(name="empty.txt", mimeType="text/plain", sizeKb=1, content=""),
    )

    queued_job = repository.create_processing_job(created.id)
    assert queued_job is not None
    job = repository.run_processing_job(queued_job.id)
    documents = repository.list_documents(created.id)

    assert job is not None
    assert job.status == "succeeded"
    assert job.chunks_created == 0
    assert embedding_service.text_batches == [[]]
    assert vector_store.upserts == []
    assert documents is not None
    assert documents[0].status == "empty"
    assert documents[0].character_count == 0


def test_processing_job_marks_document_failed_when_parsing_fails():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine, tables=KNOWLEDGE_TABLES)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    repository = KnowledgeRepository(
        session_factory=session_factory,
        document_parser=FailingDocumentParser(),
        vector_store=RecordingVectorStore(),
    )
    created = repository.create_knowledge_base(
        KnowledgeBaseCreate(name="unsupported kb", source="upload", chunkSize=120, chunkOverlap=0)
    )
    repository.add_document(
        created.id,
        KnowledgeDocumentCreate(
            name="archive.bin",
            mimeType="application/octet-stream",
            sizeKb=1,
            content="raw bytes placeholder",
        ),
    )

    queued_job = repository.create_processing_job(created.id)
    assert queued_job is not None
    job = repository.run_processing_job(queued_job.id)
    documents = repository.list_documents(created.id)
    knowledge_base = next(item for item in repository.list_knowledge_bases() if item.id == created.id)

    assert job is not None
    assert job.status == "failed"
    assert job.error_message == "unsupported document type: application/octet-stream"
    assert documents is not None
    assert documents[0].status == "failed"
    assert documents[0].error_message == "unsupported document type: application/octet-stream"
    assert knowledge_base.status == "stale"


class RecordingQdrantClient:
    def __init__(self) -> None:
        self.collections: list[str] = []
        self.upserts: list[tuple[str, list[object]]] = []
        self.searches: list[tuple[str, list[float], int, float | None]] = []
        self.deletes: list[tuple[str, object]] = []

    def collection_exists(self, collection_name: str) -> bool:
        return collection_name in self.collections

    def create_collection(self, collection_name: str, vectors_config: object) -> None:
        del vectors_config
        self.collections.append(collection_name)

    def upsert(self, collection_name: str, points: list[object]) -> None:
        self.upserts.append((collection_name, points))

    def search(
        self,
        collection_name: str,
        query_vector: list[float],
        query_filter: object,
        limit: int,
        score_threshold: float | None = None,
    ) -> list[object]:
        self.searches.append((collection_name, query_vector, limit, score_threshold))

        class SearchHit:
            id = "seg_qdrant"
            score = 0.92

        del query_filter
        return [SearchHit()]

    def delete(self, collection_name: str, points_selector: object) -> None:
        self.deletes.append((collection_name, points_selector))


def test_qdrant_vector_store_upserts_searches_and_deletes_by_knowledge_base():
    segment = KnowledgeSegmentModel(
        id="seg_qdrant",
        knowledge_base_id="kb_qdrant",
        document_id="doc_qdrant",
        position=1,
        content="qdrant content",
        character_count=14,
        token_count=2,
    )
    client = RecordingQdrantClient()
    vector_store = QdrantVectorStore(client=client, collection_name="knowledge_segments")

    vector_store.upsert_segments([segment], embeddings=[[0.1, 0.2, 0.3]])
    results = vector_store.search("kb_qdrant", [0.1, 0.2, 0.3], top_k=3, similarity_threshold=0.7)
    vector_store.delete_knowledge_base("kb_qdrant")

    assert client.collections == ["knowledge_segments"]
    assert client.upserts[0][0] == "knowledge_segments"
    assert client.searches == [("knowledge_segments", [0.1, 0.2, 0.3], 3, 0.7)]
    assert results[0].segment_id == "seg_qdrant"
    assert results[0].score == 0.92
    assert client.deletes[0][0] == "knowledge_segments"


def test_vector_store_factory_uses_provider_setting(monkeypatch):
    monkeypatch.setattr(vector_store_factory.settings, "vector_store_provider", "memory")
    memory_store = vector_store_factory.create_vector_store()

    assert isinstance(memory_store, InMemoryVectorStore)

    monkeypatch.setattr(vector_store_factory.settings, "vector_store_provider", "null")
    null_store = vector_store_factory.create_vector_store()

    assert null_store.__class__.__name__ == "NullVectorStore"


def test_vector_store_factory_creates_qdrant_store_from_settings(monkeypatch):
    captured: dict[str, str | None] = {}

    class FakeQdrantVectorStore:
        def __init__(self, url: str | None, collection_name: str) -> None:
            captured["url"] = url
            captured["collection_name"] = collection_name

    monkeypatch.setattr(vector_store_factory.settings, "vector_store_provider", "qdrant")
    monkeypatch.setattr(vector_store_factory.settings, "qdrant_url", "http://127.0.0.1:6333")
    monkeypatch.setattr(vector_store_factory.settings, "qdrant_collection", "kb_segments")
    monkeypatch.setattr(vector_store_factory, "QdrantVectorStore", FakeQdrantVectorStore)

    vector_store_factory.create_vector_store()

    assert captured == {"url": "http://127.0.0.1:6333", "collection_name": "kb_segments"}


def test_processing_job_marks_documents_failed_when_embedding_fails():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine, tables=KNOWLEDGE_TABLES)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    repository = KnowledgeRepository(
        session_factory=session_factory,
        embedding_service=FailingEmbeddingService(),
        vector_store=InMemoryVectorStore(),
    )
    created = repository.create_knowledge_base(
        KnowledgeBaseCreate(name="failed job kb", source="upload", chunkSize=120, chunkOverlap=0)
    )
    repository.add_document(
        created.id,
        KnowledgeDocumentCreate(
            name="policy.txt",
            mimeType="text/plain",
            sizeKb=1,
            content="Refund policy requires status verification.",
        ),
    )

    queued_job = repository.create_processing_job(created.id)
    assert queued_job is not None
    job = repository.run_processing_job(queued_job.id)
    documents = repository.list_documents(created.id)
    knowledge_base = next(item for item in repository.list_knowledge_bases() if item.id == created.id)

    assert job is not None
    assert job.status == "failed"
    assert job.chunks_created == 0
    assert job.error_message == "embedding backend unavailable"
    assert documents is not None
    assert documents[0].status == "failed"
    assert documents[0].error_message == "embedding backend unavailable"
    assert knowledge_base.status == "stale"


def test_run_pending_processing_jobs_recovers_queued_and_running_jobs():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine, tables=KNOWLEDGE_TABLES)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    embedding_service = RecordingEmbeddingService()
    vector_store = RecordingVectorStore()
    repository = KnowledgeRepository(
        session_factory=session_factory,
        embedding_service=embedding_service,
        vector_store=vector_store,
    )
    queued_kb = repository.create_knowledge_base(
        KnowledgeBaseCreate(name="queued recovery kb", source="upload", chunkSize=120, chunkOverlap=0)
    )
    running_kb = repository.create_knowledge_base(
        KnowledgeBaseCreate(name="running recovery kb", source="upload", chunkSize=120, chunkOverlap=0)
    )
    repository.add_document(
        queued_kb.id,
        KnowledgeDocumentCreate(name="queued.txt", mimeType="text/plain", sizeKb=1, content="queued recovery content"),
    )
    repository.add_document(
        running_kb.id,
        KnowledgeDocumentCreate(name="running.txt", mimeType="text/plain", sizeKb=1, content="running recovery content"),
    )
    queued_job = repository.create_processing_job(queued_kb.id)
    running_job = repository.create_processing_job(running_kb.id)
    assert queued_job is not None
    assert running_job is not None
    with session_factory() as session:
        stale_running_job = session.get(KnowledgeProcessingJobModel, running_job.id)
        assert stale_running_job is not None
        stale_running_job.status = "running"
        session.commit()

    recovered_jobs = repository.run_pending_processing_jobs()

    assert [job.status for job in recovered_jobs] == ["succeeded", "succeeded"]
    assert [batch[0] for batch in embedding_service.text_batches] == [
        "queued recovery content",
        "running recovery content",
    ]
    assert len(vector_store.upserts) == 2
