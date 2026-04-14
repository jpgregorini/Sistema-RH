from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_service_key: str = ""
    anthropic_api_key: str = ""
    cors_origins: str = "http://localhost:8000"

    class Config:
        env_file = ".env"


settings = Settings()
