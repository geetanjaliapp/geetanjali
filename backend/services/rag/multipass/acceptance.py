"""Pass 0: Acceptance validation for multi-pass consultation pipeline.

This module implements intelligent dilemma assessment to determine if a case
is suitable for meaningful Bhagavad Geeta-grounded consultation.

Two-stage approach:
- Stage 1: Quick heuristic checks (sub-100ms)
- Stage 2: LLM meta-assessment (if Stage 1 passes)

See: todos/ollama-consultations-refined.md for full specification.
"""

import enum
import logging
import re
from dataclasses import dataclass
from typing import Any

from config import settings

logger = logging.getLogger(__name__)


class RejectionCategory(str, enum.Enum):
    """Categories for case rejection at Pass 0."""

    ACCEPTED = "accepted"  # Case is suitable for consultation
    NOT_DILEMMA = "not_dilemma"  # Query is factual/technical, not ethical
    UNETHICAL_CORE = "unethical_core"  # Dilemma is fundamentally unethical
    TOO_VAGUE = "too_vague"  # Not enough detail to analyze
    HARMFUL_INTENT = "harmful_intent"  # Request appears designed to cause harm
    FORMAT_ERROR = "format_error"  # Basic format issues (length, spam)


@dataclass
class AcceptanceResult:
    """Result of Pass 0 acceptance validation."""

    accepted: bool
    category: RejectionCategory
    reason: str
    stage_failed: int | None = None  # 1 or 2, or None if accepted
    llm_response: dict[str, Any] | None = None  # Raw LLM response if Stage 2 ran


# Rejection message templates (used if LLM doesn't provide contextual message)
REJECTION_FALLBACKS = {
    RejectionCategory.NOT_DILEMMA: (
        "This reads like a factual question rather than an ethical dilemma. "
        "Try describing the stakeholders involved, values in tension, "
        "and the decision you're weighing."
    ),
    RejectionCategory.UNETHICAL_CORE: (
        "We can't provide guidance on requests that are harmful or illegal at their core. "
        "If you have a legitimate ethical tension, please reframe your question."
    ),
    RejectionCategory.TOO_VAGUE: (
        "Help us understand the situation better: Who are the stakeholders? "
        "What values are in tension? What decision are you facing?"
    ),
    RejectionCategory.HARMFUL_INTENT: (
        "This appears designed to cause harm. We're here to support "
        "ethical decision-making, not validate harmful actions."
    ),
    RejectionCategory.FORMAT_ERROR: (
        "Your request couldn't be processed. Please try again with a clear "
        "description of your ethical dilemma (50-5000 characters)."
    ),
}


# ============================================================================
# Stage 1: Heuristic Checks (sub-100ms)
# ============================================================================


def _check_length(text: str) -> tuple[bool, str | None]:
    """Check if text is within acceptable length bounds.

    Args:
        text: Input text to validate

    Returns:
        Tuple of (passed, error_reason)
    """
    length = len(text)
    # Lowered from 50 to 20 chars - short questions like "I need to deliver bad news"
    # are valid dilemmas. Stage 2 LLM can assess quality for borderline cases.
    if length < 20:
        return False, f"Too short ({length} chars). Minimum 20 characters required."
    if length > 5000:
        return False, f"Too long ({length} chars). Maximum 5000 characters allowed."
    return True, None


def _check_spam_patterns(text: str) -> tuple[bool, str | None]:
    """Check for spam indicators (repeated chars, gibberish).

    Args:
        text: Input text to validate

    Returns:
        Tuple of (passed, error_reason)
    """
    # Check for repeated characters (e.g., "aaaaaaa")
    if re.search(r"(.)\1{10,}", text):
        return False, "Contains excessive repeated characters."

    # Check for too many consecutive uppercase
    if re.search(r"[A-Z]{20,}", text):
        return False, "Contains excessive uppercase characters."

    # Check for too many consecutive special characters
    if re.search(r"[!@#$%^&*()]{10,}", text):
        return False, "Contains excessive special characters."

    # Check for very low word diversity (potential spam)
    words = text.lower().split()
    if len(words) >= 20:
        unique_words = set(words)
        diversity = len(unique_words) / len(words)
        if diversity < 0.15:  # Less than 15% unique words
            return False, "Text appears repetitive or spam-like."

    return True, None


