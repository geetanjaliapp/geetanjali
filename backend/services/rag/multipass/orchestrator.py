"""Multi-pass consultation orchestrator.

Coordinates the 5-pass workflow:
- Pass 0: Acceptance (validation gate)
- Pass 1: Draft (creative reasoning)
- Pass 2: Critique (analytical review)
- Pass 3: Refine (disciplined rewrite)
- Pass 4: Structure (JSON formatting)

Each pass result is stored in postgres for audit trail and fallback reconstruction.
"""

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from config import settings
from db import SessionLocal
from models.multipass import (
    MultiPassConsultation,
    MultiPassPassResponse,
)
from models.multipass import (
    PassStatus as DBPassStatus,
)
from services.llm import get_llm_service
from services.rag.pipeline import RAGPipeline
from utils.metrics_multipass import (
    multipass_active_pipelines,
    multipass_confidence_score,
    multipass_fallback_total,
    multipass_pass_timeout_total,
    multipass_pipeline_duration_ms,
    multipass_pipeline_passes_total,
    multipass_pipeline_total,
    multipass_rejection_total,
    multipass_scholar_flag_total,
    multipass_tokens_total,
)

from .acceptance import AcceptanceResult, run_acceptance_pass
from .fallback import reconstruct_from_prose
from .rejection_response import create_rejection_output
from .passes import (
    PassResult,
    PassStatus,
    run_critique_pass,
    run_draft_pass,
    run_refine_pass,
    run_structure_pass,
)

logger = logging.getLogger(__name__)


@dataclass
class MultiPassResult:
    """Result of multi-pass consultation pipeline."""

    success: bool
    result_json: dict[str, Any] | None = None
    is_policy_violation: bool = False
    rejection_reason: str | None = None
    consultation_id: str | None = None
    passes_completed: int = 0
    total_duration_ms: int = 0
    fallback_used: bool = False
    fallback_reason: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


