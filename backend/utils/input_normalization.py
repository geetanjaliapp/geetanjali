"""Input normalization utilities for preprocessing user input before LLM processing.

This module provides defensive input preprocessing to:
- Remove duplicate content (e.g., accidentally pasted twice)
- Normalize whitespace and control characters
- Detect potentially suspicious patterns for logging/monitoring

Security context:
- These are preprocessing steps, not security controls
- Defense-in-depth: LLM output is treated as untrusted regardless
- Warnings are logged for monitoring, not used to block requests

References:
- OWASP LLM Prompt Injection Prevention Cheat Sheet
- https://github.com/tldrsec/prompt-injection-defenses
"""

import logging
import re
from dataclasses import dataclass, field
from typing import List

from prometheus_client import Counter

logger = logging.getLogger(__name__)

# Metrics for monitoring input patterns
input_normalization_total = Counter(
    "geetanjali_input_normalization_total",
    "Total input normalization operations by result",
    ["result"],  # clean, modified, suspicious
)

input_normalization_warnings_total = Counter(
    "geetanjali_input_normalization_warnings_total",
    "Input normalization warnings by type",
    ["warning_type"],
)


@dataclass
class NormalizationResult:
    """Result of input normalization."""

    text: str
    warnings: List[str] = field(default_factory=list)
    original_length: int = 0
    normalized_length: int = 0
    lines_removed: int = 0

    @property
    def was_modified(self) -> bool:
        """Check if the text was modified during normalization."""
        return self.original_length != self.normalized_length or self.lines_removed > 0

    @property
    def has_warnings(self) -> bool:
        """Check if any warnings were generated."""
        return len(self.warnings) > 0


# Pattern for detecting potential Base64 encoded content (50+ chars)
BASE64_PATTERN = re.compile(r"[A-Za-z0-9+/]{50,}={0,2}")

# Pattern for chat log timestamps (WhatsApp, Telegram, etc.)
CHAT_TIMESTAMP_PATTERN = re.compile(
    r"\[\d{1,2}/\d{1,2}/\d{2,4},?\s*\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?\]"
)

# Control characters to strip (keep newlines \n, carriage returns \r, tabs \t)
CONTROL_CHAR_PATTERN = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def normalize_input(text: str) -> NormalizationResult:
    """
    Normalize user input before LLM processing.

    Performs the following transformations:
    1. Strip control characters (keeps newlines, tabs, carriage returns)
    2. Deduplicate repeated lines while preserving order
    3. Collapse multiple consecutive blank lines to one
    4. Trim leading/trailing whitespace

    Also detects and logs warnings for:
    - Potential Base64 encoded content
    - Chat log format (timestamps)
    - Significant duplicate content removal

    Args:
        text: Raw user input text (must be a string, not None)

    Returns:
        NormalizationResult with normalized text and any warnings

    Raises:
        TypeError: If text is not a string

    Example:
        >>> result = normalize_input("Hello\\nHello\\nWorld")
        >>> result.text
        'Hello\\nWorld'
        >>> result.lines_removed
        1
    """
    # Type guard for defense-in-depth
    if text is None:
        raise TypeError("normalize_input requires a string, got None")
    if not isinstance(text, str):
        raise TypeError(f"normalize_input requires a string, got {type(text).__name__}")

    if not text:
        return NormalizationResult(
            text="",
            original_length=0,
            normalized_length=0,
        )

    original_length = len(text)
    warnings: List[str] = []

    # Step 1: Strip control characters
    text = CONTROL_CHAR_PATTERN.sub("", text)

    # Step 2: Detect potential encoded content (before processing)
    if BASE64_PATTERN.search(text):
        warnings.append("potential_encoded_content")
        logger.info("Input contains potential Base64 encoded content")

    # Step 3: Detect chat log format
    chat_matches = CHAT_TIMESTAMP_PATTERN.findall(text)
    if len(chat_matches) >= 3:
        warnings.append("chat_log_format")
        logger.info(f"Input appears to be chat log format ({len(chat_matches)} timestamps)")

    # Step 4: Deduplicate lines while preserving order
    seen = set()
    lines = []
    lines_removed = 0
    prev_was_blank = False

    for line in text.split("\n"):
        stripped = line.strip()

        if stripped:
            # Non-blank line: deduplicate
            if stripped not in seen:
                seen.add(stripped)
                lines.append(line)
                prev_was_blank = False
            else:
                lines_removed += 1
        else:
            # Blank line: keep only if previous wasn't blank
            if not prev_was_blank and lines:
                lines.append("")
                prev_was_blank = True
            # Otherwise skip (collapse multiple blanks)

    # Step 5: Join and trim
    normalized_text = "\n".join(lines).strip()
    normalized_length = len(normalized_text)

    # Step 6: Generate warnings for significant changes
    if lines_removed >= 5:
        warnings.append(f"removed_{lines_removed}_duplicate_lines")
        logger.warning(
            f"Removed {lines_removed} duplicate lines from input "
            f"(original: {original_length} chars, normalized: {normalized_length} chars)"
        )

    # Step 7: Record metrics
    if warnings:
        input_normalization_total.labels(result="suspicious").inc()
        for warning in warnings:
            # Normalize warning type for metric label
            warning_type = warning.split("_")[0] if "_" in warning else warning
            input_normalization_warnings_total.labels(warning_type=warning_type).inc()
    elif lines_removed > 0 or original_length != normalized_length:
        input_normalization_total.labels(result="modified").inc()
    else:
        input_normalization_total.labels(result="clean").inc()

    return NormalizationResult(
        text=normalized_text,
        warnings=warnings,
        original_length=original_length,
        normalized_length=normalized_length,
        lines_removed=lines_removed,
    )
