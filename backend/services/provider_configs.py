"""Provider-specific configurations with fire-and-forget auto-tuning.

Each provider has optimized defaults applied automatically:
- Gemini: Explicit JSON schema for structural compliance
- Anthropic: High-quality JSON mode (no schema needed)
- Ollama: Simplified prompts for resource efficiency
- Mock: Instant test responses

No feature flags required. System detects provider and applies tuning automatically.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

logger_instance = None  # Will be set by module loader


def _get_logger():
    """Lazy logger initialization to avoid circular imports."""
    global logger_instance
    if logger_instance is None:
        import logging
        logger_instance = logging.getLogger(__name__)
    return logger_instance


# ============================================================================
# Gemini JSON Schema Definition (Auto-Applied)
# ============================================================================
# Defines the expected structure for Gemini's response_schema parameter.
# This constrains Gemini's output to valid JSON matching this structure.
# Auto-applied when LLM_PROVIDER=gemini (no config flag needed).

GEMINI_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "executive_summary": {"type": "string"},
        "options": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "pros": {"type": "array", "items": {"type": "string"}},
                    "cons": {"type": "array", "items": {"type": "string"}},
                    "sources": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
                "required": ["title", "description", "pros", "cons", "sources"],
            },
        },
        "recommended_action": {
            "type": "object",
            "properties": {
                "option": {"type": "integer"},
                "steps": {"type": "array", "items": {"type": "string"}},
                "sources": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["option", "steps", "sources"],
        },
        "reflection_prompts": {"type": "array", "items": {"type": "string"}},
        "sources": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "canonical_id": {"type": "string"},
                    "paraphrase": {"type": "string"},
                    "relevance": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                },
                "required": ["canonical_id", "paraphrase", "relevance"],
            },
        },
        "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
        "scholar_flag": {"type": "boolean"},
    },
    "required": [
        "executive_summary",
        "options",
        "recommended_action",
        "reflection_prompts",
        "sources",
        "confidence",
        "scholar_flag",
    ],
}


# ============================================================================
# Ollama Simplified Prompts (Auto-Applied)
# ============================================================================
# Simplified versions for Ollama's resource constraints.
# Auto-applied when LLM_PROVIDER=ollama (no config flag needed).

OLLAMA_SIMPLIFIED_SYSTEM_PROMPT = """You are an ethical leadership consultant using Bhagavad Geeta wisdom.

QUALITY RULES (apply before responding):
- Be SPECIFIC to their situation, not generic advice
- Make options genuinely DIFFERENT, not variations
- Connect verses to their ACTUAL dilemma, not loosely
- Give CONCRETE steps they can do this week
- State guidance directly: "Do X" not "Consider X"

Output JSON:
- suggested_title: 5-8 word title
- executive_summary: 2-3 sentences with direct guidance
- options: array of 2-3 distinct options, each with title, description, pros[], cons[], sources[]
- recommended_action: {option: number, steps: [concrete actions], sources: []}
- reflection_prompts: 2 questions
- sources: [{canonical_id, paraphrase, relevance}]
- confidence: 0.0-1.0
- scholar_flag: boolean

