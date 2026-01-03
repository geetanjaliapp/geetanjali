"""RAG output validation and repair utilities."""

import logging
from typing import Any

from config import settings
from utils.validation import validate_canonical_id

logger = logging.getLogger(__name__)


def _truncate_at_word_boundary(text: str, max_len: int = 200) -> str:
    """
    Truncate text at word boundary, adding ellipsis if needed.

    Args:
        text: The text to truncate
        max_len: Maximum length (default 200)

    Returns:
        Truncated text with ellipsis if shortened
    """
    if len(text) <= max_len:
        return text
    # Find last space before max_len
    truncated = text[:max_len].rsplit(" ", 1)[0]
    # If no space found (single long word), fall back to hard truncation
    if not truncated or len(truncated) < max_len // 2:
        return text[:max_len] + "…"
    return truncated + "…"


def _validate_relevance(relevance: Any) -> bool:
    """
    Validate that relevance is a number between 0.0 and 1.0.

    Args:
        relevance: The value to validate

    Returns:
        True if valid, False otherwise
    """
    if not isinstance(relevance, int | float):
        return False
    return 0.0 <= relevance <= 1.0


def _validate_source_reference(
    source_id: str, available_sources: list[dict[str, Any]]
) -> bool:
    """
    Validate that a source reference (in options) cites a verse that exists in sources.

    Args:
        source_id: Canonical ID referenced in option
        available_sources: List of full source objects with metadata

    Returns:
        True if the reference is valid, False otherwise
    """
    if not isinstance(source_id, str):
        return False
    # Handle both dict sources ({"canonical_id": "BG_2_47"}) and string sources ("BG_2_47")
    source_canonical_ids = []
    for s in available_sources:
        if isinstance(s, dict):
            source_canonical_ids.append(s.get("canonical_id"))
        elif isinstance(s, str):
            source_canonical_ids.append(s)
    return source_id in source_canonical_ids


def _validate_option_structure(option: dict[str, Any]) -> tuple[bool, str]:
    """
    Validate a single option has correct structure and types.

    Args:
        option: Option object to validate

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not isinstance(option, dict):
        return False, "Option is not a dict"

    # Check required fields exist and have correct types
    if (
        not isinstance(option.get("title"), str)
        or len(str(option.get("title", "")).strip()) == 0
    ):
        return False, "Option missing or empty title"

    if (
        not isinstance(option.get("description"), str)
        or len(str(option.get("description", "")).strip()) == 0
    ):
        return False, "Option missing or empty description"

    if not isinstance(option.get("pros"), list):
        return False, "Option pros not a list"

    if not isinstance(option.get("cons"), list):
        return False, "Option cons not a list"

    if not isinstance(option.get("sources"), list):
        return False, "Option sources not a list"

    # Validate each source in sources array is a string (canonical_id reference)
    for source in option.get("sources", []):
        if not isinstance(source, str):
            return False, f"Option source not a string: {source}"

    return True, ""


def _validate_source_object_structure(source: dict[str, Any]) -> tuple[bool, str]:
    """
    Validate a source object in the root sources array has correct structure.

    Args:
        source: Source object to validate

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not isinstance(source, dict):
        return False, "Source is not a dict"

    # Check canonical_id
    canonical_id = source.get("canonical_id")
    if not isinstance(canonical_id, str):
        return False, "Source missing or invalid canonical_id"

    if not validate_canonical_id(canonical_id):
        return False, f"Source canonical_id invalid format: {canonical_id}"

    # Check paraphrase
    if (
        not isinstance(source.get("paraphrase"), str)
        or len(str(source.get("paraphrase", "")).strip()) == 0
    ):
        return False, "Source missing or empty paraphrase"

    # Check relevance
    if not _validate_relevance(source.get("relevance")):
        return False, f"Source invalid relevance: {source.get('relevance')}"

    return True, ""


def _ensure_required_fields(output: dict[str, Any]) -> None:
    """
    Ensure all required fields exist in output, setting safe defaults.

    Modifies output in place.
    """
    required_fields = [
        "executive_summary",
        "options",
        "recommended_action",
        "reflection_prompts",
        "sources",
        "confidence",
    ]

    for field in required_fields:
        if field not in output:
            logger.warning(f"Missing required field: {field}")
            if field == "confidence":
                output["confidence"] = 0.5
            elif field == "scholar_flag":
                output["scholar_flag"] = True
            elif field == "executive_summary":
                output["executive_summary"] = (
                    "Ethical analysis based on Bhagavad Geeta principles."
                )
            elif field == "recommended_action":
                output["recommended_action"] = {
                    "option": 1,
                    "steps": [
                        "Reflect on the situation",
                        "Consider all perspectives",
                        "Act with clarity and integrity",
                    ],
                    "sources": [],
                }
            elif field == "reflection_prompts":
                output["reflection_prompts"] = [
                    "What is my duty in this situation?",
                    "How can I act with integrity?",
                ]
            else:
                output[field] = []


