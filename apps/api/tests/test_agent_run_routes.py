from fastapi.testclient import TestClient

from app.main import app


def test_agent_run_simulation_creates_queryable_trace():
    client = TestClient(app)

    created = client.post("/api/agents/agent-after-sale/runs")

    assert created.status_code == 201
    body = created.json()
    assert body["id"].startswith("run_")
    assert body["agentId"] == "agent-after-sale"
    assert body["status"] == "blocked"
    assert body["steps"][0]["title"] == "用户输入"
    assert body["steps"][-1]["errorMessage"] == "create_ticket degraded"

    trace = client.get(f"/api/runs/{body['id']}/trace")

    assert trace.status_code == 200
    assert trace.json()["id"] == body["id"]
    assert trace.json()["steps"][-1]["errorMessage"] == "create_ticket degraded"
