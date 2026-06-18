from dataclasses import dataclass

import pytest

from app.modules.workflow.graph_types import WorkflowNodeExecutionError
from app.modules.workflow.node_registry import NodeRegistry, resolve_variable
from app.modules.workflow.schemas import WorkflowNodeRead


def node(node_id: str, node_type: str, config: dict | None = None) -> WorkflowNodeRead:
    return WorkflowNodeRead(id=node_id, type=node_type, name=node_id, status="ready", config=config or {})


@dataclass
class FakeModelResult:
    content: str
    latency_ms: int = 12
    cost_cny: float = 0.25
    reasoning_content: str = "思考过程"
    usage: dict | None = None


class FakeModelRepository:
    def __init__(self) -> None:
        self.provider = object()
        self.requested_id = None

    def get(self, provider_id=None):
        self.requested_id = provider_id
        return self.provider


class FakeModelClient:
    def __init__(self) -> None:
        self.prompt = None

    def invoke(self, provider, prompt):
        self.prompt = prompt
        return FakeModelResult(content="模型回答", usage={"total_tokens": 8})


class FakeKnowledgeRepository:
    def __init__(self) -> None:
        self.query = None

    def search(self, query):
        self.query = query
        return {"matches": [{"text": "知识片段", "score": 0.9}]}


def registry() -> tuple[NodeRegistry, FakeModelRepository, FakeModelClient, FakeKnowledgeRepository]:
    model_repository = FakeModelRepository()
    model_client = FakeModelClient()
    knowledge_repository = FakeKnowledgeRepository()
    return NodeRegistry(model_repository, knowledge_repository, model_client), model_repository, model_client, knowledge_repository


def test_resolve_variable_supports_inputs_and_node_output() -> None:
    state = {"inputs": {"question": "退款规则"}, "node_outputs": {"search": {"result": "资料"}}}

    assert resolve_variable(state, "question") == "退款规则"
    assert resolve_variable(state, "trigger.question") == "退款规则"
    assert resolve_variable(state, "search.result") == "资料"


def test_trigger_supports_real_userinput_variable_contract() -> None:
    current_registry, _, _, _ = registry()
    handler = current_registry.build_handler(
        node(
            "node-trigger",
            "trigger",
            {
                "inputFields": [
                    {
                        "id": "question",
                        "label": "用户问题",
                        "variable": "userinput.question",
                        "kind": "text",
                        "required": True,
                    }
                ]
            },
        )
    )

    update = handler({"inputs": {"question": "退款规则", "ignored": "x"}})

    assert update["inputs"] == {"question": "退款规则"}


def test_trigger_and_retrieval_handlers_write_expected_state() -> None:
    current_registry, _, _, knowledge_repository = registry()
    state = {"inputs": {"question": "退款规则", "ignored": "x"}, "node_outputs": {}}

    trigger_update = current_registry.build_handler(
        node("trigger", "trigger", {"inputFields": [{"name": "question"}]})
    )(state)
    retrieval_update = current_registry.build_handler(
        node("search", "retrieval", {"queryVariable": "question"})
    )(state)

    assert trigger_update["inputs"] == {"question": "退款规则"}
    assert retrieval_update["node_outputs"] == {"search": {"result": {"matches": [{"text": "知识片段", "score": 0.9}]}}}
    assert knowledge_repository.query == "退款规则"


def test_llm_handler_builds_prompt_and_normalizes_result() -> None:
    current_registry, model_repository, model_client, _ = registry()
    handler = current_registry.build_handler(
        node(
            "answer",
            "llm",
            {
                "modelProviderId": "provider-1",
                "contextVariables": ["question", "search.result"],
                "systemPrompt": "你是客服",
                "userPrompt": "请回答：{{question}}",
            },
        )
    )
    state = {
        "inputs": {"question": "退款规则"},
        "node_outputs": {"search": {"result": "知识片段"}},
    }

    update = handler(state)

    assert model_repository.requested_id == "provider-1"
    assert "你是客服" in model_client.prompt
    assert "退款规则" in model_client.prompt
    assert "知识片段" in model_client.prompt
    assert update["node_outputs"]["answer"] == {
        "text": "模型回答",
        "reasoning_content": "思考过程",
        "usage": {"total_tokens": 8},
    }


def test_expose_handler_maps_declared_outputs() -> None:
    current_registry, _, _, _ = registry()
    handler = current_registry.build_handler(
        node(
            "expose",
            "expose",
            {"outputVariables": [{"name": "answer", "value": "answer.text"}, {"name": "question", "value": "question"}]},
        )
    )

    update = handler({"inputs": {"question": "退款规则"}, "node_outputs": {"answer": {"text": "可以退款"}}})

    assert update["final_output"] == {"answer": "可以退款", "question": "退款规则"}


