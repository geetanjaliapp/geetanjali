"""Tests for Passes 1-4 in multi-pass consultation pipeline.

Tests cover:
- Prompt building functions
- Pass execution with mocked LLM
- Error handling (timeout, parse errors)
- Fallback behavior
"""

import json

import pytest

from services.rag.multipass.passes import (
    PassResult,
    PassStatus,
    _extract_text,
    _extract_tokens,
    _validate_structure_output,
    run_critique_pass,
    run_draft_pass,
    run_refine_pass,
    run_structure_pass,
)
from services.rag.multipass.prompts import (
    build_critique_prompt,
    build_draft_prompt,
    build_refine_prompt,
    build_structure_prompt,
    format_verses_for_prompt,
)

# Mark all tests as unit tests (no DB required)
pytestmark = pytest.mark.unit


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def sample_case():
    """Sample case data for testing."""
    return {
        "title": "Work-Life Balance Dilemma",
        "description": (
            "My company is asking me to relocate for a promotion, but my spouse "
            "has a successful career here. I'm torn between my professional "
            "advancement and our family stability. What should I do?"
        ),
    }


@pytest.fixture
def sample_verses():
    """Sample retrieved verses for testing."""
    return [
        {
            "canonical_id": "BG_2_47",
            "document": "You have a right to perform your duty...",
            "metadata": {
                "translation_en": "You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions.",
                "chapter": 2,
                "verse": 47,
            },
        },
        {
            "canonical_id": "BG_3_35",
            "document": "It is far better to perform one's own duties...",
            "metadata": {
                "translation_en": "It is far better to perform one's own duties imperfectly than to perform another's duties perfectly.",
                "chapter": 3,
                "verse": 35,
            },
        },
    ]


@pytest.fixture
def sample_draft():
    """Sample draft output for testing Pass 2 and 3."""
    return """
    The core tension in this dilemma involves balancing professional growth
    against family stability. On one hand, the promotion represents career
    advancement and recognition of your contributions. On the other hand,
    relocating could disrupt your spouse's career and family life.

    **Path A: Accept the Promotion**
    This path honors your professional dharma and the recognition of your work.
    As BG_2_47 teaches, you have a right to perform your duties.

    **Path B: Decline and Stay**
    This path prioritizes family stability and your spouse's career.
    Following BG_3_35, you might focus on performing your current role excellently.

    **Path C: Negotiate a Compromise**
    Explore alternatives like remote work, delayed relocation, or a commuting arrangement.
    This balances both dharmas without forcing an all-or-nothing choice.

    Each path has its merits. The right choice depends on your core values
    and which dharma weighs most heavily in your situation.
    """


@pytest.fixture
def sample_critique():
    """Sample critique output for testing Pass 3."""
    return """
    - ISSUE: Options A and B are somewhat generic - "accept" vs "decline" is obvious
      FIX: Add more specific guidance on how to evaluate the decision

    - ISSUE: Verse connections are superficial - just mentioned, not applied
      FIX: Explain HOW the verses inform each specific path

    - ISSUE: Missing stakeholder perspective - spouse's view not explored
      FIX: Include what the spouse might be experiencing and their dharma

    - ISSUE: Implementation steps are vague
      FIX: Provide concrete first steps for each path
    """


# ============================================================================
# Test Prompt Building
# ============================================================================

class TestFormatVersesForPrompt:
    """Test verse formatting for prompts."""

    def test_empty_verses(self):
        """Handle empty verse list gracefully."""
        result = format_verses_for_prompt([])
        assert "No specific verses" in result

    def test_verses_with_translation(self, sample_verses):
        """Format verses with translation metadata."""
        result = format_verses_for_prompt(sample_verses)
        assert "BG_2_47" in result
        assert "BG_3_35" in result
        assert "right to perform" in result

    def test_verses_without_metadata(self):
        """Handle verses without metadata."""
        verses = [
            {"canonical_id": "BG_1_1", "document": "Test verse content"},
        ]
        result = format_verses_for_prompt(verses)
        assert "BG_1_1" in result
        assert "Test verse content" in result


class TestBuildDraftPrompt:
    """Test draft prompt building."""

    def test_build_draft_prompt(self, sample_case, sample_verses):
        """Build draft prompt with all fields."""
        system, user = build_draft_prompt(
            sample_case["title"],
            sample_case["description"],
            sample_verses,
        )
        assert "ethical consultant" in system.lower()
        assert sample_case["title"] in user
        assert sample_case["description"] in user
        assert "BG_2_47" in user


