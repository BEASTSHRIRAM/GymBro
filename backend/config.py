"""
GymBro Backend — FastAPI Configuration
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_env: str = "development"
    app_secret_key: str = "beast7878"

    # MongoDB
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "gymbro"

    # JWT
    jwt_secret: str = "beast7878"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30

    # Gmail OTP
    gmail_user: str = ""
    gmail_app_password: str = ""

    # Gemini
    gemini_api_key: str = ""

    # VisionAgents
    visionagents_api_key: str = ""
    visionagents_secret_key: str = ""
    visionagents_base_url: str = "https://api.visionagents.ai"

    # Deepgram
    deepgram_api_key: str = ""

    # ElevenLabs
    elevenlabs_api_key: str = ""

    # Stream Video (api_key / api_secret used by SDK, stream_api_key / stream_api_secret used by our code)
    api_key: str = ""
    api_secret: str = ""
    stream_api_key: str = ""
    stream_api_secret: str = ""

    # Stripe (placeholder)
    stripe_secret_key: str = ""

    # CORS
    cors_origins: str = "http://localhost:19006,exp://localhost:19000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
