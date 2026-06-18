from collections import defaultdict

from app.modules.workflow.graph_types import WorkflowGraphValidationError
from app.modules.workflow.schemas import WorkflowEdgeRead, WorkflowNodeRead, WorkflowRead


SUPPORTED_NODE_TYPES = {"trigger", "retrieval", "llm", "expose", "condition", "loop", "comment"}
SUPPORTED_OPERATORS = {"eq", "neq", "contains", "gt", "lt", "empty", "not_empty"}
COMPARISON_OPERATORS = {"eq", "neq", "contains", "gt", "lt"}
NODE_OUTPUTS = {
    "retrieval": {"result"},
    "llm": {"text", "reasoning_content", "usage"},
}


def _declared_variables(node: WorkflowNodeRead) -> set[str]:
    if node.type == "trigger":
        fields = node.config.get("inputFields", [])
        if not isinstance(fields, list):
            return set()
        declared: set[str] = set()
        for field in fields:
            if not isinstance(field, dict):
                continue
            reference = str(field.get("variable") or field.get("name") or "").strip()
            if reference:
                declared.add(reference.split(".", 1)[1] if reference.startswith("userinput.") else reference)
        return declared
    return NODE_OUTPUTS.get(node.type, set())


def _ancestors(node_id: str, incoming: dict[str, set[str]]) -> set[str]:
    visited: set[str] = set()
    pending = list(incoming.get(node_id, set()))
    while pending:
        current = pending.pop()
        if current in visited:
            continue
        visited.add(current)
        pending.extend(incoming.get(current, set()) - visited)
    return visited


def _validate_output_variables(expose: WorkflowNodeRead, nodes: dict[str, WorkflowNodeRead], incoming: dict[str, set[str]]) -> None:
    outputs = expose.config.get("outputVariables", [])
    if not isinstance(outputs, list):
        raise WorkflowGraphValidationError("输出变量必须是列表")
    names: set[str] = set()
    ancestors = _ancestors(expose.id, incoming)
    trigger_ids = {node_id for node_id in ancestors if nodes[node_id].type == "trigger"}
    for output in outputs:
        if not isinstance(output, dict):
            raise WorkflowGraphValidationError("输出变量 name/value 必填")
        name = str(output.get("name", "")).strip()
        value = str(output.get("value", "")).strip()
        if not name or not value:
            raise WorkflowGraphValidationError("输出变量 name/value 必填")
        if name in names:
            raise WorkflowGraphValidationError(f"输出变量名称重复: {name}")
        names.add(name)

        if "." in value:
            source_id, variable = value.split(".", 1)
            if source_id == "userinput":
                valid = any(variable in _declared_variables(nodes[trigger_id]) for trigger_id in trigger_ids)
            else:
                valid = source_id in ancestors and variable in _declared_variables(nodes[source_id])
        else:
            valid = any(value in _declared_variables(nodes[trigger_id]) for trigger_id in trigger_ids)
        if not valid:
            raise WorkflowGraphValidationError(f"输出变量引用不可达或未声明: {value}")


def _validate_expression(node: WorkflowNodeRead) -> None:
    variable = str(node.config.get("variable", "")).strip()
    operator = str(node.config.get("operator", "")).strip()
    if not variable or operator not in SUPPORTED_OPERATORS:
        raise WorkflowGraphValidationError(f"节点 {node.id} 的条件表达式 variable/operator 非法")
    compare_value = node.config.get("compareValue")
    if operator in COMPARISON_OPERATORS and (compare_value is None or compare_value == ""):
        raise WorkflowGraphValidationError(f"节点 {node.id} 的条件表达式缺少 compareValue")


def _effective_targets(
    target: str,
    nodes: dict[str, WorkflowNodeRead],
    outgoing_edges: dict[str, list[WorkflowEdgeRead]],
    visited: set[str] | None = None,
) -> set[str]:
    if nodes[target].type != "comment":
        return {target}
    visited = set() if visited is None else visited
    if target in visited:
        return set()
    visited.add(target)
    targets: set[str] = set()
    for edge in outgoing_edges.get(target, []):
        targets.update(_effective_targets(edge.target, nodes, outgoing_edges, set(visited)))
    return targets


