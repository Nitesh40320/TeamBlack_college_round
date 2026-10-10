from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    HOST: str = "0.0.0.0"
    PORT: int = 8000
    MODEL_MODE: Literal["mock", "live"] = "mock"
    VERSION: str = "0.1.0"

    LLM_PROVIDER: Literal["gemini", "openai", "anthropic", "fake"] = "fake"
    LLM_API_KEY: str = ""
    LLM_MODEL_NAME: str = ""

    EMBEDDING_MODEL_NAME: str = "all-MiniLM-L6-v2"
    NLI_MODEL_NAME: str = "cross-encoder/nli-deberta-v3-small"
    RETRIEVER_TOP_K: int = 5


settings = Settings()

