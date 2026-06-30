import json

from fastapi.testclient import TestClient

from app.main import app
from app.modules.knowledge import router as knowledge_router


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
        json={
            "name": "refund-policy.txt",
            "mimeType": "text/plain",
            "sizeKb": 1,
            "content": "退款政策要求先核验订单状态，并在高风险写操作前触发人工确认。",
        },
    )
    assert document.status_code == 201
    assert document.json()["status"] == "uploaded"

    job = client.post(f"/api/knowledge-bases/{knowledge_base['id']}/processing-jobs")
    assert job.status_code == 201
    assert job.json()["status"] == "queued"

    search = client.post(f"/api/knowledge-bases/{knowledge_base['id']}/search", json={"query": "退款政策"})
    assert search.status_code == 200
    assert search.json()["matches"][0]["score"] >= 0.8


def test_app_startup_recovers_pending_knowledge_jobs(monkeypatch):
    calls: list[str] = []
    monkeypatch.setattr(knowledge_router.repo, "run_pending_processing_jobs", lambda: calls.append("recover"))

    with TestClient(app):
        pass

    assert calls == ["recover"]


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
    assert body[0]["errorMessage"] is None


def test_upload_text_document_saves_content_and_can_be_processed():
    client = TestClient(app)
    created = client.post(
        "/api/knowledge-bases",
        json={"name": "上传知识库", "source": "upload", "chunkSize": 120, "chunkOverlap": 0},
    ).json()

    response = client.post(
        f"/api/knowledge-bases/{created['id']}/documents/upload",
        files={"file": ("policy.txt", b"Refund policy upload content", "text/plain")},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "policy.txt"
    assert body["mimeType"] == "text/plain"
    assert body["sizeKb"] == 1
    assert body["characterCount"] == len("Refund policy upload content")

    job = client.post(f"/api/knowledge-bases/{created['id']}/processing-jobs")
    assert job.status_code == 201
    search = client.post(f"/api/knowledge-bases/{created['id']}/search", json={"query": "refund upload"})
    assert search.status_code == 200
    assert search.json()["matches"][0]["documentName"] == "policy.txt"


def test_upload_pdf_document_extracts_text_and_can_be_processed():
    client = TestClient(app)
    created = client.post(
        "/api/knowledge-bases",
        json={"name": "PDF 知识库", "source": "upload", "chunkSize": 120, "chunkOverlap": 0},
    ).json()

    response = client.post(
        f"/api/knowledge-bases/{created['id']}/documents/upload",
        files={"file": ("policy.pdf", build_test_pdf("Refund PDF policy content"), "application/pdf")},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "policy.pdf"
    assert body["mimeType"] == "application/pdf"
    assert body["characterCount"] == len("Refund PDF policy content")

    job = client.post(f"/api/knowledge-bases/{created['id']}/processing-jobs")
    assert job.status_code == 201
    search = client.post(f"/api/knowledge-bases/{created['id']}/search", json={"query": "refund pdf"})
    assert search.status_code == 200
    assert search.json()["matches"][0]["documentName"] == "policy.pdf"


def test_upload_damaged_pdf_returns_400():
    client = TestClient(app)
    created = client.post(
        "/api/knowledge-bases",
        json={"name": "PDF 知识库", "source": "upload"},
    ).json()

    response = client.post(
        f"/api/knowledge-bases/{created['id']}/documents/upload",
        files={"file": ("broken.pdf", b"not a real pdf", "application/pdf")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Document parse failed"


def test_upload_rejects_unsupported_document_type():
    client = TestClient(app)
    created = client.post(
        "/api/knowledge-bases",
        json={"name": "上传知识库", "source": "upload"},
    ).json()

    response = client.post(
        f"/api/knowledge-bases/{created['id']}/documents/upload",
        files={"file": ("archive.bin", b"binary", "application/octet-stream")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Unsupported document type"


def build_test_pdf(text: str) -> bytes:
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        f"<< /Length {len(f'BT /F1 24 Tf 72 720 Td ({text}) Tj ET'.encode('latin-1'))} >>\nstream\nBT /F1 24 Tf 72 720 Td ({text}) Tj ET\nendstream".encode("latin-1"),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    content = b"%PDF-1.4\n"
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(content))
        content += f"{index} 0 obj\n".encode("ascii") + obj + b"\nendobj\n"
    xref_offset = len(content)
    content += f"xref\n0 {len(objects) + 1}\n".encode("ascii")
    content += b"0000000000 65535 f \n"
    for offset in offsets[1:]:
        content += f"{offset:010d} 00000 n \n".encode("ascii")
    content += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_offset}\n%%EOF\n"
    ).encode("ascii")
    return content


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


def test_processing_job_generates_segments_from_document_content():
    client = TestClient(app)
    created = client.post(
        "/api/knowledge-bases",
        json={
            "name": "minimal rag kb",
            "source": "upload",
            "chunkStrategy": "fixed",
            "chunkSize": 120,
            "chunkOverlap": 20,
            "topK": 3,
            "similarityThreshold": 0,
        },
    ).json()

    document = client.post(
        f"/api/knowledge-bases/{created['id']}/documents",
        json={
            "name": "refund-policy.txt",
            "mimeType": "text/plain",
            "sizeKb": 1,
            "content": "Refund policy requires an order status check before issuing payment. " * 4,
        },
    )
    assert document.status_code == 201

    job = client.post(f"/api/knowledge-bases/{created['id']}/processing-jobs")

    assert job.status_code == 201
    assert job.json()["status"] == "queued"
    jobs = client.get(f"/api/knowledge-bases/{created['id']}/processing-jobs").json()
    assert jobs[0]["status"] == "succeeded"
    assert jobs[0]["chunksCreated"] > 0
    documents = client.get(f"/api/knowledge-bases/{created['id']}/documents").json()
    assert documents[0]["status"] == "available"
    assert documents[0]["characterCount"] > 0


def test_list_document_segments_after_processing_job():
    client = TestClient(app)
    created = client.post(
        "/api/knowledge-bases",
        json={
            "name": "segment preview kb",
            "source": "upload",
            "chunkSize": 100,
            "chunkOverlap": 0,
            "similarityThreshold": 0,
        },
    ).json()
    document = client.post(
        f"/api/knowledge-bases/{created['id']}/documents",
        json={
            "name": "policy.txt",
            "mimeType": "text/plain",
            "sizeKb": 1,
            "content": "First chunk content. " * 8 + "Second chunk content. " * 8,
        },
    ).json()
    client.post(f"/api/knowledge-bases/{created['id']}/processing-jobs")

    response = client.get(f"/api/knowledge-bases/{created['id']}/documents/{document['id']}/segments")

    assert response.status_code == 200
    body = response.json()
    assert len(body) >= 2
    assert body[0]["id"].startswith("seg_")
    assert body[0]["knowledgeBaseId"] == created["id"]
    assert body[0]["documentId"] == document["id"]
    assert body[0]["position"] == 1
    assert "First chunk content" in body[0]["content"]
    assert body[0]["characterCount"] == len(body[0]["content"])
    assert body[0]["tokenCount"] > 0
    assert body[0]["status"] == "available"


def test_list_document_segments_for_unknown_document_returns_404():
    client = TestClient(app)
    created = client.post(
        "/api/knowledge-bases",
        json={"name": "segment missing doc kb", "source": "upload"},
    ).json()

    response = client.get(f"/api/knowledge-bases/{created['id']}/documents/doc_missing/segments")

    assert response.status_code == 404


def test_delete_document_removes_document_and_segments():
    client = TestClient(app)
    created = client.post(
        "/api/knowledge-bases",
        json={"name": "delete document kb", "source": "upload", "chunkSize": 120, "chunkOverlap": 0},
    ).json()
    document = client.post(
        f"/api/knowledge-bases/{created['id']}/documents",
        json={
            "name": "obsolete.txt",
            "mimeType": "text/plain",
            "sizeKb": 1,
            "content": "Obsolete document content should be removed from segments.",
        },
    ).json()
    client.post(f"/api/knowledge-bases/{created['id']}/processing-jobs")
    segments_before = client.get(f"/api/knowledge-bases/{created['id']}/documents/{document['id']}/segments")
    assert segments_before.status_code == 200
    assert len(segments_before.json()) == 1

    response = client.delete(f"/api/knowledge-bases/{created['id']}/documents/{document['id']}")

    assert response.status_code == 204
    documents = client.get(f"/api/knowledge-bases/{created['id']}/documents").json()
    assert all(item["id"] != document["id"] for item in documents)
    segments_after = client.get(f"/api/knowledge-bases/{created['id']}/documents/{document['id']}/segments")
    assert segments_after.status_code == 404


def test_search_returns_segment_matches_and_citations():
    client = TestClient(app)
    created = client.post(
        "/api/knowledge-bases",
        json={
            "name": "searchable rag kb",
            "source": "upload",
            "chunkSize": 160,
            "chunkOverlap": 20,
            "topK": 2,
            "similarityThreshold": 0,
            "returnCitations": True,
        },
    ).json()
    client.post(
        f"/api/knowledge-bases/{created['id']}/documents",
        json={
            "name": "refund-policy.txt",
            "mimeType": "text/plain",
            "sizeKb": 1,
            "content": "Refund policy: customers can request a refund after order status verification.",
        },
    )
    client.post(f"/api/knowledge-bases/{created['id']}/processing-jobs")

    response = client.post(f"/api/knowledge-bases/{created['id']}/search", json={"query": "refund policy"})

    assert response.status_code == 200
    body = response.json()
    assert body["matches"][0]["segmentId"].startswith("seg_")
    assert body["matches"][0]["documentId"].startswith("doc_")
    assert body["matches"][0]["documentName"] == "refund-policy.txt"
    assert "refund" in body["matches"][0]["content"].lower()
    assert body["matches"][0]["position"] == 1
    assert body["matches"][0]["score"] > 0
    assert body["citations"][0]["segmentId"] == body["matches"][0]["segmentId"]
    assert body["citations"][0]["documentName"] == "refund-policy.txt"
    assert "refund" in body["citations"][0]["snippet"].lower()


def test_answer_generates_response_with_default_llm_and_citations():
    client = TestClient(app)
    client.post(
        "/api/model-providers",
        json={
            "name": "Mock Answer LLM",
            "providerType": "openai-compatible",
            "modelPurpose": "llm",
            "baseUrl": "mock://local",
            "model": "answer-model",
            "apiKey": "sk-llm",
            "isDefault": True,
        },
    )
    created = client.post(
        "/api/knowledge-bases",
        json={"name": "answer kb", "source": "upload", "chunkSize": 160, "chunkOverlap": 0},
    ).json()
    client.post(
        f"/api/knowledge-bases/{created['id']}/documents",
        json={
            "name": "refund-policy.txt",
            "mimeType": "text/plain",
            "sizeKb": 1,
            "content": "Refund policy requires status verification before issuing payment.",
        },
    )
    client.post(f"/api/knowledge-bases/{created['id']}/processing-jobs")

    response = client.post(f"/api/knowledge-bases/{created['id']}/answer", json={"query": "refund policy"})

    assert response.status_code == 200
    body = response.json()
    assert body["query"] == "refund policy"
    assert "answer-model" in body["answer"]
    assert "Refund policy" in body["answer"]
    assert body["modelProviderName"] == "Mock Answer LLM"
    assert body["citations"][0]["documentName"] == "refund-policy.txt"
    assert body["matches"][0]["documentName"] == "refund-policy.txt"


def test_answer_stream_emits_events_and_persists_rag_trace():
    client = TestClient(app)
    client.post(
        "/api/model-providers",
        json={
            "name": "Mock Stream LLM",
            "providerType": "openai-compatible",
            "modelPurpose": "llm",
            "baseUrl": "mock://local",
            "model": "stream-answer-model",
            "apiKey": "sk-llm",
            "isDefault": True,
        },
    )
    created = client.post(
        "/api/knowledge-bases",
        json={"name": "stream answer kb", "source": "upload", "chunkSize": 160, "chunkOverlap": 0},
    ).json()
    client.post(
        f"/api/knowledge-bases/{created['id']}/documents",
        json={
            "name": "refund-policy.txt",
            "mimeType": "text/plain",
            "sizeKb": 1,
            "content": "Refund policy requires status verification before issuing payment.",
        },
    )
    client.post(f"/api/knowledge-bases/{created['id']}/processing-jobs")

    with client.stream("POST", f"/api/knowledge-bases/{created['id']}/answer/stream", json={"query": "refund policy"}) as response:
        assert response.status_code == 200
        events = [json.loads(line) for line in response.iter_lines() if line]

    assert [event["type"] for event in events[:2]] == ["retrieval_started", "retrieval_completed"]
    assert any(event["type"] == "answer_delta" and event["text"] for event in events)
    done = next(event for event in events if event["type"] == "completed")
    assert done["runId"].startswith("rag_")
    assert done["citations"][0]["documentName"] == "refund-policy.txt"

    trace = client.get(f"/api/runs/{done['runId']}/trace")
    assert trace.status_code == 200
    body = trace.json()
    assert body["agentId"] == created["id"]
    assert body["runCategory"] == "rag"
    assert body["status"] == "success"
    assert body["steps"][0]["type"] == "retrieval"
    assert body["steps"][1]["type"] == "llm"


def test_answer_requires_default_llm_provider(monkeypatch):
    client = TestClient(app)
    created = client.post(
        "/api/knowledge-bases",
        json={"name": "no llm kb", "source": "upload", "chunkSize": 160, "chunkOverlap": 0},
    ).json()
    monkeypatch.setattr(knowledge_router.repo._model_provider_repository, "get", lambda *args, **kwargs: None)

    response = client.post(f"/api/knowledge-bases/{created['id']}/answer", json={"query": "refund"})

    assert response.status_code == 400
    assert response.json()["detail"] == "No default LLM model provider configured"


def test_search_unknown_knowledge_base_returns_404():
    client = TestClient(app)

    response = client.post("/api/knowledge-bases/kb_missing/search", json={"query": "refund"})

    assert response.status_code == 404


def test_processing_job_uses_configured_mock_embedding_provider():
    client = TestClient(app)
    provider = client.post(
        "/api/model-providers",
        json={
            "name": "Mock Embedding Provider",
            "providerType": "openai-compatible",
            "modelPurpose": "embedding",
            "baseUrl": "mock://local",
            "model": "mock-embedding",
            "apiKey": "sk-mock",
        },
    ).json()
    created = client.post(
        "/api/knowledge-bases",
        json={
            "name": "embedding api kb",
            "source": "upload",
            "embeddingModelProviderId": provider["id"],
            "chunkSize": 160,
            "chunkOverlap": 0,
        },
    ).json()
    client.post(
        f"/api/knowledge-bases/{created['id']}/documents",
        json={
            "name": "policy.txt",
            "mimeType": "text/plain",
            "sizeKb": 1,
            "content": "Refund policy requires status verification.",
        },
    )

    response = client.post(f"/api/knowledge-bases/{created['id']}/processing-jobs")

    assert response.status_code == 201
    assert response.json()["status"] == "queued"
    jobs = client.get(f"/api/knowledge-bases/{created['id']}/processing-jobs").json()
    assert jobs[0]["status"] == "succeeded"
    assert jobs[0]["chunksCreated"] == 1


def test_processing_jobs_are_listed_with_timestamps_and_status():
    client = TestClient(app)
    created = client.post(
        "/api/knowledge-bases",
        json={"name": "job history kb", "source": "upload", "chunkSize": 160, "chunkOverlap": 0},
    ).json()
    client.post(
        f"/api/knowledge-bases/{created['id']}/documents",
        json={
            "name": "policy.txt",
            "mimeType": "text/plain",
            "sizeKb": 1,
            "content": "Refund policy requires status verification.",
        },
    )

    created_job = client.post(f"/api/knowledge-bases/{created['id']}/processing-jobs").json()
    listed = client.get(f"/api/knowledge-bases/{created['id']}/processing-jobs")

    assert listed.status_code == 200
    body = listed.json()
    assert body[0]["id"] == created_job["id"]
    assert created_job["status"] == "queued"
    assert body[0]["status"] == "succeeded"
    assert body[0]["chunksCreated"] == 1
    assert body[0]["createdAt"]
    assert body[0]["startedAt"]
    assert body[0]["finishedAt"]
    assert body[0]["errorMessage"] is None
