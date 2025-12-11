"""Utilities for extracting JSON from LLM responses.

LLMs often wrap JSON in markdown code blocks or explanatory text.
These utilities provide robust extraction strategies.
"""

import json
import logging
import re
from typing import Any, Dict, Optional, cast

logger = logging.getLogger(__name__)


def extract_json_from_text(response_text: str) -> Dict[str, Any]:
    """
    Robustly extract JSON from LLM response text.

    Handles:
    - Direct JSON
    - Markdown code blocks (```json ... ``` or ``` ... ```)
    - JSON wrapped in explanation text
    - Multiple JSON objects (returns first valid)

    Args:
        response_text: Raw LLM response text

    Returns:
        Parsed JSON dict

    Raises:
        ValueError: If no valid JSON can be extracted
    """
    # Strategy 1: Try direct JSON parse (LLM followed instructions perfectly)
    try:
        return cast(Dict[str, Any], json.loads(response_text))
    except json.JSONDecodeError:
        pass

    # Strategy 2: Extract from markdown code block
    # Try ```json variant first, then generic ```
    for pattern in [r"```(?:json)?\s*\n(.*?)\n```", r"```(.*?)```"]:
        matches = re.finditer(pattern, response_text, re.DOTALL)
        for match in matches:
            json_text = match.group(1).strip()
            try:
                return cast(Dict[str, Any], json.loads(json_text))
            except json.JSONDecodeError as e:
                logger.debug(
                    f"Markdown block parse failed at pos {e.pos}: "
                    f"{json_text[max(0, e.pos - 30):e.pos + 30]}"
                )
                continue

    # Strategy 3: Find first { and try to extract complete JSON
    # This handles: "analysis: {... proper json ...}" pattern
    # Use json.JSONDecoder.raw_decode() to find the complete object
    for start_idx in range(len(response_text)):
        if response_text[start_idx] == "{":
            try:
                decoder = json.JSONDecoder()
                parsed, _ = decoder.raw_decode(response_text, start_idx)
                logger.debug(f"Extracted JSON from position {start_idx}")
                return cast(Dict[str, Any], parsed)
            except json.JSONDecodeError:
                continue

    # Failed all strategies
    logger.error(
        f"Could not extract JSON from response. First 500 chars: {response_text[:500]}"
    )
    raise ValueError("No valid JSON found in LLM response")


def extract_json_from_markdown(response_text: str) -> Optional[Dict[str, Any]]:
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
                return cast(Dict[str, Any], json.loads(response_text[start:end].strip()))
            except json.JSONDecodeError:
                pass

    # Extract from generic ``` block
    if "```" in response_text:
        start = response_text.find("```") + 3
        end = response_text.find("```", start)
        if end > start:
            try:
                return cast(Dict[str, Any], json.loads(response_text[start:end].strip()))
            except json.JSONDecodeError:
                pass

    # Try direct parse
    try:
        return cast(Dict[str, Any], json.loads(response_text))
    except json.JSONDecodeError:
        return None
