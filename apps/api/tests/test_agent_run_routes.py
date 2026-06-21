from fastapi.testclient import TestClient

from app.main import app
from app.modules.agent.run_service import AgentRunService
from app.modules.agent.schemas import AgentRunRequest
from app.modules.workflow.schemas import WorkflowRead


def test_streaming_uses_llm_selected_by_structured_output_variable() -> None:
    workflow = WorkflowRead.model_validate(
        {
            "id": "workflow",
            "agentId": "agent",
            "name": "chatbot",
            "status": "ready",
            "toolHealthStatus": "online",
            "nodes": [
                {"id": "answer", "type": "llm", "name": "最终回答", "status": "success"},
                {"id": "followup", "type": "llm", "name": "后续处理", "status": "success"},
                {
                    "id": "output",
                    "type": "expose",
                    "name": "输出",
                    "status": "success",
                    "config": {
                        "outputVariables": [
                            {"name": "answer", "valueSelector": ["answer", "text"], "valueType": "String"}
                        ]
                    },
                },
            ],
        }
    )

    assert AgentRunService._stream_output_node_ids(workflow) == {"answer"}


def test_conversation_history_is_bounded_to_recent_context() -> None:
    request = AgentRunRequest.model_validate(
        {
            "userInput": "写一个 c++ 代码给我",
            "conversationHistory": [
                {"role": "user", "content": "你是谁"},
                {"role": "assistant", "content": "很长的第一轮回复" * 2000},
                {"role": "user", "content": "你能干什么"},
                {"role": "assistant", "content": "很长的第二轮回复" * 2000},
            ],
        }
    )

    history_text = AgentRunService._conversation_history_text(request)

    assert len(history_text) <= AgentRunService.MAX_CONVERSATION_HISTORY_CHARS
    assert "你能干什么" in history_text
    assert "很长的第二轮回复" in history_text
    assert "你是谁" not in history_text


def test_stream_run_finishes_when_error_happens_after_visible_delta(monkeypatch) -> None:
    service = AgentRunService(traces=object())

    def fail_after_stream(*_args, stream_sink=None, **_kwargs):
        stream_sink("已经生成的回答")
        raise RuntimeError("trace persistence failed")

    monkeypatch.setattr(service, "simulate_run", fail_after_stream)

    events = list(service.stream_run("agent", AgentRunRequest(userInput="写一个 c++ 代码给我")))

    assert events[0] == '{"type": "delta", "text": "已经生成的回答"}\n'
    assert any('"type": "done"' in event for event in events)
    assert not any('"type": "error"' in event for event in events)


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
