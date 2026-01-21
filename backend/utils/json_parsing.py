"""Utilities for extracting JSON from LLM responses.

LLMs often wrap JSON in markdown code blocks or explanatory text.
These utilities provide robust extraction strategies.
"""

import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


def extract_json_from_text(response_text: str, provider: str = "unknown") -> dict[str, Any]:
    """
    Robustly extract JSON from LLM response text.

    Handles:
    - Direct JSON
    - Markdown code blocks (```json ... ``` or ``` ... ```)
    - JSON wrapped in explanation text
    - Multiple JSON objects (returns first valid)

    Args:
        response_text: Raw LLM response text
        provider: LLM provider name (for logging/metrics)

    Returns:
        Parsed JSON dict

    Raises:
        ValueError: If no valid JSON can be extracted
    """
    # Strategy 1: Try direct JSON parse (LLM followed instructions perfectly)
    try:
        parsed = json.loads(response_text)
        if isinstance(parsed, dict):
            return parsed
        # Valid JSON but not a dict (e.g., string, list) - continue to other strategies
        logger.debug(f"Direct parse returned {type(parsed).__name__}, expected dict")
    except json.JSONDecodeError:
        pass

    # Strategy 2: Extract from markdown code block
    # Try ```json variant first, then generic ```
    for pattern in [r"```(?:json)?\s*\n(.*?)\n```", r"```(.*?)```"]:
        matches = re.finditer(pattern, response_text, re.DOTALL)
        for match in matches:
            json_text = match.group(1).strip()
            try:
                parsed = json.loads(json_text)
                if isinstance(parsed, dict):
                    return parsed
                logger.debug(
                    f"Markdown block returned {type(parsed).__name__}, expected dict"
                )
            except json.JSONDecodeError as e:
                logger.debug(
                    f"Markdown block parse failed at pos {e.pos}: "
                    f"{json_text[max(0, e.pos - 30):e.pos + 30]}"
                )
                continue

    # Strategy 3: Find JSON objects by locating { characters (with limit to avoid O(n²))
    # This handles: "analysis: {... proper json ...}" pattern
    # Use json.JSONDecoder.raw_decode() to find the complete object
    # Limit attempts to first 100 {-positions to avoid O(n²) behavior on large responses
    brace_count = 0
    max_brace_attempts = 100
    for start_idx in range(len(response_text)):
        if response_text[start_idx] == "{":
            if brace_count >= max_brace_attempts:
                logger.debug(
                    f"Reached max brace attempts ({max_brace_attempts}) in Strategy 3, "
                    f"stopping JSON extraction attempts"
                )
                break
            brace_count += 1
            try:
                decoder = json.JSONDecoder()
                parsed, _ = decoder.raw_decode(response_text, start_idx)
                if isinstance(parsed, dict):
                    logger.debug(f"Extracted JSON from position {start_idx}")
                    return parsed
            except json.JSONDecodeError:
                continue

    # Failed all strategies - log full response for debugging
    logger.error(
        f"Could not extract JSON from {provider} response. First 500 chars: {response_text[:500]}"
    )
    logger.debug(f"Full response for extraction failure analysis: {response_text}")
    raise ValueError(f"No valid JSON found in {provider} LLM response")


def extract_json_from_markdown(response_text: str) -> dict[str, Any] | None:
    """
    Extract JSON from markdown code blocks only.

    Simpler variant for cases where we expect markdown-wrapped JSON.
    Returns None instead of raising on failure.

    Args:
        response_text: Raw response text

    Returns:
        Parsed JSON dict or None if extraction fails
    """
    response_text = response_text.strip()

    # Extract from ```json block
    if "```json" in response_text:
        start = response_text.find("```json") + 7
        end = response_text.find("```", start)
        if end > start:
            try:
                parsed = json.loads(response_text[start:end].strip())
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                pass

    # Extract from generic ``` block
    if "```" in response_text:
        start = response_text.find("```") + 3
        end = response_text.find("```", start)
        if end > start:
            try:
                parsed = json.loads(response_text[start:end].strip())
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                pass

    # Try direct parse
    try:
        parsed = json.loads(response_text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    return None
