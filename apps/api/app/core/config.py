from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AI Agent Platform API"
    database_url: str = "sqlite+pysqlite:///:memory:"
    vector_store_provider: str = "null"
    qdrant_url: str | None = None
    qdrant_collection: str = "knowledge_segments"

    model_config = SettingsConfigDict(env_prefix="AI_AGENT_PLATFORM_", env_file=".env", env_file_encoding="utf-8")


settings = Settings()
