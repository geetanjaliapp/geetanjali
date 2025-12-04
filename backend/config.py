"""Application configuration."""

import logging
import warnings
from typing import List, Union, Optional
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    APP_NAME: str = "Geetanjali"
    APP_ENV: str = "development"
    DEBUG: bool = False  # Safe default: False
    LOG_LEVEL: str = "INFO"

    # Database
    DATABASE_URL: str = (
        "postgresql://geetanjali:geetanjali_dev_pass@localhost:5432/geetanjali"
    )
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_RECYCLE: int = 3600
    DB_POOL_PRE_PING: bool = True

    # Vector Database (ChromaDB)
    CHROMA_HOST: Optional[str] = None  # If set, use HTTP client instead of local
    CHROMA_PORT: int = 8000
    CHROMA_PERSIST_DIRECTORY: str = "./chroma_data"
    CHROMA_COLLECTION_NAME: str = "gita_verses"
    CHROMA_MAX_RETRIES: int = 3
    CHROMA_RETRY_MIN_WAIT: int = 1
    CHROMA_RETRY_MAX_WAIT: int = 5

    # LLM Configuration
    # Primary LLM Provider: anthropic, ollama, or mock
    LLM_PROVIDER: str = "anthropic"  # Primary provider
    LLM_FALLBACK_ENABLED: bool = True  # Enable fallback to secondary provider
    USE_MOCK_LLM: bool = False  # Use mock LLM for testing (overrides provider setting)

    # Anthropic (Claude)
    ANTHROPIC_API_KEY: Optional[str] = None  # Required for Anthropic
    ANTHROPIC_MODEL: str = (
        "claude-haiku-4-5-20251001"  # Haiku 4.5 - fast, cost-effective
    )
    ANTHROPIC_MAX_TOKENS: int = 2048
    ANTHROPIC_TIMEOUT: int = 30

    # Ollama (Local fallback)
    OLLAMA_ENABLED: bool = True  # Set to False to disable Ollama dependency
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5:3b"
    OLLAMA_TIMEOUT: int = 300  # 5 minutes for local inference
    OLLAMA_MAX_RETRIES: int = 2
    OLLAMA_RETRY_MIN_WAIT: int = 1
    OLLAMA_RETRY_MAX_WAIT: int = 10
    OLLAMA_MAX_TOKENS: int = 1024  # Balanced token limit

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
    CORS_ORIGINS: Union[str, List[str]] = [
        "http://localhost",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]
    API_KEY: str = "dev-api-key-12345"
    ANALYZE_RATE_LIMIT: str = "10/hour"  # Rate limit for analyze endpoint

    # Authentication / JWT
    JWT_SECRET: str = (
        "dev-secret-key-change-in-production-use-env-var"  # MUST be set via env var in production
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = (
        60  # 60 minutes - short-lived, auto-refreshed by frontend
    )
    REFRESH_TOKEN_EXPIRE_DAYS: int = 90  # 90 days - long-lived for convenience

    # Cookie Security
    COOKIE_SECURE: bool = False  # Set to True in production (requires HTTPS)

    # CSRF Protection
    CSRF_TOKEN_COOKIE_KEY: str = "csrf_token"
    CSRF_HEADER_NAME: str = "X-CSRF-Token"

    # Redis Cache (optional - app works without it)
    REDIS_URL: Optional[str] = None
    REDIS_ENABLED: bool = True  # Set False to disable caching entirely

    # Cache TTLs (seconds)
    CACHE_TTL_VERSE: int = 86400  # 24 hours
    CACHE_TTL_VERSE_LIST: int = 3600  # 1 hour
    CACHE_TTL_DAILY_VERSE: int = 0  # Calculated dynamically to midnight
    CACHE_TTL_USER_PROFILE: int = 900  # 15 minutes

    # RQ Task Queue (optional - falls back to FastAPI BackgroundTasks)
    RQ_ENABLED: bool = True  # Set False to use BackgroundTasks only
    RQ_QUEUE_NAME: str = "geetanjali"
    RQ_JOB_TIMEOUT: int = 300  # 5 minutes max per job
    RQ_RETRY_DELAYS: str = "30,120"  # Retry after 30s, then 2min (comma-separated)

    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"

    # Email (Resend)
    RESEND_API_KEY: Optional[str] = None  # Required for email sending
    CONTACT_EMAIL_TO: str = (
        "viks@vnykmshr.com"  # Recipient for contact form (registered in Resend)
    )
    CONTACT_EMAIL_FROM: str = (
        "Geetanjali <onboarding@resend.dev>"  # Use resend.dev for testing until domain verified
    )

    @field_validator(
        "APP_ENV",
        "LOG_LEVEL",
        "LLM_PROVIDER",
        "ANTHROPIC_MODEL",
        "OLLAMA_MODEL",
        "OLLAMA_BASE_URL",
        "ANTHROPIC_API_KEY",
        "RESEND_API_KEY",
        mode="before",
    )
    @classmethod
    def empty_string_to_none(cls, v: Optional[str]) -> Optional[str]:
        """Convert empty strings to None so defaults apply.

        Docker Compose passes empty strings for ${VAR:-} when unset.
        This ensures config.py defaults are used instead.
        """
        if v == "":
            return None
        return v

    @field_validator("DEBUG", "USE_MOCK_LLM", mode="before")
    @classmethod
    def empty_string_to_false(cls, v) -> bool:
        """Convert empty strings to False for boolean fields."""
        if v == "" or v is None:
            return False
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.lower() in ("true", "1", "yes")
        return bool(v)

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        """Parse CORS_ORIGINS from comma-separated string or list."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    @model_validator(mode="after")
    def warn_insecure_defaults(self) -> "Settings":
        """Warn if using insecure default values in non-DEBUG mode."""
        insecure_defaults = {
            "JWT_SECRET": "dev-secret-key-change-in-production-use-env-var",
            "API_KEY": "dev-api-key-12345",
        }

        for field, default_value in insecure_defaults.items():
            current_value = getattr(self, field)
            if current_value == default_value:
                if self.DEBUG:
                    logger.warning(
                        f"SECURITY: {field} is using default value. "
                        f"Set via environment variable for production."
                    )
                else:
                    # In non-DEBUG mode, emit a stronger warning
                    warnings.warn(
                        f"SECURITY WARNING: {field} is using insecure default value! "
                        f"Set {field} environment variable before deploying to production.",
                        UserWarning,
                        stacklevel=2,
                    )

        # Warn if COOKIE_SECURE is False in non-DEBUG mode
        if not self.COOKIE_SECURE and not self.DEBUG:
            logger.warning(
                "SECURITY: COOKIE_SECURE=False in non-DEBUG mode. "
                "Set COOKIE_SECURE=True for HTTPS deployments."
            )

        return self

    class Config:
        # Read from project root .env (one level up from backend/)
        env_file = "../.env"
        case_sensitive = True
        extra = "ignore"  # Ignore POSTGRES_*, VITE_* vars used by docker/frontend


# Global settings instance
settings = Settings()
