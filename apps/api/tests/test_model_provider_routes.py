import sys
from types import ModuleType

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
    assert body["modelPurpose"] == "llm"
    assert body["model"] == "qwen-plus"
    assert body["apiKeyPreview"] == "sk-...test"
    assert body["status"] == "offline"
    assert body["isDefault"] is True
    assert "apiKey" not in body

    listed = client.get("/api/model-providers")

    assert listed.status_code == 200
    assert any(item["id"] == body["id"] for item in listed.json())


def test_list_model_providers_returns_newest_first():
    client = TestClient(app)

    first = client.post(
        "/api/model-providers",
        json={
            "name": "早创建模型",
            "providerType": "openai-compatible",
            "baseUrl": "mock://local",
            "model": "first-model",
            "apiKey": "sk-first",
        },
    ).json()
    second = client.post(
        "/api/model-providers",
        json={
            "name": "后创建模型",
            "providerType": "openai-compatible",
            "baseUrl": "mock://local",
            "model": "second-model",
            "apiKey": "sk-second",
        },
    ).json()

    listed = client.get("/api/model-providers").json()
    ids = [item["id"] for item in listed]

    assert ids.index(second["id"]) < ids.index(first["id"])


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
            "modelPurpose": "embedding",
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
    assert body["modelPurpose"] == "embedding"
    assert body["model"] == "MiniMax-M2.7"
    assert body["apiKeyPreview"] == "sk-...inal"
    assert body["isDefault"] is True


def test_default_model_provider_is_unique_per_purpose_on_create():
    client = TestClient(app)

    llm = client.post(
        "/api/model-providers",
        json={
            "name": "默认推理",
            "providerType": "openai-compatible",
            "modelPurpose": "llm",
            "baseUrl": "mock://local",
            "model": "llm-default",
            "apiKey": "sk-llm",
            "isDefault": True,
        },
    ).json()
    embedding = client.post(
        "/api/model-providers",
        json={
            "name": "默认嵌入",
            "providerType": "openai-compatible",
            "modelPurpose": "embedding",
            "baseUrl": "mock://local",
            "model": "embedding-default",
            "apiKey": "sk-embedding",
            "isDefault": True,
        },
    ).json()

    listed = client.get("/api/model-providers").json()

    assert next(item for item in listed if item["id"] == llm["id"])["isDefault"] is True
    assert next(item for item in listed if item["id"] == embedding["id"])["isDefault"] is True


def test_default_model_provider_is_replaced_only_within_same_purpose_on_update():
    client = TestClient(app)
    llm = client.post(
        "/api/model-providers",
        json={
            "name": "默认推理",
            "providerType": "openai-compatible",
            "modelPurpose": "llm",
            "baseUrl": "mock://local",
            "model": "llm-default",
            "apiKey": "sk-llm",
            "isDefault": True,
        },
    ).json()
    embedding_old = client.post(
        "/api/model-providers",
        json={
            "name": "旧默认嵌入",
            "providerType": "openai-compatible",
            "modelPurpose": "embedding",
            "baseUrl": "mock://local",
            "model": "embedding-old",
            "apiKey": "sk-old",
            "isDefault": True,
        },
    ).json()
    embedding_new = client.post(
        "/api/model-providers",
        json={
            "name": "新嵌入",
            "providerType": "openai-compatible",
            "modelPurpose": "embedding",
            "baseUrl": "mock://local",
            "model": "embedding-new",
            "apiKey": "sk-new",
            "isDefault": False,
        },
    ).json()

    response = client.put(
        f"/api/model-providers/{embedding_new['id']}",
        json={
            "name": "新默认嵌入",
            "providerType": "openai-compatible",
            "modelPurpose": "embedding",
            "baseUrl": "mock://local",
            "model": "embedding-new",
            "apiKey": "",
            "isDefault": True,
        },
    )

    assert response.status_code == 200
    listed = client.get("/api/model-providers").json()
    assert next(item for item in listed if item["id"] == llm["id"])["isDefault"] is True
    assert next(item for item in listed if item["id"] == embedding_old["id"])["isDefault"] is False
    assert next(item for item in listed if item["id"] == embedding_new["id"])["isDefault"] is True


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


