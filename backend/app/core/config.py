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

    otp_static_code: str = "123456"  # dev-only fixed OTP so flows are testable without real SMS

    draft_expiry_hours: int = 48
    payment_link_expiry_hours: int = 2
    dose_fire_before_minutes: int = 15
    dose_expire_after_minutes: int = 30


settings = Settings()
