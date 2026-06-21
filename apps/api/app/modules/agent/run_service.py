import json
from collections.abc import Callable, Iterator
from queue import Queue
from threading import Thread
from uuid import uuid4

from app.modules.agent.schemas import AgentRunRequest
from app.modules.knowledge.repository import KnowledgeRepository
from app.modules.model_provider.repository import ModelProviderRepository
from app.modules.model_provider.service import LangChainModelClient, ModelInvocationResult
from app.modules.trace.repository import TraceRepository
from app.modules.trace.schemas import RunTraceCreate, RunTraceRead, TraceStepCreate
from app.modules.workflow.graph_executor import GraphExecutor
from app.modules.workflow.graph_types import WorkflowExecutionError
from app.modules.workflow.repository import WorkflowRepository
from app.modules.workflow.schemas import WorkflowRead


class AgentRunService:
    MAX_CONVERSATION_HISTORY_CHARS = 3000
    MAX_CONVERSATION_MESSAGE_CHARS = 2000

    def __init__(
        self,
        traces: TraceRepository,
        model_providers: ModelProviderRepository | None = None,
        knowledge: KnowledgeRepository | None = None,
        model_client: LangChainModelClient | None = None,
        workflows: WorkflowRepository | None = None,
        graph_executor: GraphExecutor | None = None,
    ) -> None:
        self._traces = traces
        self._model_providers = model_providers
        self._knowledge = knowledge
        self._model_client = model_client or LangChainModelClient()
        self._workflows = workflows
        self._graph_executor = graph_executor

    def simulate_run(
        self,
        agent_id: str,
        request: AgentRunRequest | None = None,
        stream_sink: Callable[[str], None] | None = None,
        stream_node_ids: set[str] | None = None,
    ) -> RunTraceRead:
        request = request or AgentRunRequest()
        run_id = f"run_{uuid4().hex[:8]}"
        workflow = self._workflows.get_by_agent_id(agent_id) if self._workflows else None
        if workflow is not None and self._graph_executor is not None and self._is_graph_configured(workflow):
            return self._run_graph(run_id, agent_id, request, workflow, stream_sink, stream_node_ids)

        provider = self._model_providers.get(request.model_provider_id) if self._model_providers else None
        knowledge_ids = request.knowledge_base_ids or ["kb-after-sale"]

        if provider is None:
            return self._traces.create_run(
                RunTraceCreate(
                    id=run_id,
                    agentId=agent_id,
                    status="failed",
                    costCny=0.0,
                    finalOutput="Model provider is not configured.",
                    steps=[
                        TraceStepCreate(
                            id=f"{run_id}_input",
                            type="trigger",
                            title="User input",
                            status="success",
                            latencyMs=18,
                            inputSummary=request.user_input,
                        ),
                        TraceStepCreate(
                            id=f"{run_id}_model_missing",
                            type="llm",
                            title="Model provider lookup",
                            status="failed",
                            latencyMs=1,
                            errorMessage="Model provider is not configured.",
                        ),
                    ],
                )
            )

        retrieval_summary = self._build_retrieval_summary(request.user_input, knowledge_ids)
        conversation_history = self._conversation_history_text(request)
        prompt_parts = ["You are an enterprise after-sale agent."]
        if conversation_history:
            prompt_parts.append(conversation_history)
        prompt_parts.extend(
            [
                f"User request: {request.user_input}",
                f"Knowledge context: {retrieval_summary}",
                "Return a concise final answer with the policy basis.",
            ]
        )
        prompt = "\n".join(prompt_parts)
        if stream_sink is not None:
            chunks = []
            for chunk in self._model_client.stream(provider, prompt):
                chunks.append(chunk)
                stream_sink(chunk)
            result = ModelInvocationResult(content="".join(chunks), latency_ms=0, cost_cny=0.0)
        else:
            result = self._model_client.invoke(provider, prompt)

        return self._traces.create_run(
            RunTraceCreate(
                id=run_id,
                agentId=agent_id,
                status="success",
                costCny=result.cost_cny,
                finalOutput=result.content,
                steps=[
                    TraceStepCreate(
                        id=f"{run_id}_input",
                        type="trigger",
                        title="User input",
                        status="success",
                        latencyMs=18,
                        inputSummary=request.user_input,
                    ),
                    TraceStepCreate(
                        id=f"{run_id}_retrieval",
                        type="retrieval",
                        title="Knowledge retrieval",
                        status="success",
                        latencyMs=320,
                        outputSummary=retrieval_summary,
                    ),
                    TraceStepCreate(
                        id=f"{run_id}_llm",
                        type="llm",
                        title="LangChain model call",
                        status="success",
                        latencyMs=result.latency_ms,
                        inputSummary=f"provider={provider.id}; model={provider.model_name}",
                        outputSummary=result.content[:500],
                    ),
                ],
            )
        )

    @staticmethod
    def _is_graph_configured(workflow: WorkflowRead) -> bool:
        return any(node.type == "expose" and isinstance(node.config.get("outputVariables"), list) for node in workflow.nodes)

    @staticmethod
    def _stream_output_node_ids(workflow: WorkflowRead | None) -> set[str]:
        if workflow is None:
            return set()
        node_ids: set[str] = set()
        for node in workflow.nodes:
            if node.type != "expose":
                continue
            outputs = node.config.get("outputVariables", [])
            if not isinstance(outputs, list):
                continue
            for output in outputs:
                if not isinstance(output, dict):
                    continue
                selector = output.get("valueSelector")
                if isinstance(selector, list) and len(selector) >= 2:
                    if selector[1] == "text" and isinstance(selector[0], str):
                        node_ids.add(selector[0])
                    continue
                reference = str(output.get("value", ""))
                if reference.endswith(".text"):
                    node_ids.add(reference.rsplit(".", 1)[0])
        if node_ids:
            return node_ids
        llm_nodes = [node.id for node in workflow.nodes if node.type == "llm"]
        return {llm_nodes[-1]} if llm_nodes else set()

    def stream_run(self, agent_id: str, request: AgentRunRequest | None = None) -> Iterator[str]:
        request = request or AgentRunRequest()
        events: Queue[tuple[str, object]] = Queue()
        workflow = self._workflows.get_by_agent_id(agent_id) if self._workflows else None

        def worker() -> None:
            try:
                run = self.simulate_run(
                    agent_id,
                    request,
                    stream_sink=lambda chunk: events.put(("delta", chunk)),
                    stream_node_ids=self._stream_output_node_ids(workflow),
                )
                events.put(("done", run))
            except Exception as exc:
                events.put(("error", str(exc)))

        Thread(target=worker, daemon=True).start()
        emitted_text = False
        while True:
            event_type, payload = events.get()
            if event_type == "delta":
                text = str(payload)
                if text:
                    emitted_text = True
                    yield json.dumps({"type": "delta", "text": text}, ensure_ascii=False) + "\n"
                continue
            if event_type == "error":
                if emitted_text:
                    yield json.dumps({"type": "done", "runId": ""}, ensure_ascii=False) + "\n"
                    return
                yield json.dumps({"type": "error", "message": "模型运行失败，请检查配置后重试。"}, ensure_ascii=False) + "\n"
                return
            run = payload
            if not emitted_text and getattr(run, "final_output", None):
                yield json.dumps({"type": "delta", "text": str(run.final_output)}, ensure_ascii=False) + "\n"
            yield json.dumps({"type": "done", "runId": str(run.id)}, ensure_ascii=False) + "\n"
            return

    @staticmethod
    def _conversation_history_text(request: AgentRunRequest) -> str:
        if not request.conversation_history:
            return ""
        role_labels = {"user": "user", "assistant": "assistant"}
        header = "Conversation history:\n"
        budget = AgentRunService.MAX_CONVERSATION_HISTORY_CHARS - len(header)
        lines: list[str] = []
        used = 0
        for item in reversed(request.conversation_history):
            prefix = f"{role_labels[item.role]}: "
            message_budget = max(0, min(AgentRunService.MAX_CONVERSATION_MESSAGE_CHARS, budget - used - len(prefix) - 1))
            if message_budget <= 0:
                break
            content = item.content
            if len(content) > message_budget:
                marker = "...[trimmed] "
                content = f"{marker}{content[-max(0, message_budget - len(marker)):]}"
            line = f"{prefix}{content}"
            lines.append(line)
            used += len(line) + 1
        messages = "\n".join(reversed(lines))
        return f"{header}{messages}" if messages else ""


    @classmethod
    def _graph_inputs(cls, workflow: WorkflowRead, request: AgentRunRequest) -> dict[str, object]:
        user_input = request.user_input
        inputs: dict[str, object] = {"userInput": user_input, "text": user_input}
        conversation_history = cls._conversation_history_text(request)
        if conversation_history:
            inputs["conversationHistory"] = conversation_history
        trigger = next((node for node in workflow.nodes if node.type == "trigger"), None)
        fields = trigger.config.get("inputFields", []) if trigger else []
        if isinstance(fields, list):
            for field in fields:
                if not isinstance(field, dict):
                    continue
                reference = str(field.get("variable") or field.get("name") or "")
                if not reference:
                    continue
                inputs[reference] = user_input
                inputs[reference.split(".", 1)[-1]] = user_input
        return inputs

    @staticmethod
    def _final_output_text(value: object) -> str:
        if isinstance(value, dict) and len(value) == 1:
            value = next(iter(value.values()))
        return value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, default=str)

    def _run_graph(
        self,
        run_id: str,
        agent_id: str,
        request: AgentRunRequest,
        workflow: WorkflowRead,
        stream_sink: Callable[[str], None] | None = None,
        stream_node_ids: set[str] | None = None,
    ) -> RunTraceRead:
        node_by_id = {node.id: node for node in workflow.nodes}
        try:
            execution = self._graph_executor.execute(
                workflow,
                self._graph_inputs(workflow, request),
                stream_sink=stream_sink,
                stream_node_ids=stream_node_ids,
            )
        except WorkflowExecutionError as exc:
            failed_node = node_by_id.get(exc.node_id)
            failed_step = exc.trace_steps[-1]
            return self._traces.create_run(
                RunTraceCreate(
                    id=run_id,
                    agentId=agent_id,
                    status="failed",
                    costCny=0.0,
                    finalOutput=str(exc),
                    steps=[
                        TraceStepCreate(
                            id=f"{run_id}_{exc.node_id}",
                            type=failed_node.type if failed_node else str(failed_step.get("node_type", "workflow")),
                            title=failed_node.name if failed_node else exc.node_name,
                            status="failed",
                            latencyMs=0,
                            errorMessage=str(failed_step.get("message") or exc),
                        )
                    ],
                )
            )

        steps: list[TraceStepCreate] = []
        for index, trace in enumerate(execution.trace_steps):
            node_id = str(trace.get("node_id", "workflow"))
            node = node_by_id.get(node_id)
            details = {key: value for key, value in trace.items() if key not in {"node_id", "node_type", "status", "message"}}
            steps.append(
                TraceStepCreate(
                    id=f"{run_id}_{node_id}_{index}",
                    type=node.type if node else str(trace.get("node_type", "workflow")),
                    title=node.name if node else node_id,
                    status=str(trace.get("status", "success")),
                    latencyMs=0,
                    inputSummary=request.user_input if node and node.type == "trigger" else None,
                    outputSummary=json.dumps(details, ensure_ascii=False, default=str) if details else None,
                    errorMessage=str(trace["message"]) if trace.get("status") == "failed" and trace.get("message") else None,
                )
            )

        cost_cny = 0.0
        for output in execution.state.get("node_outputs", {}).values():
            usage = output.get("usage") if isinstance(output, dict) else None
            if isinstance(usage, dict):
                cost_cny += float(usage.get("cost_cny", 0.0) or 0.0)
        return self._traces.create_run(
            RunTraceCreate(
                id=run_id,
                agentId=agent_id,
                status="success",
                costCny=cost_cny,
                finalOutput=self._final_output_text(execution.final_output),
                steps=steps,
            )
        )

    def _build_retrieval_summary(self, query: str, knowledge_base_ids: list[str]) -> str:
        if not self._knowledge:
            return f"{', '.join(knowledge_base_ids)} matched local policy context."

        matches = self._knowledge.search(query).matches
        best_match = matches[0].text if matches else "No matching snippet."
        return f"{', '.join(knowledge_base_ids)} matched: {best_match}"
