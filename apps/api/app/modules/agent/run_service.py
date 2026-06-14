from uuid import uuid4

from app.modules.agent.schemas import AgentRunRequest
from app.modules.knowledge.repository import KnowledgeRepository
from app.modules.model_provider.repository import ModelProviderRepository
from app.modules.model_provider.service import LangChainModelClient
from app.modules.trace.repository import TraceRepository
from app.modules.trace.schemas import RunTraceCreate, RunTraceRead, TraceStepCreate


class AgentRunService:
    def __init__(
        self,
        traces: TraceRepository,
        model_providers: ModelProviderRepository | None = None,
        knowledge: KnowledgeRepository | None = None,
        model_client: LangChainModelClient | None = None,
    ) -> None:
        self._traces = traces
        self._model_providers = model_providers
        self._knowledge = knowledge
        self._model_client = model_client or LangChainModelClient()

    def simulate_run(self, agent_id: str, request: AgentRunRequest | None = None) -> RunTraceRead:
        request = request or AgentRunRequest()
        run_id = f"run_{uuid4().hex[:8]}"
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

    def _build_retrieval_summary(self, query: str, knowledge_base_ids: list[str]) -> str:
        if not self._knowledge:
            return f"{', '.join(knowledge_base_ids)} matched local policy context."

        matches = self._knowledge.search(query).matches
        best_match = matches[0].text if matches else "No matching snippet."
        return f"{', '.join(knowledge_base_ids)} matched: {best_match}"