class TestBuildCritiquePrompt:
    """Test critique prompt building."""

    def test_build_critique_prompt(self, sample_case, sample_draft):
        """Build critique prompt with draft."""
        system, user = build_critique_prompt(
            sample_case["title"],
            sample_case["description"],
            sample_draft,
        )
        assert "critic" in system.lower()
        assert sample_draft in user
        assert "ISSUE" in user


class TestBuildRefinePrompt:
    """Test refine prompt building."""

    def test_build_refine_prompt(self, sample_case, sample_draft, sample_critique):
        """Build refine prompt with draft and critique."""
        system, user = build_refine_prompt(
            sample_case["title"],
            sample_case["description"],
            sample_draft,
            sample_critique,
        )
        assert "editor" in system.lower()
        assert sample_draft in user
        assert sample_critique in user


class TestBuildStructurePrompt:
    """Test structure prompt building."""

    def test_build_structure_prompt(self, sample_draft):
        """Build structure prompt for JSON conversion."""
        system, user = build_structure_prompt(sample_draft)
        assert "JSON" in system
        assert sample_draft in user
        assert "executive_summary" in user
        assert "options" in user


# ============================================================================
# Test Helper Functions
# ============================================================================

class TestExtractText:
    """Test text extraction from LLM responses."""

    def test_extract_from_dict_text(self):
        """Extract text from dict with 'text' key."""
        result = _extract_text({"text": "Hello world"})
        assert result == "Hello world"

    def test_extract_from_dict_content(self):
        """Extract text from dict with 'content' key."""
        result = _extract_text({"content": "Hello world"})
        assert result == "Hello world"

    def test_extract_from_string(self):
        """Extract text from string response."""
        result = _extract_text("Hello world")
        assert result == "Hello world"

    def test_extract_from_none(self):
        """Handle None response."""
        result = _extract_text(None)
        assert result == ""


class TestExtractTokens:
    """Test token extraction from LLM responses."""

    def test_extract_tokens_used(self):
        """Extract tokens_used from response."""
        result = _extract_tokens({"tokens_used": 150})
        assert result == 150

    def test_extract_usage_total(self):
        """Extract from usage.total_tokens."""
        result = _extract_tokens({"usage": {"total_tokens": 200}})
        assert result == 200

    def test_extract_no_tokens(self):
        """Handle response without token info."""
        result = _extract_tokens({"text": "Hello"})
        assert result is None


class TestValidateStructureOutput:
    """Test JSON output validation."""

    def test_valid_output(self):
        """Valid output passes validation."""
        output = {
            "executive_summary": "Summary text",
            "options": [
                {"title": "Option 1", "description": "Desc 1", "pros": [], "cons": [], "sources": []},
                {"title": "Option 2", "description": "Desc 2", "pros": [], "cons": [], "sources": []},
                {"title": "Option 3", "description": "Desc 3", "pros": [], "cons": [], "sources": []},
            ],
            "recommended_action": {"option": 1, "steps": [], "sources": []},
            "reflection_prompts": ["Question 1"],
            "sources": [],
            "confidence": 0.75,
        }
        errors = _validate_structure_output(output)
        assert errors == []

    def test_missing_required_field(self):
        """Detect missing required field."""
        output = {"executive_summary": "Summary"}
        errors = _validate_structure_output(output)
        assert any("options" in e for e in errors)

    def test_insufficient_options(self):
        """Detect insufficient options."""
        output = {
            "executive_summary": "Summary",
            "options": [{"title": "Option 1", "description": "Desc"}],
            "recommended_action": {"option": 1},
            "reflection_prompts": [],
            "sources": [],
            "confidence": 0.75,
        }
        errors = _validate_structure_output(output)
        assert any("Need 3 options" in e for e in errors)

    def test_invalid_confidence(self):
        """Detect invalid confidence value."""
        output = {
            "executive_summary": "Summary",
            "options": [
                {"title": "O1", "description": "D1"},
                {"title": "O2", "description": "D2"},
                {"title": "O3", "description": "D3"},
            ],
            "recommended_action": {"option": 1},
            "reflection_prompts": [],
            "sources": [],
            "confidence": 1.5,  # Invalid
        }
        errors = _validate_structure_output(output)
        assert any("confidence" in e.lower() for e in errors)


# ============================================================================
# Test PassResult
# ============================================================================

