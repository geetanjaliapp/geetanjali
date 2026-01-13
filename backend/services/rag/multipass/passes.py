"""Pass execution for multi-pass consultation pipeline.

Implements Passes 1-4:
- Pass 1 (Draft): Creative reasoning without format constraints
- Pass 2 (Critique): Analytical self-review
- Pass 3 (Refine): Disciplined rewrite
- Pass 4 (Structure): JSON formatting

Each pass is designed to be executed independently with its own
timeout, temperature, and retry settings.

See: todos/ollama-consultations-refined.md for full specification.
"""

import enum
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from config import settings
from utils.json_parsing import extract_json_from_text

from .prompts import (
    build_critique_prompt,
    build_draft_prompt,
    build_refine_prompt,
    build_structure_prompt,
)

logger = logging.getLogger(__name__)


class PassStatus(str, enum.Enum):
    """Status of individual pass execution."""

    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    ERROR = "error"
    TIMEOUT = "timeout"
    SKIPPED = "skipped"


@dataclass
class PassResult:
    """Result of a single pass execution."""

    pass_number: int
    pass_name: str
    status: PassStatus
    output_text: str | None = None
    output_json: dict[str, Any] | None = None
    error_message: str | None = None
    duration_ms: int | None = None
    tokens_used: int | None = None
    retry_count: int = 0
    started_at: datetime | None = None
    completed_at: datetime | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


# ============================================================================
# Pass 1: Draft (Creative Reasoning)
# ============================================================================


async def run_draft_pass(
    title: str,
    description: str,
    verses: list[dict],
    llm_service: Any,
) -> PassResult:
    """Execute Pass 1: Generate creative reasoning without format constraints.

    Args:
        title: Case title
        description: Case description
        verses: Retrieved verses with metadata
        llm_service: LLM service instance

    Returns:
        PassResult with draft prose output
    """
    start_time = time.time()
    started_at = datetime.now(timezone.utc)

    system_prompt, user_prompt = build_draft_prompt(title, description, verses)

    try:
        response = llm_service.generate(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=settings.MULTIPASS_TEMP_DRAFT,
            max_tokens=settings.MULTIPASS_TOKENS_DRAFT,
            json_mode=False,  # Draft produces prose, not JSON
            allow_fallback=False,  # No per-request fallback in multipass
        )

        # Extract text from response
        output_text = _extract_text(response)
        duration_ms = int((time.time() - start_time) * 1000)

        # Validate output
        if not output_text or len(output_text.strip()) < 100:
            logger.warning(f"Pass 1 output too short: {len(output_text or '')} chars")
            return PassResult(
                pass_number=1,
                pass_name="draft",
                status=PassStatus.ERROR,
                output_text=output_text,
                error_message="Draft output too short (< 100 chars)",
                duration_ms=duration_ms,
                started_at=started_at,
                completed_at=datetime.now(timezone.utc),
            )

        logger.info(f"Pass 1 (Draft) completed: {len(output_text)} chars in {duration_ms}ms")

        return PassResult(
            pass_number=1,
            pass_name="draft",
            status=PassStatus.SUCCESS,
            output_text=output_text,
            duration_ms=duration_ms,
            tokens_used=_extract_tokens(response),
            started_at=started_at,
            completed_at=datetime.now(timezone.utc),
        )

    except TimeoutError as e:
        logger.error(f"Pass 1 (Draft) timeout: {e}")
        return PassResult(
            pass_number=1,
            pass_name="draft",
            status=PassStatus.TIMEOUT,
            error_message=str(e),
            duration_ms=int((time.time() - start_time) * 1000),
            started_at=started_at,
            completed_at=datetime.now(timezone.utc),
        )

    except Exception as e:
        logger.error(f"Pass 1 (Draft) error: {e}")
        return PassResult(
            pass_number=1,
            pass_name="draft",
            status=PassStatus.ERROR,
            error_message=str(e),
            duration_ms=int((time.time() - start_time) * 1000),
            started_at=started_at,
            completed_at=datetime.now(timezone.utc),
        )


# ============================================================================
# Pass 2: Critique (Analytical Review)
# ============================================================================


