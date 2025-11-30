"""Application configuration."""

import os
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    APP_NAME: str = "Geetanjali"
    APP_ENV: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"

    # Database
    DATABASE_URL: str = "sqlite:///./geetanjali.db"
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_RECYCLE: int = 3600
    DB_POOL_PRE_PING: bool = True

    # Vector Database (ChromaDB)
    CHROMA_PERSIST_DIRECTORY: str = "./chroma_data"
    CHROMA_COLLECTION_NAME: str = "gita_verses"
    CHROMA_MAX_RETRIES: int = 3
    CHROMA_RETRY_MIN_WAIT: int = 1
    CHROMA_RETRY_MAX_WAIT: int = 5

    # LLM (Ollama)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.1:8b"
    OLLAMA_TIMEOUT: int = 60
    OLLAMA_MAX_RETRIES: int = 3
    OLLAMA_RETRY_MIN_WAIT: int = 1
    OLLAMA_RETRY_MAX_WAIT: int = 10

    # Embeddings
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384

    # RAG Pipeline
    RAG_TOP_K_VERSES: int = 5
    RAG_TOP_M_COMMENTARIES: int = 3
    RAG_CONFIDENCE_THRESHOLD: float = 0.7
    RAG_SCHOLAR_REVIEW_THRESHOLD: float = 0.6

    # API
    API_V1_PREFIX: str = "/api/v1"
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]
    API_KEY: str = "dev-api-key-12345"
    ANALYZE_RATE_LIMIT: str = "10/hour"  # Rate limit for analyze endpoint

    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"

    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
