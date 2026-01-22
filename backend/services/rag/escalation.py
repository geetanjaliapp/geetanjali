"""Intelligent escalation logic for LLM response quality assessment."""

import logging
from typing import Any

logger = logging.getLogger(__name__)

# Field importance classification
# CRITICAL fields: Must exist and be non-empty; missing = immediate escalation
CRITICAL_FIELDS = ["options", "recommended_action", "executive_summary"]

# IMPORTANT fields: Missing/incomplete = escalation after repair if confidence stays low
IMPORTANT_FIELDS = ["reflection_prompts"]

# OPTIONAL fields: Missing is acceptable, no escalation impact
OPTIONAL_FIELDS = ["confidence", "sources", "scholar_flag"]


def should_escalate_to_fallback(
    response: dict[str, Any],
    repair_count: int = 0,
) -> tuple[bool, str]:
    """
    Determine if LLM response should be escalated to fallback provider.

    Uses field-aware assessment:
    - Any CRITICAL field missing → escalate immediately (structural failure)
    - 2+ IMPORTANT fields missing → escalate (significant degradation)
    - Otherwise → no pre-repair escalation (let validation handle it)

    Args:
        response: LLM response dict (after JSON extraction)
        repair_count: Number of repairs already attempted (for logging context)

    Returns:
        Tuple of (should_escalate: bool, reason: str)
        reason explains why escalation is needed (for logging/metrics)

    Examples:
        >>> response = {"executive_summary": "...", "options": None}
        >>> should_escalate(response)
        (True, "missing_critical_field_options")

        >>> response = {"executive_summary": "...", "options": [...], "reflection_prompts": []}
        >>> should_escalate(response)
        (True, "missing_multiple_important_fields")

        >>> response = {"executive_summary": "...", "options": [...], "reflection_prompts": [...]}
        >>> should_escalate(response)
        (False, "all_critical_fields_present")
    """
    # Check for missing CRITICAL fields
    missing_critical = []
    for field in CRITICAL_FIELDS:
        value = response.get(field)
        # Field is missing or empty (None, [], "", etc.)
        if value is None or (isinstance(value, list | str | dict) and len(value) == 0):
            missing_critical.append(field)

    if missing_critical:
        reason = f"missing_critical_field_{missing_critical[0]}"
        logger.warning(
            f"Escalation triggered: missing CRITICAL field '{missing_critical[0]}'. "
            f"All missing critical: {missing_critical}"
        )
        return True, reason

    # Check for missing IMPORTANT fields (2+ missing triggers escalation)
    missing_important = []
    for field in IMPORTANT_FIELDS:
        value = response.get(field)
        if value is None or (isinstance(value, list | str | dict) and len(value) == 0):
            missing_important.append(field)

    if len(missing_important) >= 2:
        reason = "missing_multiple_important_fields"
        logger.warning(
            f"Escalation triggered: missing {len(missing_important)} IMPORTANT fields: {missing_important}"
        )
        return True, reason

    # All critical fields present, insufficient important field failures
    logger.debug(
        f"No pre-repair escalation needed. "
        f"Missing important fields: {len(missing_important)}"
    )
    return False, "all_critical_fields_present"


def get_escalation_threshold() -> float:
    """Get confidence threshold for post-repair escalation.

    Returns:
        Confidence threshold (0.45 by default, locked for v1.34.0)
    """
    return 0.45


def describe_escalation_reason(reason: str) -> str:
    """Provide human-readable explanation of escalation reason.

    Args:
        reason: Escalation reason code (from should_escalate_to_fallback)

    Returns:
        Human-readable description
    """
    descriptions = {
        "missing_critical_field_options": (
            "Response missing required 'options' field (structural failure)"
        ),
        "missing_critical_field_recommended_action": (
            "Response missing required 'recommended_action' field (structural failure)"
        ),
        "missing_critical_field_executive_summary": (
            "Response missing required 'executive_summary' field (structural failure)"
        ),
        "missing_multiple_important_fields": (
            "Response missing 2+ important fields (significant degradation)"
        ),
        "low_confidence_post_repair": (
            "Confidence remains below threshold after repair attempts"
        ),
        "all_critical_fields_present": "No escalation needed - all critical fields present",
    }
    return descriptions.get(reason, f"Escalation reason: {reason}")