Use verse IDs like BG_2_47. Output ONLY valid JSON."""


# ============================================================================
# Base Provider Configuration (ABC)
# ============================================================================


class ProviderConfig(ABC):
    """Base class for provider-specific configurations with auto-tuning.

    Each provider encapsulates its optimized defaults:
    - Generation parameters (temperature, timeout, max_tokens)
    - Response parsing logic (extract text, tokens, metadata)
    - Prompt customizations (system/user prompt overrides)
    - JSON schema (if provider supports it)
    - Error handling strategy (retryable vs permanent errors)

    Fire-and-forget: Instantiate with provider settings, all tuning is automatic.
    No feature flags needed; system applies provider defaults transparently.
    """

    name: str
    model: str
    timeout_seconds: float
    max_tokens: int
    temperature_default: float

    def __init__(self, name: str, model: str, timeout_seconds: float, max_tokens: int, temperature_default: float):
        """Initialize provider config with settings."""
        self.name = name
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.max_tokens = max_tokens
        self.temperature_default = temperature_default

    @abstractmethod
    def get_generation_params(self, temperature: float | None) -> dict[str, Any]:
        """Get provider-specific generation parameters for API call.

        Args:
            temperature: Override temperature, or None to use provider default

        Returns:
            Dict of generation parameters (e.g., max_tokens, temperature)
        """
        pass

    @abstractmethod
    def parse_response(self, raw_response: Any) -> tuple[str, int, int]:
        """Extract response text and token counts from provider response.

        Args:
            raw_response: Raw response object from provider API

        Returns:
            Tuple of (response_text, input_tokens, output_tokens)

        Raises:
            Exception: If response is malformed or unreadable
        """
        pass

    def customize_system_prompt(self, base_prompt: str) -> str:
        """Apply provider-specific customizations to system prompt.

        Override in subclass for provider-specific tweaks.
        Default: No customization (return base unchanged).

        Args:
            base_prompt: Base system prompt from prompts.py

        Returns:
            Customized system prompt for this provider
        """
        return base_prompt

    def customize_user_prompt(self, base_prompt: str) -> str:
        """Apply provider-specific customizations to user prompt.

        Override in subclass for provider-specific tweaks.
        Default: No customization (return base unchanged).

        Args:
            base_prompt: Base user prompt from prompts.py

        Returns:
            Customized user prompt for this provider
        """
        return base_prompt

    def get_json_schema(self, json_mode: bool) -> dict | None:
        """Get JSON schema for this provider (if supported).

        Return schema dict to enforce structure; None if no schema support.
        Auto-applied: If provider supports schemas, they're used automatically.

        Args:
            json_mode: Whether JSON output is requested

        Returns:
            JSON schema dict (e.g., for response_schema param), or None
        """
        return None

    def is_error_retryable(self, error: Exception) -> bool:
        """Determine if error should trigger retry or circuit breaker failure.

        Args:
            error: Exception from API call

        Returns:
            True if error is transient (should retry), False if permanent
        """
        return True  # Default: all errors retryable


# ============================================================================
# Gemini Configuration
# ============================================================================


@dataclass
class GeminiConfig(ProviderConfig):
    """Google Gemini auto-tuned configuration.

    Auto-applied optimizations:
    - Explicit JSON schema for structured responses (GEMINI_JSON_SCHEMA)
    - Lower default temperature (0.3) for determinism
    - Timeout normalized from milliseconds to seconds
    - JSON mode uses response_schema parameter

    Fire-and-forget: Set LLM_PROVIDER=gemini, everything else is automatic.
    """

    model: str
    timeout_seconds: float
    max_tokens: int

    def __post_init__(self):
        """Set provider-specific defaults after dataclass init."""
        super().__init__(
            name="gemini",
            model=self.model,
            timeout_seconds=self.timeout_seconds,
            max_tokens=self.max_tokens,
            temperature_default=0.3,  # Lower for determinism with schema
        )

    def get_generation_params(self, temperature: float | None) -> dict[str, Any]:
        """Build Gemini-specific generation params."""
        temp = temperature if temperature is not None else self.temperature_default
        return {
            "max_output_tokens": self.max_tokens,
            "temperature": temp,
        }

    def parse_response(self, raw_response: Any) -> tuple[str, int, int]:
        """Extract text and tokens from Gemini response."""
        try:
            response_text = raw_response.text
        except AttributeError:
            raise ValueError("Gemini returned malformed response (missing text)")

        if not response_text or not response_text.strip():
            raise ValueError("Gemini returned empty response")

        # Extract token counts with safe defaults
        try:
            input_tokens = raw_response.usage_metadata.prompt_token_count or 0
            output_tokens = raw_response.usage_metadata.candidates_token_count or 0
        except AttributeError:
            _get_logger().warning(
                "Gemini response missing usage_metadata, using 0 tokens"
            )
            input_tokens = 0
            output_tokens = 0

        return response_text, input_tokens, output_tokens

    def get_json_schema(self, json_mode: bool) -> dict | None:
        """Auto-apply Gemini JSON schema when json_mode is True.

        This schema constrains Gemini's output to valid JSON matching
        the expected consultation response structure.

        Auto-applied: No config flag needed; schema is used when json_mode=True.
        """
        if not json_mode:
            return None
        return GEMINI_JSON_SCHEMA

    def is_error_retryable(self, error: Exception) -> bool:
        """Determine if Gemini error is retryable."""
        from google.genai.errors import ClientError, ServerError

        # Transient errors (server issues, timeouts)
        if isinstance(error, (ServerError,)):
            return True

        # Import httpx errors if available
        try:
            import httpx

            if isinstance(error, (httpx.TimeoutException, httpx.ConnectError)):
                return True
        except ImportError:
            pass

        # Permanent errors (client errors, auth, invalid request)
        if isinstance(error, ClientError):
            return False

        return True


# ============================================================================
# Anthropic Configuration
# ============================================================================


@dataclass
class AnthropicConfig(ProviderConfig):
    """Anthropic Claude auto-tuned configuration.

    Auto-applied optimizations:
    - Temperature 0.7 (balanced for creative + structured output)
    - No JSON schema needed (Claude excels at structured output natively)
    - Timeout in seconds (normalized)

    Fire-and-forget: Set LLM_PROVIDER=anthropic, everything else is automatic.
    """

    model: str
    timeout_seconds: float
    max_tokens: int

    def __post_init__(self):
        """Set provider-specific defaults after dataclass init."""
        super().__init__(
            name="anthropic",
            model=self.model,
            timeout_seconds=self.timeout_seconds,
            max_tokens=self.max_tokens,
            temperature_default=0.7,  # Balanced for creative + structured
        )

    def get_generation_params(self, temperature: float | None) -> dict[str, Any]:
        """Build Anthropic-specific generation params."""
        temp = temperature if temperature is not None else self.temperature_default
        return {
            "max_tokens": self.max_tokens,
            "temperature": temp,
        }

    def parse_response(self, raw_response: Any) -> tuple[str, int, int]:
        """Extract text and tokens from Anthropic response."""
        try:
            content_block = raw_response.content[0]
            response_text = (
                content_block.text
                if hasattr(content_block, "text")
                else str(content_block)
            )
        except (IndexError, AttributeError):
            raise ValueError("Anthropic returned malformed response")

        input_tokens = getattr(raw_response.usage, "input_tokens", 0) or 0
        output_tokens = getattr(raw_response.usage, "output_tokens", 0) or 0

        return response_text, input_tokens, output_tokens

    def get_json_schema(self, json_mode: bool) -> dict | None:
        """Anthropic doesn't need JSON schema (native structured output)."""
        return None

    def is_error_retryable(self, error: Exception) -> bool:
        """Determine if Anthropic error is retryable."""
        from anthropic import APIConnectionError, APITimeoutError, AnthropicError

        # Transient errors (connection, timeout)
        if isinstance(error, (APIConnectionError, APITimeoutError)):
            return True

        # Permanent errors (auth, invalid request)
        if isinstance(error, AnthropicError):
            return False

        return True


