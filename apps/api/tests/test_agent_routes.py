from fastapi.testclient import TestClient

from app.main import app


def test_agent_routes_update_and_delete_agent():
    client = TestClient(app)
    created = client.post("/api/agents", json={"name": "售后政策助手", "scenario": "售后问答"})
    assert created.status_code == 201
    agent_id = created.json()["id"]

    updated = client.patch(f"/api/agents/{agent_id}", json={"name": "退款审核助手", "scenario": "退款条件审核"})

    assert updated.status_code == 200
    assert updated.json()["name"] == "退款审核助手"
    assert updated.json()["scenario"] == "退款条件审核"

    deleted = client.delete(f"/api/agents/{agent_id}")

    assert deleted.status_code == 204
    agents = client.get("/api/agents").json()
    assert agent_id not in [agent["id"] for agent in agents]