class TestPassResult:
    """Test PassResult dataclass."""

    def test_success_result(self):
        """Create successful pass result."""
        result = PassResult(
            pass_number=1,
            pass_name="draft",
            status=PassStatus.SUCCESS,
            output_text="Draft output",
            duration_ms=1500,
        )
        assert result.pass_number == 1
        assert result.status == PassStatus.SUCCESS
        assert result.error_message is None

    def test_error_result(self):
        """Create error pass result."""
        result = PassResult(
            pass_number=4,
            pass_name="structure",
            status=PassStatus.ERROR,
            error_message="JSON parse failed",
        )
        assert result.status == PassStatus.ERROR
        assert "JSON" in result.error_message


# ============================================================================
# Test Pass Execution (with mocked LLM)
# ============================================================================

class MockLLM:
    """Mock LLM service for testing.

    Note: The real LLM service has a synchronous generate() method,
    so this mock must also be synchronous.
    """

    def __init__(self, response_text: str, raise_error: Exception | None = None):
        self.response_text = response_text
        self.raise_error = raise_error
        self.calls = []

    def generate(self, **kwargs):
        self.calls.append(kwargs)
        if self.raise_error:
            raise self.raise_error
        return {"text": self.response_text}


@pytest.mark.asyncio
class TestRunDraftPass:
    """Test Pass 1 (Draft) execution."""

    async def test_successful_draft(self, sample_case, sample_verses):
        """Successful draft generation."""
        mock_llm = MockLLM(response_text="A" * 200)  # Long enough output
        result = await run_draft_pass(
            sample_case["title"],
            sample_case["description"],
            sample_verses,
            mock_llm,
        )
        assert result.status == PassStatus.SUCCESS
        assert result.output_text == "A" * 200
        assert result.duration_ms is not None

    async def test_draft_too_short(self, sample_case, sample_verses):
        """Draft too short triggers error."""
        mock_llm = MockLLM(response_text="Short")
        result = await run_draft_pass(
            sample_case["title"],
            sample_case["description"],
            sample_verses,
            mock_llm,
        )
        assert result.status == PassStatus.ERROR
        assert "too short" in result.error_message.lower()

    async def test_draft_timeout(self, sample_case, sample_verses):
        """Draft timeout handling."""
        mock_llm = MockLLM(response_text="", raise_error=TimeoutError("Timeout"))
        result = await run_draft_pass(
            sample_case["title"],
            sample_case["description"],
            sample_verses,
            mock_llm,
        )
        assert result.status == PassStatus.TIMEOUT

    async def test_draft_exception(self, sample_case, sample_verses):
        """Draft exception handling."""
        mock_llm = MockLLM(response_text="", raise_error=RuntimeError("Service error"))
        result = await run_draft_pass(
            sample_case["title"],
            sample_case["description"],
            sample_verses,
            mock_llm,
        )
        assert result.status == PassStatus.ERROR


@pytest.mark.asyncio
class TestRunCritiquePass:
    """Test Pass 2 (Critique) execution."""

    async def test_successful_critique(self, sample_case, sample_draft):
        """Successful critique generation."""
        mock_llm = MockLLM(response_text="ISSUE: Test issue\nFIX: Test fix")
        result = await run_critique_pass(
            sample_case["title"],
            sample_case["description"],
            sample_draft,
            mock_llm,
        )
        assert result.status == PassStatus.SUCCESS
        assert "ISSUE" in result.output_text

    async def test_empty_critique_is_ok(self, sample_case, sample_draft):
        """Empty critique is acceptable (draft was good)."""
        mock_llm = MockLLM(response_text="")
        result = await run_critique_pass(
            sample_case["title"],
            sample_case["description"],
            sample_draft,
            mock_llm,
        )
        assert result.status == PassStatus.SUCCESS
        assert "No significant issues" in result.output_text

    async def test_critique_timeout_skips(self, sample_case, sample_draft):
        """Critique timeout results in SKIPPED (not ERROR)."""
        mock_llm = MockLLM(response_text="", raise_error=TimeoutError("Timeout"))
        result = await run_critique_pass(
            sample_case["title"],
            sample_case["description"],
            sample_draft,
            mock_llm,
        )
        assert result.status == PassStatus.SKIPPED
        assert "skipped" in result.output_text.lower()


