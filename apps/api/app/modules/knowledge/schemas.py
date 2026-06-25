from typing import Literal

from pydantic import BaseModel, Field

ChunkStrategy = Literal["fixed", "markdown", "semantic"]
RetrievalMode = Literal["vector", "hybrid"]


class KnowledgeBaseCreate(BaseModel):
    name: str = Field(min_length=1)
    description: str | None = None
    source: str = Field(min_length=1)
    embedding_model_provider_id: str | None = Field(default=None, alias="embeddingModelProviderId")
    chunk_strategy: ChunkStrategy = Field(default="fixed", alias="chunkStrategy")
    chunk_size: int = Field(default=500, alias="chunkSize", ge=100, le=4000)
    chunk_overlap: int = Field(default=50, alias="chunkOverlap", ge=0, le=1000)
    retrieval_mode: RetrievalMode = Field(default="vector", alias="retrievalMode")
    retrieval_strategy: str | None = Field(default=None, alias="retrievalStrategy")
    top_k: int = Field(default=5, alias="topK", ge=1, le=20)
    similarity_threshold: float = Field(default=0.7, alias="similarityThreshold", ge=0, le=1)
    return_citations: bool = Field(default=True, alias="returnCitations")


class KnowledgeBaseUpdate(BaseModel):
    name: str = Field(min_length=1)
    description: str | None = None
    source: str = Field(min_length=1)
    embedding_model_provider_id: str | None = Field(default=None, alias="embeddingModelProviderId")
    chunk_strategy: ChunkStrategy = Field(alias="chunkStrategy")
    chunk_size: int = Field(alias="chunkSize", ge=100, le=4000)
    chunk_overlap: int = Field(alias="chunkOverlap", ge=0, le=1000)
    retrieval_mode: RetrievalMode = Field(alias="retrievalMode")
    top_k: int = Field(alias="topK", ge=1, le=20)
    similarity_threshold: float = Field(alias="similarityThreshold", ge=0, le=1)
    return_citations: bool = Field(alias="returnCitations")


class KnowledgeBaseRead(BaseModel):
    id: str
    name: str
    description: str | None = None
    source: str
    embedding_model_provider_id: str | None = Field(default=None, alias="embeddingModelProviderId")
    embedding_model_provider_name: str | None = Field(default=None, alias="embeddingModelProviderName")
    chunk_strategy: ChunkStrategy = Field(alias="chunkStrategy")
    chunk_size: int = Field(alias="chunkSize")
    chunk_overlap: int = Field(alias="chunkOverlap")
    retrieval_mode: RetrievalMode = Field(alias="retrievalMode")
    top_k: int = Field(alias="topK")
    similarity_threshold: float = Field(alias="similarityThreshold")
    return_citations: bool = Field(alias="returnCitations")
    document_count: int = Field(alias="documentCount")
    retrieval_strategy: str = Field(alias="retrievalStrategy")
    quality_score: int = Field(alias="qualityScore")
    status: str


class KnowledgeDocumentCreate(BaseModel):
    name: str = Field(min_length=1)
    mime_type: str = Field(alias="mimeType", min_length=1)
    size_kb: int = Field(alias="sizeKb", ge=1)


class KnowledgeDocumentRead(KnowledgeDocumentCreate):
    id: str
    status: str
    segment_mode: str = Field(default="通用", alias="segmentMode")
    character_count: int = Field(default=0, alias="characterCount")
    hit_count: int = Field(default=0, alias="hitCount")
    created_at: str | None = Field(default=None, alias="createdAt")


class KnowledgeProcessingJobRead(BaseModel):
    id: str
    knowledge_base_id: str = Field(alias="knowledgeBaseId")
    status: str
    chunks_created: int = Field(alias="chunksCreated")


class KnowledgeSearchRequest(BaseModel):
    query: str = Field(min_length=1)


class KnowledgeSearchMatch(BaseModel):
    document_id: str = Field(alias="documentId")
    text: str
    score: float


class KnowledgeSearchResponse(BaseModel):
    query: str
    matches: list[KnowledgeSearchMatch]
