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
from utils.exceptions import LLMError
from utils.input_normalization import normalize_input
from utils.json_parsing import extract_json_from_text
from utils.metrics_events import vector_search_fallback_total
from utils.metrics_llm import (
    track_confidence_post_repair,
    track_escalation_reason,
    track_json_extraction_escalation,
    track_json_extraction_failure,
    track_repair_success,
)

from .escalation import (
    describe_escalation_reason,
    get_escalation_threshold,
    should_escalate_to_fallback,
)
from .validation import (
    _ensure_required_fields,
    _filter_source_references,
    _inject_rag_verses,
    _validate_and_fix_options,
    _validate_field_types,
    _validate_option_structures,
    _validate_sources_array,
)

logger = logging.getLogger(__name__)


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

        Raises:
            Exception: If both ChromaDB and PostgreSQL are unavailable
        """
        from sqlalchemy.exc import OperationalError, SQLAlchemyError

        from db.connection import SessionLocal
        from services.search.config import SearchConfig
        from services.search.strategies.keyword import keyword_search

        db = SessionLocal()
        try:
            try:
                config = SearchConfig(limit=top_k)
                results = keyword_search(db, query, config)
            except (OperationalError, SQLAlchemyError) as e:
                # PostgreSQL is down/unavailable - escalate with clear error
                logger.error(
                    f"SQL fallback failed: database unavailable ({e}). "
                    f"Both vector and keyword search unavailable.",
                    exc_info=True,
                )
                raise RuntimeError(
                    "Both vector store (ChromaDB) and database (PostgreSQL) unavailable; "
                    "cannot retrieve verses"
                ) from e

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

    def _escalate_to_fallback(
        self,
        primary_provider: str,
        prompt: str,
        system_prompt: str | None,
        fallback_prompt: str | None,
        temperature: float,
    ) -> dict[str, Any] | None:
        """
        Escalate failed consultation to fallback provider.

        Called when JSON extraction fails from primary provider. Routes the
        consultation to a fallback provider as a fresh attempt.

        Provider types:
        - External LLMs (Gemini, Anthropic): Full prompt, equal treatment
        - Local LLM (Ollama): Simplified prompt due to resource constraints

        CRITICAL: Calls fallback provider DIRECTLY, not through generate()
        which would retry the primary provider instead of escalating.

        Args:
            primary_provider: Provider that failed (for logging/metrics)
            prompt: Full prompt for external LLMs
            system_prompt: System prompt for external LLMs
            fallback_prompt: Simplified prompt for Ollama fallback
            temperature: Sampling temperature

        Returns:
            Parsed JSON dict with llm_attribution metadata, or None if escalation fails
        """
        from services.llm import LLMProvider

        fallback_provider_name = settings.LLM_FALLBACK_PROVIDER.lower()

        # Skip escalation if disabled or fallback is same as primary
        if not settings.LLM_FALLBACK_ENABLED:
            return None
        if fallback_provider_name == primary_provider:
            return None
        if primary_provider == "mock":
            return None

        logger.warning(
            f"Escalating to fallback provider ({fallback_provider_name}) "
            f"due to JSON extraction failure from {primary_provider}"
        )

        # Determine if fallback is external (Gemini/Anthropic) or local (Ollama)
        is_ollama_fallback = fallback_provider_name == LLMProvider.OLLAMA.value

        # External LLMs: Full prompt and system prompt
        # Ollama: Simplified prompt due to resource constraints
        if is_ollama_fallback:
            escalation_prompt = fallback_prompt or prompt
            escalation_sys = OLLAMA_SYSTEM_PROMPT
        else:
            escalation_prompt = prompt
            escalation_sys = (
                f"{system_prompt}\n\n"
                f"NOTE: Primary LLM had format issues. Please ensure strict JSON compliance."
                if system_prompt
                else "Return only valid JSON with no additional text or markdown."
            )

        fallback_provider = fallback_provider_name
        try:
            # Call the fallback provider directly
            fallback_result = None
            if (
                fallback_provider_name == LLMProvider.ANTHROPIC.value
                and self.llm_service.anthropic_client
            ):
                fallback_result = self.llm_service._generate_anthropic(
                    prompt=escalation_prompt,
                    system_prompt=escalation_sys,
                    temperature=temperature,
                )
            elif (
                fallback_provider_name == LLMProvider.GEMINI.value
                and self.llm_service.gemini_client
            ):
                fallback_result = self.llm_service._generate_gemini(
                    prompt=escalation_prompt,
                    system_prompt=escalation_sys,
                    temperature=temperature,
                    json_mode=True,
                )
            elif is_ollama_fallback and self.llm_service.ollama_enabled:
                fallback_result = self.llm_service._generate_ollama(
                    prompt=escalation_prompt,
                    system_prompt=escalation_sys,
                    temperature=temperature,
                    json_mode=True,
                )
            else:
                raise LLMError(
                    f"Fallback provider {fallback_provider_name} not available"
                )

            fallback_response = fallback_result["response"]
            fallback_provider = fallback_result.get("provider", fallback_provider_name)
            fallback_model = fallback_result.get("model", "unknown")

            parsed_result = extract_json_from_text(
                fallback_response, provider=fallback_provider
            )
            parsed_result["llm_attribution"] = {
                "provider": fallback_provider,
                "model": fallback_model,
                "escalated_from": primary_provider,
            }
            track_json_extraction_escalation(
                primary_provider, fallback_provider, "success"
            )
            logger.info(
                f"Escalation succeeded: {fallback_provider} generated valid JSON "
                f"after {primary_provider} format failure"
            )
            return parsed_result

        except Exception as escalation_error:
            track_json_extraction_escalation(
                primary_provider, fallback_provider, "failed"
            )
            logger.error(
                f"Escalation to fallback provider also failed: {escalation_error}"
            )
            return None

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
            parsed_result = extract_json_from_text(response_text, provider=provider)
            # Add LLM attribution metadata
            parsed_result["llm_attribution"] = {
                "provider": provider,
                "model": model,
            }
            logger.info(f"Successfully parsed JSON response from {provider} ({model})")

            # [NEW] Pre-repair structural health check (v1.34.0)
            # Escalate before repair cascade if critical fields are missing
            should_escalate, escalation_reason = should_escalate_to_fallback(
                parsed_result
            )
            if should_escalate:
                reason_desc = describe_escalation_reason(escalation_reason)
                logger.warning(
                    f"Pre-repair escalation triggered: {reason_desc} "
                    f"(provider={provider})"
                )
                track_escalation_reason(escalation_reason, provider)

                # Escalate to fallback provider
                escalation_result = self._escalate_to_fallback(
                    primary_provider=provider,
                    prompt=prompt,
                    system_prompt=system_prompt,
                    fallback_prompt=fallback_prompt,
                    temperature=temperature,
                )
                if escalation_result is not None:
                    logger.info("Pre-repair escalation to fallback succeeded")
                    return escalation_result, False
                else:
                    logger.warning(
                        "Pre-repair escalation to fallback not possible, proceeding with repair"
                    )
                    # Fallback escalation failed/disabled, continue with repair

            return parsed_result, False

        except ValueError as extraction_error:
            logger.error(
                f"JSON extraction failed from {provider}: {extraction_error}. "
                f"Full response: {response_text}"
            )
            track_json_extraction_failure(provider)

            # Attempt escalation to fallback provider
            escalation_result = self._escalate_to_fallback(
                primary_provider=provider,
                prompt=prompt,
                system_prompt=system_prompt,
                fallback_prompt=fallback_prompt,
                temperature=temperature,
            )
            if escalation_result is not None:
                return escalation_result, False

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
                    return fallback_result, False
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

        # [NEW] Track repairs for post-repair escalation (v1.34.0)
        # Capture pre-repair state for comparison
        pre_repair_options_count = len(output.get("options", []))
        pre_repair_executive_summary = output.get("executive_summary")
        pre_repair_reflection_prompts = output.get("reflection_prompts")

        # Step 1: Ensure all required fields exist with safe defaults
        _ensure_required_fields(output)

        # Step 2: Validate and fix options (must have exactly 3)
        _validate_and_fix_options(output)
        if len(output.get("options", [])) != pre_repair_options_count:
            track_repair_success("options", "success")

        # Step 3: Validate field types (executive_summary, reflection_prompts, recommended_action)
        _validate_field_types(output)
        if output.get("executive_summary") != pre_repair_executive_summary:
            track_repair_success("executive_summary", "success")
        if output.get("reflection_prompts") != pre_repair_reflection_prompts:
            track_repair_success("reflection_prompts", "success")

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
        if not isinstance(confidence, int | float) or confidence < 0 or confidence > 1:
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

        # [NEW] Track confidence post-repair (v1.34.0)
        if "llm_attribution" in output:
            provider = output["llm_attribution"].get("provider", "unknown")
            track_confidence_post_repair(provider, output["confidence"])

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

            # [NEW] Post-repair escalation check (v1.34.0)
            # If confidence dropped below threshold after repair, escalate to fallback
            final_confidence = validated_output.get("confidence", 0.5)
            escalation_threshold = get_escalation_threshold()
            if final_confidence < escalation_threshold:
                logger.warning(
                    f"Post-repair confidence below threshold: "
                    f"{final_confidence:.2f} < {escalation_threshold}. "
                    f"Attempting escalation to fallback provider."
                )
                provider_name = output.get("llm_attribution", {}).get(
                    "provider", "unknown"
                )
                track_escalation_reason("low_confidence_post_repair", provider_name)

                # Attempt escalation to fallback
                escalation_result = self._escalate_to_fallback(
                    primary_provider=provider_name,
                    prompt=prompt,
                    system_prompt=SYSTEM_PROMPT,
                    fallback_prompt=fallback_prompt,
                    temperature=0.7,
                )
                if escalation_result is not None:
                    logger.info("Post-repair escalation to fallback succeeded")
                    validated_output = self.validate_output(
                        escalation_result, retrieved_verses
                    )
                else:
                    logger.warning(
                        "Post-repair escalation not possible, using repaired output"
                    )

            # Mark as degraded if no verses were retrieved
            if not retrieved_verses:
                validated_output["confidence"] = min(
                    validated_output.get("confidence", 0.5), 0.5
                )
                validated_output["scholar_flag"] = True
                validated_output["warning"] = "Generated without verse retrieval"

            # [Phase 5] Add metadata for confidence_reason generation
            # Track if escalation happened
            validated_output["_escalated"] = bool(
                validated_output.get("llm_attribution", {}).get("escalated_from")
            )
            # Track RAG injection (if sources were added beyond LLM response)
            validated_output["_rag_injected"] = bool(
                validated_output.get("_rag_injected", False)
            )
            # Note: repairs_count will be calculated by API based on available data
            validated_output["_repairs_count"] = validated_output.get(
                "_repairs_count", 0
            )

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
