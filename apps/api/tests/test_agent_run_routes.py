from fastapi.testclient import TestClient

from app.main import app


def test_agent_run_creates_queryable_trace_with_final_output():
    client = TestClient(app)
    provider = client.post(
        "/api/model-providers",
        json={
            "name": "Route smoke model",
            "providerType": "openai-compatible",
            "baseUrl": "mock://local",
            "model": "route-smoke",
            "apiKey": "sk-local",
            "isDefault": True,
        },
    ).json()

    created = client.post(
        "/api/agents/agent-after-sale/runs",
        json={
            "userInput": "Order ORD-2048 asks whether refund is allowed",
            "modelProviderId": provider["id"],
            "knowledgeBaseIds": ["kb-after-sale"],
        },
    )

    assert created.status_code == 201
    body = created.json()
    assert body["id"].startswith("run_")
    assert body["agentId"] == "agent-after-sale"
    assert body["status"] == "success"
    assert "route-smoke" in body["finalOutput"]
    assert body["steps"][0]["title"] == "User input"
    assert body["steps"][-1]["title"] == "LangChain model call"

    trace = client.get(f"/api/runs/{body['id']}/trace")

    assert trace.status_code == 200
    assert trace.json()["id"] == body["id"]
    assert trace.json()["finalOutput"] == body["finalOutput"]


def test_agent_run_executes_the_saved_langgraph_workflow():
    client = TestClient(app)
    provider = client.post(
        "/api/model-providers",
        json={
            "name": "Graph route model",
            "providerType": "openai-compatible",
            "baseUrl": "mock://local",
            "model": "graph-route",
            "apiKey": "sk-local",
            "isDefault": True,
        },
    ).json()
    agent = client.post("/api/agents", json={"name": "图执行助手", "scenario": "工作流测试"}).json()
    workflow_id = agent["workflowId"]
    saved = client.put(
        f"/api/workflows/{workflow_id}",
        json={
            "name": "图执行工作流",
            "status": "draft",
            "toolHealthStatus": "online",
            "viewport": {"x": 0, "y": 0, "zoom": 1},
            "nodes": [
                {
                    "id": "input",
                    "type": "trigger",
                    "name": "用户输入",
                    "status": "success",
                    "config": {
                        "inputFields": [
                            {"id": "question", "label": "问题", "variable": "userinput.question", "kind": "text", "required": True}
                        ]
                    },
                },
                {
                    "id": "llm",
                    "type": "llm",
                    "name": "生成回答",
                    "status": "success",
                    "config": {
                        "modelProviderId": provider["id"],
                        "contextVariables": ["userinput.question"],
                        "userPrompt": "请回答：{{userinput.question}}",
                    },
                },
                {
                    "id": "output",
                    "type": "expose",
                    "name": "输出",
                    "status": "success",
                    "config": {"outputVariables": [{"id": "answer", "name": "answer", "value": "llm.text"}]},
                },
            ],
            "edges": [
                {"id": "input-llm", "source": "input", "target": "llm"},
                {"id": "llm-output", "source": "llm", "target": "output"},
            ],
        },
    )
    assert saved.status_code == 200

    response = client.post(f"/api/agents/{agent['id']}/runs", json={"userInput": "退款规则是什么？"})

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "success"
    assert "graph-route" in body["finalOutput"]
    assert [step["title"] for step in body["steps"]] == ["用户输入", "生成回答", "输出"]
