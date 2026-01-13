"""LLM warmup utilities for pre-loading models on startup.

When Ollama is configured as the primary LLM provider, the model needs to be
loaded into memory before it can respond quickly. This module provides utilities
to "warm up" the model on startup to avoid cold-start latency on first requests.

Usage:
    from services.warmup import warmup_llm_if_needed
    warmup_llm_if_needed()  # Call during worker/backend startup
"""

import logging
import time

from config import settings

logger = logging.getLogger(__name__)

# Simple prompt for warming up the model
WARMUP_PROMPT = "Say hello in one word."

# Maximum time to wait for warmup (seconds)
WARMUP_TIMEOUT = 120


def warmup_ollama() -> bool:
    """Warm up Ollama by making a simple request to load the model.

    This sends a minimal prompt to Ollama which triggers model loading.
    The model stays in memory according to OLLAMA_KEEP_ALIVE setting.

    Returns:
        True if warmup succeeded, False otherwise
    """
    try:
        import httpx

        ollama_url = f"{settings.OLLAMA_BASE_URL}/api/generate"
        payload = {
            "model": settings.OLLAMA_MODEL,
            "prompt": WARMUP_PROMPT,
            "stream": False,
            "options": {
                "num_predict": 10,  # Very short response
            },
            # Use configured keep_alive to ensure model stays loaded
            "keep_alive": settings.OLLAMA_KEEP_ALIVE,
        }

        logger.info(
            f"Warming up Ollama model '{settings.OLLAMA_MODEL}' "
            f"(keep_alive={settings.OLLAMA_KEEP_ALIVE})..."
        )
        start_time = time.time()

        with httpx.Client(timeout=WARMUP_TIMEOUT) as client:
            response = client.post(ollama_url, json=payload)

        duration = time.time() - start_time

        if response.status_code == 200:
            logger.info(f"Ollama warmup completed in {duration:.1f}s")
            return True
        else:
            logger.warning(
                f"Ollama warmup failed with status {response.status_code}: "
                f"{response.text[:200]}"
            )
            return False

    except httpx.TimeoutException:
        logger.warning(
            f"Ollama warmup timed out after {WARMUP_TIMEOUT}s. "
            "Model may still be loading in background."
        )
        return False

    except httpx.ConnectError as e:
        logger.warning(f"Cannot connect to Ollama at {settings.OLLAMA_BASE_URL}: {e}")
        return False

    except Exception as e:
        logger.warning(f"Ollama warmup failed: {e}")
        return False


def warmup_llm_if_needed() -> None:
    """Warm up the LLM if Ollama is configured as the primary provider.

    This should be called during worker/backend startup to pre-load the model
    and avoid cold-start latency on the first consultation request.

    Only warms up if:
    - LLM_PROVIDER is 'ollama'
    - OLLAMA_ENABLED is True

    The warmup is non-blocking to startup - if it fails, the worker will still
    start and the model will be loaded on first actual request.
    """
    if settings.LLM_PROVIDER != "ollama":
        logger.debug(
            f"LLM provider is '{settings.LLM_PROVIDER}', skipping Ollama warmup"
        )
        return

    if not settings.OLLAMA_ENABLED:
        logger.debug("Ollama is not enabled, skipping warmup")
        return

    logger.info("Ollama is primary LLM provider, initiating warmup...")
    success = warmup_ollama()

    if not success:
        logger.warning(
            "Ollama warmup did not complete successfully. "
            "First consultation may experience cold-start latency."
        )
