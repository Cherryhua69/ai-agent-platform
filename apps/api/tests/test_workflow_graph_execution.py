from collections import Counter

import pytest

from app.modules.workflow.graph_compiler import GraphCompiler
from app.modules.workflow.graph_executor import GraphExecutor
from app.modules.workflow.graph_types import WorkflowExecutionError
from app.modules.workflow.node_registry import NodeRegistry
from app.modules.workflow.schemas import WorkflowEdgeRead, WorkflowNodeRead, WorkflowRead


def node(node_id: str, node_type: str, config: dict | None = None) -> WorkflowNodeRead:
    return WorkflowNodeRead(id=node_id, type=node_type, name=node_id, status="ready", config=config or {})


def edge(source: str, target: str, handle: str | None = None) -> WorkflowEdgeRead:
    return WorkflowEdgeRead(id=f"{source}-{target}-{handle}", source=source, target=target, sourceHandle=handle)


def workflow(nodes: list[WorkflowNodeRead], edges: list[WorkflowEdgeRead]) -> WorkflowRead:
    return WorkflowRead(
        id="wf",
        agentId="agent",
        name="workflow",
        status="draft",
        toolHealthStatus="healthy",
        nodes=nodes,
        edges=edges,
    )


class FakeRegistry:
    def __init__(self) -> None:
        self.calls = Counter()

    def build_handler(self, current_node):
        def handler(state):
            self.calls[current_node.id] += 1
            update = {"trace_steps": [{"node_id": current_node.id}]}
            if current_node.type == "condition":
                update["route_decisions"] = {
                    current_node.id: "true" if state.get("inputs", {}).get("choose_true") else "false"
                }
            elif current_node.type == "loop":
                current = state.get("iteration_counts", {}).get(current_node.id, 0)
                maximum = current_node.config["maxIterations"]
                decision = "continue" if current < maximum else "exit"
                update["iteration_counts"] = {current_node.id: current + 1 if decision == "continue" else current}
                update["route_decisions"] = {current_node.id: decision}
            elif current_node.type == "expose":
                update["final_output"] = {
                    "path": next(
                        (name for name in ("yes", "no") if name in state.get("node_outputs", {})),
                        None,
                    ),
                    "iterations": state.get("iteration_counts", {}).get("loop", 0),
                }
            elif current_node.type not in {"trigger"}:
                update["node_outputs"] = {current_node.id: {"result": current_node.id}}
            return update

        return handler


def test_executor_runs_linear_graph_and_returns_result() -> None:
    graph = workflow(
        [node("trigger", "trigger"), node("work", "retrieval"), node("expose", "expose", {"outputVariables": []})],
        [edge("trigger", "work"), edge("work", "expose")],
    )
    registry = FakeRegistry()

    result = GraphExecutor(GraphCompiler(registry)).execute(graph, {"question": "hello"})

    assert [step["node_id"] for step in result.trace_steps] == ["trigger", "work", "expose"]
    assert result.state["inputs"] == {"question": "hello"}


def test_condition_executes_only_selected_branch_without_deadlock() -> None:
    graph = workflow(
        [
            node("trigger", "trigger"),
            node(
                "condition",
                "condition",
                {"variable": "userinput.choose_true", "operator": "eq", "compareValue": True, "defaultBranch": "false"},
            ),
            node("yes", "retrieval"),
            node("no", "retrieval"),
            node("expose", "expose", {"outputVariables": []}),
        ],
        [
            edge("trigger", "condition"),
            edge("condition", "yes", "true"),
            edge("condition", "no", "false"),
            edge("yes", "expose"),
            edge("no", "expose"),
        ],
    )
    registry = FakeRegistry()

    result = GraphExecutor(GraphCompiler(registry)).execute(graph, {"choose_true": True})

    assert result.final_output["path"] == "yes"
    assert registry.calls["yes"] == 1
    assert registry.calls["no"] == 0
    assert registry.calls["expose"] == 1


