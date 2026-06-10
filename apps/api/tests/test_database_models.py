from app.core.database import Base
from app.modules.agent.models import AgentModel
from app.modules.audit.models import AuditLogModel


def test_database_metadata_contains_agent_and_audit_tables():
    assert AgentModel.__tablename__ in Base.metadata.tables
    assert AuditLogModel.__tablename__ in Base.metadata.tables
    assert "agents" in Base.metadata.tables
    assert "audit_logs" in Base.metadata.tables
