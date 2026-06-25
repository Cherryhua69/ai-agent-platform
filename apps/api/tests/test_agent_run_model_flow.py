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
    knowledge_base_ids = [
        client.post("/api/knowledge-bases", json={"name": "After-sale policy", "source": "upload"}).json()["id"],
        client.post("/api/knowledge-bases", json={"name": "Warranty policy", "source": "upload"}).json()["id"],
    ]

    response = client.post(
        f"/api/agents/{agent['id']}/runs",
        json={
            "userInput": "Order ORD-2048 asks whether refund is allowed",
            "modelProviderId": provider["id"],
            "knowledgeBaseIds": knowledge_base_ids,
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
    assert knowledge_base_ids[0] in body["steps"][1]["outputSummary"]
    assert body["steps"][2]["title"] == "LangChain model call"
    assert provider["id"] in body["steps"][2]["inputSummary"]


def test_agent_run_without_explicit_provider_uses_default_llm_provider():
    client = TestClient(app)
    client.post(
        "/api/model-providers",
        json={
            "name": "Default embedding model",
            "providerType": "openai-compatible",
            "modelPurpose": "embedding",
            "baseUrl": "mock://local",
            "model": "embedding-default-should-not-run",
            "apiKey": "sk-embedding",
            "isDefault": True,
        },
    )
    llm_provider = client.post(
        "/api/model-providers",
        json={
            "name": "Default reasoning model",
            "providerType": "openai-compatible",
            "modelPurpose": "llm",
            "baseUrl": "mock://local",
            "model": "llm-default-should-run",
            "apiKey": "sk-llm",
            "isDefault": True,
        },
    ).json()
    agent = client.post(
        "/api/agents",
        json={"name": "Default model helper", "scenario": "Use the default reasoning model"},
    ).json()

    response = client.post(
        f"/api/agents/{agent['id']}/runs",
        json={"userInput": "Use the default provider"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "success"
    assert "llm-default-should-run" in body["finalOutput"]
    assert "embedding-default-should-not-run" not in body["finalOutput"]
    assert llm_provider["id"] in body["steps"][2]["inputSummary"]
