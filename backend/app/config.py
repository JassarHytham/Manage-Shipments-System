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

    # Aramex (Phase 6)
    ARAMEX_USERNAME: str = ""
    ARAMEX_PASSWORD: str = ""
    ARAMEX_ACCOUNT_NUMBER: str = ""
    ARAMEX_ACCOUNT_PIN: str = ""
    ARAMEX_ACCOUNT_ENTITY: str = ""
    ARAMEX_ACCOUNT_COUNTRY_CODE: str = "SA"
    ARAMEX_API_URL: str = "https://ws.aramex.net/ShippingAPI.V2"

    # Shipper (store) details for shipment creation
    SHIPPER_NAME: str = "Wakkiez"
    SHIPPER_PHONE: str = ""
    SHIPPER_CITY: str = "Riyadh"
    SHIPPER_ADDRESS: str = ""
    SHIPPER_COUNTRY: str = "SA"

    # SMSA (Phase 6)
    SMSA_API_KEY: str = ""
    SMSA_PASSKEY: str = ""
    SMSA_API_URL: str = "https://ecomapis.smsaexpress.com"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