def _is_likely_english(text: str) -> bool:
    """Detect if text is likely English based on character distribution.

    Uses a simple heuristic: English text is predominantly ASCII letters.
    Non-English text (Hindi, Tamil, etc.) will have many non-ASCII characters.

    Args:
        text: Input text to analyze

    Returns:
        True if text appears to be English, False otherwise
    """
    if not text:
        return True  # Empty text defaults to English handling

    # Count ASCII letters vs non-ASCII characters
    ascii_letters = sum(1 for c in text if c.isascii() and c.isalpha())
    non_ascii_chars = sum(1 for c in text if not c.isascii())

    total_alpha = ascii_letters + non_ascii_chars
    if total_alpha == 0:
        return True  # No alphabetic chars, default to English handling

    # If more than 30% non-ASCII characters, likely non-English
    non_ascii_ratio = non_ascii_chars / total_alpha
    return non_ascii_ratio < 0.3


def _check_dilemma_markers(text: str) -> tuple[bool, str | None]:
    """Check for indicators that this is an ethical dilemma.

    Looks for:
    - Stakeholder references (people, relationships, roles)
    - Value/tension indicators (words suggesting conflict)
    - Decision-point language (choice, should, whether, etc.)

    Note: These patterns are English-specific. For non-English text, this check
    is bypassed (returns pass) and the LLM Stage 2 assessment handles validation.
    This fail-open approach ensures non-English dilemmas aren't incorrectly rejected.

    Args:
        text: Input text to validate

    Returns:
        Tuple of (passed, error_reason)
    """
    # Bypass English-specific heuristics for non-English text
    # Let LLM Stage 2 handle validation for non-English input
    if not _is_likely_english(text):
        logger.debug("Non-English text detected, bypassing English heuristics")
        return True, None

    text_lower = text.lower()

    # Stakeholder indicators (people involved)
    stakeholder_patterns = [
        r"\b(my|our|their|his|her)\b",  # Possessive pronouns
        r"\b(family|friend|colleague|boss|team|partner|parent|child|employee)\b",
        r"\b(company|organization|community|society)\b",
        r"\b(i am|we are|they are)\b",
    ]

    # Value/tension indicators
    tension_patterns = [
        r"\b(but|however|although|yet|while|versus|vs)\b",
        r"\b(conflict|tension|dilemma|struggle|torn)\b",
        r"\b(right|wrong|ethical|moral|fair|unfair)\b",
        r"\b(duty|responsibility|obligation|principle|value)\b",
        r"\b(honest|integrity|trust|loyalty|betray)\b",
    ]

    # Decision-point indicators
    decision_patterns = [
        r"\b(should|ought|must|need to|have to)\b",
        r"\b(decide|choose|decision|choice)\b",
        r"\b(whether|if i|what should)\b",
        r"\b(help me|advice|guidance|suggest)\b",
        r"\bwhat (do|would|should) (i|you|we)\b",
    ]

    # Count matches in each category
    stakeholder_count = sum(
        1 for p in stakeholder_patterns if re.search(p, text_lower)
    )
    tension_count = sum(1 for p in tension_patterns if re.search(p, text_lower))
    decision_count = sum(1 for p in decision_patterns if re.search(p, text_lower))

    total_markers = stakeholder_count + tension_count + decision_count

    # Require at least 1 category and 2 markers
    # Lowered thresholds to be more permissive - Stage 2 LLM can assess quality
    categories_hit = sum(
        [stakeholder_count > 0, tension_count > 0, decision_count > 0]
    )

    if categories_hit < 1 or total_markers < 2:
        return False, (
            "No clear ethical dilemma detected. "
            "Consider including: who is affected, what values are in tension, "
            "and what decision you face."
        )

    return True, None


