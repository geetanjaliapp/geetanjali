"""Tests for Pass 0 (Acceptance) validation in multi-pass pipeline.

Tests cover:
- Stage 1 heuristic checks (length, spam, dilemma markers)
- Stage 2 LLM meta-assessment (mocked)
- Edge cases and boundary conditions
"""

import pytest

from services.rag.multipass.acceptance import (
    AcceptanceResult,
    RejectionCategory,
    _check_dilemma_markers,
    _check_length,
    _check_spam_patterns,
    _is_likely_english,
    run_acceptance_pass,
    run_stage1_heuristics,
)

# Mark all tests as unit tests (no DB required)
pytestmark = pytest.mark.unit


class TestLengthChecks:
    """Test length validation."""

    def test_too_short(self):
        """Reject text under 50 characters."""
        passed, error = _check_length("Short text")
        assert not passed
        assert "Too short" in error

    def test_too_long(self):
        """Reject text over 5000 characters."""
        long_text = "a" * 5001
        passed, error = _check_length(long_text)
        assert not passed
        assert "Too long" in error

    def test_minimum_boundary(self):
        """Accept text at exactly 50 characters."""
        text = "a" * 50
        passed, error = _check_length(text)
        assert passed
        assert error is None

    def test_maximum_boundary(self):
        """Accept text at exactly 5000 characters."""
        text = "a" * 5000
        passed, error = _check_length(text)
        assert passed
        assert error is None

    def test_normal_length(self):
        """Accept text of normal length."""
        text = "This is a normal length text for an ethical dilemma description."
        passed, error = _check_length(text)
        assert passed
        assert error is None


class TestSpamPatterns:
    """Test spam detection."""

    def test_repeated_characters(self):
        """Reject text with excessive repeated characters."""
        text = "This has aaaaaaaaaaaaaa repeated characters"
        passed, error = _check_spam_patterns(text)
        assert not passed
        assert "repeated characters" in error

    def test_excessive_uppercase(self):
        """Reject text with excessive consecutive uppercase (not repeated same char)."""
        # Use different uppercase letters to avoid repeated char detection
        text = "This has ABCDEFGHIJKLMNOPQRSTUVWXYZ uppercase words"
        passed, error = _check_spam_patterns(text)
        assert not passed
        assert "uppercase" in error

    def test_excessive_special_chars(self):
        """Reject text with excessive consecutive special characters (varied)."""
        # Use different special chars to avoid repeated char detection
        text = "This has !@#$%^&*()!@#$ special characters mixed"
        passed, error = _check_spam_patterns(text)
        assert not passed
        assert "special characters" in error

    def test_low_diversity_spam(self):
        """Reject text with very low word diversity."""
        text = " ".join(["spam"] * 30)  # 30 identical words
        passed, error = _check_spam_patterns(text)
        assert not passed
        assert "repetitive" in error

    def test_normal_text(self):
        """Accept normal text without spam patterns."""
        text = "This is a normal ethical dilemma about work-life balance."
        passed, error = _check_spam_patterns(text)
        assert passed
        assert error is None


class TestLocaleDetection:
    """Test English/non-English text detection."""

    def test_english_text_detected(self):
        """Detect English text correctly."""
        text = "This is a clear English sentence about an ethical dilemma."
        assert _is_likely_english(text) is True

    def test_hindi_text_detected(self):
        """Detect Hindi (Devanagari) text as non-English."""
        text = "मैं एक नैतिक दुविधा में फंसा हुआ हूं और मुझे मदद चाहिए।"
        assert _is_likely_english(text) is False

    def test_tamil_text_detected(self):
        """Detect Tamil text as non-English."""
        text = "நான் ஒரு நெறிமுறை இக்கட்டான நிலையில் இருக்கிறேன்."
        assert _is_likely_english(text) is False

    def test_mixed_english_hindi(self):
        """Mixed text with significant Hindi detected as non-English."""
        text = "My family कहती है कि मुझे यह करना चाहिए but I'm not sure."
        # This has significant non-ASCII, should be detected as non-English
        assert _is_likely_english(text) is False

    def test_empty_text_defaults_english(self):
        """Empty text defaults to English handling."""
        assert _is_likely_english("") is True

    def test_numbers_only_defaults_english(self):
        """Text with only numbers defaults to English handling."""
        assert _is_likely_english("12345 67890") is True


