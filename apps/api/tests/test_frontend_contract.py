from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.main import app
from app.modules.trace.models import RunModel, TraceStepModel
from app.modules.trace.repository import TraceRepository
from app.modules.trace.schemas import RunTraceCreate


def trace_repository_with_empty_database() -> TraceRepository:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine, tables=[RunModel.__table__, TraceStepModel.__table__])
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    return TraceRepository(session_factory=session_factory)


def test_frontend_agent_contract_contains_ui_fields():
    client = TestClient(app)

    created = client.post("/api/agents", json={"name": "售后政策助手", "scenario": "售后问答"})
    assert created.status_code == 201

    body = created.json()
    assert body["owner"] == "陈晓"
    assert body["modelPolicy"] == "gpt-4.1 + fallback"
    assert body["workflowId"].startswith("flow_")
    assert body["knowledgeBaseIds"] == []
    assert body["toolIds"] == ["tool-ticket", "tool-order"]


def test_frontend_trace_contract_uses_camel_case_fields():
    client = TestClient(app)

    response = client.get("/api/runs/run_8f23/trace")

    assert response.status_code == 200
    body = response.json()
    assert body["agentId"] == "agent-after-sale"
    assert body["runCategory"] == "test"
    assert body["failureReason"] == "create_ticket degraded"
    assert body["costCny"] == 0.09
    assert body["steps"][0]["latencyMs"] == 18
    assert "latency_ms" not in body["steps"][0]


def test_frontend_recent_runs_contract_contains_dashboard_fields(monkeypatch):
    client = TestClient(app)
    repo = trace_repository_with_empty_database()
    repo.create_run(
        RunTraceCreate(
            id="run_contract_recent_001",
            agentId="agent-after-sale",
            status="success",
            runCategory="test",
            failureReason=None,
            costCny=0.01,
            steps=[],
        )
    )
    monkeypatch.setattr("app.modules.trace.router.repo", repo)

    response = client.get("/api/runs/recent")

    assert response.status_code == 200
    body = response.json()
    assert body
    assert set(body[0]) == {"id", "agentId", "agentName", "runTime", "failureReason", "runCategory", "status"}
    assert {item["runCategory"] for item in body} <= {"test", "production"}
    assert {item["status"] for item in body} <= {"success", "failed"}


def test_frontend_recent_runs_contract_allows_empty_database(monkeypatch):
    client = TestClient(app)
    monkeypatch.setattr("app.modules.trace.router.repo", trace_repository_with_empty_database())

    response = client.get("/api/runs/recent")

    assert response.status_code == 200
    assert response.json() == []


def test_frontend_can_call_api_with_localhost_origin():
    client = TestClient(app)

    response = client.options(
        "/api/agents",
        headers={
            "Origin": "http://127.0.0.1:5176",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5176"
