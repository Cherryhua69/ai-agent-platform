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
    assert body["status"] == "guarded"
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

    listed = client.get("/api/model-providers").json()
    assert next(item for item in listed if item["id"] == provider["id"])["status"] == "online"


def test_update_model_provider_keeps_api_key_when_blank():
    client = TestClient(app)
    provider = client.post(
        "/api/model-providers",
        json={
            "name": "Qwen production",
            "providerType": "openai-compatible",
            "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "model": "qwen-plus",
            "apiKey": "sk-original",
            "isDefault": False,
        },
    ).json()

    updated = client.put(
        f"/api/model-providers/{provider['id']}",
        json={
            "name": "Qwen staging",
            "providerType": "anthropic-compatible",
            "baseUrl": "https://api.minimaxi.com/anthropic",
            "model": "MiniMax-M2.7",
            "apiKey": "",
            "isDefault": True,
        },
    )

    assert updated.status_code == 200
    body = updated.json()
    assert body["name"] == "Qwen staging"
    assert body["providerType"] == "anthropic-compatible"
    assert body["model"] == "MiniMax-M2.7"
    assert body["apiKeyPreview"] == "sk-...inal"
    assert body["isDefault"] is True


def test_model_provider_test_failure_marks_provider_offline():
    client = TestClient(app)
    provider = client.post(
        "/api/model-providers",
        json={
            "name": "Broken model",
            "providerType": "openai-compatible",
            "baseUrl": "http://127.0.0.1:9/v1",
            "model": "missing-model",
            "apiKey": "sk-broken",
        },
    ).json()

    response = client.post(f"/api/model-providers/{provider['id']}/test", json={"prompt": "hello"})

    assert response.status_code == 200
    assert response.json()["status"] == "failed"
    listed = client.get("/api/model-providers").json()
    assert next(item for item in listed if item["id"] == provider["id"])["status"] == "offline"
