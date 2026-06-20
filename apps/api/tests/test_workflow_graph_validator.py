import pytest

from app.modules.workflow.graph_types import merge_dicts, merge_lists
from app.modules.workflow.graph_validator import validate_workflow_graph
from app.modules.workflow.schemas import WorkflowEdgeRead, WorkflowNodeRead, WorkflowRead


def node(node_id: str, node_type: str, config: dict | None = None) -> WorkflowNodeRead:
    return WorkflowNodeRead(
        id=node_id,
        type=node_type,
        name=node_id,
        status="ready",
        config=config or {},
    )


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


def test_state_reducers_merge_parallel_updates() -> None:
    assert merge_dicts({"left": 1}, {"right": 2}) == {"left": 1, "right": 2}
    assert merge_lists(["left"], ["right"]) == ["left", "right"]


def test_validator_accepts_recursively_reachable_output_variable() -> None:
    graph = workflow(
        [
            node("trigger", "trigger", {"inputFields": [{"name": "question"}]}),
            node("llm", "llm"),
            node("expose", "expose", {"outputVariables": [{"name": "answer", "value": "trigger.question"}]}),
        ],
        [edge("trigger", "llm"), edge("llm", "expose")],
    )

    validate_workflow_graph(graph)


def test_validator_accepts_real_userinput_variable_contract() -> None:
    graph = workflow(
        [
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
            ),
            node("expose", "expose", {"outputVariables": [{"name": "question", "value": "userinput.question"}]}),
        ],
        [edge("node-trigger", "expose")],
    )

    validate_workflow_graph(graph)


def test_validator_rejects_condition_without_default_branch_edge() -> None:
    graph = workflow(
        [
            node("trigger", "trigger"),
            node("condition", "condition", {"variable": "userinput.value", "operator": "empty", "defaultBranch": "default"}),
            node("work", "retrieval"),
            node("expose", "expose", {"outputVariables": []}),
        ],
        [edge("trigger", "condition"), edge("condition", "work", "true"), edge("work", "expose")],
    )

    with pytest.raises(ValueError, match="defaultBranch.*出边"):
        validate_workflow_graph(graph)


def test_validator_rejects_condition_without_true_branch_edge() -> None:
    graph = workflow(
        [
            node("trigger", "trigger"),
            node("condition", "condition", {"variable": "userinput.value", "operator": "empty", "defaultBranch": "default"}),
            node("work", "retrieval"),
            node("expose", "expose", {"outputVariables": []}),
        ],
        [edge("trigger", "condition"), edge("condition", "work", "default"), edge("work", "expose")],
    )

    with pytest.raises(ValueError, match="true.*出边"):
        validate_workflow_graph(graph)


def test_validator_rejects_condition_edge_without_source_handle() -> None:
    graph = workflow(
        [
            node("trigger", "trigger"),
            node("condition", "condition", {"variable": "userinput.value", "operator": "empty", "defaultBranch": "default"}),
            node("expose", "expose", {"outputVariables": []}),
        ],
        [edge("trigger", "condition"), edge("condition", "expose")],
    )

    with pytest.raises(ValueError, match="sourceHandle"):
        validate_workflow_graph(graph)


@pytest.mark.parametrize(
    "config",
    [
        {"variable": "", "operator": "eq", "compareValue": "x", "defaultBranch": "default"},
        {"variable": "userinput.value", "operator": "unknown", "compareValue": "x", "defaultBranch": "default"},
        {"variable": "userinput.value", "operator": "eq", "compareValue": "", "defaultBranch": "default"},
    ],
)
def test_validator_rejects_invalid_condition_expression(config: dict) -> None:
    graph = workflow(
        [node("trigger", "trigger"), node("condition", "condition", config), node("expose", "expose", {"outputVariables": []})],
        [edge("trigger", "condition"), edge("condition", "expose", "true"), edge("condition", "expose", "default")],
    )

    with pytest.raises(ValueError, match="条件表达式"):
        validate_workflow_graph(graph)


