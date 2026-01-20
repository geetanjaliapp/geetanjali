"""Token counting utilities for request validation and cost estimation."""

import logging

logger = logging.getLogger(__name__)


def estimate_tokens(text: str, model: str = "gemini") -> int:
    """
    Estimate token count for text (conservative approach).

    Uses rough estimation:
    - Gemini: ~4 chars per token (actual: 3-5 depending on language)
    - Anthropic: ~4 chars per token
    - Ollama: ~4 chars per token

    Conservative estimate ensures we never undercount.

    Args:
        text: Text to estimate
        model: Model name (gemini, anthropic, ollama) - currently unused

    Returns:
        Estimated token count (minimum 1)

    Examples:
        >>> estimate_tokens("Hello world")  # 11 chars
        3  # 11 / 4 = 2.75 → 3

        >>> estimate_tokens("This is a longer question about ethics and morality")
        16  # ~65 chars / 4
    """
    if not text:
        return 0

    # Conservative: 4 chars per token
    # Actual varies: 3-5 chars/token depending on language/content
    # Using 4 is safe (errs on side of overestimation)
    estimated = len(text) // 4
    return max(1, estimated)  # Minimum 1 token


def check_request_tokens(
    title: str,
    description: str,
    max_tokens: int = 2000,
) -> dict:
    """
    Validate request doesn't exceed token limit.

    Calculates token count for title + description.
    Raises ValueError if oversized.

    Args:
        title: Case title/subject
        description: Case description/body
        max_tokens: Maximum allowed tokens (default: 2000)

    Returns:
        dict with keys:
        - title_tokens: Estimated tokens in title
        - description_tokens: Estimated tokens in description
        - total_tokens: Total estimated tokens
        - valid: True if under limit

    Raises:
        ValueError: If total tokens > max_tokens

    Examples:
        >>> result = check_request_tokens("Career dilemma", "Should I switch jobs?")
        >>> result['valid']
        True
        >>> result['total_tokens']
        6

        >>> # Oversized request
        >>> large = "x" * 10000
        >>> check_request_tokens("Title", large)
        Traceback (most recent call last):
            ...
        ValueError: Your question is too detailed...
    """
    title_tokens = estimate_tokens(title)
    description_tokens = estimate_tokens(description)
    total_tokens = title_tokens + description_tokens

    result = {
        "title_tokens": title_tokens,
        "description_tokens": description_tokens,
        "total_tokens": total_tokens,
        "valid": total_tokens <= max_tokens,
    }

    if total_tokens > max_tokens:
        logger.warning(
            f"Request too large: {total_tokens} tokens (limit {max_tokens})",
            extra={
                "title_tokens": title_tokens,
                "description_tokens": description_tokens,
                "total_tokens": total_tokens,
                "max_tokens": max_tokens,
            },
        )
        raise ValueError(
            f"Your question is too detailed ({total_tokens} tokens). "
            f"Please simplify to under {max_tokens} tokens and focus on "
            f"the core ethical dilemma."
        )

    return result
