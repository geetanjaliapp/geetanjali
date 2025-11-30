"""RAG (Retrieval-Augmented Generation) pipeline service."""

import logging
import json
from typing import Dict, Any, List

from config import settings
from services.vector_store import get_vector_store
from services.llm import get_llm_service
from services.prompts import SYSTEM_PROMPT, build_user_prompt

logger = logging.getLogger(__name__)


class RAGPipeline:
    """RAG pipeline for generating consulting briefs."""

    def __init__(self):
        """Initialize RAG pipeline."""
        self.vector_store = get_vector_store()
        self.llm_service = get_llm_service()

        logger.info("RAG Pipeline initialized")

    def retrieve_verses(
        self,
        query: str,
        top_k: int = None
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
                "relevance": 1.0 - results["distances"][i],  # Convert distance to relevance
                "metadata": results["metadatas"][i]
            }
            verses.append(verse)

        logger.debug(f"Retrieved verses: {[v['canonical_id'] for v in verses]}")

        return verses

    def construct_context(
        self,
        case_data: Dict[str, Any],
        retrieved_verses: List[Dict[str, Any]]
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
        temperature: float = 0.7
    ) -> Dict[str, Any]:
        """
        Generate consulting brief using LLM.

        Args:
            prompt: Formatted prompt with context
            temperature: Sampling temperature

        Returns:
            Parsed JSON response

        Raises:
            Exception: If LLM fails or returns invalid JSON
        """
        logger.info("Generating consulting brief with LLM")

        # Generate JSON response
        response_text = self.llm_service.generate_json(
            prompt=prompt,
            system_prompt=SYSTEM_PROMPT,
            temperature=temperature
        )

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
            return result

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM JSON response: {e}")
            logger.error(f"Response text: {response_text[:500]}")
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
            "confidence"
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

    def run(
        self,
        case_data: Dict[str, Any],
        top_k: int = None
    ) -> Dict[str, Any]:
        """
        Run complete RAG pipeline.

        Args:
            case_data: Case information
            top_k: Number of verses to retrieve (optional)

        Returns:
            Complete consulting brief

        Raises:
            Exception: If any pipeline step fails
        """
        logger.info(f"Running RAG pipeline for case: {case_data.get('title', 'N/A')}")

        try:
            # Step 1: Retrieve relevant verses
            query = case_data.get("description", "")
            retrieved_verses = self.retrieve_verses(query, top_k=top_k)

            if not retrieved_verses:
                raise Exception("No verses retrieved from vector store")

            # Step 2: Construct context
            prompt = self.construct_context(case_data, retrieved_verses)

            # Step 3: Generate brief with LLM
            output = self.generate_brief(prompt)

            # Step 4: Validate and enrich
            validated_output = self.validate_output(output)

            logger.info("RAG pipeline completed successfully")

            return validated_output

        except Exception as e:
            logger.error(f"RAG pipeline failed: {e}")
            raise


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
