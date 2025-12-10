"""Follow-up conversation pipeline for lightweight conversational responses.

This module implements the dual-mode pipeline architecture for follow-up
conversations. Unlike the full RAG pipeline used for initial consultations,
follow-ups use a lightweight conversational approach:

- No new verse retrieval (uses prior output's sources)
- Rolling conversation context (last 8 messages)
- Markdown prose output (not structured JSON)
- Direct LLM call without validation/parsing

This design minimizes latency while maintaining conversation continuity.
"""

import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

from services.llm import get_llm_service
from services.prompts import FOLLOW_UP_SYSTEM_PROMPT, build_follow_up_prompt

logger = logging.getLogger(__name__)


@dataclass
class FollowUpResult:
    """Result from follow-up pipeline."""

    content: str  # Markdown response
    model: str  # LLM model used
    provider: str  # LLM provider (anthropic/ollama)
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None


class FollowUpPipeline:
    """
    Lightweight pipeline for conversational follow-ups.

    Unlike RAGPipeline which retrieves verses and generates structured JSON,
    this pipeline focuses on conversational responses using prior context.
    """

    def __init__(self):
        """Initialize follow-up pipeline with LLM service."""
        self.llm_service = get_llm_service()
        logger.info("FollowUpPipeline initialized")

    def run(
        self,
        case_description: str,
        prior_output: Dict[str, Any],
        conversation: List[Dict[str, Any]],
        follow_up_question: str,
    ) -> FollowUpResult:
        """
        Generate a conversational follow-up response.

        Args:
            case_description: Original dilemma description
            prior_output: The result_json from the most recent Output
            conversation: List of prior messages [{"role": "user"|"assistant", "content": "..."}]
            follow_up_question: The current follow-up question from user

        Returns:
            FollowUpResult with markdown response and metadata

        Raises:
            LLMError: If LLM generation fails
        """
        logger.info(
            f"Running follow-up pipeline (conversation length: {len(conversation)})"
        )

        # Build the conversational prompt
        prompt = build_follow_up_prompt(
            case_description=case_description,
            prior_output=prior_output,
            conversation=conversation,
            follow_up_question=follow_up_question,
        )

        logger.debug(f"Follow-up prompt length: {len(prompt)} chars")

        # Generate response using LLM (markdown output, no JSON parsing)
        result = self.llm_service.generate(
            prompt=prompt,
            system_prompt=FOLLOW_UP_SYSTEM_PROMPT,
            temperature=0.7,  # Slightly creative for natural conversation
            max_tokens=1024,  # Reasonable limit for conversational response
        )

        response_content = result.get("response", "")

        logger.info(
            f"Follow-up response generated: {len(response_content)} chars, "
            f"provider={result.get('provider')}"
        )

        return FollowUpResult(
            content=response_content,
            model=result.get("model", "unknown"),
            provider=result.get("provider", "unknown"),
            input_tokens=result.get("input_tokens"),
            output_tokens=result.get("output_tokens"),
        )


# Module-level instance for singleton pattern
_follow_up_pipeline: Optional[FollowUpPipeline] = None


def get_follow_up_pipeline() -> FollowUpPipeline:
    """
    Get or create the global FollowUpPipeline instance.

    Returns:
        FollowUpPipeline instance
    """
    global _follow_up_pipeline
    if _follow_up_pipeline is None:
        _follow_up_pipeline = FollowUpPipeline()
    return _follow_up_pipeline
