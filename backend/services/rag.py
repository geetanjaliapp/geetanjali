"""RAG (Retrieval-Augmented Generation) pipeline service."""

import hashlib
import logging
from typing import Any

from config import settings
from db import SessionLocal
from db.repositories.verse_repository import VerseRepository
from services.cache import cache, rag_output_key
from services.content_filter import (
    detect_llm_refusal,
    get_policy_violation_response,
)
from services.llm import get_llm_service
from services.prompts import (
    FEW_SHOT_EXAMPLE,
    OLLAMA_SYSTEM_PROMPT,
    SYSTEM_PROMPT,
    build_ollama_prompt,
    build_user_prompt,
    format_executive_summary,
    post_process_ollama_response,
)
from services.vector_store import get_vector_store
from utils.circuit_breaker import CircuitBreakerOpen
from utils.input_normalization import normalize_input
from utils.json_parsing import extract_json_from_text
from utils.metrics_events import vector_search_fallback_total
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
    if not isinstance(relevance, (int, float)):
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


class RAGPipeline:
    """RAG pipeline for generating consulting briefs."""

    def __init__(self):
        """Initialize RAG pipeline."""
        self.vector_store = get_vector_store()
        self.llm_service = get_llm_service()

        logger.info("RAG Pipeline initialized")

    def retrieve_verses(
        self, query: str, top_k: int | None = None
    ) -> list[dict[str, Any]]:
        """
        Retrieve relevant verses using vector similarity with SQL fallback.

        When ChromaDB circuit breaker is open, falls back to SQL keyword search
        using PostgreSQL trigram indexes for resilience.

        Args:
            query: Query text (case description)
            top_k: Number of verses to retrieve (default from config)

        Returns:
            List of retrieved verses with metadata and relevance scores
        """
        if top_k is None:
            top_k = settings.RAG_TOP_K_VERSES

        logger.info(f"Retrieving top {top_k} verses for query")

        try:
            # Primary: Vector similarity search
            results = self.vector_store.search(query, top_k=top_k)
            return self._format_vector_results(results)

        except CircuitBreakerOpen:
            # Fallback: SQL keyword search when ChromaDB is unavailable
            logger.warning(
                "ChromaDB circuit breaker open, falling back to SQL keyword search"
            )
            vector_search_fallback_total.labels(reason="circuit_open").inc()
            return self._retrieve_verses_sql_fallback(query, top_k)

        except Exception as e:
            # Other errors: try SQL fallback as well
            logger.warning(
                f"Vector search failed ({e}), falling back to SQL keyword search"
            )
            vector_search_fallback_total.labels(reason="error").inc()
            return self._retrieve_verses_sql_fallback(query, top_k)

    def _format_vector_results(self, results: dict[str, Any]) -> list[dict[str, Any]]:
        """Format vector search results into verse dicts."""
        verses = []
        for i in range(len(results["ids"])):
            verse = {
                "canonical_id": results["ids"][i],
                "document": results["documents"][i],
                "distance": results["distances"][i],
                "relevance": 1.0
                - results["distances"][i],  # Convert distance to relevance
                "metadata": results["metadatas"][i],
            }
            verses.append(verse)

        logger.debug(
            f"Retrieved verses (vector): {[v['canonical_id'] for v in verses]}"
        )
        return verses

    def _retrieve_verses_sql_fallback(
        self, query: str, top_k: int
    ) -> list[dict[str, Any]]:
        """
        Fallback verse retrieval using SQL keyword search.

        Uses PostgreSQL trigram indexes for efficient ILIKE matching.
        Results are less semantically precise but functional when
        ChromaDB is unavailable.
        """
        from db.connection import SessionLocal
        from services.search.config import SearchConfig
        from services.search.strategies.keyword import keyword_search

        db = SessionLocal()
        try:
            config = SearchConfig(limit=top_k)
            results = keyword_search(db, query, config)

            # Convert SearchResult objects to verse dicts matching vector format
            verses = []
            for result in results[:top_k]:
                verse = {
                    "canonical_id": result.canonical_id,
                    "document": result.paraphrase_en or result.translation_en or "",
                    "distance": 1.0 - result.match.score,  # Convert score to distance
                    "relevance": result.match.score,
                    "metadata": {
                        "chapter": result.chapter,
                        "verse": result.verse,
                        "paraphrase_en": result.paraphrase_en,
                        "translation_en": result.translation_en,
                    },
                }
                verses.append(verse)

            logger.info(
                f"Retrieved {len(verses)} verses via SQL fallback: "
                f"{[v['canonical_id'] for v in verses]}"
            )
            return verses

        finally:
            db.close()

    def enrich_verses_with_translations(
        self, verses: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """
        Enrich retrieved verses with translations from the database.

        Args:
            verses: List of retrieved verses from vector store

        Returns:
            Verses enriched with translation data
        """
        if not verses:
            return verses

        # Get canonical IDs
        canonical_ids = [
            v.get("canonical_id") or v.get("metadata", {}).get("canonical_id")
            for v in verses
        ]
        canonical_ids = [cid for cid in canonical_ids if cid]

        if not canonical_ids:
            return verses

        # Fetch verses with translations from database
        db = SessionLocal()
        try:
            verse_repo = VerseRepository(db)
            db_verses = verse_repo.get_many_with_translations(canonical_ids)

            # Create lookup by canonical_id
            verse_lookup = {v.canonical_id: v for v in db_verses}

            # Enrich each retrieved verse
            for verse in verses:
                cid = verse.get("canonical_id") or verse.get("metadata", {}).get(
                    "canonical_id"
                )
                if cid and cid in verse_lookup:
                    db_verse = verse_lookup[cid]

                    # Add translations to metadata
                    if "metadata" not in verse:
                        verse["metadata"] = {}

                    # Get primary translation from verse table
                    verse["metadata"]["translation_en"] = db_verse.translation_en

                    # Get additional translations from translations table
                    # Skip Swami Gambirananda since that's already in translation_en
                    if db_verse.translations:
                        other_translations = [
                            {
                                "text": t.text,
                                "translator": t.translator,
                                "school": t.school,
                            }
                            for t in db_verse.translations
                            if t.translator != "Swami Gambirananda"
                        ][:3]  # Limit to 3 translations after filtering
                        if other_translations:
                            verse["metadata"]["translations"] = other_translations

            logger.debug(f"Enriched {len(verses)} verses with translations")
            return verses

        except Exception as e:
            logger.warning(f"Failed to enrich verses with translations: {e}")
            return verses
        finally:
            db.close()

    def construct_context(
        self, case_data: dict[str, Any], retrieved_verses: list[dict[str, Any]]
    ) -> str:
        """
        Construct prompt context from case and retrieved verses.

        Args:
            case_data: Case information
            retrieved_verses: Retrieved verses

        Returns:
            Formatted prompt string
        """
        logger.debug("Constructing prompt context")

        prompt = build_user_prompt(case_data, retrieved_verses)

        logger.debug(f"Prompt length: {len(prompt)} chars")

        return prompt

    def generate_brief(
        self,
        prompt: str,
        temperature: float = 0.7,
        fallback_prompt: str | None = None,
        fallback_system: str | None = None,
        retrieved_verses: list[dict[str, Any]] | None = None,
    ) -> tuple[dict[str, Any], bool]:
        """
        Generate consulting brief using LLM.

        Args:
            prompt: Formatted prompt with context
            temperature: Sampling temperature
            fallback_prompt: Simplified prompt for Ollama fallback
            fallback_system: Simplified system prompt for fallback
            retrieved_verses: Retrieved verses for post-processing

        Returns:
            Tuple of (parsed JSON response, is_policy_violation)

        Raises:
            Exception: If LLM fails or returns invalid JSON (not due to refusal)
        """
        logger.info("Generating consulting brief with LLM")

        # Build system prompt (optionally include few-shot example)
        system_prompt = SYSTEM_PROMPT
        if settings.LLM_USE_FEW_SHOTS:
            system_prompt = f"{SYSTEM_PROMPT}\n\n{FEW_SHOT_EXAMPLE}"
            logger.debug("Few-shot example included in system prompt")

        # Build fallback system prompt (also with few-shot if enabled)
        fallback_sys = fallback_system
        if settings.LLM_USE_FEW_SHOTS and fallback_system:
            fallback_sys = f"{fallback_system}\n\n{FEW_SHOT_EXAMPLE}"

        # Generate JSON response with fallback support
        result = self.llm_service.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            fallback_prompt=fallback_prompt,
            fallback_system=fallback_sys,
        )

        response_text = result["response"]
        provider = result.get("provider", "unknown")
        model = result.get("model", "unknown")

        # Check for LLM refusal BEFORE attempting JSON parse
        # This detects when Claude refuses due to content policy
        is_refusal, refusal_match = detect_llm_refusal(response_text)
        if is_refusal:
            logger.warning(
                f"LLM refused to process content (provider={provider}, "
                f"matched: '{refusal_match}')"
            )
            # Return policy violation response with raw response for debugging
            violation_response = get_policy_violation_response()
            violation_response["_raw_llm_response"] = response_text
            return violation_response, True

        # Parse JSON with robust extraction
        try:
            parsed_result = extract_json_from_text(response_text)
            # Add LLM attribution metadata
            parsed_result["llm_attribution"] = {
                "provider": provider,
                "model": model,
            }
            logger.info(f"Successfully parsed JSON response from {provider} ({model})")
            return parsed_result, False  # type: ignore[return-value]

        except ValueError as extraction_error:
            logger.error(f"JSON extraction failed: {extraction_error}")
            logger.debug(f"Response text (first 500 chars): {response_text[:500]}")

            # Apply post-processing fallback for all providers if verses available
            # This is our graceful degradation layer - fill gaps intelligently
            if retrieved_verses:
                logger.warning(
                    f"Attempting post-processing fallback for {provider} response"
                )
                try:
                    fallback_result = post_process_ollama_response(
                        response_text, retrieved_verses
                    )
                    logger.info("Post-processing fallback succeeded")
                    return fallback_result, False  # type: ignore[return-value]
                except Exception as pp_error:
                    logger.error(f"Post-processing fallback also failed: {pp_error}")
                    raise Exception(
                        f"LLM returned invalid JSON and post-processing failed: {pp_error}"
                    )

            raise Exception(
                "LLM returned invalid JSON and no verses available for fallback"
            )

    def validate_output(
        self,
        output: dict[str, Any],
        retrieved_verses: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """
        Validate and enrich LLM output, handling incomplete or malformed responses.

        This function ensures all required fields are present and properly formatted.
        If LLM fails to generate exactly 3 options, we intelligently fill gaps rather
        than reject the response, and flag for scholar review.

        When LLM sources are empty or drop below 3 after validation, RAG-retrieved
        verses are injected to ensure users always see relevant verse citations.
        A confidence penalty (-0.03 per injected verse) is applied.

        Args:
            output: Raw LLM output (potentially incomplete)
            retrieved_verses: RAG-retrieved verses for injection when LLM sources empty

        Returns:
            Validated and enriched output with all required fields
        """
        logger.debug("Validating output")

        # Step 1: Ensure all required fields exist with safe defaults
        _ensure_required_fields(output)

        # Step 2: Validate and fix options (must have exactly 3)
        _validate_and_fix_options(output)

        # Step 3: Validate field types (executive_summary, reflection_prompts, recommended_action)
        _validate_field_types(output)

        # Step 4: Validate each option structure
        _validate_option_structures(output)

        # Step 5: Validate sources array
        _validate_sources_array(output)

        # Step 6: Filter invalid source references in options
        _filter_source_references(output)

        # Step 7: Inject RAG verses when sources below minimum
        _inject_rag_verses(output, retrieved_verses)

        # Step 7.1: Verify minimum sources met
        final_sources_count = len(output.get("sources", []))
        if final_sources_count == 0:
            logger.error(
                "No valid sources after validation and injection - flagging for review"
            )
            output["scholar_flag"] = True
            output["confidence"] = min(output.get("confidence", 0.5), 0.35)

        # Step 8: Final validation (confidence, scholar_flag, formatting)
        confidence = output.get("confidence", 0.5)
        if not isinstance(confidence, (int, float)) or confidence < 0 or confidence > 1:
            logger.warning(f"Invalid confidence value: {confidence}. Setting to 0.5")
            output["confidence"] = 0.5
        else:
            output["confidence"] = float(confidence)

        # Set scholar flag based on confidence threshold
        if output["confidence"] < settings.RAG_SCHOLAR_REVIEW_THRESHOLD:
            output["scholar_flag"] = True
            logger.info(
                f"Low confidence ({output['confidence']}) - flagged for scholar review"
            )
        else:
            output["scholar_flag"] = output.get("scholar_flag", False)

        # Post-process executive_summary for better markdown formatting
        if output.get("executive_summary"):
            output["executive_summary"] = format_executive_summary(
                output["executive_summary"]
            )

        logger.info(
            f"Output validation complete: {len(output.get('options', []))} options, "
            f"confidence={output['confidence']:.2f}, scholar_flag={output['scholar_flag']}"
        )

        return output

    def _create_fallback_response(
        self, case_data: dict[str, Any], error_message: str
    ) -> dict[str, Any]:
        """
        Create fallback response when pipeline fails.

        Args:
            case_data: Original case data
            error_message: Error description

        Returns:
            Minimal valid response structure
        """
        logger.warning(f"Creating fallback response due to: {error_message}")

        return {
            "executive_summary": (
                "We couldn't complete your consultation right now. "
                "Please try again in a few moments, or explore the relevant verses below for guidance."
            ),
            "options": [
                {
                    "title": "Take Time to Reflect",
                    "description": "Give yourself space to contemplate this situation before acting.",
                    "pros": ["Clarity through reflection", "Avoid hasty decisions"],
                    "cons": ["Delayed action", "Prolonged uncertainty"],
                    "sources": [],
                },
                {
                    "title": "Seek Trusted Counsel",
                    "description": "Discuss your situation with someone you trust - a mentor, friend, or family member.",
                    "pros": ["Fresh perspective", "Emotional support"],
                    "cons": ["May take time to arrange", "Opinions may vary"],
                    "sources": [],
                },
                {
                    "title": "Study the Verses Directly",
                    "description": "Explore the Bhagavad Geeta verses related to your situation for timeless wisdom.",
                    "pros": ["Direct access to wisdom", "Personal interpretation"],
                    "cons": ["Requires contemplation", "May need guidance"],
                    "sources": [],
                },
            ],
            "recommended_action": {
                "option": 3,
                "steps": [
                    "Browse the verses suggested for your situation",
                    "Read the translations and paraphrases carefully",
                    "Reflect on how the teachings apply to your circumstances",
                    "Return later to try your consultation again",
                ],
                "sources": [],
            },
            "reflection_prompts": [
                "What are my core values in this situation?",
                "Who will be affected by my decision?",
                "What would I advise someone else in this situation?",
            ],
            "sources": [],
            "confidence": 0.1,
            "scholar_flag": True,
            "_internal_error": error_message,  # Keep for logging, not displayed to user
        }

    def run(
        self, case_data: dict[str, Any], top_k: int | None = None
    ) -> tuple[dict[str, Any], bool]:
        """
        Run complete RAG pipeline with graceful degradation.

        Args:
            case_data: Case information
            top_k: Number of verses to retrieve (optional)

        Returns:
            Tuple of (consulting brief dict, is_policy_violation bool)

        Notes:
            - If verse retrieval fails, uses fallback with no sources
            - If LLM fails, returns fallback response
            - If LLM refuses (policy violation), returns educational response
            - Always returns a valid response structure
        """
        logger.info(f"Running RAG pipeline for case: {case_data.get('title', 'N/A')}")

        # Step 0: Normalize input to handle duplicates, control chars, etc.
        raw_description = case_data.get("description", "")
        normalization_result = normalize_input(raw_description)
        description = normalization_result.text

        # Always update case_data with normalized description for consistency
        # (even if unchanged, this ensures downstream code uses the same reference)
        case_data = {**case_data, "description": description}

        if normalization_result.was_modified:
            logger.info(
                f"Input normalized: {normalization_result.original_length} -> "
                f"{normalization_result.normalized_length} chars, "
                f"{normalization_result.lines_removed} duplicate lines removed"
            )

        if normalization_result.has_warnings:
            logger.warning(
                f"Input normalization warnings: {normalization_result.warnings}"
            )

        # P1.1 FIX: Check cache before running expensive pipeline
        # Note: Only successful (non-policy-violation) results are cached.
        # Policy violations return early at line ~944 before caching occurs,
        # so cache hits always have is_policy_violation=False.
        cache_key = rag_output_key(
            hashlib.md5(description.encode(), usedforsecurity=False).hexdigest()[:16]
        )
        cached_result = cache.get(cache_key)
        if cached_result:
            logger.info(f"RAG cache hit for key {cache_key[:24]}")
            return cached_result, False  # Cached results are never policy violations

        retrieved_verses: list[dict[str, Any]] = []

        # Step 1: Retrieve relevant verses (with fallback)
        try:
            query = case_data.get("description", "")
            retrieved_verses = self.retrieve_verses(query, top_k=top_k)

            if not retrieved_verses:
                logger.warning("No verses retrieved - continuing with empty context")
            else:
                # Enrich verses with translations from database
                retrieved_verses = self.enrich_verses_with_translations(
                    retrieved_verses
                )

        except Exception as e:
            logger.error(f"Verse retrieval failed: {e} - continuing without verses")
            # Continue pipeline without verses (degraded mode)

        # Step 2: Construct context
        try:
            prompt = self.construct_context(case_data, retrieved_verses)
            # Also prepare simplified fallback prompt for Ollama
            fallback_prompt = build_ollama_prompt(case_data, retrieved_verses)
        except Exception as e:
            logger.error(f"Context construction failed: {e}")
            return (
                self._create_fallback_response(case_data, "Failed to construct prompt"),
                False,
            )

        # Step 3: Generate brief with LLM (with fallback)
        try:
            output, is_policy_violation = self.generate_brief(
                prompt,
                fallback_prompt=fallback_prompt,
                fallback_system=OLLAMA_SYSTEM_PROMPT,
                retrieved_verses=retrieved_verses,
            )

            # If policy violation, return early with the educational response
            if is_policy_violation:
                logger.info("RAG pipeline completed with policy violation response")
                return output, True

        except Exception as e:
            logger.error(f"LLM generation failed: {e}")
            return self._create_fallback_response(case_data, "LLM unavailable"), False

        # Step 4: Validate and enrich (pass retrieved_verses for injection fallback)
        try:
            validated_output = self.validate_output(output, retrieved_verses)

            # Mark as degraded if no verses were retrieved
            if not retrieved_verses:
                validated_output["confidence"] = min(
                    validated_output.get("confidence", 0.5), 0.5
                )
                validated_output["scholar_flag"] = True
                validated_output["warning"] = "Generated without verse retrieval"

            # P1.1 FIX: Cache successful results
            cache.set(cache_key, validated_output, settings.CACHE_TTL_RAG_OUTPUT)
            logger.info(
                f"RAG pipeline completed successfully, cached as {cache_key[:24]}"
            )
            return validated_output, False

        except Exception as e:
            logger.error(f"Output validation failed: {e}")
            # Last resort: return the raw output if validation fails
            output["confidence"] = 0.3
            output["scholar_flag"] = True
            output["warning"] = "Output validation failed"
            return output, False


# Global RAG pipeline instance
_rag_pipeline = None


def get_rag_pipeline() -> RAGPipeline:
    """
    Get or create the global RAG pipeline instance.

    Returns:
        RAGPipeline instance
    """
    global _rag_pipeline
    if _rag_pipeline is None:
        _rag_pipeline = RAGPipeline()
    return _rag_pipeline
