from fastapi.testclient import TestClient

from app.main import app


def test_tool_health_p0_flow():
    client = TestClient(app)

    server = client.post(
        "/api/mcp-servers",
        json={"name": "工单 MCP", "baseUrl": "https://mcp.example.test", "owner": "platform"},
    )
    assert server.status_code == 201

    tool = client.post(
        "/api/tools",
        json={
            "name": "create_ticket",
            "type": "mcp",
            "credential": "ticket-prod",
            "permission": "Developer + Operator",
            "schema": {"input": {"type": "object"}},
        },
    )
    assert tool.status_code == 201
    assert tool.json()["schema"]["input"]["type"] == "object"

    listed = client.get("/api/tools")
    assert listed.status_code == 200
    assert listed.json()[0]["health"] == "degraded"

    health = client.get(f"/api/tools/{tool.json()['id']}/health")
    assert health.status_code == 200
    assert health.json()["status"] == "degraded"
