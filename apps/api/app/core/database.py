from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings


class Base(DeclarativeBase):
    pass


connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
pool_options = {"poolclass": StaticPool} if settings.database_url == "sqlite+pysqlite:///:memory:" else {}
engine = create_engine(settings.database_url, connect_args=connect_args, **pool_options)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def init_database() -> None:
    Base.metadata.create_all(bind=engine)
    _ensure_run_summary_columns()
    _ensure_model_provider_columns()
    _ensure_knowledge_base_columns()
    _ensure_knowledge_document_columns()
    _ensure_knowledge_segment_table()
    _ensure_knowledge_processing_job_table()


def _ensure_run_summary_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("runs"):
        return

    columns = {column["name"] for column in inspector.get_columns("runs")}
    statements: list[str] = []
    if "final_output" not in columns:
        statements.append("ALTER TABLE runs ADD COLUMN final_output TEXT NULL")
    if "run_category" not in columns:
        statements.append("ALTER TABLE runs ADD COLUMN run_category VARCHAR(32) NOT NULL DEFAULT 'test'")
    if "failure_reason" not in columns:
        statements.append("ALTER TABLE runs ADD COLUMN failure_reason TEXT NULL")

    if not statements:
        return

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def _ensure_model_provider_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("model_providers"):
        return

    columns = {column["name"] for column in inspector.get_columns("model_providers")}
    if "model_purpose" in columns:
        return

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE model_providers ADD COLUMN model_purpose VARCHAR(32) NOT NULL DEFAULT 'llm'"))


def _ensure_knowledge_base_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("knowledge_bases"):
        return

    columns = {column["name"] for column in inspector.get_columns("knowledge_bases")}
    statements: list[str] = []
    if "description" not in columns:
        statements.append("ALTER TABLE knowledge_bases ADD COLUMN description TEXT NULL")
    if "embedding_model_provider_id" not in columns:
        statements.append("ALTER TABLE knowledge_bases ADD COLUMN embedding_model_provider_id VARCHAR(64) NULL")
    if "chunk_strategy" not in columns:
        statements.append("ALTER TABLE knowledge_bases ADD COLUMN chunk_strategy VARCHAR(32) NOT NULL DEFAULT 'fixed'")
    if "chunk_size" not in columns:
        statements.append("ALTER TABLE knowledge_bases ADD COLUMN chunk_size INTEGER NOT NULL DEFAULT 500")
    if "chunk_overlap" not in columns:
        statements.append("ALTER TABLE knowledge_bases ADD COLUMN chunk_overlap INTEGER NOT NULL DEFAULT 50")
    if "retrieval_mode" not in columns:
        statements.append("ALTER TABLE knowledge_bases ADD COLUMN retrieval_mode VARCHAR(32) NOT NULL DEFAULT 'vector'")
    if "top_k" not in columns:
        statements.append("ALTER TABLE knowledge_bases ADD COLUMN top_k INTEGER NOT NULL DEFAULT 5")
    if "similarity_threshold" not in columns:
        statements.append("ALTER TABLE knowledge_bases ADD COLUMN similarity_threshold FLOAT NOT NULL DEFAULT 0.7")
    if "return_citations" not in columns:
        statements.append("ALTER TABLE knowledge_bases ADD COLUMN return_citations BOOLEAN NOT NULL DEFAULT 1")
    if "updated_at" not in columns:
        statements.append("ALTER TABLE knowledge_bases ADD COLUMN updated_at DATETIME NULL")

    if not statements:
        return

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
        if "updated_at" not in columns:
            connection.execute(text("UPDATE knowledge_bases SET updated_at = created_at WHERE updated_at IS NULL"))


def _ensure_knowledge_document_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("knowledge_documents"):
        return

    columns = {column["name"] for column in inspector.get_columns("knowledge_documents")}
    statements: list[str] = []
    if "content" not in columns:
        statements.append("ALTER TABLE knowledge_documents ADD COLUMN content TEXT NULL")
    if "character_count" not in columns:
        statements.append("ALTER TABLE knowledge_documents ADD COLUMN character_count INTEGER NOT NULL DEFAULT 0")
    if "hit_count" not in columns:
        statements.append("ALTER TABLE knowledge_documents ADD COLUMN hit_count INTEGER NOT NULL DEFAULT 0")
    if "error_message" not in columns:
        statements.append("ALTER TABLE knowledge_documents ADD COLUMN error_message TEXT NULL")
    if "updated_at" not in columns:
        statements.append("ALTER TABLE knowledge_documents ADD COLUMN updated_at DATETIME NULL")

    if not statements:
        return

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
        if "updated_at" not in columns:
            connection.execute(text("UPDATE knowledge_documents SET updated_at = created_at WHERE updated_at IS NULL"))


def _ensure_knowledge_segment_table() -> None:
    inspector = inspect(engine)
    if inspector.has_table("knowledge_segments"):
        return

    Base.metadata.tables["knowledge_segments"].create(bind=engine, checkfirst=True)


def _ensure_knowledge_processing_job_table() -> None:
    inspector = inspect(engine)
    if inspector.has_table("knowledge_processing_jobs"):
        return

    Base.metadata.tables["knowledge_processing_jobs"].create(bind=engine, checkfirst=True)