def test_condition_handler_records_selected_route() -> None:
    current_registry, _, _, _ = registry()
    handler = current_registry.build_handler(
        node(
            "condition",
            "condition",
            {"variable": "userinput.score", "operator": "gt", "compareValue": 60, "defaultBranch": "default"},
        )
    )

    update = handler({"inputs": {"score": 80}})

    assert update["route_decisions"] == {"condition": "true"}
    assert update["trace_steps"][0]["route"] == "true"


def test_condition_handler_supports_all_frontend_operators() -> None:
    current_registry, _, _, _ = registry()
    cases = [
        ("eq", "ok", "ok", "true"),
        ("neq", "ok", "bad", "true"),
        ("contains", "hello", "ell", "true"),
        ("gt", 2, 1, "true"),
        ("lt", 1, 2, "true"),
        ("empty", "", "ignored", "true"),
        ("not_empty", "value", "ignored", "true"),
    ]
    for operator, actual, expected, decision in cases:
        handler = current_registry.build_handler(
            node(
                f"condition-{operator}",
                "condition",
                {"variable": "userinput.value", "operator": operator, "compareValue": expected, "defaultBranch": "default"},
            )
        )
        update = handler({"inputs": {"value": actual}})
        assert update["route_decisions"] == {f"condition-{operator}": decision}


def test_llm_prompt_replaces_userinput_reference() -> None:
    current_registry, _, model_client, _ = registry()
    handler = current_registry.build_handler(
        node(
            "answer",
            "llm",
            {
                "contextVariables": ["userinput.question"],
                "userPrompt": "问题：{{userinput.question}}",
            },
        )
    )

    handler({"inputs": {"question": "退款规则"}})

    assert "问题：退款规则" in model_client.prompt


def test_loop_handler_continues_three_times_then_exits() -> None:
    current_registry, _, _, _ = registry()
    handler = current_registry.build_handler(
        node(
            "loop",
            "loop",
            {"variable": "userinput.keep_going", "operator": "eq", "compareValue": True, "maxIterations": 3},
        )
    )
    state = {"inputs": {"keep_going": True}, "iteration_counts": {}}

    for expected_count in (1, 2, 3):
        update = handler(state)
        assert update["route_decisions"] == {"loop": "continue"}
        assert update["iteration_counts"] == {"loop": expected_count}
        state = {"inputs": {"keep_going": True}, "iteration_counts": update["iteration_counts"]}

    update = handler(state)
    assert update["route_decisions"] == {"loop": "exit"}
    assert update["iteration_counts"] == {"loop": 3}
    assert update["trace_steps"][0]["status"] == "warning"
    assert "最大迭代次数" in update["trace_steps"][0]["message"]


def test_loop_exits_immediately_when_condition_is_false() -> None:
    current_registry, _, _, _ = registry()
    handler = current_registry.build_handler(
        node(
            "loop",
            "loop",
            {"variable": "userinput.keep_going", "operator": "eq", "compareValue": True, "maxIterations": 3},
        )
    )

    update = handler({"inputs": {"keep_going": False}, "iteration_counts": {}})

    assert update["route_decisions"] == {"loop": "exit"}
    assert update["iteration_counts"] == {"loop": 0}


def test_loop_marks_warning_when_limit_reached_even_if_condition_turns_false() -> None:
    current_registry, _, _, _ = registry()
    handler = current_registry.build_handler(
        node(
            "loop",
            "loop",
            {"variable": "userinput.keep_going", "operator": "eq", "compareValue": True, "maxIterations": 3},
        )
    )

    update = handler({"inputs": {"keep_going": False}, "iteration_counts": {"loop": 3}})

    assert update["route_decisions"] == {"loop": "exit"}
    assert update["trace_steps"][0]["status"] == "warning"


def test_handler_wraps_node_failure_with_failed_trace() -> None:
    current_registry, _, _, knowledge_repository = registry()

    def fail(_query):
        raise RuntimeError("检索服务不可用")

    knowledge_repository.search = fail
    handler = current_registry.build_handler(node("search", "retrieval", {"queryVariable": "userinput.question"}))

    with pytest.raises(WorkflowNodeExecutionError) as caught:
        handler({"inputs": {"question": "退款"}})

    assert caught.value.node_id == "search"
    assert caught.value.node_name == "search"
    assert caught.value.failed_trace["status"] == "failed"
    assert "检索服务不可用" in caught.value.failed_trace["message"]
