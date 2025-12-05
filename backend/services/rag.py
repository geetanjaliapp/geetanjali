"""RAG (Retrieval-Augmented Generation) pipeline service."""

import logging
import json
import re
from typing import Dict, Any, List, Optional

from config import settings
from services.vector_store import get_vector_store
from services.llm import get_llm_service
from services.prompts import (
    SYSTEM_PROMPT,
    build_user_prompt,
    OLLAMA_SYSTEM_PROMPT,
    build_ollama_prompt,
    post_process_ollama_response,
)
from db import SessionLocal
from db.repositories.verse_repository import VerseRepository

logger = logging.getLogger(__name__)


def _extract_json_from_text(response_text: str) -> dict:
    """
    Robustly extract JSON from LLM response.

    Handles:
    - Direct JSON
    - Markdown code blocks (```json ... ```)
    - JSON wrapped in explanation text
    - Multiple JSON objects (returns first valid)

    Args:
        response_text: Raw LLM response text

    Returns:
        Parsed JSON dict

    Raises:
        ValueError: If no valid JSON can be extracted
    """
    # Strategy 1: Try direct JSON parse (LLM followed instructions perfectly)
    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        pass

    # Strategy 2: Extract from markdown code block
    # Try ```json variant first, then generic ```
    for pattern in [r'```(?:json)?\s*\n(.*?)\n```', r'```(.*?)```']:
        matches = re.finditer(pattern, response_text, re.DOTALL)
        for match in matches:
            json_text = match.group(1).strip()
            try:
                return json.loads(json_text)
            except json.JSONDecodeError as e:
                logger.debug(
                    f"Markdown block parse failed at pos {e.pos}: "
                    f"{json_text[max(0,e.pos-30):e.pos+30]}"
                )
                continue

    # Strategy 3: Find first { and try to extract complete JSON
    # This handles: "analysis: {... proper json ...}" pattern
    # Use json.JSONDecoder.raw_decode() to find the complete object
    for start_idx in range(len(response_text)):
        if response_text[start_idx] == '{':
            try:
                decoder = json.JSONDecoder()
                parsed, end_idx = decoder.raw_decode(response_text, start_idx)
                logger.debug(f"Extracted JSON from position {start_idx}")
                return parsed
            except json.JSONDecodeError:
                continue

    # Failed all strategies
    logger.error(
        f"Could not extract JSON from response. First 500 chars: {response_text[:500]}"
    )
    raise ValueError("No valid JSON found in LLM response")


def _validate_canonical_id(canonical_id: str) -> bool:
    """
    Validate that canonical_id follows BG_X_Y format.

    Args:
        canonical_id: The ID to validate

    Returns:
        True if valid format, False otherwise
    """
    if not isinstance(canonical_id, str):
        return False
    # Valid format: BG_<chapter>_<verse> where chapter and verse are integers
    return bool(re.match(r'^BG_\d+_\d+$', canonical_id))


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


def _validate_source_reference(source_id: str, available_sources: List[Dict[str, Any]]) -> bool:
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
    source_canonical_ids = [s.get("canonical_id") for s in available_sources if s]
    return source_id in source_canonical_ids


def _validate_option_structure(option: Dict[str, Any]) -> tuple[bool, str]:
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
    if not isinstance(option.get("title"), str) or len(str(option.get("title", "")).strip()) == 0:
        return False, "Option missing or empty title"

    if not isinstance(option.get("description"), str) or len(str(option.get("description", "")).strip()) == 0:
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


def _validate_source_object_structure(source: Dict[str, Any]) -> tuple[bool, str]:
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
    if not isinstance(source.get("canonical_id"), str):
        return False, "Source missing or invalid canonical_id"

    if not _validate_canonical_id(source.get("canonical_id")):
        return False, f"Source canonical_id invalid format: {source.get('canonical_id')}"

    # Check paraphrase
    if not isinstance(source.get("paraphrase"), str) or len(str(source.get("paraphrase", "")).strip()) == 0:
        return False, "Source missing or empty paraphrase"

    # Check relevance
    if not _validate_relevance(source.get("relevance")):
        return False, f"Source invalid relevance: {source.get('relevance')}"

    return True, ""


