"""Application configuration."""

import logging
import warnings
from typing import List, Union, Optional
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class ProductionConfigError(Exception):
    """Raised when production configuration is invalid."""

    pass


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    APP_NAME: str = "Geetanjali"
    APP_VERSION: str = "1.8.0"  # Set via APP_VERSION env var at deploy (from git tag)
    APP_ENV: str = "development"
    DEBUG: bool = False  # Safe default: False
    LOG_LEVEL: str = "INFO"

    # Database
    DATABASE_URL: str = (
        "postgresql://geetanjali:geetanjali_dev_pass@localhost:5432/geetanjali"
    )
    # P0.4 FIX: Increased pool size for production workloads
    # Previous: pool_size=5, max_overflow=10 (max 15 connections)
    # New: pool_size=20, max_overflow=30 (max 50 connections)
    # PostgreSQL default max_connections=100, leaving headroom for admin/monitoring
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 30
    DB_POOL_RECYCLE: int = 3600
    DB_POOL_PRE_PING: bool = True
    DB_ECHO: bool = False  # Log all SQL queries (very verbose, for debugging only)

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
    LLM_USE_FEW_SHOTS: bool = False  # Include few-shot example in prompts (increases tokens)
    LLM_FALLBACK_PROVIDER: str = "mock"  # Fallback provider: anthropic, ollama, or mock
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

    # Health Check
    HEALTH_CHECK_TIMEOUT: int = 2  # Seconds to wait for service health checks

    # Embeddings
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384

    # RAG Pipeline
    RAG_TOP_K_VERSES: int = 5
    RAG_TOP_M_COMMENTARIES: int = 3
    RAG_CONFIDENCE_THRESHOLD: float = 0.7
    RAG_SCHOLAR_REVIEW_THRESHOLD: float = 0.6

    # Content Moderation
    CONTENT_FILTER_ENABLED: bool = True  # Master switch for all content filtering
    CONTENT_FILTER_BLOCKLIST_ENABLED: bool = True  # Layer 1: Pre-submission blocklist
    CONTENT_FILTER_LLM_REFUSAL_DETECTION: bool = True  # Layer 2: Detect LLM refusals

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
    FOLLOW_UP_RATE_LIMIT: str = "30/hour"  # Rate limit for follow-up endpoint (3x analyze)

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
    CACHE_TTL_PUBLIC_CASE: int = 3600  # 1 hour Redis TTL for public cases
    CACHE_TTL_PUBLIC_CASE_HTTP: int = (
        60  # 1 minute browser cache (short for fast revocation)
    )
    CACHE_TTL_SITEMAP: int = 3600  # 1 hour
    CACHE_TTL_FEED: int = 3600  # 1 hour
    CACHE_TTL_RAG_OUTPUT: int = 86400  # 24 hours

    # Public case sharing
    PUBLIC_CASE_EXPIRY_DAYS: int = 90  # Days until public case links expire (0 = never)

    # RQ Task Queue (optional - falls back to FastAPI BackgroundTasks)
    RQ_ENABLED: bool = True  # Set False to use BackgroundTasks only
    RQ_QUEUE_NAME: str = "geetanjali"
    RQ_JOB_TIMEOUT: int = 300  # 5 minutes max per job
    RQ_RETRY_DELAYS: str = "30,120"  # Retry after 30s, then 2min (comma-separated)

    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"

    # Email (Resend)
    RESEND_API_KEY: Optional[str] = None  # Set in .env to enable email
    CONTACT_EMAIL_TO: Optional[str] = (
        None  # Recipient for contact form - MUST set in .env
    )
    CONTACT_EMAIL_FROM: Optional[str] = (
        None  # Sender address - MUST set in .env (use verified domain)
    )

    # Monitoring (Sentry)
    SENTRY_DSN: Optional[str] = None  # Set in .env to enable error tracking
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1  # 10% of requests for performance monitoring

    @field_validator(
        # Only apply to truly Optional fields (can be None)
        "ANTHROPIC_API_KEY",
        "RESEND_API_KEY",
        "CONTACT_EMAIL_TO",
        "CONTACT_EMAIL_FROM",
        "REDIS_URL",
        "CHROMA_HOST",
        "SENTRY_DSN",
        mode="before",
    )
    @classmethod
    def empty_string_to_none(cls, v: Optional[str]) -> Optional[str]:
        """Convert empty strings to None for Optional fields only.

        This handles Docker Compose ${VAR:-} for optional API keys/URLs.
        Required fields should NOT use this validator - they should
        fail fast if not properly set in .env.
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

    @model_validator(mode="after")
    def validate_production_config(self) -> "Settings":
        """Validate configuration for production environment.

        In production (APP_ENV=production), the application will refuse to start
        if critical security settings are misconfigured. This fail-fast approach
        ensures deployment issues are caught immediately rather than at runtime.
        """
        if self.APP_ENV != "production":
            return self

        errors: list[str] = []

        # ========================================
        # CRITICAL: Secrets must not use defaults
        # ========================================
        insecure_defaults = {
            "JWT_SECRET": "dev-secret-key-change-in-production-use-env-var",
            "API_KEY": "dev-api-key-12345",
        }

        for field, default_value in insecure_defaults.items():
            if getattr(self, field) == default_value:
                errors.append(
                    f"{field} is using insecure default value. "
                    f"Set {field} environment variable."
                )

        # ========================================
        # LLM provider validation
        # ========================================
        # Ollama and mock are valid self-contained providers - no external API needed
        # Anthropic requires API key when used as primary or fallback
        valid_providers = {"ollama", "anthropic", "mock"}

        if self.LLM_PROVIDER not in valid_providers:
            errors.append(
                f"LLM_PROVIDER={self.LLM_PROVIDER} is not valid. "
                f"Use one of: {', '.join(valid_providers)}"
            )

        # Only require Anthropic key if it's the configured provider
        if self.LLM_PROVIDER == "anthropic" and not self.ANTHROPIC_API_KEY:
            errors.append(
                "LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set. "
                "Set ANTHROPIC_API_KEY or use LLM_PROVIDER=ollama."
            )

        # Warn if Anthropic is fallback but key is missing (degraded fallback)
        is_anthropic_fallback = self.LLM_FALLBACK_PROVIDER == "anthropic"
        if (
            is_anthropic_fallback
            and self.LLM_FALLBACK_ENABLED
            and not self.ANTHROPIC_API_KEY
        ):
            logger.warning(
                "PRODUCTION: LLM_FALLBACK_PROVIDER=anthropic but ANTHROPIC_API_KEY not set. "
                "Fallback to Anthropic will not work."
            )

        # Info log for self-contained providers (not warnings - they're valid choices)
        if self.LLM_PROVIDER == "ollama":
            logger.info("PRODUCTION: Using Ollama as primary LLM provider.")
        if self.LLM_PROVIDER == "mock":
            logger.info("PRODUCTION: Using mock LLM provider (for testing only).")

        # ========================================
        # SECURITY: Cookie and transport settings
        # ========================================
        if not self.COOKIE_SECURE:
            errors.append(
                "COOKIE_SECURE=False in production. "
                "Set COOKIE_SECURE=True (requires HTTPS)."
            )

        # ========================================
        # SECURITY: DEBUG must be disabled
        # ========================================
        if self.DEBUG:
            errors.append(
                "DEBUG=True in production. "
                "Set DEBUG=False for production deployments."
            )

        # ========================================
        # SECURITY: CORS origins validation
        # ========================================
        localhost_origins = [
            o for o in self.CORS_ORIGINS if "localhost" in o or "127.0.0.1" in o
        ]
        if localhost_origins and len(self.CORS_ORIGINS) == len(localhost_origins):
            errors.append(
                "CORS_ORIGINS only contains localhost addresses. "
                "Set CORS_ORIGINS to your production domain(s)."
            )

        # ========================================
        # OPTIONAL: Recommended services
        # ========================================
        if not self.REDIS_URL:
            logger.warning(
                "PRODUCTION: REDIS_URL not set. Caching will be disabled. "
                "Redis is recommended for production performance."
            )

        if not self.RESEND_API_KEY:
            logger.warning(
                "PRODUCTION: RESEND_API_KEY not set. Email notifications disabled."
            )
        elif not self.CONTACT_EMAIL_TO or not self.CONTACT_EMAIL_FROM:
            logger.warning(
                "PRODUCTION: RESEND_API_KEY is set but CONTACT_EMAIL_TO or CONTACT_EMAIL_FROM missing. "
                "Set both in .env for email to work."
            )

        # ========================================
        # FAIL FAST: Exit if critical errors found
        # ========================================
        if errors:
            error_msg = (
                "\n" + "=" * 60 + "\n"
                "PRODUCTION CONFIGURATION ERROR\n"
                "=" * 60 + "\n"
                "The application cannot start due to configuration issues:\n\n"
            )
            for i, error in enumerate(errors, 1):
                error_msg += f"  {i}. {error}\n"
            error_msg += (
                "\n" + "=" * 60 + "\n"
                "Fix these issues before deploying to production.\n"
                "Set APP_ENV=development to bypass these checks.\n"
                "=" * 60 + "\n"
            )

            # Log the error and exit
            logger.critical(error_msg)
            raise ProductionConfigError(error_msg)

        logger.info("Production configuration validated successfully.")
        return self

    class Config:
        # Read from project root .env (one level up from backend/)
        env_file = "../.env"
        case_sensitive = True
        extra = "ignore"  # Ignore POSTGRES_*, VITE_* vars used by docker/frontend


# Global settings instance
settings = Settings()