@pytest.mark.asyncio
class TestRunRefinePass:
    """Test Pass 3 (Refine) execution."""

    async def test_successful_refine(self, sample_case, sample_draft, sample_critique):
        """Successful refine generation."""
        refined_text = "Refined " + sample_draft
        mock_llm = MockLLM(response_text=refined_text)
        result = await run_refine_pass(
            sample_case["title"],
            sample_case["description"],
            sample_draft,
            sample_critique,
            mock_llm,
        )
        assert result.status == PassStatus.SUCCESS
        assert "Refined" in result.output_text

    async def test_refine_fallback_to_draft(self, sample_case, sample_draft, sample_critique):
        """Refine falls back to draft on short output."""
        mock_llm = MockLLM(response_text="Too short")
        result = await run_refine_pass(
            sample_case["title"],
            sample_case["description"],
            sample_draft,
            sample_critique,
            mock_llm,
        )
        assert result.status == PassStatus.ERROR
        assert result.output_text == sample_draft  # Fallback
        assert result.metadata.get("fallback_to_draft") is True

    async def test_refine_timeout_fallback(self, sample_case, sample_draft, sample_critique):
        """Refine timeout falls back to draft."""
        mock_llm = MockLLM(response_text="", raise_error=TimeoutError("Timeout"))
        result = await run_refine_pass(
            sample_case["title"],
            sample_case["description"],
            sample_draft,
            sample_critique,
            mock_llm,
        )
        assert result.status == PassStatus.TIMEOUT
        assert result.output_text == sample_draft  # Fallback


@pytest.mark.asyncio
class TestRunStructurePass:
    """Test Pass 4 (Structure) execution."""

    async def test_successful_structure(self):
        """Successful JSON structure generation."""
        valid_json = json.dumps({
            "suggested_title": "Test Dilemma",
            "executive_summary": "Summary text here",
            "options": [
                {"title": "Option 1", "description": "Desc 1", "pros": ["pro1"], "cons": ["con1"], "sources": ["BG_2_47"]},
                {"title": "Option 2", "description": "Desc 2", "pros": ["pro2"], "cons": ["con2"], "sources": ["BG_3_35"]},
                {"title": "Option 3", "description": "Desc 3", "pros": ["pro3"], "cons": ["con3"], "sources": ["BG_2_47"]},
            ],
            "recommended_action": {"option": 1, "steps": ["Step 1"], "sources": ["BG_2_47"]},
            "reflection_prompts": ["Question 1", "Question 2"],
            "sources": [{"canonical_id": "BG_2_47", "paraphrase": "Test", "relevance": 0.9}],
            "confidence": 0.8,
            "scholar_flag": False,
        })
        mock_llm = MockLLM(response_text=valid_json)
        result = await run_structure_pass("Refined prose here", mock_llm)
        assert result.status == PassStatus.SUCCESS
        assert result.output_json is not None
        assert result.output_json["confidence"] == 0.8

    async def test_structure_invalid_json(self):
        """Invalid JSON triggers error."""
        mock_llm = MockLLM(response_text="This is not valid JSON at all")
        result = await run_structure_pass("Refined prose", mock_llm)
        assert result.status == PassStatus.ERROR
        assert "JSON parse error" in result.error_message

    async def test_structure_validation_fails(self):
        """JSON that fails validation triggers error."""
        invalid_output = json.dumps({
            "executive_summary": "Summary",
            "options": [],  # Not enough options
            "confidence": 0.5,
        })
        mock_llm = MockLLM(response_text=invalid_output)
        result = await run_structure_pass("Refined prose", mock_llm)
        assert result.status == PassStatus.ERROR
        assert "Validation" in result.error_message

    async def test_structure_timeout(self):
        """Structure timeout handling."""
        mock_llm = MockLLM(response_text="", raise_error=TimeoutError("Timeout"))
        result = await run_structure_pass("Refined prose", mock_llm)
        assert result.status == PassStatus.TIMEOUT

    async def test_structure_retry_count(self):
        """Retry count is tracked."""
        valid_json = json.dumps({
            "suggested_title": "Test",
            "executive_summary": "Summary",
            "options": [
                {"title": "O1", "description": "D1"},
                {"title": "O2", "description": "D2"},
                {"title": "O3", "description": "D3"},
            ],
            "recommended_action": {"option": 1, "steps": []},
            "reflection_prompts": [],
            "sources": [],
            "confidence": 0.7,
        })
        mock_llm = MockLLM(response_text=valid_json)
        result = await run_structure_pass("Refined prose", mock_llm, retry_count=2)
        assert result.retry_count == 2
