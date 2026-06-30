from dataclasses import dataclass
from math import sqrt
from typing import Protocol

from app.modules.knowledge.models import KnowledgeSegmentModel


@dataclass(frozen=True)
class VectorSearchResult:
    segment_id: str
    score: float


class VectorStore(Protocol):
    """预留向量库边界，后续可替换为 Qdrant、Milvus 或 pgvector。"""

    def upsert_segments(self, segments: list[KnowledgeSegmentModel], embeddings: list[list[float]] | None = None) -> None:
        """写入分段向量索引。当前最小实现不做真实向量化。"""

    def search(
        self,
        knowledge_base_id: str,
        query_embedding: list[float],
        top_k: int,
        similarity_threshold: float,
    ) -> list[VectorSearchResult]:
        """按向量相似度召回分段。"""

    def delete_knowledge_base(self, knowledge_base_id: str) -> None:
        """删除知识库对应的向量索引数据。"""


    def delete_document(self, knowledge_base_id: str, document_id: str) -> None:
        """删除指定文档对应的向量索引数据。"""


class NullVectorStore:
    def upsert_segments(self, segments: list[KnowledgeSegmentModel], embeddings: list[list[float]] | None = None) -> None:
        del segments
        del embeddings

    def search(
        self,
        knowledge_base_id: str,
        query_embedding: list[float],
        top_k: int,
        similarity_threshold: float,
    ) -> list[VectorSearchResult]:
        del knowledge_base_id
        del query_embedding
        del top_k
        del similarity_threshold
        return []

    def delete_knowledge_base(self, knowledge_base_id: str) -> None:
        del knowledge_base_id

    def delete_document(self, knowledge_base_id: str, document_id: str) -> None:
        del knowledge_base_id
        del document_id


class InMemoryVectorStore:
    def __init__(self) -> None:
        self._items: dict[str, tuple[str, str, list[float]]] = {}

    def upsert_segments(self, segments: list[KnowledgeSegmentModel], embeddings: list[list[float]] | None = None) -> None:
        if not embeddings:
            return
        for segment, embedding in zip(segments, embeddings, strict=False):
            if embedding:
                self._items[segment.id] = (segment.knowledge_base_id, segment.document_id, embedding)

    def search(
        self,
        knowledge_base_id: str,
        query_embedding: list[float],
        top_k: int,
        similarity_threshold: float,
    ) -> list[VectorSearchResult]:
        if not query_embedding:
            return []
        scored = [
            VectorSearchResult(segment_id=segment_id, score=score)
            for segment_id, (stored_knowledge_base_id, _document_id, embedding) in self._items.items()
            if stored_knowledge_base_id == knowledge_base_id
            if (score := self._cosine_similarity(query_embedding, embedding)) >= similarity_threshold
        ]
        scored.sort(key=lambda item: item.score, reverse=True)
        return scored[:top_k]

    def delete_knowledge_base(self, knowledge_base_id: str) -> None:
        stale_ids = [
            segment_id
            for segment_id, (stored_knowledge_base_id, _document_id, _embedding) in self._items.items()
            if stored_knowledge_base_id == knowledge_base_id
        ]
        for segment_id in stale_ids:
            self._items.pop(segment_id, None)

    def delete_document(self, knowledge_base_id: str, document_id: str) -> None:
        stale_ids = [
            segment_id
            for segment_id, (stored_knowledge_base_id, stored_document_id, _embedding) in self._items.items()
            if stored_knowledge_base_id == knowledge_base_id and stored_document_id == document_id
        ]
        for segment_id in stale_ids:
            self._items.pop(segment_id, None)

    def _cosine_similarity(self, left: list[float], right: list[float]) -> float:
        if not left or not right or len(left) != len(right):
            return 0.0
        dot = sum(left_value * right_value for left_value, right_value in zip(left, right, strict=False))
        left_norm = sqrt(sum(value * value for value in left))
        right_norm = sqrt(sum(value * value for value in right))
        if left_norm == 0 or right_norm == 0:
            return 0.0
        return round(dot / (left_norm * right_norm), 4)


