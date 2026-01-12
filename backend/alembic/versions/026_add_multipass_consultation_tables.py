"""Add multipass consultation tables for 5-pass Ollama refinement workflow

Revision ID: 026
Revises: 025
Create Date: 2026-01-12

This migration adds tables for the multi-pass consultation pipeline:
- multipass_consultations: Master record for pipeline execution
- multipass_pass_responses: Individual pass records for audit trail

Purpose:
- Track 5-pass workflow (Acceptance → Draft → Critique → Refine → Structure)
- Enable fallback reconstruction from intermediate pass outputs
- Provide audit trail for quality analysis and debugging
- Support metrics collection for Phase 2 validation

See: todos/ollama-consultations-refined.md for full specification
"""

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "026"
down_revision = "025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create multipass consultation tables."""
    conn = op.get_bind()
    inspector = inspect(conn)

    # Create multipass_consultations table
    if "multipass_consultations" not in inspector.get_table_names():
        op.create_table(
            "multipass_consultations",
            # Identity
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column(
                "case_id",
                sa.String(36),
                sa.ForeignKey("cases.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            # Pipeline metadata
            sa.Column(
                "pipeline_mode",
                sa.String(20),
                nullable=False,
                server_default="multi_pass",
            ),
            sa.Column(
                "llm_provider", sa.String(50), nullable=False, server_default="ollama"
            ),
            sa.Column("llm_model", sa.String(100), nullable=True),
            # Status tracking
            sa.Column(
                "status", sa.String(20), nullable=False, server_default="queued", index=True
            ),
            sa.Column("passes_completed", sa.Integer, nullable=False, server_default="0"),
            # Aggregate results
            sa.Column("final_result_json", sa.JSON, nullable=True),
            sa.Column("final_confidence", sa.Float, nullable=True),
            sa.Column(
                "scholar_flag", sa.Boolean, nullable=False, server_default="false", index=True
            ),
            # Metrics
            sa.Column("total_duration_ms", sa.Integer, nullable=True),
            sa.Column("total_tokens_used", sa.Integer, nullable=True),
            # Fallback tracking
            sa.Column(
                "fallback_used", sa.Boolean, nullable=False, server_default="false"
            ),
            sa.Column("fallback_reason", sa.String(255), nullable=True),
            # Error tracking
            sa.Column("error_message", sa.Text, nullable=True),
            sa.Column("failed_at_pass", sa.Integer, nullable=True),
            # Timestamps
            sa.Column(
                "created_at",
                sa.DateTime,
                nullable=False,
                server_default=sa.func.now(),
                index=True,
            ),
            sa.Column("started_at", sa.DateTime, nullable=True),
            sa.Column("completed_at", sa.DateTime, nullable=True),
        )

    # Create multipass_pass_responses table
    if "multipass_pass_responses" not in inspector.get_table_names():
        op.create_table(
            "multipass_pass_responses",
            # Identity
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column(
                "consultation_id",
                sa.String(36),
                sa.ForeignKey("multipass_consultations.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            # Pass identification
            sa.Column("pass_number", sa.Integer, nullable=False),
            sa.Column("pass_name", sa.String(50), nullable=False),
            # Input/output tracking
            sa.Column("input_text", sa.Text, nullable=True),
            sa.Column("output_text", sa.Text, nullable=True),
            sa.Column("output_json", sa.JSON, nullable=True),
            # Status
            sa.Column(
                "status", sa.String(20), nullable=False, server_default="pending", index=True
            ),
            sa.Column("error_message", sa.Text, nullable=True),
            sa.Column("retry_count", sa.Integer, nullable=False, server_default="0"),
            # LLM parameters
            sa.Column("temperature", sa.Float, nullable=True),
            sa.Column("max_tokens", sa.Integer, nullable=True),
            # Metrics
            sa.Column("duration_ms", sa.Integer, nullable=True),
            sa.Column("tokens_used", sa.Integer, nullable=True),
            sa.Column("prompt_tokens", sa.Integer, nullable=True),
            sa.Column("completion_tokens", sa.Integer, nullable=True),
            # Prompt version tracking
            sa.Column("prompt_version", sa.String(20), nullable=True),
            # Timestamps
            sa.Column(
                "created_at", sa.DateTime, nullable=False, server_default=sa.func.now()
            ),
            sa.Column("started_at", sa.DateTime, nullable=True),
            sa.Column("completed_at", sa.DateTime, nullable=True),
            sa.Column("retried_at", sa.DateTime, nullable=True),
        )

        # Create composite index for efficient pass queries
        op.create_index(
            "idx_multipass_pass_consultation_number",
            "multipass_pass_responses",
            ["consultation_id", "pass_number"],
        )


def downgrade() -> None:
    """Drop multipass consultation tables."""
    # Drop index first
    op.drop_index(
        "idx_multipass_pass_consultation_number", table_name="multipass_pass_responses"
    )
    # Drop tables (pass_responses first due to foreign key)
    op.drop_table("multipass_pass_responses")
    op.drop_table("multipass_consultations")