def test_create_embedding_model_provider_and_run_embedding_test():
    client = TestClient(app)
    provider = client.post(
        "/api/model-providers",
        json={
            "name": "Local bge embedding",
            "providerType": "openai-compatible",
            "modelPurpose": "embedding",
            "baseUrl": "mock://local",
            "model": "bge-m3",
            "apiKey": "sk-embedding",
        },
    ).json()

    assert provider["modelPurpose"] == "embedding"

    response = client.post(f"/api/model-providers/{provider['id']}/test", json={"prompt": "Say hello"})

    assert response.status_code == 200
    assert response.json() == {"status": "success", "output": "嵌入模型连接正常，返回 3 维向量。"}
    listed = client.get("/api/model-providers").json()
    assert next(item for item in listed if item["id"] == provider["id"])["status"] == "online"


def test_embedding_model_provider_test_calls_embedding_endpoint(monkeypatch):
    client = TestClient(app)
    requests = []

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

        def read(self):
            return b'{"data":[{"embedding":[0.1,0.2,0.3]}]}'

    def fake_urlopen(request, timeout):
        requests.append((request, timeout))
        return FakeResponse()

    monkeypatch.setattr("app.modules.model_provider.service.urlopen", fake_urlopen)

    provider = client.post(
        "/api/model-providers",
        json={
            "name": "text2vec-large-chinese",
            "providerType": "openai-compatible",
            "modelPurpose": "embedding",
            "baseUrl": "http://127.0.0.1:8000/v1",
            "model": "text2vec-large-chinese",
            "apiKey": "sk-local",
        },
    ).json()

    response = client.post(f"/api/model-providers/{provider['id']}/test", json={"prompt": "连接测试"})

    assert response.status_code == 200
    assert response.json() == {"status": "success", "output": "嵌入模型连接正常，返回 3 维向量。"}
    assert len(requests) == 1
    request, timeout = requests[0]
    assert request.full_url == "http://127.0.0.1:8000/v1/embeddings"
    assert timeout == 60
    assert request.headers["Authorization"] == "Bearer sk-local"
    request_body = request.data.decode("utf-8")
    assert '"model": "text2vec-large-chinese"' in request_body
    assert '"input": "连接测试"' in request_body

    listed = client.get("/api/model-providers").json()
    assert next(item for item in listed if item["id"] == provider["id"])["status"] == "online"


def test_openai_compatible_chat_test_appends_v1_when_base_url_omits_it(monkeypatch):
    client = TestClient(app)
    calls = []
    fake_module = ModuleType("langchain_openai")

    class FakeChatOpenAI:
        def __init__(self, model, api_key, base_url):
            calls.append({"model": model, "api_key": api_key, "base_url": base_url})

        def invoke(self, prompt):
            return type("FakeResponse", (), {"content": f"ok: {prompt}", "additional_kwargs": {}})()

    fake_module.ChatOpenAI = FakeChatOpenAI
    monkeypatch.setitem(sys.modules, "langchain_openai", fake_module)

    provider = client.post(
        "/api/model-providers",
        json={
            "name": "Luban",
            "providerType": "openai-compatible",
            "modelPurpose": "llm",
            "baseUrl": "http://192.168.7.210:8000",
            "model": "Luban-3.5-35B-A3B",
            "apiKey": "sk-local",
        },
    ).json()

    response = client.post(f"/api/model-providers/{provider['id']}/test", json={"prompt": "连接测试"})

    assert response.status_code == 200
    assert response.json()["status"] == "success"
    assert calls[0]["base_url"] == "http://192.168.7.210:8000/v1"
    listed = client.get("/api/model-providers").json()
    assert next(item for item in listed if item["id"] == provider["id"])["status"] == "online"
