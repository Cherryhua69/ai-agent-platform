from fastapi.testclient import TestClient

from app.main import app


def test_agent_run_creates_queryable_trace_with_final_output():
    client = TestClient(app)
    provider = client.post(
        "/api/model-providers",
        json={
            "name": "Route smoke model",
            "providerType": "openai-compatible",
            "baseUrl": "mock://local",
            "model": "route-smoke",
            "apiKey": "sk-local",
            "isDefault": True,
        },
    ).json()

    created = client.post(
        "/api/agents/agent-after-sale/runs",
        json={
            "userInput": "Order ORD-2048 asks whether refund is allowed",
            "modelProviderId": provider["id"],
            "knowledgeBaseIds": ["kb-after-sale"],
        },
    )

    assert created.status_code == 201
    body = created.json()
    assert body["id"].startswith("run_")
    assert body["agentId"] == "agent-after-sale"
    assert body["status"] == "success"
    assert "route-smoke" in body["finalOutput"]
    assert body["steps"][0]["title"] == "User input"
    assert body["steps"][-1]["title"] == "LangChain model call"

    trace = client.get(f"/api/runs/{body['id']}/trace")

    assert trace.status_code == 200
    assert trace.json()["id"] == body["id"]
    assert trace.json()["finalOutput"] == body["finalOutput"]