def test_validator_requires_loop_continue_and_exit_edges() -> None:
    graph = workflow(
        [
            node(
                "loop",
                "loop",
                {"variable": "userinput.keep", "operator": "not_empty", "compareValue": "", "maxIterations": 3},
            ),
            node("trigger", "trigger"),
            node("expose", "expose", {"outputVariables": []}),
        ],
        [edge("trigger", "loop"), edge("loop", "expose", "exit")],
    )

    with pytest.raises(ValueError, match="continue.*exit"):
        validate_workflow_graph(graph)


def test_validator_rejects_condition_handle_expanding_to_multiple_targets_through_comment() -> None:
    graph = workflow(
        [
            node("trigger", "trigger"),
            node(
                "condition",
                "condition",
                {"variable": "userinput.value", "operator": "empty", "defaultBranch": "default"},
            ),
            node("comment", "comment"),
            node("left", "retrieval"),
            node("right", "retrieval"),
            node("expose", "expose", {"outputVariables": []}),
        ],
        [
            edge("trigger", "condition"),
            edge("condition", "comment", "true"),
            edge("comment", "left"),
            edge("comment", "right"),
            edge("condition", "expose", "default"),
            edge("left", "expose"),
            edge("right", "expose"),
        ],
    )

    with pytest.raises(ValueError, match="一个直接有效目标.*普通节点"):
        validate_workflow_graph(graph)


def test_validator_rejects_output_variable_not_reachable_from_expose() -> None:
    graph = workflow(
        [
            node("trigger", "trigger", {"inputFields": [{"name": "question"}]}),
            node("orphan", "llm"),
            node("expose", "expose", {"outputVariables": [{"name": "answer", "value": "orphan.text"}]}),
        ],
        [edge("trigger", "expose")],
    )

    with pytest.raises(ValueError, match="不可达"):
        validate_workflow_graph(graph)


def test_validator_accepts_structured_nested_output_selector() -> None:
    graph = workflow(
        [
            node("trigger", "trigger"),
            node("answer", "llm"),
            node(
                "expose",
                "expose",
                {
                    "outputVariables": [
                        {
                            "name": "tokens",
                            "valueSelector": ["answer", "usage", "total_tokens"],
                            "valueType": "Number",
                        }
                    ]
                },
            ),
        ],
        [edge("trigger", "answer"), edge("answer", "expose")],
    )

    validate_workflow_graph(graph)


@pytest.mark.parametrize(
    "output",
    [
        {"name": "bad name", "valueSelector": ["answer", "text"]},
        {"name": "answer", "valueSelector": ["answer"]},
        {"name": "answer", "valueSelector": "answer.text"},
        {"name": "answer", "valueSelector": ["answer", "text"], "valueType": "Mystery"},
    ],
)
def test_validator_rejects_invalid_structured_output(output: dict[str, object]) -> None:
    graph = workflow(
        [
            node("trigger", "trigger"),
            node("answer", "llm"),
            node("expose", "expose", {"outputVariables": [output]}),
        ],
        [edge("trigger", "answer"), edge("answer", "expose")],
    )

    with pytest.raises(ValueError, match="输出变量"):
        validate_workflow_graph(graph)


@pytest.mark.parametrize(
    ("bad_node", "message"),
    [
        (node("condition", "condition", {}), "defaultBranch"),
        (node("loop", "loop", {"maxIterations": 0}), "maxIterations"),
        (node("loop", "loop", {"maxIterations": 101}), "maxIterations"),
        (node("unknown", "python"), "不支持"),
    ],
)
def test_validator_rejects_invalid_node_config(bad_node: WorkflowNodeRead, message: str) -> None:
    graph = workflow(
        [node("trigger", "trigger"), bad_node, node("expose", "expose", {"outputVariables": []})],
        [edge("trigger", bad_node.id), edge(bad_node.id, "expose")],
    )

    with pytest.raises(ValueError, match=message):
        validate_workflow_graph(graph)


def test_validator_rejects_duplicate_or_incomplete_output_names() -> None:
    graph = workflow(
        [
            node("trigger", "trigger", {"inputFields": [{"name": "question"}]}),
            node(
                "expose",
                "expose",
                {"outputVariables": [{"name": "answer", "value": "trigger.question"}, {"name": "answer", "value": ""}]},
            ),
        ],
        [edge("trigger", "expose")],
    )

    with pytest.raises(ValueError, match="输出变量"):
        validate_workflow_graph(graph)
