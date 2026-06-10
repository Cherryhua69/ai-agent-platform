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
    assert knowledge_base["status"] == "processing"

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