# ============================================================================
# Ollama Configuration
# ============================================================================


@dataclass
class OllamaConfig(ProviderConfig):
    """Ollama auto-tuned configuration for local inference.

    Auto-applied optimizations:
    - Lower temperature (0.3) for determinism
    - Simplified system prompt (OLLAMA_SIMPLIFIED_SYSTEM_PROMPT) for resource efficiency
    - Timeout in seconds (normalized, default 5 minutes)
    - No JSON schema (Ollama format param used instead)

    Fire-and-forget: Set LLM_PROVIDER=ollama, everything else is automatic.
    Simplified prompts are auto-applied when Ollama is detected.
    """

    model: str
    timeout_seconds: float
    max_tokens: int

    def __post_init__(self):
        """Set provider-specific defaults after dataclass init."""
        super().__init__(
            name="ollama",
            model=self.model,
            timeout_seconds=self.timeout_seconds,
            max_tokens=self.max_tokens,
            temperature_default=0.3,  # Lower for determinism
        )

    def get_generation_params(self, temperature: float | None) -> dict[str, Any]:
        """Build Ollama-specific generation params."""
        temp = temperature if temperature is not None else self.temperature_default
        return {
            "temperature": temp,
            "num_predict": self.max_tokens,
        }

    def parse_response(self, raw_response: Any) -> tuple[str, int, int]:
        """Extract text and tokens from Ollama response."""
        response_text = raw_response.get("response", "")
        if not response_text or not response_text.strip():
            raise ValueError("Ollama returned empty response")

        # Ollama provides eval_count (output tokens), not input tokens
        output_tokens = raw_response.get("eval_count", 0)
        input_tokens = 0  # Ollama doesn't provide input token count

        return response_text, input_tokens, output_tokens

    def customize_system_prompt(self, base_prompt: str) -> str:
        """Auto-apply simplified system prompt for Ollama resource efficiency.

        Ollama runs locally with limited compute; simplified prompts
        reduce token usage and improve response time without sacrificing quality.
        Note: base_prompt is intentionally ignored; Ollama always gets simplified version.

        Auto-applied: No config flag needed; simplified prompt is used when
        LLM_PROVIDER=ollama.
        """
        return OLLAMA_SIMPLIFIED_SYSTEM_PROMPT

    def get_json_schema(self, json_mode: bool) -> dict | None:
        """Ollama doesn't support response_schema (uses format param instead)."""
        return None

    def is_error_retryable(self, error: Exception) -> bool:
        """Determine if Ollama error is retryable."""
        try:
            import httpx

            if isinstance(error, (httpx.TimeoutException, httpx.ConnectError)):
                return True
        except ImportError:
            pass

        return True


