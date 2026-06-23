from fastapi.testclient import TestClient

from app.main import app


def test_agent_run_uses_configured_model_provider_and_knowledge_bases():
    client = TestClient(app)
    provider = client.post(
        "/api/model-providers",
        json={
            "name": "Canvas configured model",
            "providerType": "openai-compatible",
            "baseUrl": "mock://local",
            "model": "canvas-model",
            "apiKey": "sk-local",
            "isDefault": True,
        },
    ).json()
    agent = client.post(
        "/api/agents",
        json={"name": "After-sale helper", "scenario": "Answer after-sale policy questions"},
    ).json()

    response = client.post(
        f"/api/agents/{agent['id']}/runs",
        json={
            "userInput": "Order ORD-2048 asks whether refund is allowed",
            "modelProviderId": provider["id"],
            "knowledgeBaseIds": ["kb-after-sale", "kb-warranty"],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["agentId"] == agent["id"]
    assert body["status"] == "success"
    assert body["runCategory"] == "test"
    assert body["failureReason"] is None
    assert body["finalOutput"]
    assert "canvas-model" in body["finalOutput"]
    assert body["steps"][1]["title"] == "Knowledge retrieval"
    assert "kb-after-sale" in body["steps"][1]["outputSummary"]
    assert body["steps"][2]["title"] == "LangChain model call"
    assert provider["id"] in body["steps"][2]["inputSummary"]
