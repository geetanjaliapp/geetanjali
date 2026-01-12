"""Tests for multi-pass consultation ORM models.

Tests cover:
- Model creation and field types
- Enum values
- Relationships (consultation ↔ pass_responses, case ↔ consultations)
- Index presence
- Default values
"""

from datetime import datetime

import pytest

from models import Case
from models.multipass import (
    MultiPassConsultation,
    MultiPassPassResponse,
    MultiPassStatus,
    PassName,
    PassStatus,
)
from tests.conftest import requires_postgresql

# Mark all tests as integration (require DB)
pytestmark = pytest.mark.integration


class TestMultiPassEnums:
    """Test enum definitions."""

    def test_multipass_status_values(self):
        """Verify MultiPassStatus enum has expected values."""
        assert MultiPassStatus.QUEUED.value == "queued"
        assert MultiPassStatus.IN_PROGRESS.value == "in_progress"
        assert MultiPassStatus.COMPLETED.value == "completed"
        assert MultiPassStatus.FAILED.value == "failed"
        assert MultiPassStatus.REJECTED.value == "rejected"

    def test_pass_status_values(self):
        """Verify PassStatus enum has expected values."""
        assert PassStatus.PENDING.value == "pending"
        assert PassStatus.RUNNING.value == "running"
        assert PassStatus.SUCCESS.value == "success"
        assert PassStatus.ERROR.value == "error"
        assert PassStatus.TIMEOUT.value == "timeout"
        assert PassStatus.SKIPPED.value == "skipped"

    def test_pass_name_values(self):
        """Verify PassName enum has expected values for all 5 passes."""
        assert PassName.ACCEPTANCE.value == "acceptance"  # Pass 0
        assert PassName.DRAFT.value == "draft"  # Pass 1
        assert PassName.CRITIQUE.value == "critique"  # Pass 2
        assert PassName.REFINE.value == "refine"  # Pass 3
        assert PassName.STRUCTURE.value == "structure"  # Pass 4


class TestMultiPassConsultationModel:
    """Test MultiPassConsultation model."""

    def test_create_consultation(self, db_session):
        """Test creating a MultiPassConsultation record."""
        # First create a case (required foreign key)
        case = Case(
            title="Test Case",
            description="Should I accept this promotion?",
            status="pending",
        )
        db_session.add(case)
        db_session.commit()

        # Create consultation
        consultation = MultiPassConsultation(
            case_id=case.id,
            pipeline_mode="multi_pass",
            llm_provider="ollama",
            llm_model="qwen2.5:3b",
            status=MultiPassStatus.QUEUED.value,
        )
        db_session.add(consultation)
        db_session.commit()

        # Verify
        assert consultation.id is not None
        assert len(consultation.id) == 36  # UUID format
        assert consultation.case_id == case.id
        assert consultation.pipeline_mode == "multi_pass"
        assert consultation.llm_provider == "ollama"
        assert consultation.status == "queued"
        assert consultation.passes_completed == 0
        assert consultation.fallback_used is False
        assert consultation.created_at is not None

    def test_consultation_defaults(self, db_session):
        """Test default values for MultiPassConsultation."""
        case = Case(
            title="Test",
            description="Test description for ethical dilemma.",
            status="pending",
        )
        db_session.add(case)
        db_session.commit()

        # Create with minimal fields
        consultation = MultiPassConsultation(case_id=case.id)
        db_session.add(consultation)
        db_session.commit()

        # Verify defaults
        assert consultation.pipeline_mode == "multi_pass"
        assert consultation.llm_provider == "ollama"
        assert consultation.status == "queued"
        assert consultation.passes_completed == 0
        assert consultation.fallback_used is False
        assert consultation.scholar_flag is False
        assert consultation.final_result_json is None
        assert consultation.error_message is None

    def test_consultation_case_relationship(self, db_session):
        """Test consultation → case relationship."""
        case = Case(
            title="Test Relationship",
            description="Testing the case relationship works correctly.",
            status="pending",
        )
        db_session.add(case)
        db_session.commit()

        consultation = MultiPassConsultation(case_id=case.id)
        db_session.add(consultation)
        db_session.commit()

        # Test forward relationship
        db_session.refresh(consultation)
        assert consultation.case is not None
        assert consultation.case.id == case.id
        assert consultation.case.title == "Test Relationship"

    def test_consultation_status_transitions(self, db_session):
        """Test updating consultation status through pipeline stages."""
        case = Case(
            title="Status Test",
            description="Testing status transitions work.",
            status="pending",
        )
        db_session.add(case)
        db_session.commit()

        consultation = MultiPassConsultation(case_id=case.id)
        db_session.add(consultation)
        db_session.commit()

        # Simulate pipeline progression
        consultation.status = MultiPassStatus.IN_PROGRESS.value
        consultation.started_at = datetime.utcnow()
        db_session.commit()
        assert consultation.status == "in_progress"

        consultation.passes_completed = 3
        db_session.commit()
        assert consultation.passes_completed == 3

        consultation.status = MultiPassStatus.COMPLETED.value
        consultation.completed_at = datetime.utcnow()
        consultation.total_duration_ms = 120000
        db_session.commit()

        assert consultation.status == "completed"
        assert consultation.total_duration_ms == 120000

    def test_consultation_failure_tracking(self, db_session):
        """Test failure tracking fields."""
        case = Case(
            title="Failure Test",
            description="Testing failure tracking works.",
            status="pending",
        )
        db_session.add(case)
        db_session.commit()

        consultation = MultiPassConsultation(
            case_id=case.id,
            status=MultiPassStatus.FAILED.value,
            failed_at_pass=2,
            error_message="Pass 2 critique timed out after 30s",
        )
        db_session.add(consultation)
        db_session.commit()

        assert consultation.status == "failed"
        assert consultation.failed_at_pass == 2
        assert "timed out" in consultation.error_message

    def test_consultation_fallback_tracking(self, db_session):
        """Test fallback reconstruction tracking."""
        case = Case(
            title="Fallback Test",
            description="Testing fallback tracking works.",
            status="pending",
        )
        db_session.add(case)
        db_session.commit()

        consultation = MultiPassConsultation(
            case_id=case.id,
            status=MultiPassStatus.COMPLETED.value,
            fallback_used=True,
            fallback_reason="Pass 4 JSON parse failed, reconstructed from Pass 3",
            scholar_flag=True,
            final_confidence=0.55,
        )
        db_session.add(consultation)
        db_session.commit()

        assert consultation.fallback_used is True
        assert "reconstructed" in consultation.fallback_reason
        assert consultation.scholar_flag is True
        assert consultation.final_confidence == 0.55


