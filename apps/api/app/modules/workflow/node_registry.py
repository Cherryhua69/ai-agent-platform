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


def _read_path(value: Any, path: list[str]) -> Any:
    current = value
    for part in path:
        if isinstance(current, dict):
            current = current.get(part)
        elif isinstance(current, list) and part.isdigit():
            index = int(part)
            current = current[index] if 0 <= index < len(current) else None
        else:
            return None
    return current


def resolve_variable(state: WorkflowState, reference: str | list[str]) -> Any:
    """解析输入变量或指定节点的输出变量。"""
    selector = reference.split(".") if isinstance(reference, str) else reference
    selector = [part for part in selector if isinstance(part, str) and part]
    if not selector:
        return None
    if len(selector) == 1:
        return state.get("inputs", {}).get(selector[0])
    source_id, *path = selector
    if source_id in {"trigger", "userinput", "input"}:
        return _read_path(state.get("inputs", {}), path)
    return _read_path(state.get("node_outputs", {}).get(source_id, {}), path)


def _serializable(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump(by_alias=True)
    return value


def _format_context_value(value: Any) -> str:
    if isinstance(value, dict) and isinstance(value.get("matches"), list):
        lines = ["检索结果："]
        for index, match in enumerate(value.get("matches", [])[:8], start=1):
            if not isinstance(match, dict):
                continue
            document_name = str(match.get("documentName") or match.get("document_name") or match.get("documentId") or "未知文档")
            position = match.get("position")
            score = match.get("score")
            content = str(match.get("content") or match.get("text") or "").strip()
            source = f"{document_name}"
            if position is not None:
                source += f" 第 {position} 段"
            score_text = f" 相似度 {score}" if score is not None else ""
            lines.append(f"{index}. 来源：{source}{score_text}")
            if content:
                lines.append(f"   内容：{content}")
        citations = value.get("citations")
        if isinstance(citations, list) and citations:
            citation_lines = []
            for citation in citations[:8]:
                if not isinstance(citation, dict):
                    continue
                document_name = str(citation.get("documentName") or citation.get("document_name") or citation.get("documentId") or "未知文档")
                position = citation.get("position")
                citation_lines.append(f"{document_name}{f' 第 {position} 段' if position is not None else ''}")
            if citation_lines:
                lines.append(f"引用来源：{'；'.join(citation_lines)}")
        return "\n".join(lines)
    return json.dumps(value, ensure_ascii=False, default=str)


def _read_optional_int(value: Any, minimum: int, maximum: int) -> int | None:
    if value is None or value == "":
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return min(maximum, max(minimum, parsed))


def _read_optional_float(value: Any, minimum: float, maximum: float) -> float | None:
    if value is None or value == "":
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return min(maximum, max(minimum, parsed))


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
            elif inputs.get("conversationHistory"):
                selected["conversationHistory"] = inputs["conversationHistory"]
            if inputs.get("modelProviderId"):
                selected["modelProviderId"] = inputs["modelProviderId"]
            return {"inputs": selected, "trace_steps": self._trace(node)}

        return handler

    def _retrieval(self, node: WorkflowNodeRead) -> NodeHandler:
        reference = str(node.config.get("queryVariable") or node.config.get("variable") or "")
        knowledge_base_id = str(node.config.get("knowledgeBaseId") or "").strip() or None
        top_k = _read_optional_int(node.config.get("topK"), minimum=1, maximum=50)
        similarity_threshold = _read_optional_float(node.config.get("similarityThreshold"), minimum=0.0, maximum=1.0)
        return_citations = node.config.get("returnCitations") if isinstance(node.config.get("returnCitations"), bool) else None

        def handler(state: WorkflowState) -> dict[str, Any]:
            query = resolve_variable(state, reference)
            result = _serializable(
                self._knowledge.search(
                    str(query or ""),
                    knowledge_base_id=knowledge_base_id,
                    top_k=top_k,
                    similarity_threshold=similarity_threshold,
                    return_citations=return_citations,
                )
            )
            return {
                "node_outputs": {node.id: {"result": result}},
                "trace_steps": self._trace(
                    node,
                    knowledge_base_id=knowledge_base_id,
                    top_k=top_k,
                    similarity_threshold=similarity_threshold,
                    return_citations=return_citations,
                ),
            }

        return handler

    def _llm(self, node: WorkflowNodeRead) -> NodeHandler:
        provider_id = node.config.get("modelProviderId")
        context_variables = node.config.get("contextVariables", [])
        system_prompt = str(node.config.get("systemPrompt", ""))
        user_prompt = str(node.config.get("userPrompt", ""))

        def handler(state: WorkflowState) -> dict[str, Any]:
            fallback_provider_id = state.get("inputs", {}).get("modelProviderId")
            selected_provider_id = provider_id or fallback_provider_id
            provider = self._model_providers.get(str(selected_provider_id) if selected_provider_id else None)
            if provider is None:
                raise RuntimeError(f"找不到模型提供商: {selected_provider_id or 'default'}")
            contexts: list[str] = []
            if isinstance(context_variables, list):
                for item in context_variables:
                    reference = str(item.get("value") or item.get("name")) if isinstance(item, dict) else str(item)
                    contexts.append(f"{reference}: {_format_context_value(resolve_variable(state, reference))}")
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
            conversation_history = str(state.get("inputs", {}).get("conversationHistory", ""))
            prompt = "\n\n".join(
                part for part in [system_prompt, conversation_history, "\n".join(contexts), rendered_user_prompt] if part
            )
            stream_sink = state.get("stream_sink")
            should_stream = callable(stream_sink) and node.id in state.get("stream_node_ids", set())
            if should_stream:
                chunks = []
                for chunk in self._model_client.stream(provider, prompt):
                    chunks.append(chunk)
                    stream_sink(chunk)
                content = "".join(chunks)
                reasoning_content = ""
                usage = {"latency_ms": 0, "cost_cny": 0.0}
            else:
                result = self._model_client.invoke(provider, prompt)
                content = str(getattr(result, "content", ""))
                reasoning_content = str(getattr(result, "reasoning_content", ""))
                usage = getattr(result, "usage", None)
                if usage is None:
                    usage = {"latency_ms": getattr(result, "latency_ms", 0), "cost_cny": getattr(result, "cost_cny", 0.0)}
            output = {
                "text": content,
                "reasoning_content": reasoning_content,
                "usage": usage,
            }
            return {"node_outputs": {node.id: output}, "trace_steps": self._trace(node)}

        return handler

    def _expose(self, node: WorkflowNodeRead) -> NodeHandler:
        outputs = node.config.get("outputVariables", [])

        def handler(state: WorkflowState) -> dict[str, Any]:
            final_output = {
                str(item["name"]): resolve_variable(
                    state,
                    item.get("valueSelector") if isinstance(item.get("valueSelector"), list) else str(item.get("value", "")),
                )
                for item in outputs
                if isinstance(item, dict)
                and item.get("name")
                and (item.get("value") or item.get("valueSelector"))
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
