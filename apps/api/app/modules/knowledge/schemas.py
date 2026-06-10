from pydantic import BaseModel, Field


class KnowledgeBaseCreate(BaseModel):
    name: str = Field(min_length=1)
    source: str = Field(min_length=1)
    retrieval_strategy: str = Field(alias="retrievalStrategy", min_length=1)


class KnowledgeBaseRead(BaseModel):
    id: str
    name: str
    source: str
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
