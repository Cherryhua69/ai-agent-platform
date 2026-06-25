from fastapi.testclient import TestClient

from app.main import app


def test_knowledge_base_p0_flow():
    client = TestClient(app)

    created = client.post(
        "/api/knowledge-bases",
        json={"name": "售后政策库", "source": "upload", "retrievalStrategy": "Hybrid + Rerank"},
    )
    assert created.status_code == 201
    knowledge_base = created.json()
    assert knowledge_base["id"].startswith("kb_")
    assert knowledge_base["status"] == "draft"

    document = client.post(
        f"/api/knowledge-bases/{knowledge_base['id']}/documents",
        json={"name": "refund-policy.pdf", "mimeType": "application/pdf", "sizeKb": 512},
    )
    assert document.status_code == 201
    assert document.json()["status"] == "uploaded"

    job = client.post(f"/api/knowledge-bases/{knowledge_base['id']}/processing-jobs")
    assert job.status_code == 201
    assert job.json()["status"] == "completed"

    search = client.post(f"/api/knowledge-bases/{knowledge_base['id']}/search", json={"query": "退款政策"})
    assert search.status_code == 200
    assert search.json()["matches"][0]["score"] >= 0.8


def test_create_knowledge_base_can_bind_embedding_model_provider():
    client = TestClient(app)
    provider = client.post(
        "/api/model-providers",
        json={
            "name": "BGE 嵌入模型",
            "providerType": "openai-compatible",
            "modelPurpose": "embedding",
            "baseUrl": "mock://local",
            "model": "bge-m3",
            "apiKey": "sk-embedding",
        },
    ).json()

    response = client.post(
        "/api/knowledge-bases",
        json={
            "name": "产品手册库",
            "description": "面向客服问答的产品资料",
            "source": "upload",
            "embeddingModelProviderId": provider["id"],
            "chunkStrategy": "markdown",
            "chunkSize": 800,
            "chunkOverlap": 120,
            "retrievalMode": "hybrid",
            "topK": 6,
            "similarityThreshold": 0.72,
            "returnCitations": True,
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["embeddingModelProviderId"] == provider["id"]
    assert body["embeddingModelProviderName"] == "BGE 嵌入模型"
    assert body["chunkStrategy"] == "markdown"
    assert body["retrievalMode"] == "hybrid"
    assert body["status"] == "draft"


def test_create_knowledge_base_rejects_llm_model_as_embedding_provider():
    client = TestClient(app)
    provider = client.post(
        "/api/model-providers",
        json={
            "name": "Qwen 推理模型",
            "providerType": "openai-compatible",
            "modelPurpose": "llm",
            "baseUrl": "mock://local",
            "model": "qwen-plus",
            "apiKey": "sk-llm",
        },
    ).json()

    response = client.post(
        "/api/knowledge-bases",
        json={
            "name": "错误模型库",
            "source": "upload",
            "embeddingModelProviderId": provider["id"],
            "chunkStrategy": "fixed",
            "chunkSize": 500,
            "chunkOverlap": 50,
            "retrievalMode": "vector",
            "topK": 5,
            "similarityThreshold": 0.7,
            "returnCitations": True,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Embedding model provider must use embedding purpose"


def test_create_knowledge_base_allows_draft_without_embedding_model_provider():
    client = TestClient(app)

    response = client.post(
        "/api/knowledge-bases",
        json={
            "name": "待配置知识库",
            "source": "manual",
            "chunkStrategy": "fixed",
            "chunkSize": 500,
            "chunkOverlap": 50,
            "retrievalMode": "vector",
            "topK": 4,
            "similarityThreshold": 0.68,
            "returnCitations": False,
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["embeddingModelProviderId"] is None
    assert body["embeddingModelProviderName"] is None
    assert body["status"] == "draft"


def test_update_knowledge_base_configuration():
    client = TestClient(app)
    provider = client.post(
        "/api/model-providers",
        json={
            "name": "M3E 嵌入模型",
            "providerType": "openai-compatible",
            "modelPurpose": "embedding",
            "baseUrl": "mock://local",
            "model": "m3e-base",
            "apiKey": "sk-embedding",
        },
    ).json()
    created = client.post(
        "/api/knowledge-bases",
        json={
            "name": "待编辑知识库",
            "source": "upload",
            "chunkStrategy": "fixed",
            "chunkSize": 500,
            "chunkOverlap": 50,
            "retrievalMode": "vector",
            "topK": 4,
            "similarityThreshold": 0.68,
            "returnCitations": False,
        },
    ).json()

    response = client.put(
        f"/api/knowledge-bases/{created['id']}",
        json={
            "name": "已编辑知识库",
            "description": "更新后的配置",
            "source": "notion",
            "embeddingModelProviderId": provider["id"],
            "chunkStrategy": "semantic",
            "chunkSize": 1000,
            "chunkOverlap": 160,
            "retrievalMode": "hybrid",
            "topK": 8,
            "similarityThreshold": 0.81,
            "returnCitations": True,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "已编辑知识库"
    assert body["description"] == "更新后的配置"
    assert body["source"] == "notion"
    assert body["embeddingModelProviderId"] == provider["id"]
    assert body["embeddingModelProviderName"] == "M3E 嵌入模型"
    assert body["chunkStrategy"] == "semantic"
    assert body["chunkSize"] == 1000
    assert body["chunkOverlap"] == 160
    assert body["retrievalMode"] == "hybrid"
    assert body["topK"] == 8
    assert body["similarityThreshold"] == 0.81
    assert body["returnCitations"] is True


def test_list_documents_for_knowledge_base():
    client = TestClient(app)
    created = client.post(
        "/api/knowledge-bases",
        json={"name": "文件列表知识库", "description": "展示已上传文档", "source": "upload"},
    ).json()
    client.post(
        f"/api/knowledge-bases/{created['id']}/documents",
        json={"name": "施工方案.pdf", "mimeType": "application/pdf", "sizeKb": 512},
    )

    response = client.get(f"/api/knowledge-bases/{created['id']}/documents")

    assert response.status_code == 200
    body = response.json()
    assert body[0]["name"] == "施工方案.pdf"
    assert body[0]["segmentMode"] == "通用"
    assert body[0]["characterCount"] == 0
    assert body[0]["hitCount"] == 0


def test_delete_knowledge_base_removes_resource_and_documents():
    client = TestClient(app)
    created = client.post(
        "/api/knowledge-bases",
        json={"name": "待删除知识库", "description": "删除后不可见", "source": "upload"},
    ).json()
    client.post(
        f"/api/knowledge-bases/{created['id']}/documents",
        json={"name": "obsolete.pdf", "mimeType": "application/pdf", "sizeKb": 128},
    )

    deleted = client.delete(f"/api/knowledge-bases/{created['id']}")

    assert deleted.status_code == 204
    listed = client.get("/api/knowledge-bases").json()
    assert all(item["id"] != created["id"] for item in listed)
    documents = client.get(f"/api/knowledge-bases/{created['id']}/documents")
    assert documents.status_code == 404


def test_legacy_seed_knowledge_base_is_not_exposed_or_deletable():
    client = TestClient(app)

    listed = client.get("/api/knowledge-bases").json()
    deleted = client.delete("/api/knowledge-bases/kb-after-sale")

    assert all(item["id"] not in {"kb-after-sale", "kb-warranty"} for item in listed)
    assert deleted.status_code == 404
