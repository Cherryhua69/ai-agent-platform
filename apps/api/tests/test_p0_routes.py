from fastapi.testclient import TestClient

from app.main import app


def test_create_and_list_agents():
    client = TestClient(app)

    created = client.post(
        "/api/agents",
        json={
            "name": "售后政策助手",
            "scenario": "售后问答",
        },
    )
    assert created.status_code == 201
    created_body = created.json()
    assert created_body["name"] == "售后政策助手"
    assert "modelPolicy" not in created_body
    assert created_body["status"] == "draft"

    listed = client.get("/api/agents")
    assert listed.status_code == 200
    agent = next(item for item in listed.json() if item["id"] == created_body["id"])
    assert agent["name"] == "售后政策助手"
    assert "modelPolicy" not in agent


def test_release_gate_returns_blocked_reason():
    client = TestClient(app)
    response = client.post("/api/agents/agent-after-sale/release-gates/check")

    assert response.status_code == 200
    assert response.json()["status"] == "blocked"
    assert "工具健康异常" in response.json()["reasons"][0]
