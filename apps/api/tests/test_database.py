from sqlalchemy import create_engine, inspect, text

from app.core import database
from app.modules.trace import models as trace_models  # noqa: F401


def test_init_database_adds_run_output_and_summary_columns_to_existing_runs_table(monkeypatch):
    engine = create_engine("sqlite+pysqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE runs (
                    id VARCHAR(64) PRIMARY KEY,
                    agent_id VARCHAR(64) NOT NULL,
                    status VARCHAR(32) NOT NULL,
                    cost_cny FLOAT NOT NULL,
                    created_at DATETIME NOT NULL
                )
                """
            )
        )

    monkeypatch.setattr(database, "engine", engine)

    database.init_database()

    columns = {column["name"] for column in inspect(engine).get_columns("runs")}
    assert {"final_output", "run_category", "failure_reason"} <= columns
