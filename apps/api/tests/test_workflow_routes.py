from fastapi.testclient import TestClient

from app.main import app


def test_list_workflows_returns_canvas_contract():
    client = TestClient(app)

    response = client.get("/api/workflows")

    assert response.status_code == 200
    workflow = response.json()[0]
    assert workflow["agentId"] == "agent-after-sale"
    assert workflow["toolHealthStatus"] == "degraded"
    assert workflow["nodes"][0]["status"] == "success"
