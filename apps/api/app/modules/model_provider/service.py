import json
import re
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from app.modules.model_provider.models import ModelProviderModel

DEFAULT_MAX_OUTPUT_TOKENS = 4096
THINK_OPEN = "<think>"
THINK_CLOSE = "</think>"
THINK_PATTERN = re.compile(r"<think>(.*?)</think>", re.IGNORECASE | re.DOTALL)


def split_reasoning(text: str) -> tuple[str, str]:
    reasoning_parts = [match.group(1).strip() for match in THINK_PATTERN.finditer(text) if match.group(1).strip()]
    visible = THINK_PATTERN.sub("", text)
    unclosed = visible.lower().find(THINK_OPEN)
    if unclosed >= 0:
        trailing_reasoning = visible[unclosed + len(THINK_OPEN) :].strip()
        if trailing_reasoning:
            reasoning_parts.append(trailing_reasoning)
        visible = visible[:unclosed]
    return visible.strip(), "\n".join(reasoning_parts)


def _partial_tag_length(text: str, tag: str) -> int:
    maximum = min(len(text), len(tag) - 1)
    for length in range(maximum, 0, -1):
        if text[-length:].lower() == tag[:length]:
            return length
    return 0


def visible_text_chunks(chunks: Iterable[str]) -> Iterator[str]:
    buffer = ""
    in_reasoning = False
    for chunk in chunks:
        buffer += chunk
        while buffer:
            lowered = buffer.lower()
            if in_reasoning:
                close_index = lowered.find(THINK_CLOSE)
                if close_index < 0:
                    keep = _partial_tag_length(buffer, THINK_CLOSE)
                    buffer = buffer[-keep:] if keep else ""
                    break
                buffer = buffer[close_index + len(THINK_CLOSE) :]
                in_reasoning = False
                continue

            open_index = lowered.find(THINK_OPEN)
            if open_index >= 0:
                if open_index:
                    yield buffer[:open_index]
                buffer = buffer[open_index + len(THINK_OPEN) :]
                in_reasoning = True
                continue

            keep = _partial_tag_length(buffer, THINK_OPEN)
            visible = buffer[:-keep] if keep else buffer
            if visible:
                yield visible
            buffer = buffer[-keep:] if keep else ""
            break
    if buffer and not in_reasoning:
        yield buffer


@dataclass(frozen=True)
class ModelInvocationResult:
    content: str
    latency_ms: int
    cost_cny: float
    reasoning_content: str = ""


class LangChainModelClient:
    def stream(self, provider: ModelProviderModel, prompt: str):
        yield from visible_text_chunks(self._stream_raw(provider, prompt))

    def _stream_raw(self, provider: ModelProviderModel, prompt: str):
        if provider.base_url.startswith("mock://"):
            content = f"[{provider.model_name}] Answer generated for: {prompt}"
            for start in range(0, len(content), 8):
                yield content[start : start + 8]
            return

        if provider.provider_type == "anthropic-compatible":
            yield from self._stream_anthropic_compatible(provider, prompt)
            return

        from langchain_openai import ChatOpenAI

        model = ChatOpenAI(
            model=provider.model_name,
            api_key=provider.api_key,
            base_url=provider.base_url,
        )
        for chunk in model.stream(prompt):
            content = chunk.content
            if isinstance(content, str) and content:
                yield content
            elif isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "text" and block.get("text"):
                        yield str(block["text"])

    def invoke(self, provider: ModelProviderModel, prompt: str) -> ModelInvocationResult:
        if provider.base_url.startswith("mock://"):
            visible, reasoning = split_reasoning(f"[{provider.model_name}] Answer generated for: {prompt}")
            return ModelInvocationResult(
                content=visible,
                latency_ms=35,
                cost_cny=0.0,
                reasoning_content=reasoning,
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
        visible, embedded_reasoning = split_reasoning(str(response.content))
        additional_kwargs = getattr(response, "additional_kwargs", {})
        reasoning = str(additional_kwargs.get("reasoning_content", "")) if isinstance(additional_kwargs, dict) else ""
        return ModelInvocationResult(
            content=visible,
            latency_ms=0,
            cost_cny=0.0,
            reasoning_content=reasoning or embedded_reasoning,
        )

    def _invoke_anthropic_compatible(self, provider: ModelProviderModel, prompt: str) -> ModelInvocationResult:
        endpoint = f"{provider.base_url.rstrip('/')}/v1/messages"
        payload = {
            "model": provider.model_name,
            "max_tokens": DEFAULT_MAX_OUTPUT_TOKENS,
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

        visible, reasoning = split_reasoning(output)
        return ModelInvocationResult(content=visible, latency_ms=0, cost_cny=0.0, reasoning_content=reasoning)

    def _stream_anthropic_compatible(self, provider: ModelProviderModel, prompt: str):
        endpoint = f"{provider.base_url.rstrip('/')}/v1/messages"
        payload = {
            "model": provider.model_name,
            "max_tokens": DEFAULT_MAX_OUTPUT_TOKENS,
            "messages": [{"role": "user", "content": prompt}],
            "stream": True,
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
                for raw_line in response:
                    line = raw_line.decode("utf-8", errors="replace").strip()
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if not data or data == "[DONE]":
                        continue
                    event = json.loads(data)
                    if event.get("type") != "content_block_delta":
                        continue
                    delta = event.get("delta", {})
                    if isinstance(delta, dict) and delta.get("type") == "text_delta" and delta.get("text"):
                        yield str(delta["text"])
        except HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Anthropic-compatible stream failed: HTTP {exc.code} {error_body}") from exc
