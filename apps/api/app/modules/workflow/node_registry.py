from __future__ import annotations

import json
import re
from collections.abc import Callable
from typing import TYPE_CHECKING, Any

from app.modules.workflow.graph_types import WorkflowNodeExecutionError, WorkflowState
from app.modules.workflow.schemas import WorkflowNodeRead

if TYPE_CHECKING:
    from app.modules.knowledge.repository import KnowledgeRepository
    from app.modules.model_provider.repository import ModelProviderRepository
    from app.modules.model_provider.service import LangChainModelClient


NodeHandler = Callable[[WorkflowState], dict[str, Any]]


def resolve_variable(state: WorkflowState, reference: str) -> Any:
    """解析输入变量或指定节点的输出变量。"""
    if "." not in reference:
        return state.get("inputs", {}).get(reference)
    node_id, variable = reference.split(".", 1)
    if node_id in {"trigger", "userinput", "input"}:
        return state.get("inputs", {}).get(variable)
    return state.get("node_outputs", {}).get(node_id, {}).get(variable)


def _serializable(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump(by_alias=True)
    return value


def _render_prompt(template: str, state: WorkflowState) -> str:
    def replace(match: re.Match[str]) -> str:
        reference = match.group(1).strip()
        value = resolve_variable(state, reference)
        return match.group(0) if value is None else str(value)

    return re.sub(r"\{\{\s*([^{}]+?)\s*\}\}", replace, template)


def _compare(actual: Any, operator: str, expected: Any) -> bool:
    if isinstance(actual, (int, float)) and isinstance(expected, str):
        try:
            expected = float(expected)
        except ValueError:
            pass
    operations: dict[str, Callable[[Any, Any], bool]] = {
        "eq": lambda left, right: left == right,
        "equals": lambda left, right: left == right,
        "neq": lambda left, right: left != right,
        "notEquals": lambda left, right: left != right,
        "not_equals": lambda left, right: left != right,
        "contains": lambda left, right: right in left,
        "greaterThan": lambda left, right: left > right,
        "gt": lambda left, right: left > right,
        "greaterThanOrEqual": lambda left, right: left >= right,
        "gte": lambda left, right: left >= right,
        "lessThan": lambda left, right: left < right,
        "lt": lambda left, right: left < right,
        "lessThanOrEqual": lambda left, right: left <= right,
        "lte": lambda left, right: left <= right,
    }
    if operator == "empty":
        return actual is None or actual == "" or actual == [] or actual == {}
    if operator == "not_empty":
        return not (actual is None or actual == "" or actual == [] or actual == {})
    if operator == "truthy":
        return bool(actual)
    operation = operations.get(operator)
    if operation is None or actual is None:
        return False
    return operation(actual, expected)


class NodeRegistry:
    def __init__(
        self,
        model_provider_repository: ModelProviderRepository,
        knowledge_repository: KnowledgeRepository,
        model_client: LangChainModelClient,
    ) -> None:
        self._model_providers = model_provider_repository
        self._knowledge = knowledge_repository
        self._model_client = model_client

    def build_handler(self, node: WorkflowNodeRead) -> NodeHandler:
        builders: dict[str, Callable[[WorkflowNodeRead], NodeHandler]] = {
            "trigger": self._trigger,
            "retrieval": self._retrieval,
            "llm": self._llm,
            "expose": self._expose,
            "condition": self._condition,
            "loop": self._loop,
        }
        try:
            handler = builders[node.type](node)
        except KeyError as exc:
            raise ValueError(f"不支持构建节点处理器: {node.type}") from exc

        def guarded_handler(state: WorkflowState) -> dict[str, Any]:
            try:
                return handler(state)
            except WorkflowNodeExecutionError:
                raise
            except Exception as exc:
                failed_trace = self._trace(node, status="failed", message=str(exc))[0]
                raise WorkflowNodeExecutionError(node.id, node.name, failed_trace, exc) from exc

        return guarded_handler

    def _trace(self, node: WorkflowNodeRead, **details: Any) -> list[dict[str, Any]]:
        return [{"node_id": node.id, "node_type": node.type, **details}]

    def _trigger(self, node: WorkflowNodeRead) -> NodeHandler:
        fields = node.config.get("inputFields", [])
        references = [
            str(field.get("variable") or field.get("name"))
            for field in fields
            if isinstance(field, dict) and (field.get("variable") or field.get("name"))
        ] if isinstance(fields, list) else []

        def handler(state: WorkflowState) -> dict[str, Any]:
            inputs = state.get("inputs", {})
            selected = {}
            for reference in references:
                name = reference.split(".", 1)[1] if reference.startswith("userinput.") else reference
                selected[name] = inputs.get(reference, inputs.get(name))
            if not references:
                selected = dict(inputs)
            return {"inputs": selected, "trace_steps": self._trace(node)}

        return handler

    def _retrieval(self, node: WorkflowNodeRead) -> NodeHandler:
        reference = str(node.config.get("queryVariable") or node.config.get("variable") or "")

        def handler(state: WorkflowState) -> dict[str, Any]:
            query = resolve_variable(state, reference)
            result = _serializable(self._knowledge.search(str(query or "")))
            return {"node_outputs": {node.id: {"result": result}}, "trace_steps": self._trace(node)}

        return handler

    def _llm(self, node: WorkflowNodeRead) -> NodeHandler:
        provider_id = node.config.get("modelProviderId")
        context_variables = node.config.get("contextVariables", [])
        system_prompt = str(node.config.get("systemPrompt", ""))
        user_prompt = str(node.config.get("userPrompt", ""))

        def handler(state: WorkflowState) -> dict[str, Any]:
            provider = self._model_providers.get(str(provider_id) if provider_id else None)
            if provider is None:
                raise RuntimeError(f"找不到模型提供商: {provider_id or 'default'}")
            contexts: list[str] = []
            if isinstance(context_variables, list):
                for item in context_variables:
                    reference = str(item.get("value") or item.get("name")) if isinstance(item, dict) else str(item)
                    contexts.append(f"{reference}: {json.dumps(resolve_variable(state, reference), ensure_ascii=False, default=str)}")
            rendered_user_prompt = _render_prompt(user_prompt, state)
            if not rendered_user_prompt.strip():
                rendered_user_prompt = next(
                    (
                        value.strip()
                        for value in state.get("inputs", {}).values()
                        if isinstance(value, str) and value.strip()
                    ),
                    "",
                )
            prompt = "\n\n".join(part for part in [system_prompt, "\n".join(contexts), rendered_user_prompt] if part)
            result = self._model_client.invoke(provider, prompt)
            usage = getattr(result, "usage", None)
            if usage is None:
                usage = {"latency_ms": getattr(result, "latency_ms", 0), "cost_cny": getattr(result, "cost_cny", 0.0)}
            output = {
                "text": str(getattr(result, "content", "")),
                "reasoning_content": str(getattr(result, "reasoning_content", "")),
                "usage": usage,
            }
            return {"node_outputs": {node.id: output}, "trace_steps": self._trace(node)}

        return handler

    def _expose(self, node: WorkflowNodeRead) -> NodeHandler:
        outputs = node.config.get("outputVariables", [])

        def handler(state: WorkflowState) -> dict[str, Any]:
            final_output = {
                str(item["name"]): resolve_variable(state, str(item["value"]))
                for item in outputs
                if isinstance(item, dict) and item.get("name") and item.get("value")
            }
            return {"final_output": final_output, "trace_steps": self._trace(node)}

        return handler

    def _condition(self, node: WorkflowNodeRead) -> NodeHandler:
        reference = str(node.config.get("variable", ""))
        operator = str(node.config.get("operator", "equals"))
        expected = node.config.get("compareValue")
        default_branch = str(node.config.get("defaultBranch", "false"))

        def handler(state: WorkflowState) -> dict[str, Any]:
            decision = "true" if _compare(resolve_variable(state, reference), operator, expected) else default_branch
            return {"route_decisions": {node.id: decision}, "trace_steps": self._trace(node, route=decision)}

        return handler

    def _loop(self, node: WorkflowNodeRead) -> NodeHandler:
        reference = str(node.config.get("variable", ""))
        operator = str(node.config.get("operator", ""))
        expected = node.config.get("compareValue")
        maximum = int(node.config.get("maxIterations", 1))

        def handler(state: WorkflowState) -> dict[str, Any]:
            current = state.get("iteration_counts", {}).get(node.id, 0)
            condition_matches = _compare(resolve_variable(state, reference), operator, expected)
            decision = "continue" if condition_matches and current < maximum else "exit"
            count = current + 1 if decision == "continue" else current
            trace_details: dict[str, Any] = {"route": decision, "iteration": count}
            if current >= maximum:
                trace_details.update(status="warning", message=f"达到最大迭代次数 {maximum}，已强制退出")
            return {
                "iteration_counts": {node.id: count},
                "route_decisions": {node.id: decision},
                "trace_steps": self._trace(node, **trace_details),
            }

        return handler
