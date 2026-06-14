from dataclasses import dataclass
import json
from urllib.error import HTTPError
from urllib.request import Request, urlopen

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

        if provider.provider_type == "anthropic-compatible":
            return self._invoke_anthropic_compatible(provider, prompt)

        from langchain_openai import ChatOpenAI

        model = ChatOpenAI(
            model=provider.model_name,
            api_key=provider.api_key,
            base_url=provider.base_url,
        )
        response = model.invoke(prompt)
        return ModelInvocationResult(content=str(response.content), latency_ms=0, cost_cny=0.0)

    def _invoke_anthropic_compatible(self, provider: ModelProviderModel, prompt: str) -> ModelInvocationResult:
        endpoint = f"{provider.base_url.rstrip('/')}/v1/messages"
        payload = {
            "model": provider.model_name,
            "max_tokens": 256,
            "messages": [{"role": "user", "content": prompt}],
        }
        request = Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
                "x-api-key": provider.api_key,
            },
            method="POST",
        )

        try:
            with urlopen(request, timeout=60) as response:
                body = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Anthropic-compatible request failed: HTTP {exc.code} {error_body}") from exc

        content_blocks = body.get("content", [])
        text_parts = [block.get("text", "") for block in content_blocks if isinstance(block, dict) and block.get("type") == "text"]
        output = "\n".join(part for part in text_parts if part).strip()
        if not output:
            output = json.dumps(body, ensure_ascii=False)

        return ModelInvocationResult(content=output, latency_ms=0, cost_cny=0.0)
