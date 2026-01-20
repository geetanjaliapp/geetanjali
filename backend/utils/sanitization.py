"""Input sanitization utilities for XSS prevention.

This module provides functions and Pydantic types for sanitizing user input
to prevent XSS attacks. Two strategies are used based on context:

1. Strip angle brackets entirely (for names, titles, queries)
   - Removes all < > characters and HTML tags
   - Used where HTML is never valid input

2. Sanitize dangerous tags only (for long text like descriptions)
   - Preserves legitimate uses like "x < 10" or "a > b"
   - Removes dangerous tags: script, iframe, svg, etc.
   - Removes event handlers: onclick, onerror, etc.
"""

import re
from typing import Annotated

from pydantic import BeforeValidator, StringConstraints

# Dangerous HTML elements that can execute JavaScript (XSS vectors)
DANGEROUS_TAGS = [
    "script",
    "iframe",
    "style",
    "link",
    "meta",
    "object",
    "embed",
    "form",
    "input",
    "button",
    "svg",
    "math",
    "base",
    "template",
]

# Event handlers pattern (onclick, onerror, onload, etc.)
EVENT_HANDLER_PATTERN = r"\s+on\w+\s*="


def strip_angle_brackets(value: str) -> str:
    """
    Remove all HTML tags and angle brackets from input.

    For names, titles, and search queries where HTML is never valid.

    Examples:
        "John<script>alert(1)</script>" → "John"
        "My <b>Goal</b>" → "My Goal"
        "<script>" → ""

    Args:
        value: Input string to sanitize

    Returns:
        String with all HTML tags and angle brackets removed
    """
    if not value:
        return value
    # Remove complete HTML tags first
    value = re.sub(r"<[^>]*>", "", value)
    # Remove any remaining stray angle brackets
    value = re.sub(r"[<>]", "", value)
    # Normalize whitespace (collapse multiple spaces to single)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def sanitize_dangerous(value: str) -> str:
    """
    Remove dangerous HTML elements only, preserving legitimate angle bracket use.

    For long text fields (descriptions, messages) where users might legitimately
    write things like "x < 10" or "income > expenses".

    Examples:
        "x < 10 <script>bad</script>" → "x < 10 "
        "income > expenses is <b>good</b>" → "income > expenses is good"
        "<img onerror='alert(1)'>" → "<img >"

    Args:
        value: Input string to sanitize

    Returns:
        String with dangerous HTML elements removed
    """
    if not value:
        return value

    # Remove dangerous tags with their content: <script>...</script>
    for tag in DANGEROUS_TAGS:
        # Match opening and closing tags with content between
        value = re.sub(
            rf"<{tag}[^>]*>.*?</{tag}>",
            "",
            value,
            flags=re.IGNORECASE | re.DOTALL,
        )
        # Match self-closing tags: <script/>
        value = re.sub(
            rf"<{tag}[^>]*/>",
            "",
            value,
            flags=re.IGNORECASE,
        )
        # Match unclosed dangerous tags: <script>
        value = re.sub(
            rf"<{tag}[^>]*>",
            "",
            value,
            flags=re.IGNORECASE,
        )

    # Remove event handlers from any remaining tags
    # e.g., <img onerror="alert(1)"> becomes <img >
    value = re.sub(EVENT_HANDLER_PATTERN, " ", value, flags=re.IGNORECASE)

    return value.strip()


# =============================================================================
# Pydantic Custom Types
# =============================================================================

# For user names: strip all HTML, max 100 chars
SafeName = Annotated[
    str,
    StringConstraints(max_length=100, strip_whitespace=True),
    BeforeValidator(strip_angle_brackets),
]

# For titles: strip all HTML, max 200 chars
SafeTitle = Annotated[
    str,
    StringConstraints(max_length=200, strip_whitespace=True),
    BeforeValidator(strip_angle_brackets),
]

# For medium text (stakeholders, constraints): strip all HTML, max 500 chars
SafeMediumText = Annotated[
    str,
    StringConstraints(max_length=500, strip_whitespace=True),
    BeforeValidator(strip_angle_brackets),
]

# For long text (descriptions, messages): sanitize dangerous only, max 10000 chars
# Note: Token validation (2000 tokens ≈ 8000 chars) provides stricter limit
SafeText = Annotated[
    str,
    StringConstraints(max_length=10000, strip_whitespace=True),
    BeforeValidator(sanitize_dangerous),
]

# For search queries: strip all HTML, max 200 chars
SafeQuery = Annotated[
    str,
    StringConstraints(max_length=200, strip_whitespace=True),
    BeforeValidator(strip_angle_brackets),
]