class TestMultiPassPassResponseModel:
    """Test MultiPassPassResponse model."""

    def test_create_pass_response(self, db_session):
        """Test creating a pass response record."""
        # Setup case and consultation
        case = Case(
            title="Pass Response Test",
            description="Testing pass response creation.",
            status="pending",
        )
        db_session.add(case)
        db_session.commit()

        consultation = MultiPassConsultation(case_id=case.id)
        db_session.add(consultation)
        db_session.commit()

        # Create pass response for Pass 1 (Draft)
        pass_response = MultiPassPassResponse(
            consultation_id=consultation.id,
            pass_number=1,
            pass_name=PassName.DRAFT.value,
            input_text="Case context and verses...",
            output_text="The ethical tension here involves...",
            status=PassStatus.SUCCESS.value,
            temperature=0.65,
            max_tokens=2000,
            duration_ms=45000,
            tokens_used=1500,
            prompt_version="1.0.0",
        )
        db_session.add(pass_response)
        db_session.commit()

        # Verify
        assert pass_response.id is not None
        assert pass_response.pass_number == 1
        assert pass_response.pass_name == "draft"
        assert pass_response.status == "success"
        assert pass_response.temperature == 0.65
        assert pass_response.duration_ms == 45000

    def test_pass_response_defaults(self, db_session):
        """Test default values for MultiPassPassResponse."""
        case = Case(
            title="Defaults Test",
            description="Testing defaults.",
            status="pending",
        )
        db_session.add(case)
        db_session.commit()

        consultation = MultiPassConsultation(case_id=case.id)
        db_session.add(consultation)
        db_session.commit()

        # Minimal creation
        pass_response = MultiPassPassResponse(
            consultation_id=consultation.id,
            pass_number=0,
            pass_name=PassName.ACCEPTANCE.value,
        )
        db_session.add(pass_response)
        db_session.commit()

        assert pass_response.status == "pending"
        assert pass_response.retry_count == 0
        assert pass_response.input_text is None
        assert pass_response.output_text is None
        assert pass_response.error_message is None

    def test_pass_response_consultation_relationship(self, db_session):
        """Test pass_response → consultation relationship."""
        case = Case(
            title="Relationship Test",
            description="Testing relationships.",
            status="pending",
        )
        db_session.add(case)
        db_session.commit()

        consultation = MultiPassConsultation(case_id=case.id)
        db_session.add(consultation)
        db_session.commit()

        pass_response = MultiPassPassResponse(
            consultation_id=consultation.id,
            pass_number=0,
            pass_name="acceptance",
        )
        db_session.add(pass_response)
        db_session.commit()

        # Test relationship
        db_session.refresh(pass_response)
        assert pass_response.consultation is not None
        assert pass_response.consultation.id == consultation.id

    def test_consultation_pass_responses_relationship(self, db_session):
        """Test consultation → pass_responses relationship (one-to-many)."""
        case = Case(
            title="One-to-Many Test",
            description="Testing one-to-many relationship.",
            status="pending",
        )
        db_session.add(case)
        db_session.commit()

        consultation = MultiPassConsultation(case_id=case.id)
        db_session.add(consultation)
        db_session.commit()

        # Create all 5 passes
        passes = [
            (0, "acceptance"),
            (1, "draft"),
            (2, "critique"),
            (3, "refine"),
            (4, "structure"),
        ]
        for pass_num, pass_name in passes:
            pr = MultiPassPassResponse(
                consultation_id=consultation.id,
                pass_number=pass_num,
                pass_name=pass_name,
                status=PassStatus.SUCCESS.value,
            )
            db_session.add(pr)
        db_session.commit()

        # Test relationship
        db_session.refresh(consultation)
        assert len(consultation.pass_responses) == 5

        # Verify ordering (should be by pass_number)
        for i, pr in enumerate(consultation.pass_responses):
            assert pr.pass_number == i

    def test_pass_response_error_tracking(self, db_session):
        """Test error tracking for failed passes."""
        case = Case(
            title="Error Test",
            description="Testing error tracking.",
            status="pending",
        )
        db_session.add(case)
        db_session.commit()

        consultation = MultiPassConsultation(case_id=case.id)
        db_session.add(consultation)
        db_session.commit()

        pass_response = MultiPassPassResponse(
            consultation_id=consultation.id,
            pass_number=4,
            pass_name="structure",
            status=PassStatus.ERROR.value,
            error_message="JSON parse error: Expecting ',' at position 245",
            retry_count=2,
        )
        db_session.add(pass_response)
        db_session.commit()

        assert pass_response.status == "error"
        assert "JSON parse error" in pass_response.error_message
        assert pass_response.retry_count == 2

    def test_pass_response_timeout_status(self, db_session):
        """Test timeout status for pass responses."""
        case = Case(
            title="Timeout Test",
            description="Testing timeout status.",
            status="pending",
        )
        db_session.add(case)
        db_session.commit()

        consultation = MultiPassConsultation(case_id=case.id)
        db_session.add(consultation)
        db_session.commit()

        pass_response = MultiPassPassResponse(
            consultation_id=consultation.id,
            pass_number=1,
            pass_name="draft",
            status=PassStatus.TIMEOUT.value,
            error_message="Pass exceeded timeout of 60000ms",
            duration_ms=60500,  # Slightly over timeout
        )
        db_session.add(pass_response)
        db_session.commit()

        assert pass_response.status == "timeout"
        assert pass_response.duration_ms > 60000

    def test_pass_response_json_output(self, db_session):
        """Test JSON output storage for Pass 0 and Pass 4."""
        case = Case(
            title="JSON Test",
            description="Testing JSON output storage.",
            status="pending",
        )
        db_session.add(case)
        db_session.commit()

        consultation = MultiPassConsultation(case_id=case.id)
        db_session.add(consultation)
        db_session.commit()

        # Pass 0 JSON output (acceptance result)
        pass_0 = MultiPassPassResponse(
            consultation_id=consultation.id,
            pass_number=0,
            pass_name="acceptance",
            status=PassStatus.SUCCESS.value,
            output_json={"accept": True, "reason": "Valid ethical dilemma", "category": "accepted"},
        )
        db_session.add(pass_0)
        db_session.commit()

        db_session.refresh(pass_0)
        assert pass_0.output_json["accept"] is True
        assert pass_0.output_json["category"] == "accepted"