def test_parallel_fanout_waits_for_both_predecessors_and_joins_once() -> None:
    graph = workflow(
        [
            node("trigger", "trigger"),
            node("left", "retrieval"),
            node("right", "retrieval"),
            node("join", "llm"),
            node("expose", "expose", {"outputVariables": []}),
        ],
        [edge("trigger", "left"), edge("trigger", "right"), edge("left", "join"), edge("right", "join"), edge("join", "expose")],
    )
    registry = FakeRegistry()

    result = GraphExecutor(GraphCompiler(registry)).execute(graph, {})

    assert {"left", "right"}.issubset(result.state["node_outputs"])
    assert registry.calls["join"] == 1
    assert registry.calls["expose"] == 1


def test_loop_runs_body_three_times_then_exits() -> None:
    graph = workflow(
        [
            node("trigger", "trigger"),
            node("loop", "loop", {"variable": "userinput.keep", "operator": "eq", "compareValue": True, "maxIterations": 3}),
            node("body", "retrieval"),
            node("expose", "expose", {"outputVariables": []}),
        ],
        [edge("trigger", "loop"), edge("loop", "body", "continue"), edge("body", "loop"), edge("loop", "expose", "exit")],
    )
    registry = FakeRegistry()

    result = GraphExecutor(GraphCompiler(registry), recursion_limit=30).execute(graph, {"keep": True})

    assert registry.calls["body"] == 3
    assert result.final_output["iterations"] == 3


def test_loop_with_maximum_iterations_has_sufficient_recursion_budget() -> None:
    graph = workflow(
        [
            node("trigger", "trigger"),
            node("loop", "loop", {"variable": "userinput.keep", "operator": "eq", "compareValue": True, "maxIterations": 100}),
            node("body", "retrieval"),
            node("expose", "expose", {"outputVariables": []}),
        ],
        [edge("trigger", "loop"), edge("loop", "body", "continue"), edge("body", "loop"), edge("loop", "expose", "exit")],
    )
    registry = FakeRegistry()

    result = GraphExecutor(GraphCompiler(registry), recursion_limit=10).execute(graph, {"keep": True})

    assert registry.calls["body"] == 100
    assert result.final_output["iterations"] == 100


def test_executor_exposes_failed_node_trace() -> None:
    class FailingKnowledge:
        def search(self, _query, knowledge_base_id=None, top_k=None, similarity_threshold=None, return_citations=None):
            raise RuntimeError("知识库超时")

    class EmptyModels:
        def get(self, _provider_id=None):
            return None

    class EmptyClient:
        pass

    real_registry = NodeRegistry(EmptyModels(), FailingKnowledge(), EmptyClient())
    graph = workflow(
        [node("trigger", "trigger"), node("search", "retrieval"), node("expose", "expose", {"outputVariables": []})],
        [edge("trigger", "search"), edge("search", "expose")],
    )

    with pytest.raises(WorkflowExecutionError) as caught:
        GraphExecutor(GraphCompiler(real_registry)).execute(graph, {"question": "退款"})

    assert caught.value.node_id == "search"
    assert caught.value.trace_steps[-1]["status"] == "failed"


def test_parallel_failure_preserves_failed_node_location() -> None:
    class SelectiveKnowledge:
        def search(self, query, knowledge_base_id=None, top_k=None, similarity_threshold=None, return_citations=None):
            if query == "fail":
                raise RuntimeError("并行检索失败")
            return {"matches": []}

    class EmptyModels:
        def get(self, _provider_id=None):
            return None

    real_registry = NodeRegistry(EmptyModels(), SelectiveKnowledge(), object())
    graph = workflow(
        [
            node("trigger", "trigger"),
            node("failed-search", "retrieval", {"queryVariable": "userinput.failed_query"}),
            node("safe-search", "retrieval", {"queryVariable": "userinput.safe_query"}),
            node("expose", "expose", {"outputVariables": []}),
        ],
        [
            edge("trigger", "failed-search"),
            edge("trigger", "safe-search"),
            edge("failed-search", "expose"),
            edge("safe-search", "expose"),
        ],
    )

    with pytest.raises(WorkflowExecutionError) as caught:
        GraphExecutor(GraphCompiler(real_registry)).execute(graph, {"failed_query": "fail", "safe_query": "ok"})

    assert caught.value.node_id == "failed-search"
    assert "并行检索失败" in caught.value.trace_steps[-1]["message"]
