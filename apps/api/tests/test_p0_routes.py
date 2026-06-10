from fastapi.testclient import TestClient

from app.main import app


def test_create_and_list_agents():
    client = TestClient(app)

    created = client.post("/api/agents", json={"name": "售后政策助手", "scenario": "售后问答"})
    assert created.status_code == 201

    listed = client.get("/api/agents")
    assert listed.status_code == 200
    assert listed.json()[0]["name"] == "售后政策助手"


def test_release_gate_returns_blocked_reason():
    client = TestClient(app)
    response = client.post("/api/agents/agent-after-sale/release-gates/check")

    assert response.status_code == 200
    assert response.json()["status"] == "blocked"
    assert "工具健康异常" in response.json()["reasons"][0]
