"""Hybrid LLM service with configurable primary/fallback providers."""

import logging
from enum import Enum
from typing import Any

import httpx
from tenacity import (
    before_sleep_log,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

try:
    from anthropic import Anthropic, AnthropicError, APIConnectionError, APITimeoutError

    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

try:
    from google import genai
    from google.genai import types as genai_types
    from google.genai.errors import ClientError, ServerError

    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

from config import settings
from services.mock_llm import MockLLMService
from utils.circuit_breaker import CircuitBreaker, CircuitBreakerOpen
from utils.exceptions import LLMError, RetryableLLMError
from utils.metrics_llm import (
    llm_circuit_breaker_state,
    llm_fallback_total,
    llm_requests_total,
    llm_tokens_total,
)

logger = logging.getLogger(__name__)


class LLMProvider(str, Enum):
    """LLM provider types."""

    ANTHROPIC = "anthropic"
    GEMINI = "gemini"
    OLLAMA = "ollama"
    MOCK = "mock"


class LLMCircuitBreaker(CircuitBreaker):
    """
    Circuit breaker for LLM providers.

    Each provider (Anthropic, Gemini, Ollama) has its own circuit breaker instance
    to allow independent failure isolation.
    """

    def __init__(
        self,
        provider: str,
        failure_threshold: int = 3,
        recovery_timeout: float = 60.0,
    ):
        """
        Initialize LLM circuit breaker.

        Args:
            provider: Provider name for metrics (e.g., "anthropic", "gemini", "ollama")
            failure_threshold: Consecutive failures before opening (default: 3)
            recovery_timeout: Seconds before testing recovery (default: 60)
        """
        super().__init__(
            name=f"llm-{provider}",
            failure_threshold=failure_threshold,
            recovery_timeout=recovery_timeout,
        )
        self._provider = provider

    def _update_metric(self, state: str) -> None:
        """Update Prometheus gauge for this provider's circuit breaker state."""
        llm_circuit_breaker_state.labels(provider=self._provider).set(
            self.STATE_VALUES.get(state, 0)
        )


class LLMService:
    """
    Hybrid LLM service with primary and fallback providers.

    Supports: Anthropic Claude, Google Gemini, Ollama (local)
    External providers (Anthropic, Gemini) use single-pass generation.
    Ollama can use single-pass or multipass (5-pass refinement).
    """

    def __init__(self):
        """Initialize LLM service with provider configuration."""
        # Check if mock mode is enabled (overrides all other settings)
        self.use_mock = settings.USE_MOCK_LLM
        self.mock_service = None

        if self.use_mock:
            self.mock_service = MockLLMService()
            logger.info(
                "LLM Service initialized with MOCK provider (fast testing mode)"
            )
            return

        self.primary_provider = LLMProvider(settings.LLM_PROVIDER.lower())
        self.fallback_provider = LLMProvider(settings.LLM_FALLBACK_PROVIDER.lower())
        self.fallback_enabled = settings.LLM_FALLBACK_ENABLED
        self.mock_service = MockLLMService()  # Always available for fallback

        # Initialize Anthropic client if available
        self.anthropic_client = None
        if settings.ANTHROPIC_API_KEY and ANTHROPIC_AVAILABLE:
            self.anthropic_client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            logger.info(f"Anthropic client initialized: {settings.ANTHROPIC_MODEL}")
        elif self.primary_provider == LLMProvider.ANTHROPIC:
            logger.warning(
                "Anthropic selected as primary but API key not set or SDK not installed"
            )

        # Initialize Gemini client if available
        self.gemini_client = None
        if settings.GOOGLE_API_KEY and GEMINI_AVAILABLE:
            self.gemini_client = genai.Client(
                api_key=settings.GOOGLE_API_KEY,
                http_options=genai_types.HttpOptions(timeout=settings.GEMINI_TIMEOUT),
            )
            logger.info(
                f"Gemini client initialized: {settings.GEMINI_MODEL} "
                f"(timeout={settings.GEMINI_TIMEOUT}s)"
            )
        elif self.primary_provider == LLMProvider.GEMINI:
            logger.warning(
                "Gemini selected as primary but API key not set or SDK not installed"
            )

        # Ollama configuration with persistent HTTP client
        self.ollama_enabled = settings.OLLAMA_ENABLED
        self.ollama_base_url = settings.OLLAMA_BASE_URL
        self.ollama_model = settings.OLLAMA_MODEL

        # Create persistent HTTP client for Ollama with connection pooling
        self.ollama_client = httpx.Client(
            base_url=self.ollama_base_url,
            timeout=settings.OLLAMA_TIMEOUT,
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
        )

        # Initialize per-provider circuit breakers (uses config settings)
        self._anthropic_breaker = self._create_circuit_breaker("anthropic")
        self._gemini_breaker = self._create_circuit_breaker("gemini")
        self._ollama_breaker = self._create_circuit_breaker("ollama")

        logger.info(
            f"LLM Service initialized - Primary: {self.primary_provider.value}, "
            f"Fallback: {self.fallback_provider.value if self.fallback_enabled else 'disabled'}"
        )

    def check_health(self) -> bool:
        """
        Check if primary LLM provider is accessible.

        Returns:
            True if healthy, False otherwise
        """
        if self.use_mock:
            return bool(self.mock_service.check_health())

        if self.primary_provider == LLMProvider.ANTHROPIC:
            return self.anthropic_client is not None
        elif self.primary_provider == LLMProvider.GEMINI:
            return self.gemini_client is not None
        elif self.primary_provider == LLMProvider.OLLAMA:
            return self._check_ollama_health()
        return False

    def _create_circuit_breaker(self, provider: str) -> LLMCircuitBreaker:
        """Create a circuit breaker for the given provider.

        All providers share the same failure threshold and recovery timeout
        from config, but maintain independent state.

        Args:
            provider: Provider name (anthropic, gemini, ollama)

        Returns:
            Configured LLMCircuitBreaker instance
        """
        return LLMCircuitBreaker(
            provider=provider,
            failure_threshold=settings.CB_LLM_FAILURE_THRESHOLD,
            recovery_timeout=float(settings.CB_LLM_RECOVERY_TIMEOUT),
        )

    def _check_ollama_health(self) -> bool:
        """Check if Ollama is accessible."""
        if not self.ollama_enabled:
            return False
        try:
            response = self.ollama_client.get("/api/tags", timeout=5)
            return bool(response.status_code == 200)
        except Exception as e:
            logger.error(f"Ollama health check failed: {e}")
            return False

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(min=2, max=10),
        retry=retry_if_exception_type((RetryableLLMError,)),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )
    def _generate_anthropic(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> dict[str, Any]:
        """Generate response using Anthropic Claude with retry and circuit breaker.

        Retry: Up to 3 attempts with exponential backoff (2s, 4s, 8s).
        Circuit Breaker: Opens after 3 consecutive failures, 60s recovery.
        Only retries on RetryableLLMError (timeout, connection errors).
        Permanent errors (auth, invalid request) fail immediately.
        """
        if not self.anthropic_client:
            raise LLMError("Anthropic client not initialized")

        # Check circuit breaker before attempting request
        if not self._anthropic_breaker.allow_request():
            raise CircuitBreakerOpen(
                self._anthropic_breaker.name,
                self._anthropic_breaker.recovery_timeout,
            )

        max_tokens = max_tokens or settings.ANTHROPIC_MAX_TOKENS

        try:
            logger.debug(f"Calling Anthropic Claude with {len(prompt)} char prompt")

            response = self.anthropic_client.messages.create(
                model=settings.ANTHROPIC_MODEL,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_prompt or "",
                messages=[{"role": "user", "content": prompt}],
                timeout=settings.ANTHROPIC_TIMEOUT,
            )

            content_block = response.content[0]
            response_text = (
                content_block.text
                if hasattr(content_block, "text")
                else str(content_block)
            )

            logger.info(
                f"Anthropic response: {len(response_text)} chars, "
                f"{response.usage.input_tokens} in / {response.usage.output_tokens} out tokens"
            )

            # Track LLM metrics and record circuit breaker success
            llm_requests_total.labels(provider="anthropic", status="success").inc()
            llm_tokens_total.labels(provider="anthropic", token_type="input").inc(
                response.usage.input_tokens
            )
            llm_tokens_total.labels(provider="anthropic", token_type="output").inc(
                response.usage.output_tokens
            )
            self._anthropic_breaker.record_success()

            return {
                "response": response_text,
                "model": settings.ANTHROPIC_MODEL,
                "provider": "anthropic",
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            }

        except (APITimeoutError, APIConnectionError) as e:
            # Transient errors - use RetryableLLMError for retry logic
            # Note: Don't record circuit breaker failure here - tenacity will retry.
            # Failure is recorded in generate() after all retries exhaust.
            logger.error(f"Anthropic API error (retryable): {e}")
            llm_requests_total.labels(provider="anthropic", status="error").inc()
            raise RetryableLLMError(f"Anthropic request failed: {str(e)}")
        except AnthropicError as e:
            # Permanent errors (auth, invalid request) - record failure immediately
            self._anthropic_breaker.record_failure()
            logger.error(f"Anthropic error (permanent): {e}")
            llm_requests_total.labels(provider="anthropic", status="error").inc()
            raise LLMError(f"Anthropic error: {str(e)}")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(min=2, max=10),
        retry=retry_if_exception_type((RetryableLLMError,)),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )
    def _generate_gemini(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> dict[str, Any]:
        """Generate response using Google Gemini with retry and circuit breaker.

        Args:
            prompt: User prompt text
            system_prompt: System instruction (optional)
            temperature: Sampling temperature 0.0-2.0 (default: 0.7)
            max_tokens: Maximum tokens to generate (default: settings.GEMINI_MAX_TOKENS)

        Returns:
            Dict with keys: response, model, provider, input_tokens, output_tokens

        Raises:
            LLMError: For client errors, empty responses, or malformed responses
            RetryableLLMError: For transient server/timeout errors (triggers retry)
            CircuitBreakerOpen: When circuit breaker prevents request

        Retry: Up to 3 attempts with exponential backoff (2s, 4s, 8s).
        Circuit Breaker: Opens after 3 consecutive failures, 60s recovery.
        """
        if not self.gemini_client:
            raise LLMError("Gemini client not initialized")

        # Check circuit breaker before attempting request
        if not self._gemini_breaker.allow_request():
            raise CircuitBreakerOpen(
                self._gemini_breaker.name,
                self._gemini_breaker.recovery_timeout,
            )

        max_tokens = max_tokens or settings.GEMINI_MAX_TOKENS

        try:
            logger.debug(
                f"Calling Gemini ({settings.GEMINI_MODEL}) with {len(prompt)} char prompt"
            )

            config = genai_types.GenerateContentConfig(
                system_instruction=system_prompt if system_prompt else None,
                max_output_tokens=max_tokens,
                temperature=temperature,
            )

            response = self.gemini_client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config=config,
            )

            # Guard against malformed response (missing .text or .usage_metadata)
            try:
                response_text = response.text
            except AttributeError:
                raise LLMError("Gemini returned malformed response (missing text)")

            if not response_text or not response_text.strip():
                raise LLMError("Gemini returned empty response")

            # Extract token counts with safe defaults
            try:
                input_tokens = response.usage_metadata.prompt_token_count or 0
                output_tokens = response.usage_metadata.candidates_token_count or 0
            except AttributeError:
                logger.warning("Gemini response missing usage_metadata, using 0 tokens")
                input_tokens = 0
                output_tokens = 0

            logger.info(
                f"Gemini response: {len(response_text)} chars, "
                f"{input_tokens} in / {output_tokens} out tokens"
            )

            # Track LLM metrics and record circuit breaker success
            llm_requests_total.labels(provider="gemini", status="success").inc()
            llm_tokens_total.labels(provider="gemini", token_type="input").inc(
                input_tokens
            )
            llm_tokens_total.labels(provider="gemini", token_type="output").inc(
                output_tokens
            )
            self._gemini_breaker.record_success()

            return {
                "response": response_text,
                "model": settings.GEMINI_MODEL,
                "provider": "gemini",
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
            }

        except (ServerError, httpx.TimeoutException, httpx.ConnectError) as e:
            # Transient errors (server issues, timeouts, connection errors) - retry
            logger.error(f"Gemini API error (retryable): {type(e).__name__}: {e}")
            llm_requests_total.labels(provider="gemini", status="error").inc()
            raise RetryableLLMError(f"Gemini service temporarily unavailable: {type(e).__name__}")
        except ClientError as e:
            # Permanent client errors (auth, invalid request) - fail immediately
            self._gemini_breaker.record_failure()
            logger.error(f"Gemini error (permanent): {type(e).__name__}: {e}")
            llm_requests_total.labels(provider="gemini", status="error").inc()
            raise LLMError(f"Gemini request failed: {e}")
        except LLMError:
            # Re-raise our own errors (empty response, malformed response)
            raise
        except Exception as e:
            # Catch-all for unexpected errors
            self._gemini_breaker.record_failure()
            logger.error(f"Gemini unexpected error: {type(e).__name__}: {e}")
            llm_requests_total.labels(provider="gemini", status="error").inc()
            raise LLMError("Gemini request failed unexpectedly")

    @retry(
        stop=stop_after_attempt(settings.OLLAMA_MAX_RETRIES),
        wait=wait_exponential(
            min=settings.OLLAMA_RETRY_MIN_WAIT, max=settings.OLLAMA_RETRY_MAX_WAIT
        ),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.ConnectError)),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )
    def _make_ollama_request(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Make Ollama request with retry logic using persistent client."""
        response = self.ollama_client.post("/api/generate", json=payload)
        response.raise_for_status()
        return dict(response.json())

    def _generate_ollama(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        simplified: bool = False,
        json_mode: bool = True,
    ) -> dict[str, Any]:
        """
        Generate response using Ollama with circuit breaker.

        Args:
            simplified: If True, use simplified prompt for faster response
            json_mode: If True, force JSON output format. Set False for prose/markdown.

        Circuit Breaker: Opens after 3 consecutive failures, 60s recovery.
        """
        if not self.ollama_enabled:
            raise LLMError("Ollama not enabled")

        # Check circuit breaker before attempting request
        if not self._ollama_breaker.allow_request():
            raise CircuitBreakerOpen(
                self._ollama_breaker.name,
                self._ollama_breaker.recovery_timeout,
            )

        logger.debug(
            f"Calling Ollama ({self.ollama_model}) with {len(prompt)} char prompt, json_mode={json_mode}"
        )

        # Use limited tokens for fallback mode
        if simplified and not max_tokens:
            max_tokens = settings.OLLAMA_MAX_TOKENS

        payload = {
            "model": self.ollama_model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.3 if json_mode else temperature,
            },
        }

        # Only force JSON format when JSON output is expected
        if json_mode:
            payload["format"] = "json"

        if system_prompt:
            payload["system"] = system_prompt

        if max_tokens:
            payload["options"]["num_predict"] = max_tokens

        try:
            result = self._make_ollama_request(payload)

            logger.info(f"Ollama response: {len(result.get('response', ''))} chars")

            # Track LLM metrics and record circuit breaker success
            eval_count = result.get("eval_count", 0)
            llm_requests_total.labels(provider="ollama", status="success").inc()
            llm_tokens_total.labels(provider="ollama", token_type="output").inc(
                eval_count
            )
            self._ollama_breaker.record_success()

            return {
                "response": result.get("response", ""),
                "model": result.get("model", self.ollama_model),
                "provider": "ollama",
                "total_duration": result.get("total_duration", 0),
                "eval_count": eval_count,
            }

        except httpx.TimeoutException as e:
            # Timeout after retries exhausted - record failure
            # Note: _make_ollama_request has its own retry, so this is after exhaustion
            self._ollama_breaker.record_failure()
            logger.error(
                f"Ollama timeout after {settings.OLLAMA_MAX_RETRIES} retries: {e}"
            )
            llm_requests_total.labels(provider="ollama", status="error").inc()
            raise LLMError("Ollama request timed out")
        except Exception as e:
            # Other errors (connection, HTTP errors) - record failure
            self._ollama_breaker.record_failure()
            logger.error(f"Ollama error: {e}")
            llm_requests_total.labels(provider="ollama", status="error").inc()
            raise

    def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        fallback_prompt: str | None = None,
        fallback_system: str | None = None,
        json_mode: bool = True,
        allow_fallback: bool = True,
    ) -> dict[str, Any]:
        """
        Generate text using primary LLM with optional fallback.

        Args:
            prompt: User prompt
            system_prompt: System prompt (optional)
            temperature: Sampling temperature (0.0 - 1.0)
            max_tokens: Maximum tokens to generate
            fallback_prompt: Simplified prompt for fallback (optional)
            fallback_system: Simplified system prompt for fallback (optional)
            json_mode: If True, force JSON output for Ollama. Set False for prose/markdown.
            allow_fallback: If True (default), attempt fallback on primary failure.
                           Set False for multipass passes to prevent provider mixing.

        Returns:
            Generation result with response text and metadata
        """
        # Use mock if enabled
        if self.use_mock:
            return dict(
                self.mock_service.generate(
                    prompt,
                    system_prompt,
                    temperature,
                    max_tokens,
                    fallback_prompt,
                    fallback_system,
                )
            )

        # Try primary provider
        primary_error: Exception | None = None
        try:
            if self.primary_provider == LLMProvider.ANTHROPIC:
                return self._generate_anthropic(
                    prompt, system_prompt, temperature, max_tokens
                )
            elif self.primary_provider == LLMProvider.GEMINI:
                return self._generate_gemini(
                    prompt, system_prompt, temperature, max_tokens
                )
            elif self.primary_provider == LLMProvider.OLLAMA:
                return self._generate_ollama(
                    prompt, system_prompt, temperature, max_tokens, json_mode=json_mode
                )
        except CircuitBreakerOpen as e:
            primary_error = e
            logger.warning(
                f"Primary provider {self.primary_provider.value} circuit breaker open: {e}"
            )
        except RetryableLLMError as e:
            # Retries exhausted for transient errors - now record circuit breaker failure
            primary_error = e
            if self.primary_provider == LLMProvider.ANTHROPIC:
                self._anthropic_breaker.record_failure()
            elif self.primary_provider == LLMProvider.GEMINI:
                self._gemini_breaker.record_failure()
            elif self.primary_provider == LLMProvider.OLLAMA:
                self._ollama_breaker.record_failure()
            logger.warning(
                f"Primary provider {self.primary_provider.value} failed after retries: {e}"
            )
        except Exception as e:
            primary_error = e
            logger.warning(
                f"Primary provider {self.primary_provider.value} failed: {e}"
            )

        # Try fallback if primary failed, fallback is enabled, and caller allows it
        # Note: allow_fallback=False is used by multipass passes to prevent provider mixing
        if primary_error and self.fallback_enabled and allow_fallback:
            # Determine fallback reason for metrics
            fallback_reason = "error"
            if isinstance(primary_error, CircuitBreakerOpen):
                fallback_reason = "circuit_open"
            elif isinstance(primary_error, RetryableLLMError):
                fallback_reason = "retries_exhausted"

            # Track fallback event
            llm_fallback_total.labels(
                primary=self.primary_provider.value,
                fallback=self.fallback_provider.value,
                reason=fallback_reason,
            ).inc()

            logger.info(
                f"Attempting fallback provider: {self.fallback_provider.value} "
                f"(reason: {fallback_reason})"
            )
            try:
                # Fallback prompt strategy:
                # - Ollama: Use simplified prompt (designed for smaller models)
                # - Anthropic/Gemini: Use original full prompt (they can handle it)
                use_simplified = self.fallback_provider == LLMProvider.OLLAMA
                fb_prompt = (fallback_prompt or prompt) if use_simplified else prompt
                fb_system = (fallback_system or system_prompt) if use_simplified else system_prompt

                if self.fallback_provider == LLMProvider.MOCK:
                    return dict(
                        self.mock_service.generate(
                            fb_prompt,
                            fb_system,
                            temperature,
                            max_tokens,
                            fallback_prompt,
                            fallback_system,
                        )
                    )
                elif self.fallback_provider == LLMProvider.OLLAMA:
                    return self._generate_ollama(
                        fb_prompt,
                        fb_system,
                        temperature,
                        max_tokens,
                        simplified=True,
                        json_mode=json_mode,
                    )
                elif self.fallback_provider == LLMProvider.ANTHROPIC:
                    if self.anthropic_client:
                        return self._generate_anthropic(
                            fb_prompt, fb_system, temperature, max_tokens
                        )
                    else:
                        raise LLMError("Anthropic fallback not available (no API key)")
                elif self.fallback_provider == LLMProvider.GEMINI:
                    if self.gemini_client:
                        return self._generate_gemini(
                            fb_prompt, fb_system, temperature, max_tokens
                        )
                    else:
                        raise LLMError("Gemini fallback not available (no API key)")
                else:
                    raise LLMError(
                        f"Unknown fallback provider: {self.fallback_provider}"
                    )
            except Exception as fallback_error:
                logger.error(f"Fallback provider also failed: {fallback_error}")
                raise LLMError(
                    f"All LLM providers failed. Primary: {primary_error}, Fallback: {fallback_error}"
                )
        elif primary_error:
            raise primary_error

        raise LLMError("No LLM provider succeeded")

    def generate_json(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.3,
        fallback_prompt: str | None = None,
        fallback_system: str | None = None,
    ) -> str:
        """
        Generate JSON response from LLM.

        Args:
            prompt: User prompt requesting JSON output
            system_prompt: System prompt
            temperature: Lower temperature for structured output
            fallback_prompt: Simplified prompt for fallback
            fallback_system: Simplified system for fallback

        Returns:
            JSON string response
        """
        # Add JSON instruction to system prompt
        json_instruction = (
            "\n\nYou must respond ONLY with valid JSON. "
            "Do not include any text before or after the JSON object."
        )

        full_system = (system_prompt or "") + json_instruction
        fb_system = (
            (fallback_system or "") + json_instruction
            if fallback_system
            else full_system
        )

        result = self.generate(
            prompt=prompt,
            system_prompt=full_system,
            temperature=temperature,
            fallback_prompt=fallback_prompt,
            fallback_system=fb_system,
        )

        return str(result["response"])

    def cleanup(self) -> None:
        """
        Clean up resources held by the LLM service.

        Closes HTTP clients and releases any other resources.
        Should be called during application shutdown.
        """
        if hasattr(self, "ollama_client") and self.ollama_client is not None:
            try:
                self.ollama_client.close()
                logger.info("Ollama HTTP client closed")
            except Exception as e:
                logger.warning(f"Error closing Ollama client: {e}")

        # Note: Anthropic SDK client doesn't require explicit cleanup
        # as it uses httpx internally with proper context management

        logger.debug("LLM service cleanup complete")


# Global LLM service instance
_llm_service = None


def get_llm_service() -> LLMService:
    """
    Get or create the global LLM service instance.

    Returns:
        LLMService instance
    """
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service


def cleanup_llm_service() -> None:
    """
    Clean up the global LLM service instance.

    Should be called during application shutdown.
    """
    global _llm_service
    if _llm_service is not None:
        _llm_service.cleanup()
        _llm_service = None
        logger.info("LLM service cleaned up")
