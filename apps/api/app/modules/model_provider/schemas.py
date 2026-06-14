from pydantic import BaseModel, Field


class ModelProviderCreate(BaseModel):
    name: str = Field(min_length=1)
    provider_type: str = Field(alias="providerType", min_length=1)
    base_url: str = Field(alias="baseUrl", min_length=1)
    model: str = Field(min_length=1)
    api_key: str = Field(alias="apiKey", min_length=1)
    is_default: bool = Field(default=False, alias="isDefault")


class ModelProviderRead(BaseModel):
    id: str
    name: str
    provider_type: str = Field(alias="providerType")
    base_url: str = Field(alias="baseUrl")
    model: str
    api_key_preview: str = Field(alias="apiKeyPreview")
    status: str
    is_default: bool = Field(alias="isDefault")


class ModelProviderTestRequest(BaseModel):
    prompt: str = Field(default="Hello", min_length=1)


class ModelProviderTestResponse(BaseModel):
    status: str
    output: str
