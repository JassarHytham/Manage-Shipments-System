from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/postgres"
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Salla (Phase 2)
    SALLA_CLIENT_ID: str = ""
    SALLA_CLIENT_SECRET: str = ""
    SALLA_REDIRECT_URI: str = ""
    SALLA_WEBHOOK_SECRET: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
