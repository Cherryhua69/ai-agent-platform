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
    assert workflow["nodes"][0]["name"] == "用户输入"
    assert workflow["nodes"][0]["config"]["inputFields"] == []


def test_created_agent_has_persisted_default_workflow():
    client = TestClient(app)

    created = client.post("/api/agents", json={"name": "售后政策助手", "scenario": "售后问答"})

    assert created.status_code == 201
    workflow_id = created.json()["workflowId"]

    response = client.get(f"/api/workflows/{workflow_id}")

    assert response.status_code == 200
    workflow = response.json()
    assert workflow["id"] == workflow_id
    assert workflow["agentId"] == created.json()["id"]
    assert [node["type"] for node in workflow["nodes"]] == ["trigger"]
    assert workflow["edges"] == []


def test_created_agent_default_trigger_has_input_fields():
    client = TestClient(app)

    created = client.post("/api/agents", json={"name": "文件问答助手", "scenario": "读取用户上传文件并回答"}).json()

    response = client.get(f"/api/workflows/{created['workflowId']}")

    assert response.status_code == 200
    trigger_node = response.json()["nodes"][0]
    assert trigger_node["type"] == "trigger"
    assert trigger_node["name"] == "用户输入"
    assert trigger_node["config"]["inputFields"] == []


def test_seed_workflow_can_be_saved_after_agent_card_navigation():
    client = TestClient(app)

    payload = {
        "name": "售后工单 Agentflow",
        "status": "draft",
        "toolHealthStatus": "online",
        "viewport": {"x": 0, "y": 0, "zoom": 1},
        "nodes": [
            {
                "id": "node-trigger",
                "type": "trigger",
                "name": "用户输入",
                "status": "success",
                "position": {"x": 80, "y": 160},
                "config": {"inputFields": []},
            }
        ],
        "edges": [],
    }

    updated = client.put("/api/workflows/workflow-after-sale", json=payload)
    loaded = client.get("/api/workflows/workflow-after-sale")

    assert updated.status_code == 200
    assert loaded.status_code == 200
    workflow = loaded.json()
    assert [node["id"] for node in workflow["nodes"]] == ["node-trigger"]
    assert workflow["status"] == "draft"


def test_update_workflow_persists_canvas_contract():
    client = TestClient(app)
    created = client.post("/api/agents", json={"name": "退款审核助手", "scenario": "退款条件审核"}).json()
    workflow_id = created["workflowId"]

    payload = {
        "name": "退款审核工作流",
        "status": "draft",
        "toolHealthStatus": "online",
        "viewport": {"x": 12, "y": -8, "zoom": 0.9},
        "nodes": [
            {
                "id": "node-input",
                "type": "trigger",
                "name": "用户输入",
                "status": "success",
                "position": {"x": 80, "y": 120},
                "config": {"required": True},
            },
            {
                "id": "node-llm",
                "type": "llm",
                "name": "LLM",
                "status": "success",
                "description": "AI 基于检索到的知识库内容结合用户问题，生成清晰、有帮助的回答。",
                "position": {"x": 360, "y": 120},
                "config": {"model": "gpt-4.1"},
            },
        ],
        "edges": [
            {
                "id": "edge-input-llm",
                "source": "node-input",
                "target": "node-llm",
                "sourceHandle": "right",
                "targetHandle": "left",
            }
        ],
    }

    updated = client.put(f"/api/workflows/{workflow_id}", json=payload)
    loaded = client.get(f"/api/workflows/{workflow_id}")

    assert updated.status_code == 200
    assert loaded.status_code == 200
    workflow = loaded.json()
    assert workflow["name"] == "退款审核工作流"
    assert workflow["viewport"] == {"x": 12, "y": -8, "zoom": 0.9}
    assert workflow["nodes"][1]["config"] == {"model": "gpt-4.1"}
    assert workflow["edges"] == payload["edges"]


def test_run_workflow_test_returns_trace_placeholder():
    client = TestClient(app)
    created = client.post("/api/agents", json={"name": "测试助手", "scenario": "配置调试"}).json()

    response = client.post(f"/api/workflows/{created['workflowId']}/test", json={"input": "如何申请退款？"})

    assert response.status_code == 201
    body = response.json()
    assert body["workflowId"] == created["workflowId"]
    assert body["status"] == "success"
    assert body["input"] == "如何申请退款？"
    assert body["output"]
