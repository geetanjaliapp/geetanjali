"""Tests for fallback reconstruction logic.

Tests cover:
- Heuristic prose extraction
- Title, summary, options extraction
- Verse reference extraction
- Confidence scoring
- Validation of reconstructed output
"""

import pytest

from services.rag.multipass.fallback import (
    ReconstructionResult,
    _calculate_reconstruction_confidence,
    _extract_options,
    _extract_reflection_prompts,
    _extract_summary,
    _extract_title,
    _extract_verse_references,
    _is_valid_structure,
    reconstruct_from_prose,
)

# Mark all tests as unit tests (no DB required)
pytestmark = pytest.mark.unit


class TestReconstructionResult:
    """Test ReconstructionResult dataclass."""

    def test_success_result(self):
        """Test creating a successful result."""
        result = ReconstructionResult(
            success=True,
            result_json={"test": "data"},
            confidence=0.5,
            reconstruction_method="refined_prose_heuristic",
        )
        assert result.success
        assert result.result_json is not None
        assert result.confidence == 0.5

    def test_failure_result(self):
        """Test creating a failure result."""
        result = ReconstructionResult(
            success=False,
            confidence=0.3,
            errors=["Extraction failed"],
        )
        assert not result.success
        assert result.result_json is None
        assert len(result.errors) == 1


class TestReconstructFromProse:
    """Test main reconstruction function."""

    def test_reconstruct_from_refined_prose(self):
        """Test reconstruction from refined prose."""
        refined_prose = """
# The Path Forward

This ethical dilemma involves balancing personal integrity with professional obligations.

1. **Path of Duty**: Focus on your professional responsibilities. This honors
   your commitments and maintains trust with stakeholders.

2. **Path of Compassion**: Consider the human impact of your decision.
   This builds relationships and demonstrates empathy.

3. **Path of Balance**: Seek a middle ground that honors both duty and
   compassion. This requires wisdom and patience.

The Bhagavad Geeta verse BG_2_47 teaches us about action without attachment.
Consider also BG_3_35 regarding one's own dharma.

What values are most important to you in this situation?
How will this decision affect those you serve?
"""
        verses = [
            {"canonical_id": "BG_2_47", "metadata": {"translation_en": "Focus on action"}},
            {"canonical_id": "BG_3_35", "metadata": {"translation_en": "One's own dharma"}},
        ]

        result = reconstruct_from_prose(
            refined_prose=refined_prose,
            draft_prose=None,
            verses=verses,
        )

        assert result.success
        assert result.result_json is not None
        assert result.reconstruction_method == "refined_prose_heuristic"
        assert "options" in result.result_json
        assert len(result.result_json["options"]) >= 3

    def test_reconstruct_fallback_to_draft(self):
        """Test reconstruction falls back to draft when refined unavailable."""
        draft_prose = """
This situation presents a classic ethical tension.

1. **Option A**: Take immediate action based on principles.
2. **Option B**: Delay decision to gather more information.
3. **Option C**: Seek guidance from mentors before deciding.

Consider BG_2_47 on detachment from outcomes.
"""
        verses = [{"canonical_id": "BG_2_47", "metadata": {"translation_en": "Test"}}]

        result = reconstruct_from_prose(
            refined_prose=None,
            draft_prose=draft_prose,
            verses=verses,
        )

        assert result.success
        assert result.reconstruction_method == "draft_prose_heuristic"

    def test_reconstruct_fails_with_no_prose(self):
        """Test reconstruction fails when no prose available."""
        result = reconstruct_from_prose(
            refined_prose=None,
            draft_prose=None,
            verses=[],
        )

        assert not result.success
        assert result.reconstruction_method == "none"
        assert len(result.errors) > 0

    def test_reconstruct_fails_with_short_prose(self):
        """Test reconstruction fails with very short prose."""
        result = reconstruct_from_prose(
            refined_prose="Too short",
            draft_prose="Also short",
            verses=[],
        )

        assert not result.success


