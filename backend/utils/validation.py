"""Shared validation utilities."""

import re
from typing import Any


def validate_canonical_id(canonical_id: Any) -> bool:
    """
    Validate that canonical_id follows BG_X_Y format.

    The Bhagavad Gita has 18 chapters (max 2 digits) and verses
    up to ~78 per chapter (max 3 digits).

    Valid formats:
        - BG_1_1
        - BG_18_78
        - BG_2_47

    Args:
        canonical_id: The ID to validate

    Returns:
        True if valid format, False otherwise

    Examples:
        >>> validate_canonical_id("BG_2_47")
        True
        >>> validate_canonical_id("BG_18_63")
        True
        >>> validate_canonical_id("bg_2_47")  # Case sensitive
        False
        >>> validate_canonical_id("GK_2_47")  # Wrong prefix
        False
        >>> validate_canonical_id(12345)  # Wrong type
        False
    """
    if not isinstance(canonical_id, str):
        return False
    # Valid format: BG_<chapter>_<verse>
    # Chapter: 1-2 digits (chapters 1-18)
    # Verse: 1-3 digits (verses 1-78 max)
    return bool(re.match(r"^BG_\d{1,2}_\d{1,3}$", canonical_id))


def validate_canonical_id_format(canonical_id: str | None) -> str | None:
    """
    Validate canonical ID and return error message if invalid.

    This is a convenience wrapper for code that needs error messages
    rather than boolean results.

    Args:
        canonical_id: The ID to validate (or None)

    Returns:
        None if valid, error message string if invalid or missing
    """
    if not canonical_id:
        return "Missing canonical_id"
    if not validate_canonical_id(canonical_id):
        return f"Invalid canonical_id format: {canonical_id} (expected: BG_chapter_verse)"
    return None
