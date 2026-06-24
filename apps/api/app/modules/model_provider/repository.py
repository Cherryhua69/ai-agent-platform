from uuid import uuid4

from sqlalchemy import select, update
from sqlalchemy.orm import Session, sessionmaker

from app.modules.model_provider.models import ModelProviderModel
from app.modules.model_provider.schemas import ModelProviderCreate, ModelProviderRead, ModelProviderUpdate, ModelPurpose


class ModelProviderRepository:
    def __init__(self, session_factory: sessionmaker[Session] | None = None) -> None:
        self._session_factory = session_factory
        self._providers: dict[str, ModelProviderModel] = {}

    def create(self, payload: ModelProviderCreate) -> ModelProviderRead:
        """新增模型供应商配置，并在设置默认项时仅取消同用途的其它默认配置。"""
        provider = ModelProviderModel(
            id=f"model_provider_{uuid4().hex[:8]}",
            name=payload.name,
            provider_type=payload.provider_type,
            model_purpose=payload.model_purpose,
            base_url=payload.base_url,
            model_name=payload.model,
            api_key=payload.api_key,
            status="offline",
            is_default=payload.is_default,
        )

        if self._session_factory:
            with self._session_factory() as session:
                if provider.is_default:
                    session.execute(
                        update(ModelProviderModel)
                        .where(ModelProviderModel.model_purpose == provider.model_purpose)
                        .values(is_default=False)
                    )
                session.add(provider)
                session.commit()
            return self._to_read_model(provider)

        if provider.is_default:
            for existing in self._providers.values():
                if existing.model_purpose == provider.model_purpose:
                    existing.is_default = False
        self._providers[provider.id] = provider
        return self._to_read_model(provider)

    def list(self) -> list[ModelProviderRead]:
        """按创建时间查询全部模型供应商配置。"""
        if self._session_factory:
            with self._session_factory() as session:
                models = session.scalars(select(ModelProviderModel).order_by(ModelProviderModel.created_at.desc())).all()
            return [self._to_read_model(provider) for provider in models]

        providers = sorted(self._providers.values(), key=lambda provider: provider.created_at, reverse=True)
        return [self._to_read_model(provider) for provider in providers]

    def update(self, provider_id: str, payload: ModelProviderUpdate) -> ModelProviderRead | None:
        """更新指定模型供应商配置；找不到配置时返回 None。"""
        if self._session_factory:
            with self._session_factory() as session:
                provider = session.get(ModelProviderModel, provider_id)
                if provider is None:
                    return None
                self._apply_update(provider, payload)
                if provider.is_default:
                    session.execute(
                        update(ModelProviderModel)
                        .where(ModelProviderModel.id != provider_id, ModelProviderModel.model_purpose == provider.model_purpose)
                        .values(is_default=False)
                    )
                session.commit()
            return self._to_read_model(provider)

        provider = self._providers.get(provider_id)
        if provider is None:
            return None
        if payload.is_default:
            for existing_id, existing in self._providers.items():
                if existing_id != provider_id and existing.model_purpose == payload.model_purpose:
                    existing.is_default = False
        self._apply_update(provider, payload)
        return self._to_read_model(provider)

    def get(self, provider_id: str | None = None, model_purpose: ModelPurpose = "llm") -> ModelProviderModel | None:
        """按 ID 查询模型供应商；未传 ID 时返回指定用途的默认供应商。"""
        if self._session_factory:
            with self._session_factory() as session:
                if provider_id:
                    return session.get(ModelProviderModel, provider_id)
                return session.scalar(
                    select(ModelProviderModel).where(
                        ModelProviderModel.is_default.is_(True),
                        ModelProviderModel.model_purpose == model_purpose,
                    )
                )

        if provider_id:
            return self._providers.get(provider_id)
        return next(
            (provider for provider in self._providers.values() if provider.is_default and provider.model_purpose == model_purpose),
            None,
        )

    def set_status(self, provider_id: str, status: str) -> ModelProviderRead | None:
        """更新模型供应商健康状态，供连通性测试结果回写。"""
        if self._session_factory:
            with self._session_factory() as session:
                provider = session.get(ModelProviderModel, provider_id)
                if provider is None:
                    return None
                provider.status = status
                session.commit()
            return self._to_read_model(provider)

        provider = self._providers.get(provider_id)
        if provider is None:
            return None
        provider.status = status
        return self._to_read_model(provider)

    def _to_read_model(self, provider: ModelProviderModel) -> ModelProviderRead:
        return ModelProviderRead(
            id=provider.id,
            name=provider.name,
            providerType=provider.provider_type,
            modelPurpose=provider.model_purpose,
            baseUrl=provider.base_url,
            model=provider.model_name,
            apiKeyPreview=self._preview_api_key(provider.api_key),
            status=provider.status,
            isDefault=provider.is_default,
        )

    def _preview_api_key(self, api_key: str) -> str:
        if len(api_key) < 7:
            return "***"
        return f"{api_key[:3]}...{api_key[-4:]}"

    def _apply_update(self, provider: ModelProviderModel, payload: ModelProviderUpdate) -> None:
        provider.name = payload.name
        provider.provider_type = payload.provider_type
        provider.model_purpose = payload.model_purpose
        provider.base_url = payload.base_url
        provider.model_name = payload.model
        if payload.api_key:
            provider.api_key = payload.api_key
        provider.is_default = payload.is_default
