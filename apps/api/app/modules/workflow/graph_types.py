from dataclasses import dataclass
from typing import Annotated, Any, TypedDict


def merge_dicts(left: dict[str, Any], right: dict[str, Any]) -> dict[str, Any]:
    """合并并行节点产生的字典状态。"""
    return {**left, **right}


def merge_lists(left: list[Any], right: list[Any]) -> list[Any]:
    """按到达顺序合并并行节点产生的列表状态。"""
    return [*left, *right]


class WorkflowState(TypedDict, total=False):
    inputs: dict[str, Any]
    node_outputs: Annotated[dict[str, dict[str, Any]], merge_dicts]
    final_output: dict[str, Any]
    trace_steps: Annotated[list[dict[str, Any]], merge_lists]
    route_decisions: Annotated[dict[str, str], merge_dicts]
    iteration_counts: Annotated[dict[str, int], merge_dicts]


class WorkflowGraphValidationError(ValueError):
    """工作流图不符合可执行契约。"""


class WorkflowNodeExecutionError(RuntimeError):
    def __init__(self, node_id: str, node_name: str, failed_trace: dict[str, Any], cause: Exception) -> None:
        self.node_id = node_id
        self.node_name = node_name
        self.failed_trace = failed_trace
        self.cause = cause
        super().__init__(f"节点 {node_name} ({node_id}) 执行失败: {cause}")


class WorkflowExecutionError(RuntimeError):
    def __init__(self, error: WorkflowNodeExecutionError) -> None:
        self.node_id = error.node_id
        self.node_name = error.node_name
        self.trace_steps = [error.failed_trace]
        self.cause = error.cause
        super().__init__(str(error))


@dataclass(frozen=True)
class WorkflowExecutionResult:
    final_output: dict[str, Any]
    trace_steps: list[dict[str, Any]]
    state: WorkflowState
