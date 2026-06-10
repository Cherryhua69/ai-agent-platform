from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AI Agent Platform API"

    model_config = SettingsConfigDict(env_prefix="AI_AGENT_PLATFORM_")


settings = Settings()