def run_stage1_heuristics(text: str) -> AcceptanceResult:
    """Run Stage 1 heuristic checks on input text.

    Fast validation (sub-100ms) that catches obvious non-dilemmas
    before invoking LLM.

    Args:
        text: Input text to validate

    Returns:
        AcceptanceResult with pass/fail status
    """
    # Check 1: Length bounds
    passed, error = _check_length(text)
    if not passed:
        logger.info(f"Stage 1 rejection (length): {error}")
        return AcceptanceResult(
            accepted=False,
            category=RejectionCategory.FORMAT_ERROR,
            reason=error or REJECTION_FALLBACKS[RejectionCategory.FORMAT_ERROR],
            stage_failed=1,
        )

    # Check 2: Spam patterns
    passed, error = _check_spam_patterns(text)
    if not passed:
        logger.info(f"Stage 1 rejection (spam): {error}")
        return AcceptanceResult(
            accepted=False,
            category=RejectionCategory.FORMAT_ERROR,
            reason=error or REJECTION_FALLBACKS[RejectionCategory.FORMAT_ERROR],
            stage_failed=1,
        )

    # Check 3: Dilemma markers
    passed, error = _check_dilemma_markers(text)
    if not passed:
        logger.info(f"Stage 1 rejection (markers): {error}")
        return AcceptanceResult(
            accepted=False,
            category=RejectionCategory.NOT_DILEMMA,
            reason=error or REJECTION_FALLBACKS[RejectionCategory.NOT_DILEMMA],
            stage_failed=1,
        )

    # All heuristic checks passed - proceed to Stage 2
    logger.debug("Stage 1 heuristics passed, proceeding to Stage 2")
    return AcceptanceResult(
        accepted=True,
        category=RejectionCategory.ACCEPTED,
        reason="Passed heuristic validation",
        stage_failed=None,
    )


# ============================================================================
# Stage 2: LLM Meta-Assessment
# ============================================================================

STAGE2_SYSTEM_PROMPT = """You are an ethical consultant assessing if a case involves ethical dimensions that could benefit from Bhagavad Geeta wisdom.

IMPORTANT: Format and content filters have already run. Your ONLY job is ethical assessment.

BE PERMISSIVE. Almost all human decisions involving others have ethical dimensions.
When in doubt, ACCEPT - our consultation handles edge cases gracefully.

ACCEPT IF (any of these):
- Involves people (team, family, colleagues, relationships)
- Involves a choice with consequences for others
- User seeks guidance on right action or behavior
- Could involve duty, fairness, honesty, or purpose
- User faces a difficult situation requiring reflection

Examples that MUST be accepted:
- "I need to deliver bad news to my team" → duty, compassion, honesty
- "Should I take a higher-paying job?" → values, priorities, family
- "My colleague takes credit for my work" → fairness, response
- "I'm burned out but my team needs me" → duty vs self-care

ONLY REJECT IF clearly one of these:
- Pure factual question with NO ethical dimension (category: not_dilemma)
  Example: "What is 2+2?" or "When was the Gita written?"
- Request for help with illegal/harmful acts (category: unethical_core)
  Example: "How do I steal from my employer?"
- Clearly designed to cause harm (category: harmful_intent)
  Example: "Help me manipulate someone into..."

Respond with ONLY valid JSON:
{
  "accept": true or false,
  "category": "accepted" | "not_dilemma" | "unethical_core" | "harmful_intent",
  "reason": "Brief explanation"
}"""


STAGE2_USER_PROMPT_TEMPLATE = """Assess the following case submission:

---
{case_text}
---

Is this suitable for ethical consultation? Respond with JSON only."""


