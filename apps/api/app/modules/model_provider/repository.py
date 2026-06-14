from uuid import uuid4

from sqlalchemy import select, update
from sqlalchemy.orm import Session, sessionmaker

from app.modules.model_provider.models import ModelProviderModel
from app.modules.model_provider.schemas import ModelProviderCreate, ModelProviderRead


class ModelProviderRepository:
    def __init__(self, session_factory: sessionmaker[Session] | None = None) -> None:
        self._session_factory = session_factory
        self._providers: dict[str, ModelProviderModel] = {}

    def create(self, payload: ModelProviderCreate) -> ModelProviderRead:
        provider = ModelProviderModel(
            id=f"model_provider_{uuid4().hex[:8]}",
            name=payload.name,
            provider_type=payload.provider_type,
            base_url=payload.base_url,
            model_name=payload.model,
            api_key=payload.api_key,
            status="online",
            is_default=payload.is_default,
        )

        if self._session_factory:
            with self._session_factory() as session:
                if provider.is_default:
                    session.execute(update(ModelProviderModel).values(is_default=False))
                session.add(provider)
                session.commit()
            return self._to_read_model(provider)

        if provider.is_default:
            for existing in self._providers.values():
                existing.is_default = False
        self._providers[provider.id] = provider
        return self._to_read_model(provider)

    def list(self) -> list[ModelProviderRead]:
        if self._session_factory:
            with self._session_factory() as session:
                models = session.scalars(select(ModelProviderModel).order_by(ModelProviderModel.created_at.asc())).all()
            return [self._to_read_model(provider) for provider in models]

        return [self._to_read_model(provider) for provider in self._providers.values()]

    def get(self, provider_id: str | None = None) -> ModelProviderModel | None:
        if self._session_factory:
            with self._session_factory() as session:
                if provider_id:
                    return session.get(ModelProviderModel, provider_id)
                return session.scalar(select(ModelProviderModel).where(ModelProviderModel.is_default.is_(True)))

        if provider_id:
            return self._providers.get(provider_id)
        return next((provider for provider in self._providers.values() if provider.is_default), None)

    def _to_read_model(self, provider: ModelProviderModel) -> ModelProviderRead:
        return ModelProviderRead(
            id=provider.id,
            name=provider.name,
            providerType=provider.provider_type,
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