class TestExtractTitle:
    """Test title extraction."""

    def test_extract_markdown_header(self):
        """Test extracting title from markdown header."""
        prose = "# The Ethical Path Forward\n\nSome content..."
        title = _extract_title(prose)
        assert title == "The Ethical Path Forward"

    def test_extract_bold_title(self):
        """Test extracting title from bold text."""
        prose = "**Navigating Difficult Choices**\n\nSome content..."
        title = _extract_title(prose)
        assert title == "Navigating Difficult Choices"

    def test_extract_first_sentence(self):
        """Test extracting title from first sentence."""
        prose = "This dilemma requires careful consideration. More content follows..."
        title = _extract_title(prose)
        assert title == "This dilemma requires careful consideration"

    def test_fallback_title(self):
        """Test fallback when no good title found."""
        prose = "x"  # Too short
        title = _extract_title(prose, fallback="Test Title")
        assert title == "Test Title"


class TestExtractSummary:
    """Test summary extraction."""

    def test_extract_first_paragraphs(self):
        """Test extracting summary from first paragraphs."""
        prose = """First paragraph with important context.

Second paragraph with more details.

Third paragraph continues the discussion."""

        summary = _extract_summary(prose)
        assert "First paragraph" in summary
        assert "Second paragraph" in summary

    def test_summary_truncation(self):
        """Test that summary is truncated to reasonable length."""
        long_para = "word " * 300  # 300 words
        summary = _extract_summary(long_para)
        words = summary.split()
        assert len(words) <= 210  # Roughly 200 + some buffer

    def test_skip_headers_and_lists(self):
        """Test that headers and lists are skipped."""
        prose = """# Header
- List item
1. Numbered item

This is the actual content paragraph."""

        summary = _extract_summary(prose)
        assert "actual content" in summary


class TestExtractOptions:
    """Test options extraction."""

    def test_extract_numbered_options(self):
        """Test extracting numbered options."""
        prose = """
1. **Path of Duty**: Honor your commitments and professional obligations.
   This maintains trust and integrity.

2. **Path of Compassion**: Consider the human impact and act with empathy.
   This builds stronger relationships.

3. **Path of Wisdom**: Seek balance between competing values.
   This requires patience and discernment.
"""
        verses = [{"canonical_id": "BG_2_47", "metadata": {}}]
        options = _extract_options(prose, verses)

        assert len(options) >= 3
        assert all("title" in opt for opt in options)
        assert all("description" in opt for opt in options)

    def test_generic_options_when_extraction_fails(self):
        """Test generic options are created when extraction fails."""
        prose = "This is unstructured text without clear options."
        verses = [{"canonical_id": "BG_2_47", "metadata": {}}]

        options = _extract_options(prose, verses)

        assert len(options) == 3
        assert all("title" in opt for opt in options)


class TestExtractVerseReferences:
    """Test verse reference extraction."""

    def test_extract_bg_underscore_format(self):
        """Test extracting BG_X_Y format."""
        prose = "Consider BG_2_47 and BG_3_35 for guidance."
        refs = _extract_verse_references(prose)

        assert "BG_2_47" in refs
        assert "BG_3_35" in refs

    def test_extract_bg_space_format(self):
        """Test extracting BG X.Y format."""
        prose = "The verse BG 2.47 teaches us about detachment."
        refs = _extract_verse_references(prose)

        assert len(refs) >= 1
        assert any("2" in ref and "47" in ref for ref in refs)

    def test_deduplicate_references(self):
        """Test that duplicate references are removed."""
        prose = "BG_2_47 is mentioned. Again BG_2_47 appears."
        refs = _extract_verse_references(prose)

        assert refs.count("BG_2_47") == 1


class TestExtractReflectionPrompts:
    """Test reflection prompt extraction."""

    def test_extract_questions(self):
        """Test extracting questions from prose."""
        prose = """
Consider this situation carefully.
What values are most important to you?
How will this decision affect others?
What would your wisest self advise?
"""
        prompts = _extract_reflection_prompts(prose)

        assert len(prompts) >= 2
        assert any("values" in p.lower() for p in prompts)

    def test_default_prompts_added(self):
        """Test default prompts are added when too few found."""
        prose = "No questions in this text at all."
        prompts = _extract_reflection_prompts(prose)

        assert len(prompts) >= 2


