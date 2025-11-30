"""LLM service using Ollama."""

import logging
import httpx
from typing import Dict, Any, Optional

from config import settings

logger = logging.getLogger(__name__)


class LLMService:
    """Service for interacting with Ollama LLM."""

    def __init__(self):
        """Initialize LLM service."""
        self.base_url = settings.OLLAMA_BASE_URL
        self.model = settings.OLLAMA_MODEL
        self.timeout = settings.OLLAMA_TIMEOUT

        logger.info(f"LLM Service initialized: {self.base_url} / {self.model}")

    def check_health(self) -> bool:
        """
        Check if Ollama is accessible.

        Returns:
            True if healthy, False otherwise
        """
        try:
            response = httpx.get(f"{self.base_url}/api/tags", timeout=5)
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Ollama health check failed: {e}")
            return False

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Generate text using the LLM.

        Args:
            prompt: User prompt
            system_prompt: System prompt (optional)
            temperature: Sampling temperature (0.0 - 1.0)
            max_tokens: Maximum tokens to generate

        Returns:
            Generation result with response text

        Raises:
            Exception: If LLM request fails
        """
        logger.debug(f"Generating with prompt length: {len(prompt)}")

        # Prepare request
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
            }
        }

        if system_prompt:
            payload["system"] = system_prompt

        if max_tokens:
            payload["options"]["num_predict"] = max_tokens

        try:
            # Make request
            response = httpx.post(
                f"{self.base_url}/api/generate",
                json=payload,
                timeout=self.timeout
            )
            response.raise_for_status()

            result = response.json()

            logger.debug(f"Generated {len(result.get('response', ''))} chars")

            return {
                "response": result.get("response", ""),
                "model": result.get("model", self.model),
                "total_duration": result.get("total_duration", 0),
                "eval_count": result.get("eval_count", 0),
            }

        except httpx.TimeoutException as e:
            logger.error(f"LLM request timeout: {e}")
            raise Exception("LLM request timed out")
        except httpx.HTTPError as e:
            logger.error(f"LLM HTTP error: {e}")
            raise Exception(f"LLM request failed: {str(e)}")
        except Exception as e:
            logger.error(f"LLM error: {e}")
            raise

    def generate_json(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.3
    ) -> str:
        """
        Generate JSON response from LLM.

        Args:
            prompt: User prompt requesting JSON output
            system_prompt: System prompt
            temperature: Lower temperature for structured output

        Returns:
            JSON string response
        """
        # Add JSON instruction to system prompt
        json_system = (
            "You are a helpful assistant that responds ONLY with valid JSON. "
            "Do not include any text before or after the JSON object."
        )

        if system_prompt:
            json_system = f"{system_prompt}\n\n{json_system}"

        result = self.generate(
            prompt=prompt,
            system_prompt=json_system,
            temperature=temperature
        )

        return result["response"]


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