class TestLocaleAwareHeuristics:
    """Test that dilemma markers bypass non-English text."""

    def test_hindi_bypasses_english_heuristics(self):
        """Hindi text bypasses English-specific heuristics (passes through)."""
        # This Hindi text wouldn't match English patterns, but should pass
        # so LLM Stage 2 can evaluate it
        text = "मेरे परिवार में एक बड़ी समस्या है। मुझे निर्णय लेना है।" * 3
        passed, error = _check_dilemma_markers(text)
        assert passed is True
        assert error is None

    def test_tamil_bypasses_english_heuristics(self):
        """Tamil text bypasses English-specific heuristics."""
        text = "என் குடும்பத்தில் ஒரு பெரிய பிரச்சனை உள்ளது." * 3
        passed, error = _check_dilemma_markers(text)
        assert passed is True
        assert error is None


class TestDilemmaMarkers:
    """Test ethical dilemma marker detection."""

    def test_valid_dilemma_all_markers(self):
        """Accept text with stakeholders, tension, and decision markers."""
        text = (
            "My family expects me to take over the business, but I feel torn "
            "between my duty to them and my own career aspirations. Should I "
            "sacrifice my dreams for their expectations?"
        )
        passed, error = _check_dilemma_markers(text)
        assert passed
        assert error is None

    def test_valid_dilemma_work_context(self):
        """Accept work-related ethical dilemma."""
        text = (
            "My boss asked me to present misleading numbers to investors. "
            "I'm struggling with whether I should comply or risk my job. "
            "What is the right thing to do in this situation?"
        )
        passed, error = _check_dilemma_markers(text)
        assert passed
        assert error is None

    def test_factual_question_rejected(self):
        """Reject factual/technical questions without ethical tension."""
        text = "What is the capital of France? I need this information for my homework."
        passed, error = _check_dilemma_markers(text)
        assert not passed
        assert "No clear ethical dilemma" in error

    def test_simple_request_rejected(self):
        """Reject simple requests without dilemma markers."""
        text = "Please help me write a cover letter for a software engineering job."
        passed, error = _check_dilemma_markers(text)
        assert not passed
        assert "No clear ethical dilemma" in error

    def test_minimal_dilemma_accepted(self):
        """Accept dilemma with minimum required markers."""
        text = (
            "I need to decide whether to tell my friend the truth about "
            "something that might hurt them. What should I do?"
        )
        passed, error = _check_dilemma_markers(text)
        assert passed
        assert error is None


class TestStage1Heuristics:
    """Test full Stage 1 heuristic pipeline."""

    def test_valid_dilemma_passes(self):
        """Valid ethical dilemma passes Stage 1."""
        text = (
            "My colleague is taking credit for my work, but speaking up might "
            "damage our team's relationship. I feel torn between honesty and "
            "maintaining harmony. Should I confront them or let it go?"
        )
        result = run_stage1_heuristics(text)
        assert result.accepted
        assert result.category == RejectionCategory.ACCEPTED
        assert result.stage_failed is None

    def test_too_short_fails(self):
        """Too short text fails Stage 1."""
        result = run_stage1_heuristics("Help me")
        assert not result.accepted
        assert result.category == RejectionCategory.FORMAT_ERROR
        assert result.stage_failed == 1

    def test_spam_fails(self):
        """Spam text fails Stage 1."""
        result = run_stage1_heuristics("This has aaaaaaaaaaaaaaa repeated text aaaaaaaaaaaaaaa")
        assert not result.accepted
        assert result.category == RejectionCategory.FORMAT_ERROR
        assert result.stage_failed == 1

    def test_no_dilemma_fails(self):
        """Non-dilemma text fails Stage 1."""
        text = "What is the weather forecast for tomorrow in New York City?"
        result = run_stage1_heuristics(text)
        assert not result.accepted
        assert result.category == RejectionCategory.NOT_DILEMMA
        assert result.stage_failed == 1


class TestAcceptanceResult:
    """Test AcceptanceResult dataclass."""

    def test_accepted_result(self):
        """Test creating accepted result."""
        result = AcceptanceResult(
            accepted=True,
            category=RejectionCategory.ACCEPTED,
            reason="Case accepted for consultation",
        )
        assert result.accepted
        assert result.category == RejectionCategory.ACCEPTED
        assert result.stage_failed is None

    def test_rejected_result(self):
        """Test creating rejected result."""
        result = AcceptanceResult(
            accepted=False,
            category=RejectionCategory.NOT_DILEMMA,
            reason="This is a factual question",
            stage_failed=1,
        )
        assert not result.accepted
        assert result.category == RejectionCategory.NOT_DILEMMA
        assert result.stage_failed == 1


