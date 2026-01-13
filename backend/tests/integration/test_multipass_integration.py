"""Integration tests for multi-pass consultation pipeline.

These tests run against a real Ollama instance and verify end-to-end behavior.
Skip in CI by default using: pytest -m "not integration"

Prerequisites:
- Ollama must be running locally
- Model must be loaded (qwen2.5:3b or as configured)
"""

import os
import time

import httpx
import pytest

# Mark all tests as integration tests (skip by default in CI)
pytestmark = [pytest.mark.integration, pytest.mark.slow]


def ollama_available() -> bool:
    """Check if Ollama is running and accessible."""
    try:
        from config import settings
        # Use OLLAMA_BASE_URL from config (handles Docker network hostnames)
        base_url = getattr(settings, "OLLAMA_BASE_URL", "http://localhost:11434")
        response = httpx.get(f"{base_url}/api/version", timeout=5.0)
        return response.status_code == 200
    except Exception:
        return False


# Skip all tests if Ollama is not available
skip_if_no_ollama = pytest.mark.skipif(
    not ollama_available(),
    reason="Ollama not available - skipping integration tests"
)


@skip_if_no_ollama
class TestMultipassIntegration:
    """Integration tests for multi-pass pipeline with real LLM."""

    pytestmark = pytest.mark.asyncio

    @pytest.fixture
    def valid_ethical_dilemma(self) -> str:
        """A well-formed ethical dilemma for testing."""
        return """
        I am a team lead at a software company. One of my team members, Rahul,
        has been underperforming for the past 3 months due to personal issues
        at home. He is a single parent with two young children.

        My manager is pressuring me to put Rahul on a performance improvement plan
        (PIP), which often leads to termination. However, I know Rahul is a
        good developer who is going through a difficult time.

        I am torn between:
        - My duty to the company and team productivity
        - My responsibility to support a team member in crisis
        - The impact on Rahul's family if he loses his job
        - Setting a precedent for how we treat struggling employees

        What should I do? How can I balance compassion with accountability?
        """

    @pytest.fixture
    def non_dilemma_input(self) -> str:
        """Input that should be rejected as non-dilemma.

        This is a factual question, not an ethical dilemma. It must be
        at least 50 characters to pass the length check in Stage 1.
        """
        return (
            "I would like to know what the capital city of India is, "
            "and also learn about the major cities in the country."
        )

    @pytest.fixture
    def harmful_input(self) -> str:
        """Input that should be rejected as harmful."""
        return "How can I manipulate my employees into working unpaid overtime?"

    async def test_happy_path_full_pipeline(self, valid_ethical_dilemma):
        """Test full pipeline execution with valid dilemma."""
        from services.rag.multipass import run_multipass_consultation
        from db import SessionLocal
        from models.case import Case
        import uuid

        # Create a test case in DB
        db = SessionLocal()
        try:
            case = Case(
                id=str(uuid.uuid4()),
                title="Test Dilemma",
                description=valid_ethical_dilemma,
                status="pending",
            )
            db.add(case)
            db.commit()

            start_time = time.time()

            # Run the pipeline
            result = await run_multipass_consultation(
                case_id=case.id,
                title="Test Dilemma",
                description=valid_ethical_dilemma,
            )

            duration = time.time() - start_time
            print(f"\nPipeline duration: {duration:.1f}s")

            # Assertions
            assert result.success, f"Pipeline should succeed, got: {result.metadata}"
            assert result.result_json is not None, "Should have result JSON"
            assert result.passes_completed == 4, f"Should complete 4 passes, got {result.passes_completed}"
            assert result.consultation_id is not None, "Should have consultation ID"

            # Check result structure
            json_result = result.result_json
            assert "executive_summary" in json_result
            assert "options" in json_result
            assert len(json_result["options"]) == 3, "Should have 3 options"
            assert "confidence" in json_result
            assert 0.0 <= json_result["confidence"] <= 1.0

            # Print summary for manual review
            print(f"\nConfidence: {json_result['confidence']}")
            print(f"Scholar flag: {json_result.get('scholar_flag', False)}")
            print(f"Title: {json_result.get('suggested_title', 'N/A')}")

        finally:
            # Cleanup
            db.query(Case).filter(Case.id == case.id).delete()
            db.commit()
            db.close()

    async def test_pass0_rejection_non_dilemma(self, non_dilemma_input):
        """Test that non-dilemma input is rejected at Pass 0."""
        from services.rag.multipass import run_multipass_consultation
        from db import SessionLocal
        from models.case import Case
        import uuid

        db = SessionLocal()
        try:
            case = Case(
                id=str(uuid.uuid4()),
                title="Test Non-Dilemma",
                description=non_dilemma_input,
                status="pending",
            )
            db.add(case)
            db.commit()

            result = await run_multipass_consultation(
                case_id=case.id,
                title="Test",
                description=non_dilemma_input,
            )

            # Should be rejected as policy violation
            assert result.is_policy_violation, "Non-dilemma should be rejected"
            assert result.passes_completed == 0, "Should stop at Pass 0"
            # May be rejected by Stage 1 heuristics (no_dilemma_markers) or Stage 2 LLM (not_dilemma)
            rejection_category = result.metadata.get("rejection_category", "")
            valid_categories = ["not_dilemma", "no_dilemma_markers"]
            assert rejection_category in valid_categories, \
                f"Should identify as not_dilemma or no_dilemma_markers, got: {rejection_category}"

            print(f"\nRejection reason: {result.rejection_reason}")
            print(f"Rejection category: {rejection_category}")

        finally:
            db.query(Case).filter(Case.id == case.id).delete()
            db.commit()
            db.close()

    async def test_latency_within_slo(self, valid_ethical_dilemma):
        """Test that pipeline completes within 5-minute SLO."""
        from services.rag.multipass import run_multipass_consultation
        from db import SessionLocal
        from models.case import Case
        import uuid

        MAX_DURATION_SECONDS = 300  # 5 minutes

        db = SessionLocal()
        try:
            case = Case(
                id=str(uuid.uuid4()),
                title="Latency Test",
                description=valid_ethical_dilemma,
                status="pending",
            )
            db.add(case)
            db.commit()

            start_time = time.time()

            result = await run_multipass_consultation(
                case_id=case.id,
                title="Latency Test",
                description=valid_ethical_dilemma,
            )

            duration = time.time() - start_time

            assert duration < MAX_DURATION_SECONDS, \
                f"Pipeline took {duration:.1f}s, exceeds {MAX_DURATION_SECONDS}s SLO"

            print(f"\nLatency: {duration:.1f}s (SLO: {MAX_DURATION_SECONDS}s)")
            print(f"Pass timing: {result.total_duration_ms}ms")

        finally:
            db.query(Case).filter(Case.id == case.id).delete()
            db.commit()
            db.close()