class MultiPassOrchestrator:
    """Orchestrates the multi-pass consultation workflow.

    This class coordinates:
    1. Running each pass sequentially
    2. Storing all pass responses in postgres audit trail
    3. Handling failures with fallback behavior
    4. Returning the final result
    """

    def __init__(self, case_id: str):
        """Initialize orchestrator for a case.

        Args:
            case_id: The case ID to process
        """
        self.case_id = case_id
        self.llm_service = get_llm_service()
        self.rag_pipeline = RAGPipeline()
        self.consultation: MultiPassConsultation | None = None

    async def run(
        self,
        title: str,
        description: str,
        skip_acceptance_llm: bool = False,
    ) -> MultiPassResult:
        """Run the full multi-pass pipeline.

        Args:
            title: Case title
            description: Case description
            skip_acceptance_llm: Skip LLM stage of acceptance (use heuristics only)

        Returns:
            MultiPassResult with final consultation output or error details
        """
        start_time = time.time()
        multipass_active_pipelines.inc()

        db = SessionLocal()
        try:
            # Create consultation record
            self.consultation = MultiPassConsultation(
                case_id=self.case_id,
                status="in_progress",
                pipeline_mode="multi_pass",
            )
            db.add(self.consultation)
            db.commit()
            db.refresh(self.consultation)

            consultation_id = str(self.consultation.id)
            logger.info(f"Starting multi-pass consultation {consultation_id} for case {self.case_id}")

            # Retrieve verses once (reused across all passes)
            verses = self.rag_pipeline.retrieve_verses(description)
            verses = self.rag_pipeline.enrich_verses_with_translations(verses)
            logger.info(f"Retrieved {len(verses)} verses for consultation")

            # Pass 0: Acceptance
            acceptance_result = await self._run_acceptance(
                db, description, skip_acceptance_llm
            )

            if not acceptance_result.accepted:
                # Update consultation status
                self.consultation.status = "rejected"
                self.consultation.completed_at = datetime.utcnow()
                db.commit()

                # Record rejection metric
                multipass_rejection_total.labels(
                    category=acceptance_result.category.value
                ).inc()
                multipass_pipeline_total.labels(status="rejected").inc()

                # Generate rejection response (with LLM-generated message or fallback)
                rejection_output = await create_rejection_output(
                    case_description=description,
                    acceptance_result=acceptance_result,
                    llm_service=self.llm_service,
                )

                duration_ms = int((time.time() - start_time) * 1000)
                return MultiPassResult(
                    success=True,  # Success=True with policy violation, not a failure
                    result_json=rejection_output,
                    is_policy_violation=True,
                    rejection_reason=acceptance_result.reason,
                    consultation_id=consultation_id,
                    passes_completed=0,
                    total_duration_ms=duration_ms,
                    metadata={"rejection_category": acceptance_result.category.value},
                )

            # Pass 1: Draft
            draft_result = await self._run_pass(
                db, 1, "draft",
                lambda: run_draft_pass(title, description, verses, self.llm_service)
            )

            if draft_result.status != PassStatus.SUCCESS:
                return self._create_failure_result(
                    consultation_id, 1, draft_result, start_time
                )

            # Pass 2: Critique
            critique_result = await self._run_pass(
                db, 2, "critique",
                lambda: run_critique_pass(title, description, draft_result.output_text, self.llm_service)
            )

            # Critique timeout/error is recoverable - use placeholder
            critique_text = critique_result.output_text or "No critique available."

            # Pass 3: Refine
            refine_result = await self._run_pass(
                db, 3, "refine",
                lambda: run_refine_pass(title, description, draft_result.output_text, critique_text, self.llm_service)
            )

            # Refine failure falls back to draft (already handled in run_refine_pass)
            refined_text = refine_result.output_text or draft_result.output_text

            # Pass 4: Structure
            structure_result = await self._run_pass(
                db, 4, "structure",
                lambda: run_structure_pass(refined_text, self.llm_service)
            )

            # Check if we need fallback reconstruction
            if structure_result.status != PassStatus.SUCCESS or not structure_result.output_json:
                # Attempt retry if configured
                if settings.MULTIPASS_RETRIES_STRUCTURE > 0:
                    logger.info("Retrying structure pass with lower temperature")
                    structure_result = await self._run_pass(
                        db, 4, "structure_retry",
                        lambda: run_structure_pass(refined_text, self.llm_service, retry_count=1)
                    )

                if structure_result.status != PassStatus.SUCCESS or not structure_result.output_json:
                    # Use fallback reconstruction (Task 8)
                    logger.warning("Structure pass failed, attempting fallback reconstruction")
                    return await self._fallback_reconstruction(
                        db, consultation_id, verses, draft_result, refine_result, start_time
                    )

            # Success - update consultation
            self.consultation.status = "completed"
            self.consultation.completed_at = datetime.utcnow()
            self.consultation.final_result_json = structure_result.output_json
            self.consultation.total_duration_ms = int((time.time() - start_time) * 1000)
            db.commit()

            duration_ms = int((time.time() - start_time) * 1000)
            logger.info(f"Multi-pass consultation completed in {duration_ms}ms")

            # Record success metrics
            multipass_pipeline_total.labels(status="success").inc()
            if structure_result.output_json:
                confidence = structure_result.output_json.get("confidence", 0.7)
                multipass_confidence_score.observe(confidence)
                if structure_result.output_json.get("scholar_flag", False):
                    multipass_scholar_flag_total.labels(reason="low_confidence").inc()

            return MultiPassResult(
                success=True,
                result_json=structure_result.output_json,
                consultation_id=consultation_id,
                passes_completed=4,
                total_duration_ms=duration_ms,
                metadata={
                    "draft_length": len(draft_result.output_text or ""),
                    "critique_length": len(critique_text),
                    "refined_length": len(refined_text),
                },
            )

        except Exception as e:
            logger.error(f"Multi-pass pipeline error: {e}", exc_info=True)
            if self.consultation:
                self.consultation.status = "failed"
                self.consultation.completed_at = datetime.utcnow()
                db.commit()

            multipass_pipeline_total.labels(status="failed").inc()

            return MultiPassResult(
                success=False,
                consultation_id=str(self.consultation.id) if self.consultation else None,
                total_duration_ms=int((time.time() - start_time) * 1000),
                metadata={"error": str(e)},
            )

        finally:
            multipass_active_pipelines.dec()
            db.close()

    async def _run_acceptance(
        self,
        db,
        description: str,
        skip_llm: bool,
    ) -> AcceptanceResult:
        """Run Pass 0: Acceptance validation.

        Args:
            db: Database session
            description: Case description to validate
            skip_llm: Skip LLM stage (heuristics only)

        Returns:
            AcceptanceResult with accept/reject decision
        """
        start_time = time.time()

        result = await run_acceptance_pass(
            description,
            llm_service=None if skip_llm else self.llm_service,
            skip_llm=skip_llm,
        )

        duration_ms = int((time.time() - start_time) * 1000)

        # Record acceptance pass metrics
        status = "success" if result.accepted else "rejected"
        multipass_pipeline_passes_total.labels(
            pass_number="0",
            pass_name="acceptance",
            status=status,
        ).inc()
        multipass_pipeline_duration_ms.labels(
            pass_number="0",
            pass_name="acceptance",
        ).observe(duration_ms)

        # Store in audit trail
        pass_response = MultiPassPassResponse(
            consultation_id=self.consultation.id,
            pass_number=0,
            pass_name="acceptance",
            input_text=description[:2000],  # Truncate for storage
            output_text=result.reason,
            status=DBPassStatus.SUCCESS if result.accepted else DBPassStatus.ERROR,
            duration_ms=duration_ms,
        )
        db.add(pass_response)
        db.commit()

        logger.info(f"Pass 0 (Acceptance): {'accepted' if result.accepted else 'rejected'} in {duration_ms}ms")

        return result

    async def _run_pass(
        self,
        db,
        pass_number: int,
        pass_name: str,
        pass_func,
    ) -> PassResult:
        """Run a single pass and store result in audit trail.

        Args:
            db: Database session
            pass_number: Pass number (1-4)
            pass_name: Pass name for logging
            pass_func: Async function to execute

        Returns:
            PassResult from the pass execution
        """
        start_time = time.time()

        try:
            result = await pass_func()
        except Exception as e:
            logger.error(f"Pass {pass_number} ({pass_name}) failed: {e}")
            result = PassResult(
                pass_number=pass_number,
                pass_name=pass_name,
                status=PassStatus.ERROR,
                error_message=str(e),
            )

        duration_ms = int((time.time() - start_time) * 1000)

        # Record pass metrics
        multipass_pipeline_passes_total.labels(
            pass_number=str(pass_number),
            pass_name=pass_name,
            status=result.status.value,
        ).inc()
        multipass_pipeline_duration_ms.labels(
            pass_number=str(pass_number),
            pass_name=pass_name,
        ).observe(duration_ms)

        # Record timeout metric if applicable
        if result.status == PassStatus.TIMEOUT:
            multipass_pass_timeout_total.labels(
                pass_number=str(pass_number),
                pass_name=pass_name,
            ).inc()

        # Map PassStatus to DBPassStatus
        status_map = {
            PassStatus.SUCCESS: DBPassStatus.SUCCESS,
            PassStatus.ERROR: DBPassStatus.ERROR,
            PassStatus.TIMEOUT: DBPassStatus.TIMEOUT,
            PassStatus.SKIPPED: DBPassStatus.SKIPPED,
        }

        # Store in audit trail
        pass_response = MultiPassPassResponse(
            consultation_id=self.consultation.id,
            pass_number=pass_number,
            pass_name=pass_name,
            input_text=None,  # Input varies by pass, handled separately if needed
            output_text=result.output_text[:10000] if result.output_text else None,  # Truncate
            error_message=result.error_message,
            status=status_map.get(result.status, DBPassStatus.ERROR),
            duration_ms=duration_ms,
            tokens_used=result.tokens_used,
            temperature=getattr(settings, f"MULTIPASS_TEMP_{pass_name.upper()}", None),
        )
        db.add(pass_response)
        db.commit()

        # Record token usage metric if available
        if result.tokens_used and result.tokens_used > 0:
            multipass_tokens_total.labels(
                pass_number=str(pass_number),
                pass_name=pass_name,
            ).inc(result.tokens_used)

        logger.info(f"Pass {pass_number} ({pass_name}): {result.status.value} in {duration_ms}ms")

        return result

    async def _fallback_reconstruction(
        self,
        db,
        consultation_id: str,
        verses: list[dict],
        draft_result: PassResult,
        refine_result: PassResult,
        start_time: float,
    ) -> MultiPassResult:
        """Attempt fallback reconstruction when Pass 4 fails.

        Tries heuristic extraction from prose first, then falls back to
        generic response if that also fails.

        Args:
            db: Database session
            consultation_id: Consultation ID
            verses: Retrieved verses
            draft_result: Result from Pass 1
            refine_result: Result from Pass 3
            start_time: Pipeline start time

        Returns:
            MultiPassResult with fallback response
        """
        # Attempt heuristic reconstruction from prose
        reconstruction = reconstruct_from_prose(
            refined_prose=refine_result.output_text,
            draft_prose=draft_result.output_text,
            verses=verses,
        )

        if reconstruction.success and reconstruction.result_json:
            fallback_json = reconstruction.result_json
            fallback_reason = f"Heuristic reconstruction from {reconstruction.reconstruction_method}"
            logger.info(f"Heuristic reconstruction succeeded for consultation {consultation_id}")
            multipass_fallback_total.labels(fallback_type="reconstruction").inc()
        else:
            # Fall back to generic response
            fallback_json = self._create_generic_fallback(verses)
            fallback_reason = "Structure pass failed, using generic fallback"
            logger.warning(f"Heuristic reconstruction failed, using generic fallback for {consultation_id}")
            multipass_fallback_total.labels(fallback_type="generic_response").inc()

        # Fallback always sets scholar_flag
        multipass_scholar_flag_total.labels(reason="reconstruction").inc()
        multipass_pipeline_total.labels(status="partial_success").inc()

        # Record confidence score from fallback
        confidence = fallback_json.get("confidence", 0.4)
        multipass_confidence_score.observe(confidence)

        # Update consultation
        self.consultation.status = "completed"
        self.consultation.completed_at = datetime.utcnow()
        self.consultation.final_result_json = fallback_json
        self.consultation.fallback_used = True
        self.consultation.fallback_reason = fallback_reason
        db.commit()

        duration_ms = int((time.time() - start_time) * 1000)

        prose_length = len(refine_result.output_text or draft_result.output_text or "")

        return MultiPassResult(
            success=True,
            result_json=fallback_json,
            consultation_id=consultation_id,
            passes_completed=3,
            total_duration_ms=duration_ms,
            fallback_used=True,
            fallback_reason=fallback_reason,
            metadata={
                "prose_length": prose_length,
                "reconstruction_method": reconstruction.reconstruction_method,
                "reconstruction_confidence": reconstruction.confidence,
            },
        )

    def _create_generic_fallback(self, verses: list[dict]) -> dict:
        """Create a generic fallback response when reconstruction fails.

        Args:
            verses: Retrieved verses

        Returns:
            Basic consultation structure with generic content
        """
        # Extract verse info
        verse_sources = []
        for verse in verses[:5]:  # Use top 5 verses
            canonical_id = verse.get("canonical_id", "BG_2_47")
            metadata = verse.get("metadata", {})
            translation = (
                metadata.get("translation_en") or
                metadata.get("paraphrase_en") or
                "Wisdom from the Bhagavad Geeta"
            )
            verse_sources.append({
                "canonical_id": canonical_id,
                "paraphrase": translation[:200],
                "relevance": 0.5,
            })

        return {
            "suggested_title": "Ethical Guidance",
            "executive_summary": (
                "We encountered a processing issue while analyzing your dilemma in depth. "
                "The wisdom of the Bhagavad Geeta teaches us that in times of uncertainty, "
                "we should focus on our dharma (duty) and act with detachment from outcomes. "
                "Please consider the verses provided and reflect on how they apply to your situation."
            ),
            "options": [
                {
                    "title": "Reflect on Your Values",
                    "description": "Take time to identify the core values at stake in your situation.",
                    "pros": ["Clarifies priorities", "Builds self-awareness"],
                    "cons": ["Requires honest self-examination"],
                    "sources": [vs["canonical_id"] for vs in verse_sources[:2]],
                },
                {
                    "title": "Consider Stakeholder Perspectives",
                    "description": "Examine how your decision affects others involved.",
                    "pros": ["Builds empathy", "Reveals hidden impacts"],
                    "cons": ["May complicate decision"],
                    "sources": [vs["canonical_id"] for vs in verse_sources[2:4]],
                },
                {
                    "title": "Act with Detachment",
                    "description": "Focus on right action (karma yoga) without attachment to outcomes.",
                    "pros": ["Reduces anxiety", "Promotes ethical action"],
                    "cons": ["Challenging mindset shift"],
                    "sources": [vs["canonical_id"] for vs in verse_sources[4:5]] if len(verse_sources) > 4 else verse_sources[:1],
                },
            ],
            "recommended_action": {
                "option": 1,
                "steps": [
                    "Reflect quietly on your core values and duties",
                    "Consider how each path aligns with your dharma",
                    "Act with integrity, accepting outcomes with equanimity",
                ],
                "sources": [vs["canonical_id"] for vs in verse_sources[:2]],
            },
            "reflection_prompts": [
                "What would acting from my highest self look like?",
                "How will this decision affect my dharma and those I serve?",
            ],
            "sources": verse_sources,
            "confidence": 0.4,  # Low confidence for fallback
            "scholar_flag": True,  # Always flag fallback for review
        }

    def _create_failure_result(
        self,
        consultation_id: str,
        pass_number: int,
        pass_result: PassResult,
        start_time: float,
    ) -> MultiPassResult:
        """Create a failure result when a critical pass fails.

        Args:
            consultation_id: Consultation ID
            pass_number: Failed pass number
            pass_result: Failed pass result
            start_time: Pipeline start time

        Returns:
            MultiPassResult indicating failure
        """
        duration_ms = int((time.time() - start_time) * 1000)

        return MultiPassResult(
            success=False,
            consultation_id=consultation_id,
            passes_completed=pass_number - 1,
            total_duration_ms=duration_ms,
            metadata={
                "failed_pass": pass_number,
                "error": pass_result.error_message,
            },
        )


async def run_multipass_consultation(
    case_id: str,
    title: str,
    description: str,
    skip_acceptance_llm: bool = False,
) -> MultiPassResult:
    """Entry point for running a multi-pass consultation.

    This function can be called directly or enqueued as a background job.

    Args:
        case_id: Case ID to process
        title: Case title
        description: Case description
        skip_acceptance_llm: Skip LLM stage of acceptance

    Returns:
        MultiPassResult with consultation output
    """
    orchestrator = MultiPassOrchestrator(case_id)
    return await orchestrator.run(title, description, skip_acceptance_llm)
