"""Application configuration."""

import logging
import warnings
from pathlib import Path

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
    APP_VERSION: str = "1.16.0"  # Set via APP_VERSION env var at deploy (from git tag)
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
    DB_POOL_TIMEOUT: int = 10  # Seconds to wait for connection from pool (web tier)
    DB_POOL_PRE_PING: bool = True
    DB_ECHO: bool = False  # Log all SQL queries (very verbose, for debugging only)

    # Vector Database (ChromaDB)
    CHROMA_HOST: str | None = None  # If set, use HTTP client instead of local
    CHROMA_PORT: int = 8000
    CHROMA_PERSIST_DIRECTORY: str = "./chroma_data"
    CHROMA_COLLECTION_NAME: str = "gita_verses"
    CHROMA_MAX_RETRIES: int = 3
    CHROMA_RETRY_MIN_WAIT: int = 1
    CHROMA_RETRY_MAX_WAIT: int = 5

    # ============================================================
    # LLM CONFIGURATION
    # ============================================================
    # Provider routing (automatic):
    #   anthropic, gemini → Single-pass (external LLMs, high quality)
    #   ollama + MULTIPASS_ENABLED=true → Multipass (5-pass refinement)
    #   ollama + MULTIPASS_ENABLED=false → Single-pass
    #   mock → Instant test responses
    # ============================================================
    #
    # Primary LLM Provider: anthropic, gemini, ollama, or mock
    # Recommended setup:
    #   Development: LLM_PROVIDER=ollama (local-first, no API costs)
    #   Production:  LLM_PROVIDER=anthropic or gemini (best quality)
    LLM_PROVIDER: str = "anthropic"  # Primary provider
    LLM_USE_FEW_SHOTS: bool = (
        False  # Include few-shot example in prompts (increases tokens)
    )
    # Fallback provider: anthropic, gemini, ollama, or mock
    # Provides resilience when primary provider fails or circuit breaker opens
    # Fallback events are tracked via geetanjali_llm_fallback_total metric
    # with labels: primary, fallback, reason (circuit_open, retries_exhausted, error)
    LLM_FALLBACK_PROVIDER: str = "mock"  # Fallback provider
    LLM_FALLBACK_ENABLED: bool = True  # Enable fallback to secondary provider
    USE_MOCK_LLM: bool = False  # Use mock LLM for testing (overrides provider setting)

    # Anthropic (Claude)
    ANTHROPIC_API_KEY: str | None = None  # Required for Anthropic
    ANTHROPIC_MODEL: str = (
        "claude-haiku-4-5-20251001"  # Haiku 4.5 - fast, cost-effective
    )
    ANTHROPIC_MAX_TOKENS: int = 2048
    ANTHROPIC_TIMEOUT: int = 30

    # Gemini (Google)
    # Get API key: https://aistudio.google.com/apikey
    GOOGLE_API_KEY: str | None = None  # Required for Gemini
    GEMINI_MODEL: str = "gemini-2.5-flash"  # Fast, cost-effective (85% cheaper than Claude)
    GEMINI_MAX_TOKENS: int = 4096  # Higher than Anthropic - Gemini needs more for consultations
    GEMINI_TIMEOUT: int = 30000  # Milliseconds (SDK uses ms, not seconds)

    # Ollama (Local fallback)
    OLLAMA_ENABLED: bool = True  # Set to False to disable Ollama dependency
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5:3b"
    OLLAMA_TIMEOUT: int = 300  # 5 minutes per request (matches production)
    OLLAMA_MAX_RETRIES: int = 2
    OLLAMA_RETRY_MIN_WAIT: int = 1
    OLLAMA_RETRY_MAX_WAIT: int = 10
    OLLAMA_MAX_TOKENS: int = 1024  # Balanced token limit
    OLLAMA_KEEP_ALIVE: str = "1h"  # How long model stays in memory (5m, 1h, 24h, -1=never)

    # --- LLM Circuit Breaker ---
    # Shared for all LLM providers (Anthropic, Gemini, Ollama)
    # Opens after consecutive failures; tests recovery after timeout
    CB_LLM_FAILURE_THRESHOLD: int = 3  # Failures before opening circuit
    CB_LLM_RECOVERY_TIMEOUT: int = 60  # Seconds before testing recovery

    # ========================================
    # Multi-Pass Ollama Consultation Settings
    # ========================================
    # 5-pass workflow: Acceptance → Draft → Critique → Refine → Structure
    # See: todos/ollama-consultations-refined.md for full specification
    #
    # Feature flag (master switch for multi-pass workflow)
    MULTIPASS_ENABLED: bool = False  # Disabled by default; enable in .env
    #
    # Single-pass fallback if multi-pass fails completely
    MULTIPASS_FALLBACK_TO_SINGLE_PASS: bool = True
    #
    # Pass temperatures (tuned per pass role)
    # Pass 0 (Acceptance): Deterministic gate - should be consistent
    MULTIPASS_TEMP_ACCEPTANCE: float = 0.1
    # Pass 1 (Draft): Creative reasoning - warmer for diverse ideas
    MULTIPASS_TEMP_DRAFT: float = 0.65
    # Pass 2 (Critique): Analytical review - cooler for focused critique
    MULTIPASS_TEMP_CRITIQUE: float = 0.2
    # Pass 3 (Refine): Disciplined rewrite - balanced
    MULTIPASS_TEMP_REFINE: float = 0.35
    # Pass 4 (Structure): JSON formatting - deterministic
    MULTIPASS_TEMP_STRUCTURE: float = 0.1
    #
    # Pass timeouts: Each pass uses OLLAMA_TIMEOUT (or ANTHROPIC_TIMEOUT).
    # Total multipass duration = 5 passes × provider timeout.
    # RQ_JOB_TIMEOUT must be >= total to avoid premature job termination.
    # (Calculated automatically - see MULTIPASS_PASS_COUNT below)
    MULTIPASS_PASS_COUNT: int = 5  # Acceptance + Draft + Critique + Refine + Structure
    #
    # Pass token limits (reduced for faster local inference)
    # qwen2.5:3b generates ~9 tokens/sec, so lower limits = faster passes
    MULTIPASS_TOKENS_ACCEPTANCE: int = 500  # Short validation response
    MULTIPASS_TOKENS_DRAFT: int = 1000  # Concise reasoning prose
    MULTIPASS_TOKENS_CRITIQUE: int = 600  # Focused bullet critique
    MULTIPASS_TOKENS_REFINE: int = 1000  # Concise refined prose
    MULTIPASS_TOKENS_STRUCTURE: int = 1200  # Compact JSON output
    #
    # Rejection message generation (only for ~3-5% rejected cases)
    MULTIPASS_TEMP_REJECTION: float = 0.3  # Slightly creative for kind tone
    MULTIPASS_TIMEOUT_REJECTION: int = 5  # Fast - just generating a message
    MULTIPASS_TOKENS_REJECTION: int = 200  # Short message
    #
    # Retry budgets per pass (0 = no retries)
    MULTIPASS_RETRIES_ACCEPTANCE: int = 0  # No retry - acceptance is final
    MULTIPASS_RETRIES_DRAFT: int = 1
    MULTIPASS_RETRIES_CRITIQUE: int = 1
    MULTIPASS_RETRIES_REFINE: int = 1
    MULTIPASS_RETRIES_STRUCTURE: int = 2  # Extra retry for JSON issues
    #
    # Scholar flag thresholds
    MULTIPASS_CONFIDENCE_HIGH: float = 0.85  # No scholar flag
    MULTIPASS_CONFIDENCE_LOW: float = 0.65  # Always flag below this
    #
    # Comparison mode settings (Phase 3: run both pipelines, collect data)
    # When enabled, runs both single-pass and multi-pass for quality comparison
    MULTIPASS_COMPARISON_MODE: bool = False  # Enable comparison data collection
    # Which pipeline to use for user response during comparison
    # Options: "multipass" (default) or "singlepass"
    MULTIPASS_COMPARISON_PRIMARY: str = "multipass"
    # Sample rate for comparison mode (1.0 = all requests, 0.1 = 10%)
    MULTIPASS_COMPARISON_SAMPLE_RATE: float = 1.0

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

    # Follow-up Pipeline
    FOLLOW_UP_MAX_TOKENS: int = 1024  # Token limit for conversational follow-ups

    # Content Moderation
    CONTENT_FILTER_ENABLED: bool = True  # Master switch for all content filtering
    CONTENT_FILTER_BLOCKLIST_ENABLED: bool = True  # Layer 1: Pre-submission blocklist
    CONTENT_FILTER_PROFANITY_ENABLED: bool = True  # Layer 1: Profanity/abuse detection
    CONTENT_FILTER_LLM_REFUSAL_DETECTION: bool = True  # Layer 2: Detect LLM refusals

    # API
    API_V1_PREFIX: str = "/api/v1"
    CORS_ORIGINS: str | list[str] = [
        "http://localhost",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]
    # NOTE: Default is for dev only. Production validation will FAIL TO START if used.
    API_KEY: str = "dev-api-key-12345"
    ANALYZE_RATE_LIMIT: str = "10/hour"  # Rate limit for analyze endpoint
    FOLLOW_UP_RATE_LIMIT: str = (
        "30/hour"  # Rate limit for follow-up endpoint (3x analyze)
    )

    # Authentication / JWT
    # NOTE: Default is for dev only. Production validation (validate_production_config)
    # will FAIL TO START if this default is used when APP_ENV=production.
    JWT_SECRET: str = "dev-secret-key-change-in-production-use-env-var"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = (
        15  # 15 minutes - short-lived, proactively refreshed by frontend
    )
    REFRESH_TOKEN_EXPIRE_DAYS: int = 90  # 90 days - long-lived for convenience

    # Cookie Security
    COOKIE_SECURE: bool = False  # Set to True in production (requires HTTPS)

    # CSRF Protection
    CSRF_TOKEN_COOKIE_KEY: str = "csrf_token"
    CSRF_HEADER_NAME: str = "X-CSRF-Token"

    # Redis Cache (optional - app works without it)
    REDIS_URL: str | None = None
    REDIS_ENABLED: bool = True  # Set False to disable caching entirely

    # Cache TTLs (seconds)
    CACHE_TTL_VERSE: int = 86400  # 24 hours
    CACHE_TTL_VERSE_LIST: int = 3600  # 1 hour
    CACHE_TTL_DAILY_VERSE: int = 0  # Calculated dynamically to midnight
    CACHE_TTL_METADATA: int = 86400  # 24 hours - book/chapter metadata is static
    CACHE_TTL_SEARCH: int = 300  # 5 minutes - short TTL for burst protection
    CACHE_TTL_PRINCIPLES: int = 3600  # 1 hour - principles list rarely changes
    CACHE_TTL_FEATURED_COUNT: int = 3600  # 1 hour - featured count rarely changes
    CACHE_TTL_FEATURED_CASES: int = (
        86400  # 24 hours - featured cases are static content
    )
    CACHE_TTL_VIEW_DEDUPE: int = 86400  # 24 hours - view count deduplication window
    CACHE_TTL_PUBLIC_CASE: int = 3600  # 1 hour Redis TTL for public cases
    CACHE_TTL_PUBLIC_CASE_HTTP: int = 300  # 5 minutes browser cache
    CACHE_TTL_SITEMAP: int = 3600  # 1 hour
    CACHE_TTL_FEED: int = 3600  # 1 hour
    CACHE_TTL_RAG_OUTPUT: int = 86400  # 24 hours
    CACHE_TTL_DAILY_COUNTER: int = (
        172800  # 48 hours - daily counters with timezone safety
    )

    # Public case sharing
    PUBLIC_CASE_EXPIRY_DAYS: int = 90  # Days until public case links expire (0 = never)

    # RQ Task Queue (optional - falls back to FastAPI BackgroundTasks)
    RQ_ENABLED: bool = True  # Set False to use BackgroundTasks only
    RQ_QUEUE_NAME: str = "geetanjali"
    RQ_JOB_TIMEOUT: int = 1800  # 30 minutes for multi-pass pipeline (generous)
    RQ_RETRY_DELAYS: str = "30,120"  # Retry after 30s, then 2min (comma-separated)
    RQ_RESULT_TTL: int = 86400  # 24 hours - cleanup successful job results
    RQ_FAILURE_TTL: int = 86400  # 24 hours - cleanup failed job results
    STALE_PROCESSING_TIMEOUT: int = (
        600  # 10 minutes - auto-fail cases stuck in PROCESSING (multipass can take 5-7min)
    )

    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"

    # Audio Files
    AUDIO_FILES_PATH: str = "../public/audio"  # Relative to backend/ or absolute

    # Email (Resend)
    RESEND_API_KEY: str | None = None  # Set in .env to enable email
    CONTACT_EMAIL_TO: str | None = None  # Recipient for contact form - MUST set in .env
    CONTACT_EMAIL_FROM: str | None = (
        None  # Sender address - MUST set in .env (use verified domain)
    )

    # Newsletter
    NEWSLETTER_DRY_RUN: bool = (
        True  # Default safe: log emails, don't send. Set False in prod.
    )

    # Monitoring (Sentry)
    SENTRY_DSN: str | None = None  # Set in .env to enable error tracking
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1  # 10% of requests for performance monitoring

    # Circuit Breaker Configuration
    # Circuit breakers protect against cascading failures by stopping requests
    # to failing services. After recovery_timeout seconds, a single request
    # is allowed through to test if the service has recovered.
    #
    # Note: LLM circuit breaker (CB_LLM_*) is in the LLM Configuration section above.
    #
    # Email circuit breaker (higher threshold - email failures less critical)
    CB_EMAIL_FAILURE_THRESHOLD: int = 5  # Failures before opening circuit
    CB_EMAIL_RECOVERY_TIMEOUT: int = 60  # Seconds before testing recovery
    #
    # ChromaDB/VectorStore circuit breaker
    CB_CHROMADB_FAILURE_THRESHOLD: int = 3  # Failures before opening circuit
    CB_CHROMADB_RECOVERY_TIMEOUT: int = 60  # Seconds before testing recovery

    @field_validator(
        # Only apply to truly Optional fields (can be None)
        "ANTHROPIC_API_KEY",
        "GOOGLE_API_KEY",
        "RESEND_API_KEY",
        "CONTACT_EMAIL_TO",
        "CONTACT_EMAIL_FROM",
        "REDIS_URL",
        "CHROMA_HOST",
        "SENTRY_DSN",
        mode="before",
    )
    @classmethod
    def empty_string_to_none(cls, v: str | None) -> str | None:
        """Convert empty strings to None for Optional fields only.

        This handles Docker Compose ${VAR:-} for optional API keys/URLs.
        Required fields should NOT use this validator - they should
        fail fast if not properly set in .env.
        """
        if v == "":
            return None
        return v

    @field_validator(
        "DEBUG",
        "USE_MOCK_LLM",
        "MULTIPASS_ENABLED",
        "MULTIPASS_FALLBACK_TO_SINGLE_PASS",
        "MULTIPASS_COMPARISON_MODE",
        mode="before",
    )
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
    def parse_cors_origins(cls, v: str | list[str]) -> list[str]:
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
        # Anthropic and Gemini require API keys when used as primary or fallback
        valid_providers = {"ollama", "anthropic", "gemini", "mock"}

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

        # Only require Gemini key if it's the configured provider
        if self.LLM_PROVIDER == "gemini" and not self.GOOGLE_API_KEY:
            errors.append(
                "LLM_PROVIDER=gemini but GOOGLE_API_KEY is not set. "
                "Set GOOGLE_API_KEY or use LLM_PROVIDER=ollama."
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

        # Warn if Gemini is fallback but key is missing (degraded fallback)
        is_gemini_fallback = self.LLM_FALLBACK_PROVIDER == "gemini"
        if (
            is_gemini_fallback
            and self.LLM_FALLBACK_ENABLED
            and not self.GOOGLE_API_KEY
        ):
            logger.warning(
                "PRODUCTION: LLM_FALLBACK_PROVIDER=gemini but GOOGLE_API_KEY not set. "
                "Fallback to Gemini will not work."
            )

        # Info log for provider selection
        if self.LLM_PROVIDER == "gemini":
            logger.info("PRODUCTION: Using Gemini as primary LLM provider.")
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
        # OPTIONAL: Audio files path validation
        # ========================================
        audio_path = Path(self.AUDIO_FILES_PATH)
        if not audio_path.is_absolute():
            # Resolve relative to backend/ directory
            audio_path = Path(__file__).parent / self.AUDIO_FILES_PATH
        if not audio_path.exists():
            logger.warning(
                f"PRODUCTION: AUDIO_FILES_PATH '{self.AUDIO_FILES_PATH}' does not exist. "
                "Audio recitations will not be available. Run 'git lfs pull' to download audio files."
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

    @property
    def MULTIPASS_MAX_DURATION(self) -> int:
        """Calculate maximum expected duration for multi-pass pipeline.

        Each pass uses the provider timeout (OLLAMA_TIMEOUT or ANTHROPIC_TIMEOUT).
        Total = MULTIPASS_PASS_COUNT × provider_timeout.

        Returns:
            int: Maximum expected duration in seconds.
        """
        # Multipass is designed for Ollama; use its timeout as the base
        provider_timeout = self.OLLAMA_TIMEOUT if self.OLLAMA_ENABLED else self.ANTHROPIC_TIMEOUT
        return self.MULTIPASS_PASS_COUNT * provider_timeout

    @model_validator(mode="after")
    def validate_rq_timeout(self) -> "Settings":
        """Warn if RQ_JOB_TIMEOUT is less than expected multipass duration.

        This validation ensures the background job won't be killed before
        the multi-pass pipeline can complete all passes.
        """
        if not self.MULTIPASS_ENABLED or not self.RQ_ENABLED:
            return self

        max_duration = self.MULTIPASS_MAX_DURATION
        if self.RQ_JOB_TIMEOUT < max_duration:
            logger.warning(
                f"RQ_JOB_TIMEOUT ({self.RQ_JOB_TIMEOUT}s) is less than "
                f"MULTIPASS_MAX_DURATION ({max_duration}s = {self.MULTIPASS_PASS_COUNT} passes × "
                f"{self.OLLAMA_TIMEOUT}s OLLAMA_TIMEOUT). "
                f"Multi-pass jobs may be terminated prematurely. "
                f"Consider increasing RQ_JOB_TIMEOUT or reducing OLLAMA_TIMEOUT."
            )

        return self

    class Config:
        # Read from project root .env (one level up from backend/)
        env_file = "../.env"
        case_sensitive = True
        extra = "ignore"  # Ignore POSTGRES_*, VITE_* vars used by docker/frontend


# Global settings instance
settings = Settings()
