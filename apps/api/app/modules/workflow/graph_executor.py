from app.modules.workflow.graph_compiler import GraphCompiler
from app.modules.workflow.graph_types import (
    WorkflowExecutionError,
    WorkflowExecutionResult,
    WorkflowNodeExecutionError,
    WorkflowState,
)
from app.modules.workflow.graph_validator import validate_workflow_graph
from app.modules.workflow.schemas import WorkflowRead


class GraphExecutor:
    def __init__(self, compiler: GraphCompiler, recursion_limit: int = 100) -> None:
        self._compiler = compiler
        self._recursion_limit = recursion_limit

    def execute(self, workflow: WorkflowRead, inputs: dict[str, object]) -> WorkflowExecutionResult:
        """校验、编译并执行工作流。"""
        validate_workflow_graph(workflow)
        graph = self._compiler.compile(workflow)
        initial_state: WorkflowState = {
            "inputs": inputs,
            "node_outputs": {},
            "final_output": {},
            "trace_steps": [],
            "route_decisions": {},
            "iteration_counts": {},
        }
        loop_budget = sum(
            int(node.config.get("maxIterations", 0)) * (len(workflow.nodes) + 2)
            for node in workflow.nodes
            if node.type == "loop"
        )
        recursion_limit = max(self._recursion_limit, 10 + loop_budget)
        try:
            state = graph.invoke(initial_state, config={"recursion_limit": recursion_limit})
        except WorkflowNodeExecutionError as exc:
            raise WorkflowExecutionError(exc) from exc
        return WorkflowExecutionResult(
            final_output=state.get("final_output", {}),
            trace_steps=state.get("trace_steps", []),
            state=state,
        )
