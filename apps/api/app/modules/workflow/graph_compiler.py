from collections import defaultdict
from typing import Protocol, cast

from langgraph.graph import START, StateGraph

from app.modules.workflow.graph_types import WorkflowState
from app.modules.workflow.node_registry import NodeRegistry
from app.modules.workflow.schemas import WorkflowEdgeRead, WorkflowRead


class CompiledWorkflowGraph(Protocol):
    def invoke(self, input: WorkflowState, config: dict[str, object] | None = None) -> WorkflowState: ...


class GraphCompiler:
    def __init__(self, registry: NodeRegistry) -> None:
        self._registry = registry

    def _effective_edges(self, workflow: WorkflowRead) -> list[WorkflowEdgeRead]:
        nodes = {node.id: node for node in workflow.nodes}
        outgoing: dict[str, list[WorkflowEdgeRead]] = defaultdict(list)
        for current_edge in workflow.edges:
            outgoing[current_edge.source].append(current_edge)

        effective: list[WorkflowEdgeRead] = []
        for source in (node for node in workflow.nodes if node.type != "comment"):
            pending = [(item, set()) for item in outgoing.get(source.id, [])]
            while pending:
                current_edge, visited = pending.pop()
                target = nodes[current_edge.target]
                if target.type != "comment":
                    effective.append(current_edge)
                    continue
                if target.id in visited:
                    continue
                next_visited = {*visited, target.id}
                for next_edge in outgoing.get(target.id, []):
                    pending.append(
                        (
                            WorkflowEdgeRead(
                                id=f"{current_edge.id}:{next_edge.id}",
                                source=source.id,
                                target=next_edge.target,
                                sourceHandle=current_edge.source_handle,
                                targetHandle=next_edge.target_handle,
                            ),
                            next_visited,
                        )
                    )
        return effective

    @staticmethod
    def _is_mutually_exclusive(
        sources: list[str],
        routing_nodes: set[str],
        outgoing: dict[str, list[WorkflowEdgeRead]],
    ) -> bool:
        def reachable(start: str, destination: str) -> bool:
            pending = [start]
            visited: set[str] = set()
            while pending:
                current = pending.pop()
                if current == destination:
                    return True
                if current in visited:
                    continue
                visited.add(current)
                pending.extend(edge.target for edge in outgoing.get(current, []))
            return False

        for routing_node in routing_nodes:
            branch_targets = outgoing.get(routing_node, [])
            source_branches = [
                {edge.source_handle for edge in branch_targets if reachable(edge.target, source)}
                for source in sources
            ]
            if all(branches for branches in source_branches):
                common = set.intersection(*source_branches)
                if not common:
                    return True
        return False

    def compile(self, workflow: WorkflowRead) -> CompiledWorkflowGraph:
        """把已校验的持久化图编译为 LangGraph。"""
        executable_nodes = {node.id: node for node in workflow.nodes if node.type != "comment"}
        edges = self._effective_edges(workflow)
        outgoing: dict[str, list[WorkflowEdgeRead]] = defaultdict(list)
        incoming: dict[str, list[str]] = defaultdict(list)
        for current_edge in edges:
            outgoing[current_edge.source].append(current_edge)
            incoming[current_edge.target].append(current_edge.source)

        graph = StateGraph(WorkflowState)
        for node in executable_nodes.values():
            graph.add_node(node.id, self._registry.build_handler(node))

        trigger = next(node for node in executable_nodes.values() if node.type == "trigger")
        graph.add_edge(START, trigger.id)

        routing_nodes = {node.id for node in executable_nodes.values() if node.type in {"condition", "loop"}}
        joined_targets: set[str] = set()
        for target, raw_sources in incoming.items():
            sources = list(dict.fromkeys(raw_sources))
            if len(sources) < 2 or target == trigger.id or target in routing_nodes:
                continue
            if not self._is_mutually_exclusive(sources, routing_nodes, outgoing):
                graph.add_edge(sources, target)
                joined_targets.add(target)

        for source, source_edges in outgoing.items():
            if source in routing_nodes:
                path_map = {
                    str(current_edge.source_handle): current_edge.target
                    for current_edge in source_edges
                    if current_edge.source_handle is not None
                }

                def route(state: WorkflowState, node_id: str = source) -> str:
                    return state.get("route_decisions", {}).get(node_id, "")

                graph.add_conditional_edges(source, route, path_map)
                continue
            for current_edge in source_edges:
                if current_edge.target == trigger.id or current_edge.target in joined_targets:
                    continue
                graph.add_edge(source, current_edge.target)

        return cast(CompiledWorkflowGraph, graph.compile())