# ============================================================================
# Mock Configuration (Testing)
# ============================================================================


@dataclass
class MockConfig(ProviderConfig):
    """Mock LLM for testing (instant responses).

    Auto-applied optimizations:
    - Zero latency (instant responses)
    - Deterministic output (reproducible tests)
    - No external dependencies

    Fire-and-forget: Set LLM_PROVIDER=mock for testing.
    """

    model: str
    timeout_seconds: float
    max_tokens: int

    def __post_init__(self):
        """Set provider-specific defaults after dataclass init."""
        super().__init__(
            name="mock",
            model=self.model,
            timeout_seconds=self.timeout_seconds,
            max_tokens=self.max_tokens,
            temperature_default=0.5,
        )

    def get_generation_params(self, temperature: float | None) -> dict[str, Any]:
        """Build mock generation params."""
        return {}

    def parse_response(self, raw_response: Any) -> tuple[str, int, int]:
        """Extract from mock response."""
        response_text = raw_response.get("response", "")
        return response_text, 0, 0

    def is_error_retryable(self, error: Exception) -> bool:
        """Mock errors are never retryable (for testing)."""
        return False


# ============================================================================
# Provider Registry & Factory
# ============================================================================
# Auto-instantiates provider configs based on settings.
# Fire-and-forget: get_provider_config("gemini") returns optimized config.


def get_provider_config(provider_name: str, settings: Any = None) -> ProviderConfig:
    """Get provider config by name with all auto-tuning applied.

    Fire-and-forget factory: Returns provider-specific config with
    all optimizations pre-configured. No feature flags to set.

    Args:
        provider_name: "gemini", "anthropic", "ollama", or "mock"
        settings: Settings object (auto-imported if not provided)

    Returns:
        ProviderConfig with all defaults optimized for provider

    Raises:
        ValueError: If provider_name is unknown
    """
    if settings is None:
        from config import settings as _settings

        settings = _settings

    provider_name = provider_name.lower()

    if provider_name == "gemini":
        return GeminiConfig(
            model=settings.GEMINI_MODEL,
            timeout_seconds=settings.GEMINI_TIMEOUT / 1000.0,  # Convert ms to seconds
            max_tokens=settings.GEMINI_MAX_TOKENS,
        )
    elif provider_name == "anthropic":
        return AnthropicConfig(
            model=settings.ANTHROPIC_MODEL,
            timeout_seconds=settings.ANTHROPIC_TIMEOUT,
            max_tokens=settings.ANTHROPIC_MAX_TOKENS,
        )
    elif provider_name == "ollama":
        return OllamaConfig(
            model=settings.OLLAMA_MODEL,
            timeout_seconds=settings.OLLAMA_TIMEOUT,
            max_tokens=settings.OLLAMA_MAX_TOKENS,
        )
    elif provider_name == "mock":
        return MockConfig(
            model="mock",
            timeout_seconds=1.0,
            max_tokens=1000,
        )
    else:
        raise ValueError(
            f"Unknown provider: {provider_name}. "
            f"Valid providers: gemini, anthropic, ollama, mock"
        )