def _extract_canonical_id(verse: Any, fallback: str) -> str:
    """
    Extract canonical_id from a verse, handling both dict and string formats.

    Args:
        verse: Either a dict with canonical_id key, or a string
        fallback: Fallback canonical_id if extraction fails

    Returns:
        Canonical ID string
    """
    if isinstance(verse, dict):
        canonical_id = verse.get("canonical_id", fallback)
        return canonical_id if isinstance(canonical_id, str) else fallback
    elif isinstance(verse, str) and validate_canonical_id(verse):
        return verse
    return fallback


def _generate_default_options(base_verses: list[Any]) -> list[dict[str, Any]]:
    """Generate 3 default options when LLM fails to provide any."""
    # Extract canonical IDs safely, handling both dict and string formats
    verse_ids = []
    defaults = ["BG_2_47", "BG_3_35", "BG_18_63"]
    for i, fallback in enumerate(defaults):
        if i < len(base_verses):
            verse_ids.append(_extract_canonical_id(base_verses[i], fallback))
        else:
            verse_ids.append(fallback)

    return [
        {
            "title": "Option 1: Path of Duty and Dharma",
            "description": (
                "Follow your rightful duty (svadharma) with focus on principles "
                "rather than outcomes, aligning with core Geeta teachings"
            ),
            "pros": [
                "Aligns with dharma and personal duty",
                "Promotes spiritual growth",
                "Creates positive karma",
            ],
            "cons": [
                "May require immediate sacrifice",
                "Outcomes uncertain",
            ],
            "sources": [verse_ids[0]],
        },
        {
            "title": "Option 2: Balanced Approach with Flexibility",
            "description": (
                "Integrate duty with pragmatic considerations, adapting to "
                "circumstances while maintaining ethical principles"
            ),
            "pros": [
                "Balances ideals with reality",
                "Allows for adaptation",
                "Considers stakeholders",
            ],
            "cons": [
                "Requires ongoing reflection",
                "May appear uncertain",
            ],
            "sources": [verse_ids[1]],
        },
        {
            "title": "Option 3: Seek Deeper Understanding",
            "description": (
                "Pause for reflection and deeper inquiry into your values, "
                "circumstances, and the wisdom traditions before committing"
            ),
            "pros": [
                "Builds clarity and confidence",
                "Reduces future regret",
                "Honors complexity",
            ],
            "cons": [
                "Delays decision-making",
                "May require more effort",
            ],
            "sources": [verse_ids[2]],
        },
    ]


def _validate_and_fix_options(output: dict[str, Any]) -> None:
    """
    Validate options array has exactly 3 options, filling gaps if needed.

    Modifies output in place.
    """
    options = output.get("options", [])
    num_options = len(options)

    if num_options == 3:
        return  # All good

    logger.warning(
        f"LLM returned {num_options} options instead of required 3. "
        f"Will attempt to fill gaps intelligently."
    )

    # Flag for scholar review since LLM didn't follow constraint
    output["scholar_flag"] = True
    output["confidence"] = max(output.get("confidence", 0.5) - 0.15, 0.3)

    base_verses = output.get("sources", [])

    if num_options > 0 and num_options < 3:
        # Validate existing options have required fields
        for i, option in enumerate(options):
            if "title" not in option:
                option["title"] = f"Option {i + 1}"
            if "description" not in option:
                option["description"] = "An alternative approach"
            if "pros" not in option or not isinstance(option["pros"], list):
                option["pros"] = []
            if "cons" not in option or not isinstance(option["cons"], list):
                option["cons"] = []
            if "sources" not in option or not isinstance(option["sources"], list):
                option["sources"] = []

        # Generate missing options
        verse_ids = [
            v.get("canonical_id", f"BG_{i}_{i}")
            for i, v in enumerate(base_verses[:3], 1)
        ]

        while len(options) < 3:
            idx = len(options) + 1
            verse_id = (
                verse_ids[idx - 1] if idx - 1 < len(verse_ids) else f"BG_{idx}_{idx}"
            )

            missing_option = {
                "title": f"Option {idx}: Alternative Perspective",
                "description": (
                    "A balanced approach considering different perspectives "
                    "and values from Bhagavad Geeta wisdom"
                ),
                "pros": [
                    "Considers multiple viewpoints",
                    "Grounded in principles",
                    "Sustainable long-term",
                ],
                "cons": [
                    "Requires careful implementation",
                    "May involve compromise",
                ],
                "sources": [verse_id],
            }
            options.append(missing_option)
            logger.info(
                f"Generated missing Option {idx} to meet requirement of 3 options"
            )

        output["options"] = options

    elif num_options == 0:
        logger.warning("No options found in LLM response. Generating default options.")
        output["options"] = _generate_default_options(base_verses)
        output["scholar_flag"] = True
        output["confidence"] = 0.4


