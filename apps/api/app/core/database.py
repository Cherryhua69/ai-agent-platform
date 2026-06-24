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
