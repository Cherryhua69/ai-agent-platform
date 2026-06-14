from fastapi.testclient import TestClient

from app.main import app


def test_create_and_list_model_provider():
    client = TestClient(app)

    created = client.post(
        "/api/model-providers",
        json={
            "name": "Qwen production",
            "providerType": "openai-compatible",
            "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "model": "qwen-plus",
            "apiKey": "sk-test",
            "isDefault": True,
        },
    )

    assert created.status_code == 201
    body = created.json()
    assert body["id"].startswith("model_provider_")
    assert body["name"] == "Qwen production"
    assert body["providerType"] == "openai-compatible"
    assert body["model"] == "qwen-plus"
    assert body["apiKeyPreview"] == "sk-...test"
    assert body["status"] == "online"
    assert body["isDefault"] is True
    assert "apiKey" not in body

    listed = client.get("/api/model-providers")

    assert listed.status_code == 200
    assert any(item["id"] == body["id"] for item in listed.json())


def test_test_model_provider_with_mock_base_url():
    client = TestClient(app)
    provider = client.post(
        "/api/model-providers",
        json={
            "name": "Local smoke model",
            "providerType": "openai-compatible",
            "baseUrl": "mock://local",
            "model": "local-smoke",
            "apiKey": "sk-local",
        },
    ).json()

    response = client.post(f"/api/model-providers/{provider['id']}/test", json={"prompt": "Say hello"})

    assert response.status_code == 200
    assert response.json()["status"] == "success"
    assert "local-smoke" in response.json()["output"]
