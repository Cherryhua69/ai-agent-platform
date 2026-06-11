from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.modules.knowledge.models import KnowledgeBaseModel, KnowledgeDocumentModel
from app.modules.knowledge.repository import KnowledgeRepository
from app.modules.knowledge.schemas import KnowledgeBaseCreate, KnowledgeDocumentCreate


def test_knowledge_repository_persists_base_and_documents_with_session_factory():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine, tables=[KnowledgeBaseModel.__table__, KnowledgeDocumentModel.__table__])
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    writer = KnowledgeRepository(session_factory=session_factory)
    created = writer.create_knowledge_base(
        KnowledgeBaseCreate(name="保修政策库", source="PDF", retrievalStrategy="Hybrid")
    )
    document = writer.add_document(
        created.id,
        KnowledgeDocumentCreate(name="warranty.pdf", mimeType="application/pdf", sizeKb=256),
    )
    job = writer.create_processing_job(created.id)

    reader = KnowledgeRepository(session_factory=session_factory)
    knowledge_bases = reader.list_knowledge_bases()
    persisted = next(item for item in knowledge_bases if item.id == created.id)

    assert persisted.name == "保修政策库"
    assert persisted.document_count == 1
    assert persisted.quality_score == 88
    assert persisted.status == "ready"
    assert document.id.startswith("doc_")
    assert job.knowledge_base_id == created.id
