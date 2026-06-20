from types import SimpleNamespace
import json

import app.modules.model_provider.service as model_service
from app.modules.model_provider.service import LangChainModelClient, split_reasoning, visible_text_chunks


def test_mock_model_stream_yields_only_final_text_chunks() -> None:
    client = LangChainModelClient()
    provider = SimpleNamespace(
        base_url="mock://local",
        model_name="stream-model",
        provider_type="openai-compatible",
        api_key="sk-local",
    )

    assert hasattr(client, "stream")
    chunks = list(client.stream(provider, "退款规则是什么？"))

    assert len(chunks) > 1
    assert "".join(chunks) == "[stream-model] Answer generated for: 退款规则是什么？"
    assert all("reasoning_content" not in chunk and "usage" not in chunk for chunk in chunks)


def test_reasoning_markup_is_hidden_but_remains_extractable() -> None:
    visible, reasoning = split_reasoning("<think>内部推理过程</think>给用户的最终回答")

    assert visible == "给用户的最终回答"
    assert reasoning == "内部推理过程"


def test_reasoning_markup_split_across_stream_chunks_is_not_emitted() -> None:
    chunks = ["<thi", "nk>内部", "推理</th", "ink>最终", "回答"]

    assert "".join(visible_text_chunks(chunks)) == "最终回答"


def test_anthropic_stream_uses_a_full_response_token_budget(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def __iter__(self):
            event = {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "完整回复"}}
            return iter([f"data: {json.dumps(event, ensure_ascii=False)}\n".encode()])

    def fake_urlopen(request, timeout):
        captured["payload"] = json.loads(request.data.decode())
        captured["timeout"] = timeout
        return FakeResponse()

    monkeypatch.setattr(model_service, "urlopen", fake_urlopen)
    provider = SimpleNamespace(
        base_url="https://anthropic.example",
        model_name="claude-compatible",
        provider_type="anthropic-compatible",
        api_key="sk-local",
    )

    chunks = list(LangChainModelClient().stream(provider, "请给出详细回答"))

    assert chunks == ["完整回复"]
    assert captured["payload"]["max_tokens"] >= 4096
