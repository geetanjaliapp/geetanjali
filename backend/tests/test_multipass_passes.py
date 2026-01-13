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
    _normalize_structure_output,
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
        self.calls: list[dict] = []

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

    async def test_structure_normalization_recovers_incomplete_output(self):
        """Incomplete JSON is recovered through normalization."""
        # Previously this would fail validation, but now normalization
        # fills in missing fields so it succeeds
        incomplete_output = json.dumps({
            "executive_summary": "Summary",
            "options": [],  # Will be padded to 3 options
            "confidence": 0.5,
        })
        mock_llm = MockLLM(response_text=incomplete_output)
        result = await run_structure_pass("Refined prose", mock_llm)
        # Now succeeds because normalization pads to 3 options
        assert result.status == PassStatus.SUCCESS
        assert len(result.output_json["options"]) == 3

    async def test_structure_validation_fails_on_non_dict_option(self):
        """JSON with non-dict options fails validation."""
        # Normalization can't fix options that are completely wrong types
        invalid_output = json.dumps({
            "executive_summary": "Summary",
            "options": ["not a dict", "also not", "still not"],
            "recommended_action": {"option": 1},
            "reflection_prompts": [],
            "sources": [],
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


# ============================================================================
# Test _normalize_structure_output
# ============================================================================


class TestNormalizeStructureOutput:
    """Tests for output normalization to ensure schema conformance."""

    def test_adds_missing_sources_to_options(self):
        """Options without sources get empty sources array."""
        output = {
            "suggested_title": "Test",
            "executive_summary": "Summary",
            "options": [
                {"title": "O1", "description": "D1", "pros": ["p1"], "cons": ["c1"]},
                {"title": "O2", "description": "D2"},
                {"title": "O3", "description": "D3", "sources": ["BG_2_47"]},
            ],
            "recommended_action": {"option": 1},
            "reflection_prompts": ["Q1?"],
            "sources": [],
            "confidence": 0.7,
        }

        normalized = _normalize_structure_output(output)

        # First two options should have empty sources added
        assert normalized["options"][0]["sources"] == []
        assert normalized["options"][1]["sources"] == []
        # Third option already had sources - should be unchanged
        assert normalized["options"][2]["sources"] == ["BG_2_47"]

    def test_adds_missing_pros_cons_to_options(self):
        """Options without pros/cons get default arrays (not empty)."""
        output = {
            "options": [
                {"title": "O1", "description": "D1"},
            ],
            "recommended_action": {"option": 1},
            "confidence": 0.7,
        }

        normalized = _normalize_structure_output(output)

        # Now adds meaningful defaults instead of empty arrays
        assert len(normalized["options"][0]["pros"]) >= 1
        assert len(normalized["options"][0]["cons"]) >= 1
        assert normalized["options"][0]["sources"] == []

    def test_adds_missing_recommended_action_fields(self):
        """Recommended action gets missing sources and steps with defaults."""
        output = {
            "options": [],
            "recommended_action": {"option": 1},
            "confidence": 0.7,
        }

        normalized = _normalize_structure_output(output)

        # Sources remain empty (no default sources without context)
        assert normalized["recommended_action"]["sources"] == []
        # Steps get default guidance when empty
        assert len(normalized["recommended_action"]["steps"]) >= 1
        assert "reflect" in normalized["recommended_action"]["steps"][0].lower()

    def test_adds_scholar_flag_based_on_confidence(self):
        """Scholar flag defaults based on confidence level."""
        # High confidence - no flag
        high_conf = _normalize_structure_output({"confidence": 0.8, "options": []})
        assert high_conf["scholar_flag"] is False

        # Low confidence - flag set
        low_conf = _normalize_structure_output({"confidence": 0.5, "options": []})
        assert low_conf["scholar_flag"] is True

    def test_preserves_existing_scholar_flag(self):
        """Existing scholar_flag is not overwritten."""
        output = {"confidence": 0.8, "scholar_flag": True, "options": []}
        normalized = _normalize_structure_output(output)
        assert normalized["scholar_flag"] is True

    def test_adds_default_suggested_title(self):
        """Missing suggested_title gets default value."""
        output = {"options": [], "confidence": 0.7}
        normalized = _normalize_structure_output(output)
        assert normalized["suggested_title"] == "Ethical Guidance"

    def test_normalizes_sources_array(self):
        """Sources array entries get missing relevance and paraphrase."""
        output = {
            "options": [],
            "sources": [
                {"canonical_id": "BG_2_47"},
                {"canonical_id": "BG_3_35", "relevance": 0.8},
            ],
            "confidence": 0.7,
        }

        normalized = _normalize_structure_output(output)

        assert normalized["sources"][0]["relevance"] == 0.5
        assert normalized["sources"][0]["paraphrase"] == ""
        # Existing relevance preserved
        assert normalized["sources"][1]["relevance"] == 0.8

    def test_full_normalization_scenario(self):
        """Full scenario: LLM output missing several fields gets normalized."""
        # Simulates actual LLM output that caused the production bug
        llm_output = {
            "executive_summary": "This is a test summary.",
            "options": [
                {
                    "title": "Courage and Duty",
                    "description": "Follow your dharma.",
                    "pros": ["Respect for duty"],
                    "cons": ["Risk of losing respect"],
                    # NOTE: sources is MISSING - this caused the bug
                },
                {
                    "title": "Compassion",
                    "description": "Show empathy.",
                    "pros": ["Builds trust"],
                    "cons": ["May seem weak"],
                },
                {
                    "title": "Balance",
                    "description": "Find middle ground.",
                    "pros": ["Harmony"],
                    "cons": ["Compromise"],
                },
            ],
            "recommended_action": {
                "option": 1,
                # NOTE: sources and steps are MISSING
            },
            "reflection_prompts": ["What matters most?"],
            "sources": [{"canonical_id": "BG_2_47"}],
            "confidence": 0.75,
        }

        normalized = _normalize_structure_output(llm_output)

        # All options should now have sources field
        for opt in normalized["options"]:
            assert "sources" in opt
            assert isinstance(opt["sources"], list)

        # Recommended action should have sources and steps
        assert "sources" in normalized["recommended_action"]
        assert "steps" in normalized["recommended_action"]

        # Scholar flag should be set based on confidence
        assert "scholar_flag" in normalized

    def test_adds_missing_executive_summary(self):
        """Missing executive_summary gets default value."""
        output = {"options": [], "confidence": 0.7}
        normalized = _normalize_structure_output(output)
        assert "executive_summary" in normalized
        assert len(normalized["executive_summary"]) > 50

    def test_pads_options_to_three(self):
        """Options array is padded to have 3 options."""
        # No options
        no_options = _normalize_structure_output({"options": [], "confidence": 0.7})
        assert len(no_options["options"]) == 3
        assert no_options["options"][0]["title"] == "Path of Dharma"

        # One option
        one_option = _normalize_structure_output({
            "options": [{"title": "My Option", "description": "My desc"}],
            "confidence": 0.7,
        })
        assert len(one_option["options"]) == 3
        assert one_option["options"][0]["title"] == "My Option"
        assert one_option["options"][1]["title"] == "Path of Compassion"

        # Two options
        two_options = _normalize_structure_output({
            "options": [
                {"title": "Option A", "description": "Desc A"},
                {"title": "Option B", "description": "Desc B"},
            ],
            "confidence": 0.7,
        })
        assert len(two_options["options"]) == 3
        assert two_options["options"][2]["title"] == "Path of Wisdom"

    def test_options_with_missing_title_description(self):
        """Options missing title/description get defaults."""
        output = {
            "options": [
                {},  # Empty option
                {"title": "Only Title"},  # Missing description
                {"description": "Only Description"},  # Missing title
            ],
            "confidence": 0.7,
        }
        normalized = _normalize_structure_output(output)

        assert normalized["options"][0]["title"] == "Option 1"
        assert "Consider this approach" in normalized["options"][0]["description"]
        assert normalized["options"][1]["description"] == "Consider this approach carefully."
        assert normalized["options"][2]["title"] == "Option 3"

    def test_creates_missing_recommended_action(self):
        """Missing recommended_action gets default structure."""
        output = {"options": [], "confidence": 0.7}
        normalized = _normalize_structure_output(output)

        assert "recommended_action" in normalized
        assert normalized["recommended_action"]["option"] == 1
        assert len(normalized["recommended_action"]["steps"]) >= 1
        assert isinstance(normalized["recommended_action"]["sources"], list)

    def test_fixes_invalid_recommended_action_option(self):
        """Invalid option number gets corrected to 1."""
        # Option 0 (invalid)
        zero_opt = _normalize_structure_output({
            "options": [],
            "recommended_action": {"option": 0},
            "confidence": 0.7,
        })
        assert zero_opt["recommended_action"]["option"] == 1

        # Option 5 (out of range)
        high_opt = _normalize_structure_output({
            "options": [],
            "recommended_action": {"option": 5},
            "confidence": 0.7,
        })
        assert high_opt["recommended_action"]["option"] == 1

        # String option (wrong type)
        str_opt = _normalize_structure_output({
            "options": [],
            "recommended_action": {"option": "first"},
            "confidence": 0.7,
        })
        assert str_opt["recommended_action"]["option"] == 1

    def test_clamps_confidence_to_valid_range(self):
        """Confidence values are clamped to 0-1."""
        # Too high
        high = _normalize_structure_output({"options": [], "confidence": 1.5})
        assert high["confidence"] == 1.0

        # Too low / negative
        low = _normalize_structure_output({"options": [], "confidence": -0.5})
        assert low["confidence"] == 0.0

        # Valid stays unchanged
        valid = _normalize_structure_output({"options": [], "confidence": 0.75})
        assert valid["confidence"] == 0.75

    def test_handles_missing_confidence(self):
        """Missing confidence gets default value."""
        output = {"options": []}
        normalized = _normalize_structure_output(output)
        assert normalized["confidence"] == 0.7

    def test_handles_legacy_string_sources(self):
        """Sources as strings are converted to proper format."""
        output = {
            "options": [],
            "sources": ["BG_2_47", "BG_3_35"],
            "confidence": 0.7,
        }
        normalized = _normalize_structure_output(output)

        assert len(normalized["sources"]) == 2
        assert normalized["sources"][0]["canonical_id"] == "BG_2_47"
        assert normalized["sources"][0]["paraphrase"] == ""
        assert normalized["sources"][0]["relevance"] == 0.5

    def test_adds_default_source_when_empty(self):
        """Empty sources array gets default source."""
        output = {"options": [], "sources": [], "confidence": 0.7}
        normalized = _normalize_structure_output(output)

        assert len(normalized["sources"]) == 1
        assert normalized["sources"][0]["canonical_id"] == "BG_2_47"

    def test_creates_sources_when_missing(self):
        """Missing sources array is created with default."""
        output = {"options": [], "confidence": 0.7}
        normalized = _normalize_structure_output(output)

        assert "sources" in normalized
        assert len(normalized["sources"]) >= 1

    def test_handles_empty_steps_array(self):
        """Empty steps array in recommended_action gets default."""
        output = {
            "options": [],
            "recommended_action": {"option": 1, "steps": []},
            "confidence": 0.7,
        }
        normalized = _normalize_structure_output(output)

        assert len(normalized["recommended_action"]["steps"]) >= 1
        assert "reflect" in normalized["recommended_action"]["steps"][0].lower()

    def test_handles_invalid_options_type(self):
        """Non-list options gets converted to list and padded."""
        output = {"options": "not a list", "confidence": 0.7}
        normalized = _normalize_structure_output(output)

        assert isinstance(normalized["options"], list)
        assert len(normalized["options"]) == 3

    def test_complete_minimal_output_normalization(self):
        """Completely minimal output gets fully normalized."""
        # Simulates worst case: LLM returns almost nothing
        minimal = {"confidence": 0.5}
        normalized = _normalize_structure_output(minimal)

        # Should have all required fields
        assert "suggested_title" in normalized
        assert "executive_summary" in normalized
        assert len(normalized["options"]) == 3
        assert "recommended_action" in normalized
        assert "reflection_prompts" in normalized
        assert "sources" in normalized
        assert "confidence" in normalized
        assert "scholar_flag" in normalized

        # Each option should be complete
        for opt in normalized["options"]:
            assert "title" in opt
            assert "description" in opt
            assert "pros" in opt
            assert "cons" in opt
            assert "sources" in opt
