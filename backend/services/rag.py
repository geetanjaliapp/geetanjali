"""RAG (Retrieval-Augmented Generation) pipeline service."""

import logging
import json
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
                    if db_verse.translations:
                        verse["metadata"]["translations"] = [
                            {
                                "text": t.text,
                                "translator": t.translator,
                                "school": t.school,
                            }
                            for t in db_verse.translations[
                                :3
                            ]  # Limit to 3 translations
                        ]

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

        # Parse JSON
        try:
            # Try to extract JSON if wrapped in markdown code blocks
            if "```json" in response_text:
                start = response_text.find("```json") + 7
                end = response_text.find("```", start)
                response_text = response_text[start:end].strip()
            elif "```" in response_text:
                start = response_text.find("```") + 3
                end = response_text.find("```", start)
                response_text = response_text[start:end].strip()

            result = json.loads(response_text)
            logger.info("Successfully parsed JSON response")

            # Post-process if using Ollama (fallback mode)
            if provider == "ollama" and retrieved_verses:
                logger.info("Post-processing Ollama response")
                result = post_process_ollama_response(response_text, retrieved_verses)

            return result  # type: ignore[no-any-return]

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM JSON response: {e}")
            logger.error(f"Response text: {response_text[:500]}")

            # If Ollama, try post-processing the raw text
            if provider == "ollama" and retrieved_verses:
                logger.warning("Attempting Ollama post-processing on malformed JSON")
                try:
                    return post_process_ollama_response(response_text, retrieved_verses)
                except Exception as pp_error:
                    logger.error(f"Post-processing also failed: {pp_error}")

            raise Exception("LLM returned invalid JSON")

    def validate_output(self, output: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate and enrich LLM output.

        Args:
            output: Raw LLM output

        Returns:
            Validated and enriched output
        """
        logger.debug("Validating output")

        # Ensure required fields
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
                # Set defaults
                if field == "confidence":
                    output["confidence"] = 0.5
                elif field == "scholar_flag":
                    output["scholar_flag"] = True
                else:
                    output[field] = []

        # Validate confidence and set scholar flag
        confidence = output.get("confidence", 0.5)

        if confidence < settings.RAG_SCHOLAR_REVIEW_THRESHOLD:
            output["scholar_flag"] = True
            logger.info(f"Low confidence ({confidence}) - flagged for scholar review")
        else:
            output["scholar_flag"] = output.get("scholar_flag", False)

        # Ensure exactly 3 options
        if len(output.get("options", [])) != 3:
            logger.warning(f"Expected 3 options, got {len(output.get('options', []))}")

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