async def run_critique_pass(
    title: str,
    description: str,
    draft_text: str,
    llm_service: Any,
) -> PassResult:
    """Execute Pass 2: Analytical review for gaps and shallow thinking.

    Args:
        title: Case title
        description: Case description
        draft_text: Output from Pass 1
        llm_service: LLM service instance

    Returns:
        PassResult with critique bullet points
    """
    start_time = time.time()
    started_at = datetime.now(timezone.utc)

    system_prompt, user_prompt = build_critique_prompt(title, description, draft_text)

    try:
        response = llm_service.generate(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=settings.MULTIPASS_TEMP_CRITIQUE,
            max_tokens=settings.MULTIPASS_TOKENS_CRITIQUE,
            json_mode=False,  # Critique produces prose, not JSON
            allow_fallback=False,  # No per-request fallback in multipass
        )

        output_text = _extract_text(response)
        duration_ms = int((time.time() - start_time) * 1000)

        # Empty critique is OK (maybe draft was good)
        if not output_text:
            output_text = "No significant issues found in the draft."

        logger.info(f"Pass 2 (Critique) completed: {len(output_text)} chars in {duration_ms}ms")

        return PassResult(
            pass_number=2,
            pass_name="critique",
            status=PassStatus.SUCCESS,
            output_text=output_text,
            duration_ms=duration_ms,
            tokens_used=_extract_tokens(response),
            started_at=started_at,
            completed_at=datetime.now(timezone.utc),
        )

    except TimeoutError as e:
        logger.warning(f"Pass 2 (Critique) timeout: {e}, skipping critique")
        # Critique timeout is recoverable - we can skip it
        return PassResult(
            pass_number=2,
            pass_name="critique",
            status=PassStatus.SKIPPED,
            output_text="Critique skipped due to timeout.",
            error_message=str(e),
            duration_ms=int((time.time() - start_time) * 1000),
            started_at=started_at,
            completed_at=datetime.now(timezone.utc),
        )

    except Exception as e:
        logger.error(f"Pass 2 (Critique) error: {e}")
        return PassResult(
            pass_number=2,
            pass_name="critique",
            status=PassStatus.ERROR,
            error_message=str(e),
            duration_ms=int((time.time() - start_time) * 1000),
            started_at=started_at,
            completed_at=datetime.now(timezone.utc),
        )


# ============================================================================
# Pass 3: Refine (Disciplined Rewrite)
# ============================================================================


async def run_refine_pass(
    title: str,
    description: str,
    draft_text: str,
    critique_text: str,
    llm_service: Any,
) -> PassResult:
    """Execute Pass 3: Disciplined rewrite incorporating critique.

    Args:
        title: Case title
        description: Case description
        draft_text: Output from Pass 1
        critique_text: Output from Pass 2
        llm_service: LLM service instance

    Returns:
        PassResult with refined prose
    """
    start_time = time.time()
    started_at = datetime.now(timezone.utc)

    system_prompt, user_prompt = build_refine_prompt(
        title, description, draft_text, critique_text
    )

    try:
        response = llm_service.generate(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=settings.MULTIPASS_TEMP_REFINE,
            max_tokens=settings.MULTIPASS_TOKENS_REFINE,
            json_mode=False,  # Refine produces prose, not JSON
            allow_fallback=False,  # No per-request fallback in multipass
        )

        output_text = _extract_text(response)
        duration_ms = int((time.time() - start_time) * 1000)

        # Validate output
        if not output_text or len(output_text.strip()) < 100:
            logger.warning(f"Pass 3 output too short: {len(output_text or '')} chars")
            # Fall back to draft if refine fails
            return PassResult(
                pass_number=3,
                pass_name="refine",
                status=PassStatus.ERROR,
                output_text=draft_text,  # Fall back to draft
                error_message="Refine output too short, using draft",
                duration_ms=duration_ms,
                started_at=started_at,
                completed_at=datetime.now(timezone.utc),
                metadata={"fallback_to_draft": True},
            )

        logger.info(f"Pass 3 (Refine) completed: {len(output_text)} chars in {duration_ms}ms")

        return PassResult(
            pass_number=3,
            pass_name="refine",
            status=PassStatus.SUCCESS,
            output_text=output_text,
            duration_ms=duration_ms,
            tokens_used=_extract_tokens(response),
            started_at=started_at,
            completed_at=datetime.now(timezone.utc),
        )

    except TimeoutError as e:
        logger.warning(f"Pass 3 (Refine) timeout: {e}, using draft as fallback")
        return PassResult(
            pass_number=3,
            pass_name="refine",
            status=PassStatus.TIMEOUT,
            output_text=draft_text,  # Fall back to draft
            error_message=str(e),
            duration_ms=int((time.time() - start_time) * 1000),
            started_at=started_at,
            completed_at=datetime.now(timezone.utc),
            metadata={"fallback_to_draft": True},
        )

    except Exception as e:
        logger.error(f"Pass 3 (Refine) error: {e}")
        return PassResult(
            pass_number=3,
            pass_name="refine",
            status=PassStatus.ERROR,
            output_text=draft_text,  # Fall back to draft
            error_message=str(e),
            duration_ms=int((time.time() - start_time) * 1000),
            started_at=started_at,
            completed_at=datetime.now(timezone.utc),
            metadata={"fallback_to_draft": True},
        )


# ============================================================================
# Pass 4: Structure (JSON Formatting)
# ============================================================================