def _validate_field_types(output: dict[str, Any]) -> None:
    """
    Validate field types for executive_summary, reflection_prompts, recommended_action.

    Modifies output in place.
    """
    # Validate executive_summary
    if (
        not isinstance(output.get("executive_summary"), str)
        or len(str(output.get("executive_summary", "")).strip()) == 0
    ):
        logger.warning("Invalid or missing executive_summary, using default")
        output["executive_summary"] = (
            "Ethical analysis based on Bhagavad Geeta principles."
        )

    # Validate reflection_prompts
    if (
        not isinstance(output.get("reflection_prompts"), list)
        or len(output.get("reflection_prompts", [])) == 0
    ):
        logger.warning("Invalid or missing reflection_prompts, using defaults")
        output["reflection_prompts"] = [
            "What is my duty in this situation?",
            "How can I act with integrity?",
        ]

    # Validate recommended_action structure
    recommended_action = output.get("recommended_action", {})
    if not isinstance(recommended_action, dict):
        logger.warning("Invalid recommended_action structure, using default")
        recommended_action = {
            "option": 1,
            "steps": [
                "Reflect on the situation",
                "Consider all perspectives",
                "Act with clarity",
            ],
            "sources": [],
        }
    else:
        # Validate option field
        if not isinstance(
            recommended_action.get("option"), int
        ) or recommended_action.get("option") not in [1, 2, 3]:
            logger.warning(
                f"Invalid recommended_action.option: {recommended_action.get('option')}, defaulting to 1"
            )
            recommended_action["option"] = 1

        # Validate steps
        if (
            not isinstance(recommended_action.get("steps"), list)
            or len(recommended_action.get("steps", [])) == 0
        ):
            logger.warning("Invalid or missing recommended_action.steps")
            recommended_action["steps"] = [
                "Reflect on the situation",
                "Consider all perspectives",
                "Act with clarity",
            ]

        # Validate sources
        if not isinstance(recommended_action.get("sources"), list):
            logger.warning("Invalid recommended_action.sources, setting to empty list")
            recommended_action["sources"] = []

    output["recommended_action"] = recommended_action


def _validate_option_structures(output: dict[str, Any]) -> None:
    """
    Validate each option has correct structure.

    Modifies output in place.
    """
    for i, option in enumerate(output.get("options", [])):
        is_valid, error_msg = _validate_option_structure(option)
        if not is_valid:
            logger.warning(f"Option {i} validation failed: {error_msg}")
            if "title" not in option or not isinstance(option.get("title"), str):
                option["title"] = f"Option {i + 1}"
            if "description" not in option or not isinstance(
                option.get("description"), str
            ):
                option["description"] = "An alternative approach"
            if "pros" not in option or not isinstance(option.get("pros"), list):
                option["pros"] = []
            if "cons" not in option or not isinstance(option.get("cons"), list):
                option["cons"] = []
            if "sources" not in option or not isinstance(option.get("sources"), list):
                option["sources"] = []


def _validate_sources_array(output: dict[str, Any]) -> None:
    """
    Validate sources array structure and individual source objects.

    Modifies output in place.
    """
    sources_array = output.get("sources", [])
    if not isinstance(sources_array, list):
        logger.warning("Sources field is not a list, setting to empty")
        output["sources"] = []
        return

    valid_sources = []
    for i, source in enumerate(sources_array):
        is_valid, error_msg = _validate_source_object_structure(source)
        if not is_valid:
            logger.warning(f"Source {i} validation failed: {error_msg}, skipping")
            continue
        valid_sources.append(source)

    if len(valid_sources) < len(sources_array):
        logger.warning(
            f"Removed {len(sources_array) - len(valid_sources)} invalid sources "
            f"({len(valid_sources)} valid sources remain)"
        )
        output["sources"] = valid_sources


