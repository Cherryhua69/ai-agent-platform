from typing import Protocol

from app.modules.model_provider.repository import ModelProviderRepository
from app.modules.model_provider.service import LangChainModelClient


class EmbeddingService(Protocol):
    """文本嵌入服务边界，后续接入真实模型供应商时替换实现。"""

    def embed_documents(self, texts: list[str], provider_id: str | None = None) -> list[list[float]]:
        """返回与 texts 一一对应的向量。当前默认实现不调用外部模型。"""


class NullEmbeddingService:
    def embed_documents(self, texts: list[str], provider_id: str | None = None) -> list[list[float]]:
        del provider_id
        return [[] for _ in texts]


class ModelProviderEmbeddingService:
    def __init__(
        self,
        provider_repository: ModelProviderRepository,
        model_client: LangChainModelClient | None = None,
    ) -> None:
        self._provider_repository = provider_repository
        self._model_client = model_client or LangChainModelClient()

    def embed_documents(self, texts: list[str], provider_id: str | None = None) -> list[list[float]]:
        if not texts:
            return []
        provider = self._provider_repository.get(provider_id, model_purpose="embedding")
        if provider is None:
            return [[] for _ in texts]
        if provider.model_purpose != "embedding":
            raise RuntimeError("Embedding model provider must use embedding purpose")
        return [self._model_client.embed(provider, text) for text in texts]
