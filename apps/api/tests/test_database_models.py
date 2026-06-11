from app.core.database import Base
from app.modules.agent.models import AgentModel
from app.modules.audit.models import AuditLogModel
from app.modules.evaluation.models import EvaluationCaseModel, EvaluationDatasetModel, EvaluationRunModel
from app.modules.knowledge.models import KnowledgeBaseModel, KnowledgeDocumentModel
from app.modules.tool.models import McpServerModel, ToolModel
from app.modules.trace.models import RunModel, TraceStepModel


def test_database_metadata_contains_core_tables():
    assert AgentModel.__tablename__ in Base.metadata.tables
    assert AuditLogModel.__tablename__ in Base.metadata.tables
    assert KnowledgeBaseModel.__tablename__ in Base.metadata.tables
    assert KnowledgeDocumentModel.__tablename__ in Base.metadata.tables
    assert McpServerModel.__tablename__ in Base.metadata.tables
    assert ToolModel.__tablename__ in Base.metadata.tables
    assert EvaluationDatasetModel.__tablename__ in Base.metadata.tables
    assert EvaluationCaseModel.__tablename__ in Base.metadata.tables
    assert EvaluationRunModel.__tablename__ in Base.metadata.tables
    assert RunModel.__tablename__ in Base.metadata.tables
    assert TraceStepModel.__tablename__ in Base.metadata.tables
    assert "agents" in Base.metadata.tables
    assert "audit_logs" in Base.metadata.tables
    assert "knowledge_bases" in Base.metadata.tables
    assert "knowledge_documents" in Base.metadata.tables
    assert "mcp_servers" in Base.metadata.tables
    assert "tools" in Base.metadata.tables
    assert "evaluation_datasets" in Base.metadata.tables
    assert "evaluation_cases" in Base.metadata.tables
    assert "evaluation_runs" in Base.metadata.tables
    assert "runs" in Base.metadata.tables
    assert "trace_steps" in Base.metadata.tables
