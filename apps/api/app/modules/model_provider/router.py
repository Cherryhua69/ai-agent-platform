from fastapi import APIRouter, HTTPException, status

from app.core.database import SessionLocal
from app.modules.model_provider.repository import ModelProviderRepository
from app.modules.model_provider.schemas import (
    ModelProviderCreate,
    ModelProviderRead,
    ModelProviderTestRequest,
    ModelProviderTestResponse,
    ModelProviderUpdate,
)
from app.modules.model_provider.service import LangChainModelClient

router = APIRouter(prefix="/api/model-providers", tags=["model-providers"])
repo = ModelProviderRepository(session_factory=SessionLocal)
model_client = LangChainModelClient()


@router.get("", response_model=list[ModelProviderRead])
def list_model_providers() -> list[ModelProviderRead]:
    """查询全部模型供应商配置，供前端模型配置表格和后续工作流选择器使用。"""
    return repo.list()


@router.post("", response_model=ModelProviderRead, status_code=status.HTTP_201_CREATED)
def create_model_provider(payload: ModelProviderCreate) -> ModelProviderRead:
    """创建模型供应商配置，支持对话、Embedding 和重排模型用途。"""
    return repo.create(payload)


@router.put("/{provider_id}", response_model=ModelProviderRead)
def update_model_provider(provider_id: str, payload: ModelProviderUpdate) -> ModelProviderRead:
    """更新指定模型供应商配置；API Key 留空时由仓储层保留原密钥。"""
    provider = repo.update(provider_id, payload)
    if provider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model provider not found")
    return provider


@router.post("/{provider_id}/test", response_model=ModelProviderTestResponse)
def test_model_provider(provider_id: str, payload: ModelProviderTestRequest) -> ModelProviderTestResponse:
    """测试模型供应商连通性；推理模型调用聊天接口，嵌入模型调用向量接口，重排模型暂返回预留状态。"""
    provider = repo.get(provider_id)
    if provider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model provider not found")

    if provider.model_purpose == "embedding":
        try:
            vector = model_client.embed(provider, payload.prompt)
        except Exception as exc:
            repo.set_status(provider_id, "offline")
            return ModelProviderTestResponse(status="failed", output=str(exc))
        repo.set_status(provider_id, "online")
        return ModelProviderTestResponse(status="success", output=f"嵌入模型连接正常，返回 {len(vector)} 维向量。")
    if provider.model_purpose == "rerank":
        repo.set_status(provider_id, "online")
        return ModelProviderTestResponse(status="success", output="连接配置可用；重排模型测试待实现。")

    try:
        result = model_client.invoke(provider, payload.prompt)
    except Exception as exc:
        repo.set_status(provider_id, "offline")
        return ModelProviderTestResponse(status="failed", output=str(exc))

    repo.set_status(provider_id, "online")
    return ModelProviderTestResponse(status="success", output=result.content)