class QdrantVectorStore:
    def __init__(
        self,
        url: str | None = None,
        collection_name: str = "knowledge_segments",
        client: object | None = None,
    ) -> None:
        self._collection_name = collection_name
        self._client = client or self._create_client(url)

    def upsert_segments(self, segments: list[KnowledgeSegmentModel], embeddings: list[list[float]] | None = None) -> None:
        if not embeddings:
            return
        pairs = [(segment, embedding) for segment, embedding in zip(segments, embeddings, strict=False) if embedding]
        if not pairs:
            return
        vector_size = len(pairs[0][1])
        self._ensure_collection(vector_size)
        points = [
            self._point_struct(
                point_id=segment.id,
                vector=embedding,
                payload={
                    "knowledge_base_id": segment.knowledge_base_id,
                    "document_id": segment.document_id,
                    "position": segment.position,
                },
            )
            for segment, embedding in pairs
        ]
        self._client.upsert(collection_name=self._collection_name, points=points)

    def search(
        self,
        knowledge_base_id: str,
        query_embedding: list[float],
        top_k: int,
        similarity_threshold: float,
    ) -> list[VectorSearchResult]:
        if not query_embedding:
            return []
        hits = self._client.search(
            collection_name=self._collection_name,
            query_vector=query_embedding,
            query_filter=self._knowledge_base_filter(knowledge_base_id),
            limit=top_k,
            score_threshold=similarity_threshold,
        )
        return [
            VectorSearchResult(segment_id=str(getattr(hit, "id")), score=float(getattr(hit, "score", 0.0)))
            for hit in hits
        ]

    def delete_knowledge_base(self, knowledge_base_id: str) -> None:
        self._client.delete(
            collection_name=self._collection_name,
            points_selector=self._knowledge_base_filter(knowledge_base_id),
        )

    def delete_document(self, knowledge_base_id: str, document_id: str) -> None:
        self._client.delete(
            collection_name=self._collection_name,
            points_selector=self._document_filter(knowledge_base_id, document_id),
        )

    def _create_client(self, url: str | None) -> object:
        try:
            from qdrant_client import QdrantClient
        except ImportError as exc:
            raise RuntimeError("qdrant-client is required when vector store provider is qdrant") from exc
        return QdrantClient(url=url)

    def _ensure_collection(self, vector_size: int) -> None:
        if self._client.collection_exists(self._collection_name):
            return
        try:
            from qdrant_client.models import Distance, VectorParams

            vectors_config = VectorParams(size=vector_size, distance=Distance.COSINE)
        except ImportError:
            vectors_config = {"size": vector_size, "distance": "Cosine"}
        self._client.create_collection(collection_name=self._collection_name, vectors_config=vectors_config)

    def _point_struct(self, point_id: str, vector: list[float], payload: dict[str, str | int]) -> object:
        try:
            from qdrant_client.models import PointStruct

            return PointStruct(id=point_id, vector=vector, payload=payload)
        except ImportError:
            return {"id": point_id, "vector": vector, "payload": payload}

    def _knowledge_base_filter(self, knowledge_base_id: str) -> object:
        try:
            from qdrant_client.models import FieldCondition, Filter, MatchValue

            return Filter(
                must=[
                    FieldCondition(
                        key="knowledge_base_id",
                        match=MatchValue(value=knowledge_base_id),
                    )
                ]
            )
        except ImportError:
            return {"must": [{"key": "knowledge_base_id", "match": {"value": knowledge_base_id}}]}

    def _document_filter(self, knowledge_base_id: str, document_id: str) -> object:
        try:
            from qdrant_client.models import FieldCondition, Filter, MatchValue

            return Filter(
                must=[
                    FieldCondition(key="knowledge_base_id", match=MatchValue(value=knowledge_base_id)),
                    FieldCondition(key="document_id", match=MatchValue(value=document_id)),
                ]
            )
        except ImportError:
            return {
                "must": [
                    {"key": "knowledge_base_id", "match": {"value": knowledge_base_id}},
                    {"key": "document_id", "match": {"value": document_id}},
                ]
            }