def _validate_routing_edges(
    node: WorkflowNodeRead,
    nodes: dict[str, WorkflowNodeRead],
    outgoing_edges: dict[str, list[WorkflowEdgeRead]],
) -> set[str]:
    routing_edges = outgoing_edges.get(node.id, [])
    if any(not edge.source_handle for edge in routing_edges):
        raise WorkflowGraphValidationError(f"路由节点 {node.id} 的所有出边必须配置 sourceHandle")
    handles = [str(edge.source_handle) for edge in routing_edges]
    if len(handles) != len(set(handles)):
        raise WorkflowGraphValidationError(
            f"路由节点 {node.id} 的 sourceHandle 必须唯一；请先连接一个普通节点，再从该节点并行扇出"
        )
    for edge in routing_edges:
        effective_targets = _effective_targets(edge.target, nodes, outgoing_edges)
        if len(effective_targets) != 1:
            raise WorkflowGraphValidationError(
                f"路由节点 {node.id} 的每个 sourceHandle 只能有一个直接有效目标；请先连接一个普通节点，再从该节点并行扇出"
            )
    return set(handles)


def validate_workflow_graph(workflow: WorkflowRead) -> None:
    """校验持久化工作流是否满足编译前约束。"""
    nodes = {node.id: node for node in workflow.nodes}
    if len(nodes) != len(workflow.nodes):
        raise WorkflowGraphValidationError("节点 ID 必须唯一")

    unsupported = [node.type for node in workflow.nodes if node.type not in SUPPORTED_NODE_TYPES]
    if unsupported:
        raise WorkflowGraphValidationError(f"不支持的节点类型: {unsupported[0]}")

    triggers = [node for node in workflow.nodes if node.type == "trigger"]
    exposes = [node for node in workflow.nodes if node.type == "expose"]
    if len(triggers) != 1:
        raise WorkflowGraphValidationError("工作流必须恰好包含一个 trigger")
    if len(exposes) != 1:
        raise WorkflowGraphValidationError("工作流必须恰好包含一个 expose")

    incoming: dict[str, set[str]] = defaultdict(set)
    outgoing: dict[str, set[str]] = defaultdict(set)
    outgoing_edges: dict[str, list[WorkflowEdgeRead]] = defaultdict(list)
    for edge in workflow.edges:
        if edge.source not in nodes or edge.target not in nodes:
            raise WorkflowGraphValidationError(f"边引用不存在的节点: {edge.id}")
        incoming[edge.target].add(edge.source)
        outgoing[edge.source].add(edge.target)
        outgoing_edges[edge.source].append(edge)
    if outgoing.get(exposes[0].id):
        raise WorkflowGraphValidationError("expose 节点不能有出边")

    for node in workflow.nodes:
        if node.type == "condition" and not str(node.config.get("defaultBranch", "")).strip():
            raise WorkflowGraphValidationError(f"条件节点 {node.id} 缺少 defaultBranch")
        if node.type == "condition":
            _validate_expression(node)
            handles = _validate_routing_edges(node, nodes, outgoing_edges)
            if "true" not in handles:
                raise WorkflowGraphValidationError(f"条件节点 {node.id} 的 true 分支没有对应出边")
            default_branch = str(node.config.get("defaultBranch", ""))
            if default_branch not in handles:
                raise WorkflowGraphValidationError(f"条件节点 {node.id} 的 defaultBranch 没有对应出边")
        if node.type == "loop":
            maximum = node.config.get("maxIterations")
            if not isinstance(maximum, int) or isinstance(maximum, bool) or not 1 <= maximum <= 100:
                raise WorkflowGraphValidationError(f"循环节点 {node.id} 的 maxIterations 必须在 1..100")
            _validate_expression(node)
            handles = _validate_routing_edges(node, nodes, outgoing_edges)
            if not {"continue", "exit"}.issubset(handles):
                raise WorkflowGraphValidationError(f"循环节点 {node.id} 必须同时包含 continue 和 exit 出边")

    _validate_output_variables(exposes[0], nodes, incoming)
