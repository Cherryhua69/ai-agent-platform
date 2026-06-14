from dataclasses import dataclass

from app.modules.model_provider.models import ModelProviderModel


@dataclass(frozen=True)
class ModelInvocationResult:
    content: str
    latency_ms: int
    cost_cny: float


class LangChainModelClient:
    def invoke(self, provider: ModelProviderModel, prompt: str) -> ModelInvocationResult:
        if provider.base_url.startswith("mock://"):
            return ModelInvocationResult(
                content=f"[{provider.model_name}] Answer generated for: {prompt}",
                latency_ms=35,
                cost_cny=0.0,
            )

        from langchain_openai import ChatOpenAI

        model = ChatOpenAI(
            model=provider.model_name,
            api_key=provider.api_key,
            base_url=provider.base_url,
        )
        response = model.invoke(prompt)
        return ModelInvocationResult(content=str(response.content), latency_ms=0, cost_cny=0.0)
