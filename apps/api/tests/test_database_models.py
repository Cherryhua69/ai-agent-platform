from app.core.database import Base
from app.modules.agent.models import AgentModel
from app.modules.audit.models import AuditLogModel
from app.modules.knowledge.models import KnowledgeBaseModel, KnowledgeDocumentModel


def test_database_metadata_contains_core_tables():
    assert AgentModel.__tablename__ in Base.metadata.tables
    assert AuditLogModel.__tablename__ in Base.metadata.tables
    assert KnowledgeBaseModel.__tablename__ in Base.metadata.tables
    assert KnowledgeDocumentModel.__tablename__ in Base.metadata.tables
    assert "agents" in Base.metadata.tables
    assert "audit_logs" in Base.metadata.tables
    assert "knowledge_bases" in Base.metadata.tables
    assert "knowledge_documents" in Base.metadata.tables