class RAGPipeline:
    """RAG pipeline for generating consulting briefs."""

    def __init__(self):
        """Initialize RAG pipeline."""
        self.vector_store = get_vector_store()
        self.llm_service = get_llm_service()

        logger.info("RAG Pipeline initialized")

    def retrieve_verses(
        self, query: str, top_k: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieve relevant verses using vector similarity.

        Args:
            query: Query text (case description)
            top_k: Number of verses to retrieve (default from config)

        Returns:
            List of retrieved verses with metadata and relevance scores
        """
        if top_k is None:
            top_k = settings.RAG_TOP_K_VERSES

        logger.info(f"Retrieving top {top_k} verses for query")

        # Search vector store
        results = self.vector_store.search(query, top_k=top_k)

        # Format results
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

        logger.debug(f"Retrieved verses: {[v['canonical_id'] for v in verses]}")

        return verses

    def enrich_verses_with_translations(
        self, verses: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
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
        self, case_data: Dict[str, Any], retrieved_verses: List[Dict[str, Any]]
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
        fallback_prompt: Optional[str] = None,
        fallback_system: Optional[str] = None,
        retrieved_verses: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Generate consulting brief using LLM.

        Args:
            prompt: Formatted prompt with context
            temperature: Sampling temperature
            fallback_prompt: Simplified prompt for Ollama fallback
            fallback_system: Simplified system prompt for fallback
            retrieved_verses: Retrieved verses for post-processing

        Returns:
            Parsed JSON response

        Raises:
            Exception: If LLM fails or returns invalid JSON
        """
        logger.info("Generating consulting brief with LLM")

        # Generate JSON response with fallback support
        result = self.llm_service.generate(
            prompt=prompt,
            system_prompt=SYSTEM_PROMPT,
            temperature=temperature,
            fallback_prompt=fallback_prompt,
            fallback_system=fallback_system,
        )

        response_text = result["response"]
        provider = result.get("provider", "unknown")
        model = result.get("model", "unknown")

        # Parse JSON with robust extraction
        try:
            parsed_result = _extract_json_from_text(response_text)
            # Add LLM attribution metadata
            parsed_result["llm_attribution"] = {
                "provider": provider,
                "model": model,
            }
            logger.info(f"Successfully parsed JSON response from {provider} ({model})")
            return parsed_result  # type: ignore[no-any-return]

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
                    return fallback_result  # type: ignore[no-any-return]
                except Exception as pp_error:
                    logger.error(f"Post-processing fallback also failed: {pp_error}")
                    raise Exception(
                        f"LLM returned invalid JSON and post-processing failed: {pp_error}"
                    )

            raise Exception("LLM returned invalid JSON and no verses available for fallback")

    def validate_output(self, output: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate and enrich LLM output, handling incomplete or malformed responses.

        This function ensures all required fields are present and properly formatted.
        If LLM fails to generate exactly 3 options, we intelligently fill gaps rather
        than reject the response, and flag for scholar review.

        Args:
            output: Raw LLM output (potentially incomplete)

        Returns:
            Validated and enriched output with all required fields
        """
        logger.debug("Validating output")

        # Ensure required fields exist
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
                # Set safe defaults
                if field == "confidence":
                    output["confidence"] = 0.5
                elif field == "scholar_flag":
                    output["scholar_flag"] = True
                elif field == "executive_summary":
                    output["executive_summary"] = "Ethical analysis based on Bhagavad Geeta principles."
                elif field == "recommended_action":
                    output["recommended_action"] = {
                        "option": 1,
                        "steps": ["Reflect on the situation", "Consider all perspectives", "Act with clarity and integrity"],
                        "sources": [],
                    }
                elif field == "reflection_prompts":
                    output["reflection_prompts"] = [
                        "What is my duty in this situation?",
                        "How can I act with integrity?",
                    ]
                else:
                    output[field] = []

        # Validate and fix options (critical requirement: exactly 3)
        options = output.get("options", [])
        num_options = len(options)

        if num_options != 3:
            logger.warning(
                f"LLM returned {num_options} options instead of required 3. "
                f"Will attempt to fill gaps intelligently."
            )

            # Flag for scholar review since LLM didn't follow constraint
            output["scholar_flag"] = True
            output["confidence"] = max(output.get("confidence", 0.5) - 0.15, 0.3)  # Penalize confidence

            # If we have some valid options, try to intelligently fill missing ones
            if num_options > 0 and num_options < 3:
                # Validate existing options have required fields
                for option in options:
                    if "title" not in option:
                        option["title"] = f"Option {options.index(option) + 1}"
                    if "description" not in option:
                        option["description"] = "An alternative approach"
                    if "pros" not in option or not isinstance(option["pros"], list):
                        option["pros"] = []
                    if "cons" not in option or not isinstance(option["cons"], list):
                        option["cons"] = []
                    if "sources" not in option or not isinstance(option["sources"], list):
                        option["sources"] = []

                # Generate missing options using available context
                base_verses = output.get("sources", [])
                verse_ids = [v.get("canonical_id", f"BG_{i}_{i}") for i, v in enumerate(base_verses[:3], 1)]

                while len(options) < 3:
                    idx = len(options) + 1
                    verse_id = verse_ids[idx - 1] if idx - 1 < len(verse_ids) else f"BG_{idx}_{idx}"

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
                    logger.info(f"Generated missing Option {idx} to meet requirement of 3 options")

                output["options"] = options
            elif num_options == 0:
                # Complete failure - generate all 3 default options
                logger.warning("No options found in LLM response. Generating default options.")
                output["options"] = [
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
                        "sources": [v.get("canonical_id", "BG_2_47") for v in base_verses[:1]],
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
                        "sources": [v.get("canonical_id", "BG_3_35") for v in base_verses[1:2]],
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
                        "sources": [v.get("canonical_id", "BG_18_63") for v in base_verses[2:3]],
                    },
                ]
                output["scholar_flag"] = True
                output["confidence"] = 0.4  # Very low confidence for completely generated options

        # Comprehensive field type validation
        # Validate executive_summary is a non-empty string
        if not isinstance(output.get("executive_summary"), str) or len(str(output.get("executive_summary", "")).strip()) == 0:
            logger.warning("Invalid or missing executive_summary, using default")
            output["executive_summary"] = "Ethical analysis based on Bhagavad Geeta principles."

        # Validate reflection_prompts is a non-empty list
        if not isinstance(output.get("reflection_prompts"), list) or len(output.get("reflection_prompts", [])) == 0:
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
                "steps": ["Reflect on the situation", "Consider all perspectives", "Act with clarity"],
                "sources": [],
            }
        else:
            # Validate option field is valid integer
            if not isinstance(recommended_action.get("option"), int) or recommended_action.get("option") not in [1, 2, 3]:
                logger.warning(f"Invalid recommended_action.option: {recommended_action.get('option')}, defaulting to 1")
                recommended_action["option"] = 1

            # Validate steps is a non-empty list
            if not isinstance(recommended_action.get("steps"), list) or len(recommended_action.get("steps", [])) == 0:
                logger.warning("Invalid or missing recommended_action.steps")
                recommended_action["steps"] = ["Reflect on the situation", "Consider all perspectives", "Act with clarity"]

            # Validate sources is a list (can be empty)
            if not isinstance(recommended_action.get("sources"), list):
                logger.warning("Invalid recommended_action.sources, setting to empty list")
                recommended_action["sources"] = []

        output["recommended_action"] = recommended_action

        # Validate each option structure
        for i, option in enumerate(output.get("options", [])):
            is_valid, error_msg = _validate_option_structure(option)
            if not is_valid:
                logger.warning(f"Option {i} validation failed: {error_msg}")
                # Minimum fix to keep option viable
                if "title" not in option or not isinstance(option.get("title"), str):
                    option["title"] = f"Option {i + 1}"
                if "description" not in option or not isinstance(option.get("description"), str):
                    option["description"] = "An alternative approach"
                if "pros" not in option or not isinstance(option.get("pros"), list):
                    option["pros"] = []
                if "cons" not in option or not isinstance(option.get("cons"), list):
                    option["cons"] = []
                if "sources" not in option or not isinstance(option.get("sources"), list):
                    option["sources"] = []

        # Validate sources array
        sources_array = output.get("sources", [])
        if not isinstance(sources_array, list):
            logger.warning("Sources field is not a list, setting to empty")
            output["sources"] = []
            sources_array = []
        else:
            # Validate each source object structure
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

        # Validate source references in options (optional: check if option sources cite actual sources)
        if sources_array:
            source_ids = _validate_source_reference  # For logging
            for option_idx, option in enumerate(output.get("options", [])):
                for source_ref in option.get("sources", []):
                    if not _validate_source_reference(source_ref, sources_array):
                        logger.warning(
                            f"Option {option_idx} references undefined source {source_ref}. "
                            f"Available sources: {[s.get('canonical_id') for s in sources_array]}"
                        )

        # Validate confidence is numeric and in range
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

        logger.info(
            f"Output validation complete: {len(output.get('options', []))} options, "
            f"confidence={output['confidence']:.2f}, scholar_flag={output['scholar_flag']}"
        )

        return output

    def _create_fallback_response(
        self, case_data: Dict[str, Any], error_message: str
    ) -> Dict[str, Any]:
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
        self, case_data: Dict[str, Any], top_k: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Run complete RAG pipeline with graceful degradation.

        Args:
            case_data: Case information
            top_k: Number of verses to retrieve (optional)

        Returns:
            Complete consulting brief (or fallback response)

        Notes:
            - If verse retrieval fails, uses fallback with no sources
            - If LLM fails, returns fallback response
            - Always returns a valid response structure
        """
        logger.info(f"Running RAG pipeline for case: {case_data.get('title', 'N/A')}")

        retrieved_verses = []

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
            return self._create_fallback_response(
                case_data, "Failed to construct prompt"
            )

        # Step 3: Generate brief with LLM (with fallback)
        try:
            output = self.generate_brief(
                prompt,
                fallback_prompt=fallback_prompt,
                fallback_system=OLLAMA_SYSTEM_PROMPT,
                retrieved_verses=retrieved_verses,
            )
        except Exception as e:
            logger.error(f"LLM generation failed: {e}")
            return self._create_fallback_response(case_data, "LLM unavailable")

        # Step 4: Validate and enrich
        try:
            validated_output = self.validate_output(output)

            # Mark as degraded if no verses were retrieved
            if not retrieved_verses:
                validated_output["confidence"] = min(
                    validated_output.get("confidence", 0.5), 0.5
                )
                validated_output["scholar_flag"] = True
                validated_output["warning"] = "Generated without verse retrieval"

            logger.info("RAG pipeline completed successfully")
            return validated_output

        except Exception as e:
            logger.error(f"Output validation failed: {e}")
            # Last resort: return the raw output if validation fails
            output["confidence"] = 0.3
            output["scholar_flag"] = True
            output["warning"] = "Output validation failed"
            return output


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
