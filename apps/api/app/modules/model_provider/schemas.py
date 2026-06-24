from typing import Literal

from pydantic import BaseModel, Field

ModelPurpose = Literal["llm", "embedding", "rerank"]


class ModelProviderCreate(BaseModel):
    """创建模型供应商配置的请求体。"""

    name: str = Field(min_length=1)
    provider_type: str = Field(alias="providerType", min_length=1)
    model_purpose: ModelPurpose = Field(default="llm", alias="modelPurpose", pattern="^(llm|embedding|rerank)$")
    base_url: str = Field(alias="baseUrl", min_length=1)
    model: str = Field(min_length=1)
    api_key: str = Field(alias="apiKey", min_length=1)
    is_default: bool = Field(default=False, alias="isDefault")


class ModelProviderUpdate(BaseModel):
    """更新模型供应商配置的请求体，允许 API Key 为空以保留原密钥。"""

    name: str = Field(min_length=1)
    provider_type: str = Field(alias="providerType", min_length=1)
    model_purpose: ModelPurpose = Field(default="llm", alias="modelPurpose", pattern="^(llm|embedding|rerank)$")
    base_url: str = Field(alias="baseUrl", min_length=1)
    model: str = Field(min_length=1)
    api_key: str | None = Field(default=None, alias="apiKey")
    is_default: bool = Field(default=False, alias="isDefault")


class ModelProviderRead(BaseModel):
    """模型供应商配置的安全响应体，不返回明文 API Key。"""

    id: str
    name: str
    provider_type: str = Field(alias="providerType")
    model_purpose: ModelPurpose = Field(alias="modelPurpose")
    base_url: str = Field(alias="baseUrl")
    model: str
    api_key_preview: str = Field(alias="apiKeyPreview")
    status: str
    is_default: bool = Field(alias="isDefault")


class ModelProviderTestRequest(BaseModel):
    """模型供应商连通性测试请求，对话模型会使用 prompt 发起最小调用。"""

    prompt: str = Field(default="Hello", min_length=1)


class ModelProviderTestResponse(BaseModel):
    """模型供应商连通性测试响应，返回测试状态和可展示的输出说明。"""

    status: str
    output: str