def _filter_source_references(output: dict[str, Any]) -> None:
    """
    Filter invalid source references in options and recommended_action.

    Modifies output in place.
    """
    sources_array = output.get("sources", [])
    # Handle both dict sources ({"canonical_id": "BG_2_47"}) and legacy string sources ("BG_2_47")
    valid_canonical_ids = set()
    for s in sources_array:
        if isinstance(s, dict):
            valid_canonical_ids.add(s.get("canonical_id"))
        elif isinstance(s, str):
            valid_canonical_ids.add(s)

    # Filter option sources
    for option_idx, option in enumerate(output.get("options", [])):
        original_sources = option.get("sources", [])
        valid_sources_for_option = []
        invalid_sources = []

        for src in original_sources:
            if isinstance(src, str):
                if sources_array and _validate_source_reference(src, sources_array):
                    valid_sources_for_option.append(src)
                elif not sources_array and validate_canonical_id(src):
                    valid_sources_for_option.append(src)
                    logger.debug(
                        f"Option {option_idx}: accepting orphan source {src} (valid format)"
                    )
                else:
                    invalid_sources.append(src)
            else:
                invalid_sources.append(str(src))

        if invalid_sources:
            logger.warning(
                f"Option {option_idx}: removed invalid source refs: {invalid_sources}"
            )
            option["sources"] = valid_sources_for_option

    # Filter recommended_action sources
    rec_action = output.get("recommended_action", {})
    if rec_action and "sources" in rec_action:
        original_rec_sources = rec_action.get("sources", [])
        valid_rec_sources = []
        invalid_rec = []

        for src in original_rec_sources:
            if isinstance(src, str):
                if sources_array and _validate_source_reference(src, sources_array):
                    valid_rec_sources.append(src)
                elif not sources_array and validate_canonical_id(src):
                    valid_rec_sources.append(src)
                else:
                    invalid_rec.append(src)
            else:
                invalid_rec.append(str(src))

        if invalid_rec:
            logger.warning(
                f"recommended_action: removed invalid citations {invalid_rec}"
            )
            rec_action["sources"] = valid_rec_sources


def _inject_rag_verses(
    output: dict[str, Any],
    retrieved_verses: list[dict[str, Any]] | None,
) -> None:
    """
    Inject RAG-retrieved verses when sources drop below minimum threshold.

    Applies confidence penalty for each injected verse.
    Modifies output in place.
    """
    MIN_SOURCES = 3
    INJECTION_CONFIDENCE_PENALTY = 0.03

    sources_array = output.get("sources", [])
    num_existing = len(sources_array)

    if num_existing >= MIN_SOURCES:
        return

    if not retrieved_verses:
        logger.warning(
            f"Sources below minimum ({num_existing} < {MIN_SOURCES}) but no RAG verses available to inject"
        )
        return

    num_to_inject = MIN_SOURCES - num_existing
    existing_ids = {s.get("canonical_id") for s in sources_array}

    injected_count = 0
    for verse in retrieved_verses:
        if injected_count >= num_to_inject:
            break

        verse_id = verse.get("canonical_id") or verse.get("metadata", {}).get(
            "canonical_id"
        )
        if not verse_id or verse_id in existing_ids:
            continue

        metadata = verse.get("metadata", {})
        paraphrase = (
            metadata.get("translation_en")
            or metadata.get("paraphrase")
            or _truncate_at_word_boundary(verse.get("document", ""))
        )

        if not paraphrase:
            continue

        injected_source = {
            "canonical_id": verse_id,
            "paraphrase": paraphrase,
            "relevance": verse.get("relevance", 0.7),
        }

        sources_array.append(injected_source)
        existing_ids.add(verse_id)
        injected_count += 1

        logger.info(
            f"Injected RAG verse {verse_id} (relevance: {verse.get('relevance', 0.7):.2f})"
        )

    if injected_count > 0:
        output["sources"] = sources_array
        current_confidence = output.get("confidence", 0.5)
        penalty = INJECTION_CONFIDENCE_PENALTY * injected_count
        output["confidence"] = max(current_confidence - penalty, 0.3)
        logger.warning(
            f"Injected {injected_count} RAG verses (sources now: {len(sources_array)}). "
            f"Confidence penalty: -{penalty:.2f} (now: {output['confidence']:.2f})"
        )
