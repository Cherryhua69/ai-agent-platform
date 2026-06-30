from app.core.config import settings
from app.modules.knowledge.vector_store import InMemoryVectorStore, NullVectorStore, QdrantVectorStore, VectorStore


def create_vector_store() -> VectorStore:
    provider = settings.vector_store_provider.lower()
    if provider == "qdrant":
        return QdrantVectorStore(url=settings.qdrant_url, collection_name=settings.qdrant_collection)
    if provider == "memory":
        return InMemoryVectorStore()
    return NullVectorStore()