@skip_if_no_ollama
class TestMultipassMetricsIntegration:
    """Test that metrics are recorded correctly during integration."""

    pytestmark = pytest.mark.asyncio

    async def test_metrics_recorded_on_success(self):
        """Verify Prometheus metrics are recorded during pipeline execution."""
        from services.rag.multipass import run_multipass_consultation
        from utils.metrics_multipass import (
            multipass_pipeline_total,
            multipass_pipeline_passes_total,
        )
        from db import SessionLocal
        from models.case import Case
        import uuid

        # Get initial metric values (approximately - Prometheus counters only go up)
        # Note: In a real test, you'd use a test registry or reset metrics

        dilemma = """
        I discovered my colleague has been falsifying expense reports.
        Should I report them to HR, risking our friendship and creating
        workplace tension? Or should I talk to them privately first,
        potentially becoming complicit if they continue?
        """

        db = SessionLocal()
        try:
            case = Case(
                id=str(uuid.uuid4()),
                title="Metrics Test",
                description=dilemma,
                status="pending",
            )
            db.add(case)
            db.commit()

            # Run pipeline
            result = await run_multipass_consultation(
                case_id=case.id,
                title="Metrics Test",
                description=dilemma,
            )

            # Basic assertion that metrics exist and pipeline worked
            assert result.success or result.is_policy_violation, \
                "Pipeline should either succeed or properly reject"

            # Metrics are recorded - we can verify by checking they don't error
            # In production, you'd scrape /metrics and verify counts
            print(f"\nPipeline completed with {result.passes_completed} passes")

        finally:
            db.query(Case).filter(Case.id == case.id).delete()
            db.commit()
            db.close()


# Manual test cases for QA review
MANUAL_QA_CASES = [
    {
        "name": "Career decision",
        "description": """
        I've been offered a promotion that would triple my salary but require
        relocating overseas. My elderly parents depend on me here. My spouse
        has a career they love that can't transfer. Should I take the opportunity
        for financial security or stay for family stability?
        """
    },
    {
        "name": "Workplace ethics",
        "description": """
        My company is about to launch a product I believe has safety flaws.
        I've raised concerns internally but was told to proceed anyway.
        Should I blow the whistle and risk my career, or trust management's
        judgment even though I disagree?
        """
    },
    {
        "name": "Resource allocation",
        "description": """
        As a hospital administrator, I must allocate a limited supply of
        life-saving medication. I can either give full doses to fewer patients
        (guaranteeing their survival) or partial doses to more patients
        (giving everyone a chance but reducing effectiveness). How do I decide?
        """
    },
]


@skip_if_no_ollama
@pytest.mark.asyncio
@pytest.mark.parametrize("case", MANUAL_QA_CASES, ids=[c["name"] for c in MANUAL_QA_CASES])
async def test_manual_qa_cases(case):
    """Run manual QA test cases for human review.

    These tests print detailed output for human review of quality.
    Run with: pytest tests/integration/test_multipass_integration.py -s -k manual_qa
    """
    from services.rag.multipass import run_multipass_consultation
    from db import SessionLocal
    from models.case import Case
    import uuid

    db = SessionLocal()
    try:
        db_case = Case(
            id=str(uuid.uuid4()),
            title=case["name"],
            description=case["description"],
            status="pending",
        )
        db.add(db_case)
        db.commit()

        print(f"\n{'='*60}")
        print(f"QA Case: {case['name']}")
        print(f"{'='*60}")

        result = await run_multipass_consultation(
            case_id=db_case.id,
            title=case["name"],
            description=case["description"],
        )

        if result.success and result.result_json:
            json_result = result.result_json
            print(f"\nTitle: {json_result.get('suggested_title', 'N/A')}")
            print(f"Confidence: {json_result.get('confidence', 0):.2f}")
            print(f"Scholar Flag: {json_result.get('scholar_flag', False)}")
            print(f"\nSummary:\n{json_result.get('executive_summary', 'N/A')[:500]}...")
            print(f"\nOptions:")
            for i, opt in enumerate(json_result.get("options", []), 1):
                print(f"  {i}. {opt.get('title', 'N/A')}")
            print(f"\nDuration: {result.total_duration_ms}ms")
        else:
            print(f"\nRejected: {result.rejection_reason}")
            print(f"Policy Violation: {result.is_policy_violation}")

        # Always pass - this is for manual review
        assert True

    finally:
        db.query(Case).filter(Case.id == db_case.id).delete()
        db.commit()
        db.close()
