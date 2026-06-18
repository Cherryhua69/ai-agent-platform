import json
from uuid import uuid4

from app.modules.agent.schemas import AgentRunRequest
from app.modules.knowledge.repository import KnowledgeRepository
from app.modules.model_provider.repository import ModelProviderRepository
from app.modules.model_provider.service import LangChainModelClient
from app.modules.trace.repository import TraceRepository
from app.modules.trace.schemas import RunTraceCreate, RunTraceRead, TraceStepCreate
from app.modules.workflow.graph_executor import GraphExecutor
from app.modules.workflow.graph_types import WorkflowExecutionError
from app.modules.workflow.repository import WorkflowRepository
from app.modules.workflow.schemas import WorkflowRead


class AgentRunService:
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

    def simulate_run(self, agent_id: str, request: AgentRunRequest | None = None) -> RunTraceRead:
        request = request or AgentRunRequest()
        run_id = f"run_{uuid4().hex[:8]}"
        workflow = self._workflows.get_by_agent_id(agent_id) if self._workflows else None
        if workflow is not None and self._graph_executor is not None and self._is_graph_configured(workflow):
            return self._run_graph(run_id, agent_id, request, workflow)

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
        prompt = (
            "You are an enterprise after-sale agent. "
            f"User request: {request.user_input}\n"
            f"Knowledge context: {retrieval_summary}\n"
            "Return a concise final answer with the policy basis."
        )
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
    def _graph_inputs(workflow: WorkflowRead, user_input: str) -> dict[str, object]:
        inputs: dict[str, object] = {"userInput": user_input, "text": user_input}
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
    ) -> RunTraceRead:
        node_by_id = {node.id: node for node in workflow.nodes}
        try:
            execution = self._graph_executor.execute(workflow, self._graph_inputs(workflow, request.user_input))
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
