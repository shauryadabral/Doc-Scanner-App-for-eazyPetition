from pydantic_settings import BaseSettings


class Settings(BaseSettings):
  max_image_dimension: int = 1500
  ocr_min_confidence: float = 0.7
  stability_window_seconds: float = 3.0
  backend_name: str = "document-scanner-backend"

  class Config:
    env_file = ".env"


settings = Settings()
