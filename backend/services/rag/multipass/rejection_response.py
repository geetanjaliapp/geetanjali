"""Pass 0 rejection message generation for multi-pass consultation pipeline.

Generates contextual, empathetic rejection messages when Pass 0 rejects a case.
Only called for the ~3-5% of cases that are rejected.

Strategy:
- Separate LLM call (not part of Pass 0 itself)
- Falls back to static templates if LLM fails
- Keeps Pass 0 fast for accepted cases (happy path)
"""

import logging
from typing import Any

from config import settings

from .acceptance import REJECTION_FALLBACKS, RejectionCategory

logger = logging.getLogger(__name__)


# System prompt for generating rejection messages
REJECTION_MESSAGE_SYSTEM_PROMPT = """You are a compassionate guide helping someone understand why their submission wasn't suitable for ethical consultation grounded in Bhagavad Geeta wisdom.

Your tone should be:
- Kind and supportive (not dismissive or harsh)
- Clear about why we can't help with this specific request
- Encouraging about resubmission if they reframe their question

Keep responses concise (100-150 words max)."""


REJECTION_MESSAGE_USER_PROMPT = """A user submitted a case for ethical consultation, but it was not suitable.

Their submission (first 500 characters):
---
{case_description}
---

Reason it wasn't suitable: {rejection_reason}
Category: {category}

Generate a brief, kind response that:
1. Acknowledges their concern without being condescending
2. Explains clearly why this isn't something we can help with
3. If appropriate, suggests how they might reframe as an ethical dilemma
4. Encourages them to try again if they have a genuine ethical tension

Do NOT:
- Be preachy or judgmental
- Repeat the rejection reason verbatim
- Make them feel bad for trying

Respond with just the message (no JSON, no headers)."""


async def generate_rejection_message(
    case_description: str,
    rejection_reason: str,
    category: RejectionCategory,
    llm_service: Any,
) -> str:
    """Generate a contextual rejection message for a rejected case.

    This is called separately from Pass 0 acceptance, only for rejected cases.
    If LLM fails or times out, falls back to static templates.

    Args:
        case_description: The original case description (truncated to 500 chars)
        rejection_reason: The reason from Pass 0 (e.g., "not_dilemma")
        category: The rejection category enum
        llm_service: LLM service instance for generating message

    Returns:
        A kind, contextual rejection message string
    """
    # Truncate description for prompt
    truncated_description = case_description[:500]
    if len(case_description) > 500:
        truncated_description += "..."

    user_prompt = REJECTION_MESSAGE_USER_PROMPT.format(
        case_description=truncated_description,
        rejection_reason=rejection_reason,
        category=category.value,
    )

    try:
        response = await llm_service.generate(
            prompt=user_prompt,
            system_prompt=REJECTION_MESSAGE_SYSTEM_PROMPT,
            temperature=settings.MULTIPASS_TEMP_REJECTION,
            max_tokens=settings.MULTIPASS_TOKENS_REJECTION,
            timeout=settings.MULTIPASS_TIMEOUT_REJECTION,
        )

        # Extract text from response
        if isinstance(response, dict):
            message = response.get("text", "") or response.get("content", "")
        else:
            message = str(response) if response else ""

        # Validate response
        if message and len(message.strip()) >= 50:
            logger.info(
                f"Generated contextual rejection message for category: {category.value}"
            )
            return message.strip()

        # Response too short, use fallback
        logger.warning(
            f"Rejection message too short ({len(message)} chars), using fallback"
        )
        return get_fallback_message(category)

    except TimeoutError:
        logger.warning("Rejection message generation timed out, using fallback")
        return get_fallback_message(category)

    except Exception as e:
        logger.error(f"Rejection message generation failed: {e}, using fallback")
        return get_fallback_message(category)


def get_fallback_message(category: RejectionCategory) -> str:
    """Get static fallback message for a rejection category.

    Args:
        category: The rejection category

    Returns:
        Static fallback message string
    """
    return REJECTION_FALLBACKS.get(
        category,
        "Your request couldn't be processed for consultation. "
        "Please try again with a clear description of an ethical dilemma "
        "where you're weighing competing values or duties.",
    )


async def create_rejection_output(
    case_description: str,
    acceptance_result: Any,
    llm_service: Any | None = None,
) -> dict[str, Any]:
    """Create a structured output for a rejected case.

    Generates a user-facing response that explains the rejection
    and provides guidance for resubmission.

    Args:
        case_description: The original case description
        acceptance_result: Result from run_acceptance_pass
        llm_service: Optional LLM service for contextual messages

    Returns:
        Structured output dict matching the Output schema
    """
    # Get rejection message (LLM-generated or fallback)
    if llm_service is not None:
        message = await generate_rejection_message(
            case_description=case_description,
            rejection_reason=acceptance_result.reason,
            category=acceptance_result.category,
            llm_service=llm_service,
        )
    else:
        message = get_fallback_message(acceptance_result.category)

    # Build structured response matching Output schema
    return {
        "suggested_title": "Unable to Process Request",
        "executive_summary": message,
        "options": [
            {
                "title": "Reframe Your Question",
                "description": (
                    "Consider describing the stakeholders involved, "
                    "the values or duties in tension, and the decision you face."
                ),
                "pros": ["Enables meaningful consultation"],
                "cons": ["Requires more reflection on the situation"],
                "sources": [],
            },
            {
                "title": "Provide More Context",
                "description": (
                    "Help us understand the full situation: "
                    "Who is affected? What are the consequences of different choices?"
                ),
                "pros": ["Allows for deeper analysis"],
                "cons": ["Takes more time to articulate"],
                "sources": [],
            },
            {
                "title": "Explore Related Questions",
                "description": (
                    "If this isn't an ethical dilemma, consider what underlying "
                    "values or principles might be relevant to your situation."
                ),
                "pros": ["May reveal hidden ethical dimensions"],
                "cons": ["Requires stepping back from the immediate question"],
                "sources": [],
            },
        ],
        "recommended_action": {
            "option": 1,
            "steps": [
                "Identify the key decision you need to make",
                "List the people or groups affected by this decision",
                "Describe the competing values or duties at play",
                "Resubmit with this context included",
            ],
            "sources": [],
        },
        "reflection_prompts": [
            "What makes this situation feel like a dilemma to you?",
            "Who are the stakeholders and what do they need?",
        ],
        "sources": [],
        "confidence": 0.0,
        "scholar_flag": True,
        "rejection_category": acceptance_result.category.value,
        "rejection_reason": acceptance_result.reason,
    }