class TestRejectionCategory:
    """Test RejectionCategory enum values."""

    def test_all_categories_exist(self):
        """All expected categories exist."""
        assert RejectionCategory.ACCEPTED.value == "accepted"
        assert RejectionCategory.NOT_DILEMMA.value == "not_dilemma"
        assert RejectionCategory.UNETHICAL_CORE.value == "unethical_core"
        assert RejectionCategory.TOO_VAGUE.value == "too_vague"
        assert RejectionCategory.HARMFUL_INTENT.value == "harmful_intent"
        assert RejectionCategory.FORMAT_ERROR.value == "format_error"


@pytest.mark.asyncio
class TestRunAcceptancePass:
    """Test main acceptance pass entry point."""

    async def test_stage1_only_valid(self):
        """Valid dilemma passes with Stage 1 only (no LLM)."""
        text = (
            "My manager wants me to fire a team member who is underperforming "
            "but going through a difficult personal situation. I'm torn between "
            "my responsibility to the company and compassion for this person. "
            "What should I do?"
        )
        result = await run_acceptance_pass(text, llm_service=None)
        assert result.accepted
        assert result.category == RejectionCategory.ACCEPTED

    async def test_stage1_only_invalid(self):
        """Invalid text fails Stage 1 (no LLM needed)."""
        text = "Hi"  # Too short
        result = await run_acceptance_pass(text, llm_service=None)
        assert not result.accepted
        assert result.category == RejectionCategory.FORMAT_ERROR
        assert result.stage_failed == 1

    async def test_skip_llm_flag(self):
        """skip_llm=True skips Stage 2 even with LLM service."""
        text = (
            "My colleague plagiarized my work. I'm conflicted about whether "
            "to report them or handle it privately. What is the ethical path?"
        )

        class MockLLM:
            def generate(self, **kwargs):
                raise AssertionError("LLM should not be called")

        result = await run_acceptance_pass(text, llm_service=MockLLM(), skip_llm=True)
        assert result.accepted
        assert result.stage_failed is None


@pytest.mark.asyncio
class TestStage2LLMAssessment:
    """Test Stage 2 LLM meta-assessment."""

    async def test_llm_accepts(self):
        """LLM accepts valid dilemma."""
        from services.rag.multipass.acceptance import run_stage2_llm_assessment

        class MockLLM:
            def generate(self, **kwargs):
                return {
                    "text": '{"accept": true, "category": "accepted", "reason": "Valid ethical dilemma"}'
                }

        text = "Should I report my colleague for misconduct even though they are my friend?"
        result = await run_stage2_llm_assessment(text, MockLLM())
        assert result.accepted
        assert result.category == RejectionCategory.ACCEPTED

    async def test_llm_rejects_not_dilemma(self):
        """LLM rejects factual question."""
        from services.rag.multipass.acceptance import run_stage2_llm_assessment

        class MockLLM:
            def generate(self, **kwargs):
                return {
                    "text": '{"accept": false, "category": "not_dilemma", "reason": "This is a factual question"}'
                }

        text = "What is the best programming language to learn?"
        result = await run_stage2_llm_assessment(text, MockLLM())
        assert not result.accepted
        assert result.category == RejectionCategory.NOT_DILEMMA
        assert result.stage_failed == 2

    async def test_llm_rejects_unethical(self):
        """LLM rejects unethical request."""
        from services.rag.multipass.acceptance import run_stage2_llm_assessment

        class MockLLM:
            def generate(self, **kwargs):
                return {
                    "text": '{"accept": false, "category": "unethical_core", "reason": "Request involves fraud"}'
                }

        text = "How can I deceive my investors about our financial situation?"
        result = await run_stage2_llm_assessment(text, MockLLM())
        assert not result.accepted
        assert result.category == RejectionCategory.UNETHICAL_CORE

    async def test_llm_parse_failure_accepts(self):
        """LLM parse failure defaults to acceptance (fail open)."""
        from services.rag.multipass.acceptance import run_stage2_llm_assessment

        class MockLLM:
            def generate(self, **kwargs):
                return {"text": "This is not valid JSON at all!!!"}

        text = "Ethical dilemma about work"
        result = await run_stage2_llm_assessment(text, MockLLM())
        assert result.accepted  # Fail open
        assert "parse failed" in result.reason.lower()

    async def test_llm_exception_accepts(self):
        """LLM exception defaults to acceptance (fail open)."""
        from services.rag.multipass.acceptance import run_stage2_llm_assessment

        class MockLLM:
            def generate(self, **kwargs):
                raise RuntimeError("LLM service unavailable")

        text = "Ethical dilemma about work"
        result = await run_stage2_llm_assessment(text, MockLLM())
        assert result.accepted  # Fail open
        assert "failed" in result.reason.lower()
