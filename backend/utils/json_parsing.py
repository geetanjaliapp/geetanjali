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

    # Strategy 4: Attempt to repair truncated JSON
    # LLMs sometimes hit token limits and return incomplete JSON
    repaired = _attempt_truncated_json_repair(response_text, provider)
    if repaired is not None:
        return repaired

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


def _attempt_truncated_json_repair(response_text: str, provider: str) -> dict[str, Any] | None:
    """
    Attempt to repair truncated JSON from LLM responses.

    LLMs sometimes hit token limits mid-response, producing invalid JSON.
    This function attempts to detect and repair common truncation patterns.

    Handles:
    - Unclosed strings (ends mid-quote)
    - Unclosed arrays (missing ])
    - Unclosed objects (missing })
    - Markdown-wrapped truncated JSON
    - Proper nesting order when closing

    Args:
        response_text: Raw response that failed normal parsing
        provider: LLM provider name (for logging)

    Returns:
        Parsed JSON dict if repair succeeded, None otherwise
    """
    # First, extract content from markdown if present
    text = response_text.strip()
    if text.startswith("```"):
        # Remove markdown fences
        if text.startswith("```json"):
            text = text[7:]
        else:
            text = text[3:]
        # Remove closing fence if present
        if "```" in text:
            text = text[: text.rfind("```")]
        text = text.strip()

    # Must start with { to be a JSON object
    if not text.startswith("{"):
        # Try to find first {
        brace_pos = text.find("{")
        if brace_pos == -1:
            return None
        text = text[brace_pos:]

    # Check if JSON appears complete (ends with })
    if text.rstrip().endswith("}"):
        # Already ends properly, normal parsing should have worked
        return None

    logger.info(f"Attempting to repair truncated JSON from {provider}")

    # Track nesting with a stack to maintain proper close order
    # Stack contains '{' or '[' in the order they were opened
    nesting_stack: list[str] = []
    in_string = False
    escape_next = False

    for char in text:
        if escape_next:
            escape_next = False
            continue
        if char == "\\":
            escape_next = True
            continue
        if char == '"' and not escape_next:
            in_string = not in_string
            continue
        if in_string:
            continue
        if char == "{":
            nesting_stack.append("{")
        elif char == "}":
            if nesting_stack and nesting_stack[-1] == "{":
                nesting_stack.pop()
        elif char == "[":
            nesting_stack.append("[")
        elif char == "]":
            if nesting_stack and nesting_stack[-1] == "[":
                nesting_stack.pop()

    # If we're in a string, close it
    repaired = text
    if in_string:
        repaired += '"'
        logger.debug("Closed unclosed string")

    # Close structures in reverse order (LIFO) to maintain proper nesting
    while nesting_stack:
        opener = nesting_stack.pop()
        if opener == "{":
            repaired += "}"
            logger.debug("Closed unclosed object")
        elif opener == "[":
            repaired += "]"
            logger.debug("Closed unclosed array")

    # Try to parse the repaired JSON
    try:
        parsed = json.loads(repaired)
        if isinstance(parsed, dict):
            logger.warning(
                f"Successfully repaired truncated JSON from {provider} "
                f"(added closures to make valid)"
            )
            return parsed
    except json.JSONDecodeError as e:
        logger.debug(f"Repair attempt failed: {e}")

    # More aggressive repair: try to close at common truncation points
    # Find last complete key-value pair and close from there
    # Look for patterns like: ..."value"  or  ...number  or  ...true/false/null
    truncation_patterns = [
        (r'("[^"]*")\s*$', r"\1"),  # Ends with string value
        (r"(\d+\.?\d*)\s*$", r"\1"),  # Ends with number
        (r"(true|false|null)\s*$", r"\1"),  # Ends with literal
        (r"(\])\s*$", r"\1"),  # Ends with array close
        (r"(\})\s*$", r"\1"),  # Ends with object close
    ]

    for pattern, _ in truncation_patterns:
        match = re.search(pattern, text)
        if match:
            # Try closing from this point
            close_point = match.end()
            attempt = text[:close_point]

            # Rebuild nesting stack for this attempt
            nesting_stack = []
            in_string = False
            escape_next = False

            for char in attempt:
                if escape_next:
                    escape_next = False
                    continue
                if char == "\\":
                    escape_next = True
                    continue
                if char == '"' and not escape_next:
                    in_string = not in_string
                    continue
                if in_string:
                    continue
                if char == "{":
                    nesting_stack.append("{")
                elif char == "}":
                    if nesting_stack and nesting_stack[-1] == "{":
                        nesting_stack.pop()
                elif char == "[":
                    nesting_stack.append("[")
                elif char == "]":
                    if nesting_stack and nesting_stack[-1] == "[":
                        nesting_stack.pop()

            # Close in reverse order
            repaired = attempt
            while nesting_stack:
                opener = nesting_stack.pop()
                if opener == "{":
                    repaired += "}"
                elif opener == "[":
                    repaired += "]"

            try:
                parsed = json.loads(repaired)
                if isinstance(parsed, dict):
                    logger.warning(
                        f"Repaired truncated JSON from {provider} using pattern matching"
                    )
                    return parsed
            except json.JSONDecodeError:
                continue

    return None