async def run_structure_pass(
    refined_text: str,
    llm_service: Any,
    retry_count: int = 0,
) -> PassResult:
    """Execute Pass 4: Convert refined prose to JSON structure.

    Args:
        refined_text: Output from Pass 3
        llm_service: LLM service instance
        retry_count: Number of retries already attempted

    Returns:
        PassResult with JSON output
    """
    start_time = time.time()
    started_at = datetime.now(timezone.utc)

    system_prompt, user_prompt = build_structure_prompt(refined_text)

    # Use lower temperature on retry
    temperature = settings.MULTIPASS_TEMP_STRUCTURE
    if retry_count > 0:
        temperature = 0.0  # Fully deterministic on retry

    try:
        response = llm_service.generate(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=settings.MULTIPASS_TOKENS_STRUCTURE,
            json_mode=True,  # Structure pass produces JSON
            allow_fallback=False,  # No per-request fallback in multipass
        )

        output_text = _extract_text(response)
        duration_ms = int((time.time() - start_time) * 1000)

        # Parse JSON from response
        try:
            output_json = extract_json_from_text(output_text)
        except Exception:
            try:
                output_json = json.loads(output_text)
            except json.JSONDecodeError as e:
                logger.warning(f"Pass 4 JSON parse failed: {e}")
                return PassResult(
                    pass_number=4,
                    pass_name="structure",
                    status=PassStatus.ERROR,
                    output_text=output_text,
                    error_message=f"JSON parse error: {str(e)[:100]}",
                    duration_ms=duration_ms,
                    retry_count=retry_count,
                    started_at=started_at,
                    completed_at=datetime.now(timezone.utc),
                )

        # Validate JSON structure
        validation_errors = _validate_structure_output(output_json)
        if validation_errors:
            logger.warning(f"Pass 4 validation errors: {validation_errors}")
            return PassResult(
                pass_number=4,
                pass_name="structure",
                status=PassStatus.ERROR,
                output_text=output_text,
                output_json=output_json,
                error_message=f"Validation: {'; '.join(validation_errors[:3])}",
                duration_ms=duration_ms,
                retry_count=retry_count,
                started_at=started_at,
                completed_at=datetime.now(timezone.utc),
            )

        logger.info(f"Pass 4 (Structure) completed in {duration_ms}ms")

        return PassResult(
            pass_number=4,
            pass_name="structure",
            status=PassStatus.SUCCESS,
            output_text=output_text,
            output_json=output_json,
            duration_ms=duration_ms,
            tokens_used=_extract_tokens(response),
            retry_count=retry_count,
            started_at=started_at,
            completed_at=datetime.now(timezone.utc),
        )

    except TimeoutError as e:
        logger.error(f"Pass 4 (Structure) timeout: {e}")
        return PassResult(
            pass_number=4,
            pass_name="structure",
            status=PassStatus.TIMEOUT,
            error_message=str(e),
            duration_ms=int((time.time() - start_time) * 1000),
            retry_count=retry_count,
            started_at=started_at,
            completed_at=datetime.now(timezone.utc),
        )

    except Exception as e:
        logger.error(f"Pass 4 (Structure) error: {e}")
        return PassResult(
            pass_number=4,
            pass_name="structure",
            status=PassStatus.ERROR,
            error_message=str(e),
            duration_ms=int((time.time() - start_time) * 1000),
            retry_count=retry_count,
            started_at=started_at,
            completed_at=datetime.now(timezone.utc),
        )


# ============================================================================
# Helper Functions
# ============================================================================


def _extract_text(response: Any) -> str:
    """Extract text from LLM response.

    Handles both dict responses and string responses.
    LLM service returns {"response": ...}, but also handles legacy formats.
    """
    if isinstance(response, dict):
        # Try multiple keys: "response" (LLM service), "text" (tests), "content" (legacy)
        return (
            response.get("response", "")
            or response.get("text", "")
            or response.get("content", "")
            or ""
        )
    return str(response) if response else ""


def _extract_tokens(response: Any) -> int | None:
    """Extract token count from LLM response if available."""
    if isinstance(response, dict):
        tokens = response.get("tokens_used") or response.get("usage", {}).get("total_tokens")
        return int(tokens) if tokens is not None else None
    return None


def _validate_structure_output(output: dict) -> list[str]:
    """Validate Pass 4 JSON output structure.

    Returns list of validation error messages (empty if valid).
    """
    errors = []

    # Required top-level fields
    required_fields = [
        "executive_summary",
        "options",
        "recommended_action",
        "reflection_prompts",
        "sources",
        "confidence",
    ]

    for field_name in required_fields:
        if field_name not in output:
            errors.append(f"Missing required field: {field_name}")

    # Validate options array
    options = output.get("options", [])
    if not isinstance(options, list):
        errors.append("'options' must be a list")
    elif len(options) < 3:
        errors.append(f"Need 3 options, got {len(options)}")
    else:
        for i, opt in enumerate(options):
            if not isinstance(opt, dict):
                errors.append(f"Option {i} is not a dict")
            elif not opt.get("title") or not opt.get("description"):
                errors.append(f"Option {i} missing title or description")

    # Validate confidence
    confidence = output.get("confidence")
    if confidence is not None:
        if not isinstance(confidence, int | float):
            errors.append("'confidence' must be a number")
        elif not (0.0 <= confidence <= 1.0):
            errors.append(f"'confidence' must be 0-1, got {confidence}")

    # Validate recommended_action
    rec_action = output.get("recommended_action", {})
    if not isinstance(rec_action, dict):
        errors.append("'recommended_action' must be a dict")
    elif "option" not in rec_action:
        errors.append("'recommended_action' missing 'option' field")

    return errors
