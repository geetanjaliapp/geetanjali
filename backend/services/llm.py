"""Hybrid LLM service with Anthropic Claude primary and Ollama fallback."""

import logging
import httpx
from typing import Dict, Any, Optional
from enum import Enum
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

try:
    from anthropic import Anthropic, AnthropicError, APITimeoutError, APIConnectionError

    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

from config import settings
from services.mock_llm import MockLLMService

logger = logging.getLogger(__name__)


class LLMProvider(str, Enum):
    """LLM provider types."""

    ANTHROPIC = "anthropic"
    OLLAMA = "ollama"


class LLMService:
    """
    Hybrid LLM service with primary and fallback providers.

    Primary: Anthropic Claude (fast, high-quality)
    Fallback: Ollama (local, simplified prompt)
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
        self.fallback_enabled = settings.LLM_FALLBACK_ENABLED

        # Initialize Anthropic client if available
        self.anthropic_client = None
        if settings.ANTHROPIC_API_KEY and ANTHROPIC_AVAILABLE:
            self.anthropic_client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            logger.info(f"Anthropic client initialized: {settings.ANTHROPIC_MODEL}")
        elif self.primary_provider == LLMProvider.ANTHROPIC:
            logger.warning(
                "Anthropic selected as primary but API key not set or SDK not installed"
            )

        # Ollama configuration
        self.ollama_enabled = settings.OLLAMA_ENABLED
        self.ollama_base_url = settings.OLLAMA_BASE_URL
        self.ollama_model = settings.OLLAMA_MODEL

        logger.info(
            f"LLM Service initialized - Primary: {self.primary_provider.value}, "
            f"Fallback: {'enabled' if self.fallback_enabled else 'disabled'}"
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
        elif self.primary_provider == LLMProvider.OLLAMA:
            return self._check_ollama_health()
        return False

    def _check_ollama_health(self) -> bool:
        """Check if Ollama is accessible."""
        if not self.ollama_enabled:
            return False
        try:
            response = httpx.get(f"{self.ollama_base_url}/api/tags", timeout=5)
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Ollama health check failed: {e}")
            return False

    def _generate_anthropic(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Generate response using Anthropic Claude."""
        if not self.anthropic_client:
            raise Exception("Anthropic client not initialized")

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

            response_text = response.content[0].text

            logger.info(
                f"Anthropic response: {len(response_text)} chars, "
                f"{response.usage.input_tokens} in / {response.usage.output_tokens} out tokens"
            )

            return {
                "response": response_text,
                "model": settings.ANTHROPIC_MODEL,
                "provider": "anthropic",
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            }

        except (APITimeoutError, APIConnectionError) as e:
            logger.error(f"Anthropic API error: {e}")
            raise Exception(f"Anthropic request failed: {str(e)}")
        except AnthropicError as e:
            logger.error(f"Anthropic error: {e}")
            raise Exception(f"Anthropic error: {str(e)}")

    @retry(
        stop=stop_after_attempt(settings.OLLAMA_MAX_RETRIES),
        wait=wait_exponential(
            min=settings.OLLAMA_RETRY_MIN_WAIT, max=settings.OLLAMA_RETRY_MAX_WAIT
        ),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.ConnectError)),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )
    def _make_ollama_request(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Make Ollama request with retry logic."""
        response = httpx.post(
            f"{self.ollama_base_url}/api/generate",
            json=payload,
            timeout=settings.OLLAMA_TIMEOUT,
        )
        response.raise_for_status()
        return dict(response.json())

    def _generate_ollama(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        simplified: bool = False,
    ) -> Dict[str, Any]:
        """
        Generate response using Ollama.

        Args:
            simplified: If True, use simplified prompt for faster response
        """
        if not self.ollama_enabled:
            raise Exception("Ollama not enabled")

        logger.debug(
            f"Calling Ollama ({self.ollama_model}) with {len(prompt)} char prompt"
        )

        # Use limited tokens for fallback mode
        if simplified and not max_tokens:
            max_tokens = settings.OLLAMA_MAX_TOKENS

        payload = {
            "model": self.ollama_model,
            "prompt": prompt,
            "stream": False,
            "format": "json",  # OPTIMIZATION: Force JSON output mode
            "options": {
                "temperature": 0.3,  # OPTIMIZATION: Lower temp for deterministic JSON
            },
        }

        if system_prompt:
            payload["system"] = system_prompt

        if max_tokens:
            payload["options"]["num_predict"] = max_tokens

        try:
            result = self._make_ollama_request(payload)

            logger.info(f"Ollama response: {len(result.get('response', ''))} chars")

            return {
                "response": result.get("response", ""),
                "model": result.get("model", self.ollama_model),
                "provider": "ollama",
                "total_duration": result.get("total_duration", 0),
                "eval_count": result.get("eval_count", 0),
            }

        except httpx.TimeoutException as e:
            logger.error(
                f"Ollama timeout after {settings.OLLAMA_MAX_RETRIES} retries: {e}"
            )
            raise Exception("Ollama request timed out")
        except Exception as e:
            logger.error(f"Ollama error: {e}")
            raise

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        fallback_prompt: Optional[str] = None,
        fallback_system: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate text using primary LLM with fallback.

        Args:
            prompt: User prompt
            system_prompt: System prompt (optional)
            temperature: Sampling temperature (0.0 - 1.0)
            max_tokens: Maximum tokens to generate
            fallback_prompt: Simplified prompt for fallback (optional)
            fallback_system: Simplified system prompt for fallback (optional)

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
        try:
            if self.primary_provider == LLMProvider.ANTHROPIC:
                return self._generate_anthropic(
                    prompt, system_prompt, temperature, max_tokens
                )
            elif self.primary_provider == LLMProvider.OLLAMA:
                return self._generate_ollama(
                    prompt, system_prompt, temperature, max_tokens
                )
        except Exception as e:
            logger.warning(
                f"Primary provider {self.primary_provider.value} failed: {e}"
            )

            # Try fallback if enabled
            if self.fallback_enabled:
                logger.info("Attempting fallback provider...")
                try:
                    # Use simplified prompts for fallback if provided
                    fb_prompt = fallback_prompt or prompt
                    fb_system = fallback_system or system_prompt

                    if self.primary_provider == LLMProvider.ANTHROPIC:
                        # Fallback to Ollama with simplified prompt
                        return self._generate_ollama(
                            fb_prompt,
                            fb_system,
                            temperature,
                            max_tokens,
                            simplified=True,
                        )
                    elif self.primary_provider == LLMProvider.OLLAMA:
                        # Fallback to Anthropic if available
                        if self.anthropic_client:
                            return self._generate_anthropic(
                                fb_prompt, fb_system, temperature, max_tokens
                            )
                        else:
                            raise Exception("No fallback provider available")
                except Exception as fallback_error:
                    logger.error(f"Fallback provider also failed: {fallback_error}")
                    raise Exception(
                        f"All LLM providers failed. Primary: {e}, Fallback: {fallback_error}"
                    )
            else:
                raise

        raise Exception("No LLM provider succeeded")

    def generate_json(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.3,
        fallback_prompt: Optional[str] = None,
        fallback_system: Optional[str] = None,
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