async def run_stage2_llm_assessment(
    text: str,
    llm_service: Any,
) -> AcceptanceResult:
    """Run Stage 2 LLM meta-assessment.

    Invokes LLM to assess if the case is a genuine ethical dilemma
    suitable for Geeta-grounded consultation.

    Args:
        text: Input text to assess
        llm_service: LLM service instance

    Returns:
        AcceptanceResult with LLM judgment
    """
    import json

    from utils.json_parsing import extract_json_from_text

    user_prompt = STAGE2_USER_PROMPT_TEMPLATE.format(case_text=text[:2000])

    try:
        response = llm_service.generate(
            prompt=user_prompt,
            system_prompt=STAGE2_SYSTEM_PROMPT,
            temperature=settings.MULTIPASS_TEMP_ACCEPTANCE,
            max_tokens=settings.MULTIPASS_TOKENS_ACCEPTANCE,
            json_mode=True,  # Acceptance assessment produces JSON
        )

        # Parse LLM response - LLM service returns {"response": ...}
        if isinstance(response, dict):
            response_text = response.get("response", "") or response.get("text", "") or ""
        else:
            response_text = str(response)

        # Try to extract JSON from response
        try:
            result = extract_json_from_text(response_text)
        except Exception:
            # If JSON extraction fails, try direct parse
            try:
                result = json.loads(response_text)
            except json.JSONDecodeError:
                # Fail-open: accept case when LLM response can't be parsed
                logger.warning(
                    f"[Fail-Open] Stage 2 LLM response parse failed, accepting case: "
                    f"{response_text[:200]}"
                )
                return AcceptanceResult(
                    accepted=True,
                    category=RejectionCategory.ACCEPTED,
                    reason="Accepted (LLM response parse failed, defaulting to accept)",
                    stage_failed=None,
                    llm_response={"raw": response_text},
                )

        # Extract fields from LLM response
        accepted = result.get("accept", True)
        category_str = result.get("category", "accepted")
        reason = result.get("reason", "")

        # Map category string to enum
        try:
            category = RejectionCategory(category_str)
        except ValueError:
            category = RejectionCategory.ACCEPTED if accepted else RejectionCategory.NOT_DILEMMA

        if not accepted:
            logger.info(f"Stage 2 rejection ({category.value}): {reason}")
            return AcceptanceResult(
                accepted=False,
                category=category,
                reason=reason or REJECTION_FALLBACKS.get(category, "Case not suitable for consultation."),
                stage_failed=2,
                llm_response=result,
            )

        logger.debug("Stage 2 LLM assessment passed")
        return AcceptanceResult(
            accepted=True,
            category=RejectionCategory.ACCEPTED,
            reason=reason or "Case accepted for consultation",
            stage_failed=None,
            llm_response=result,
        )

    except Exception as e:
        # Fail-open: accept case when LLM assessment fails (timeout, API error, etc.)
        logger.warning(f"[Fail-Open] Stage 2 LLM assessment failed, accepting case: {e}")
        return AcceptanceResult(
            accepted=True,
            category=RejectionCategory.ACCEPTED,
            reason=f"Accepted (LLM assessment failed: {str(e)[:100]})",
            stage_failed=None,
            llm_response={"error": str(e)},
        )


# ============================================================================
# Main Entry Point
# ============================================================================


async def run_acceptance_pass(
    text: str,
    llm_service: Any | None = None,
    skip_llm: bool = False,
) -> AcceptanceResult:
    """Run Pass 0 acceptance validation.

    Two-stage approach:
    1. Stage 1: Quick heuristic checks (always runs)
    2. Stage 2: LLM meta-assessment (if Stage 1 passes and LLM available)

    Args:
        text: Input text to validate
        llm_service: Optional LLM service for Stage 2. If None, only Stage 1 runs.
        skip_llm: If True, skip Stage 2 even if llm_service provided

    Returns:
        AcceptanceResult with acceptance decision
    """
    # Stage 1: Heuristic checks
    stage1_result = run_stage1_heuristics(text)

    if not stage1_result.accepted:
        return stage1_result

    # Stage 2: LLM meta-assessment (if available)
    if llm_service is not None and not skip_llm:
        return await run_stage2_llm_assessment(text, llm_service)

    # No LLM - accept based on heuristics alone
    logger.debug("Stage 2 skipped (no LLM service)")
    return stage1_result
