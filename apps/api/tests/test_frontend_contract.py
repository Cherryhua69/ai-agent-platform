from fastapi.testclient import TestClient

from app.main import app


def test_frontend_agent_contract_contains_ui_fields():
    client = TestClient(app)

    created = client.post("/api/agents", json={"name": "售后政策助手", "scenario": "售后问答"})
    assert created.status_code == 201

    body = created.json()
    assert body["owner"] == "陈晓"
    assert body["modelPolicy"] == "gpt-4.1 + fallback"
    assert body["workflowId"].startswith("flow_")
    assert body["knowledgeBaseIds"] == ["kb-after-sale", "kb-warranty"]
    assert body["toolIds"] == ["tool-ticket", "tool-order"]


def test_frontend_trace_contract_uses_camel_case_fields():
    client = TestClient(app)

    response = client.get("/api/runs/run_8f23/trace")

    assert response.status_code == 200
    body = response.json()
    assert body["agentId"] == "agent-after-sale"
    assert body["costCny"] == 0.09
    assert body["steps"][0]["latencyMs"] == 18
    assert "latency_ms" not in body["steps"][0]


def test_frontend_can_call_api_with_localhost_origin():
    client = TestClient(app)

    response = client.options(
        "/api/agents",
        headers={
            "Origin": "http://127.0.0.1:5176",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5176"