class TestCascadeDelete:
    """Test cascade delete behavior."""

    def test_delete_consultation_cascades_to_pass_responses(self, db_session):
        """Test that deleting consultation deletes all pass responses."""
        case = Case(
            title="Cascade Test",
            description="Testing cascade delete.",
            status="pending",
        )
        db_session.add(case)
        db_session.commit()

        consultation = MultiPassConsultation(case_id=case.id)
        db_session.add(consultation)
        db_session.commit()

        # Add pass responses
        for i in range(5):
            pr = MultiPassPassResponse(
                consultation_id=consultation.id,
                pass_number=i,
                pass_name=["acceptance", "draft", "critique", "refine", "structure"][i],
            )
            db_session.add(pr)
        db_session.commit()

        # Verify they exist
        assert (
            db_session.query(MultiPassPassResponse)
            .filter_by(consultation_id=consultation.id)
            .count()
            == 5
        )

        # Delete consultation
        consultation_id = consultation.id
        db_session.delete(consultation)
        db_session.commit()

        # Verify pass responses are deleted
        assert (
            db_session.query(MultiPassPassResponse)
            .filter_by(consultation_id=consultation_id)
            .count()
            == 0
        )

    @requires_postgresql
    def test_delete_case_cascades_to_consultations(self, db_session):
        """Test that deleting case deletes all consultations.

        Note: This test is skipped on SQLite because it doesn't enforce
        ON DELETE CASCADE properly. In production (PostgreSQL), the cascade
        works correctly.
        """
        case = Case(
            title="Case Cascade Test",
            description="Testing case cascade delete.",
            status="pending",
        )
        db_session.add(case)
        db_session.commit()
        case_id = case.id

        consultation = MultiPassConsultation(case_id=case.id)
        db_session.add(consultation)
        db_session.commit()

        # Delete case
        db_session.delete(case)
        db_session.commit()

        # Verify consultation is deleted
        assert (
            db_session.query(MultiPassConsultation).filter_by(case_id=case_id).count()
            == 0
        )
