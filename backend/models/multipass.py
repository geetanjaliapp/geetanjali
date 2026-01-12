"""Multi-pass consultation models for Ollama 5-pass refinement workflow.

These models provide audit trail and fallback reconstruction capabilities
for the multi-pass consultation pipeline (Pass 0-4: Acceptance → Draft →
Critique → Refine → Structure).

See: todos/ollama-consultations-refined.md for full specification.
"""

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base


class MultiPassStatus(str, enum.Enum):
    """Status of multi-pass consultation pipeline."""

    QUEUED = "queued"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    REJECTED = "rejected"  # Pass 0 rejection


class PassStatus(str, enum.Enum):
    """Status of individual pass execution."""

    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    ERROR = "error"
    TIMEOUT = "timeout"
    SKIPPED = "skipped"  # e.g., Pass 2 critique skipped on timeout


class PassName(str, enum.Enum):
    """Names for each pass in the pipeline."""

    ACCEPTANCE = "acceptance"  # Pass 0
    DRAFT = "draft"  # Pass 1
    CRITIQUE = "critique"  # Pass 2
    REFINE = "refine"  # Pass 3
    STRUCTURE = "structure"  # Pass 4


class MultiPassConsultation(Base):
    """Master record for a multi-pass consultation pipeline execution.

    Each consultation corresponds to one Case and tracks the overall
    pipeline status, timing, and results. Child PassResponse records
    store individual pass inputs/outputs for debugging and reconstruction.
    """

    __tablename__ = "multipass_consultations"

    # Identity
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    case_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("cases.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    # Pipeline metadata
    pipeline_mode: Mapped[str] = mapped_column(
        String(20), nullable=False, default="multi_pass"
    )  # multi_pass | one_pass (for comparison mode)
    llm_provider: Mapped[str] = mapped_column(
        String(50), nullable=False, default="ollama"
    )  # ollama | anthropic
    llm_model: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )  # e.g., "qwen2.5:3b"

    # Status tracking
    status: Mapped[str] = mapped_column(
        String(20), default=MultiPassStatus.QUEUED.value, index=True
    )
    passes_completed: Mapped[int] = mapped_column(Integer, default=0)

    # Aggregate results (populated on completion)
    final_result_json: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    final_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    scholar_flag: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    # Metrics
    total_duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_tokens_used: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Fallback tracking
    fallback_used: Mapped[bool] = mapped_column(Boolean, default=False)
    fallback_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Error tracking
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    failed_at_pass: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )  # 0-4, which pass failed

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, index=True
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    case = relationship("Case", backref="multipass_consultations")
    pass_responses = relationship(
        "MultiPassPassResponse",
        back_populates="consultation",
        cascade="all, delete-orphan",
        order_by="MultiPassPassResponse.pass_number",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<MultiPassConsultation(id={self.id}, case_id={self.case_id}, "
            f"status={self.status}, passes={self.passes_completed})>"
        )


class MultiPassPassResponse(Base):
    """Individual pass execution record for audit trail and reconstruction.

    Stores input/output for each pass (0-4) enabling:
    - Debugging: See exactly what each pass received and produced
    - Fallback reconstruction: Use Pass 3 output if Pass 4 fails
    - Quality analysis: Compare pass-wise improvements
    - Metrics: Track timing and token usage per pass
    """

    __tablename__ = "multipass_pass_responses"

    # Identity
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    consultation_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("multipass_consultations.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    # Pass identification
    pass_number: Mapped[int] = mapped_column(Integer, nullable=False)  # 0-4
    pass_name: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # acceptance, draft, critique, refine, structure

    # Input/output tracking (for debugging and reconstruction)
    input_text: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # Prompt or previous pass output
    output_text: Mapped[str | None] = mapped_column(Text, nullable=True)  # LLM response
    output_json: Mapped[Any | None] = mapped_column(
        JSON, nullable=True
    )  # Parsed output (Pass 0, Pass 4)

    # Status
    status: Mapped[str] = mapped_column(
        String(20), default=PassStatus.PENDING.value, index=True
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)

    # LLM parameters used
    temperature: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Metrics
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tokens_used: Mapped[int | None] = mapped_column(Integer, nullable=True)
    prompt_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Prompt version tracking (for debugging prompt changes)
    prompt_version: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    retried_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    consultation = relationship(
        "MultiPassConsultation", back_populates="pass_responses"
    )

    def __repr__(self) -> str:
        return (
            f"<MultiPassPassResponse(id={self.id}, pass={self.pass_number}:{self.pass_name}, "
            f"status={self.status}, duration={self.duration_ms}ms)>"
        )


