from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "HMS API"
    environment: str = "development"

    database_url: str = "postgresql+psycopg://hms:hms@localhost:5432/hms"

    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 12

    redis_url: str = "redis://localhost:6379/0"

    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "hms_minio"
    minio_secret_key: str = "hms_minio_secret"
    minio_bucket: str = "hms-files"
    minio_secure: bool = False

    payment_provider: str = "mock"  # mock | razorpay
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""

    sms_provider: str = "mock"  # mock | twilio | msg91
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""

    push_provider: str = "mock"  # mock | fcm
    fcm_server_key: str = ""

    otp_static_code: str = ""  # if set, always issue this code instead of a random one (local-only convenience)

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    draft_expiry_hours: int = 48
    payment_link_expiry_hours: int = 2
    dose_fire_before_minutes: int = 15
    dose_expire_after_minutes: int = 30

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