class TestCalculateReconstructionConfidence:
    """Test confidence scoring."""

    def test_short_prose_low_confidence(self):
        """Test that short prose gets low confidence."""
        short_prose = "Very short text."
        confidence = _calculate_reconstruction_confidence(short_prose)

        assert confidence <= 0.4

    def test_long_structured_prose_higher_confidence(self):
        """Test that long, structured prose gets higher confidence."""
        long_prose = """
This is a longer piece of prose that contains multiple paragraphs.

The second paragraph adds more depth. Consider BG_2_47 and BG_3_35.
Therefore, we can conclude that careful consideration is needed.

However, there are multiple perspectives to consider. Thus, balance is key.
"""
        confidence = _calculate_reconstruction_confidence(long_prose)

        assert confidence > 0.4

    def test_confidence_capped(self):
        """Test that confidence is capped at 0.65."""
        very_long = "word " * 1000 + "\n\n" * 10 + "BG_2_47 " * 20
        very_long += " therefore however because thus consider " * 10

        confidence = _calculate_reconstruction_confidence(very_long)

        assert confidence <= 0.65


class TestIsValidStructure:
    """Test structure validation."""

    def test_valid_structure(self):
        """Test validation of valid structure."""
        valid = {
            "suggested_title": "Test",
            "executive_summary": "Summary",
            "options": [
                {"title": "A", "description": "Desc A"},
                {"title": "B", "description": "Desc B"},
                {"title": "C", "description": "Desc C"},
            ],
            "recommended_action": {"option": 1, "steps": []},
        }

        assert _is_valid_structure(valid)

    def test_invalid_missing_required(self):
        """Test validation fails with missing required fields."""
        invalid = {
            "suggested_title": "Test",
            # Missing executive_summary, options, recommended_action
        }

        assert not _is_valid_structure(invalid)

    def test_invalid_too_few_options(self):
        """Test validation fails with fewer than 3 options."""
        invalid = {
            "suggested_title": "Test",
            "executive_summary": "Summary",
            "options": [
                {"title": "A", "description": "Desc A"},
                {"title": "B", "description": "Desc B"},
            ],
            "recommended_action": {"option": 1},
        }

        assert not _is_valid_structure(invalid)

    def test_invalid_option_missing_fields(self):
        """Test validation fails when options missing fields."""
        invalid = {
            "suggested_title": "Test",
            "executive_summary": "Summary",
            "options": [
                {"title": "A"},  # Missing description
                {"title": "B", "description": "Desc B"},
                {"title": "C", "description": "Desc C"},
            ],
            "recommended_action": {"option": 1},
        }

        assert not _is_valid_structure(invalid)


class TestIntegration:
    """Integration tests for fallback reconstruction."""

    def test_full_reconstruction_flow(self):
        """Test complete reconstruction from realistic prose."""
        prose = """
# Navigating the Ethical Dilemma

This situation presents a classic tension between professional duty and personal
values. The stakeholders include your team, your organization, and yourself.

## The Core Tension

At the heart of this dilemma lies the conflict between loyalty and integrity.
Both values are important, but in this case they point in different directions.

## Options to Consider

1. **Honor Your Commitment**: Follow through on your professional obligations.
   Pro: Maintains trust and reputation.
   Con: May conflict with personal values.

2. **Prioritize Personal Integrity**: Act according to your deepest values.
   Pro: Preserves self-respect and authenticity.
   Con: May damage professional relationships.

3. **Seek a Middle Path**: Find creative solutions that honor both.
   Pro: Integrates multiple values.
   Con: May require difficult compromises.

## Wisdom from the Geeta

The verse BG_2_47 reminds us to focus on action without attachment to outcomes.
Similarly, BG_3_35 emphasizes following one's own dharma rather than another's.

## Reflection

What would you advise a friend in this situation?
How will this decision shape your character over time?
"""
        verses = [
            {"canonical_id": "BG_2_47", "metadata": {"translation_en": "Focus on action"}},
            {"canonical_id": "BG_3_35", "metadata": {"translation_en": "Own dharma"}},
        ]

        result = reconstruct_from_prose(
            refined_prose=prose,
            draft_prose=None,
            verses=verses,
        )

        assert result.success
        assert result.result_json is not None

        json_result = result.result_json
        assert "suggested_title" in json_result
        assert "executive_summary" in json_result
        assert "options" in json_result
        assert len(json_result["options"]) >= 3
        assert "recommended_action" in json_result
        assert "reflection_prompts" in json_result
        assert "sources" in json_result
        assert json_result.get("scholar_flag") is True

        # Check confidence is reasonable
        assert 0.3 <= result.confidence <= 0.65
