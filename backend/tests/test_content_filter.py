"""Tests for content filter module."""

import pytest
from unittest.mock import patch

# Mark all tests in this module as unit tests (fast, no DB required)
pytestmark = pytest.mark.unit
from services.content_filter import (
    check_blocklist,
    detect_llm_refusal,
    validate_submission_content,
    get_policy_violation_response,
    ContentPolicyError,
    ViolationType,
)


class TestBlocklist:
    """Tests for blocklist content filtering."""

    def test_allows_legitimate_ethical_dilemma(self):
        """Legitimate ethical dilemmas should pass."""
        text = """
        I discovered my colleague is taking credit for my work.
        Should I confront them directly or escalate to management?
        """
        result = check_blocklist(text)
        assert result.is_violation is False

    def test_allows_complex_workplace_scenario(self):
        """Complex workplace scenarios should pass."""
        text = """
        As a manager, I need to lay off several team members due to budget cuts.
        How do I balance my duty to the company with my responsibility to employees?
        """
        result = check_blocklist(text)
        assert result.is_violation is False

    def test_blocks_explicit_sexual_content(self):
        """Explicit sexual content should be blocked."""
        text = "sexual fantasy with explicit pornographic content"
        result = check_blocklist(text)
        assert result.is_violation is True
        assert result.violation_type == ViolationType.EXPLICIT_SEXUAL

    def test_blocks_explicit_violence(self):
        """Explicit violence should be blocked."""
        text = "how to murder someone without getting caught"
        result = check_blocklist(text)
        assert result.is_violation is True
        assert result.violation_type == ViolationType.EXPLICIT_VIOLENCE

    def test_blocks_spam_gibberish_repeated_chars(self):
        """Repeated characters spam should be blocked."""
        text = "aaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        result = check_blocklist(text)
        assert result.is_violation is True
        assert result.violation_type == ViolationType.SPAM_GIBBERISH

    def test_blocks_spam_gibberish_no_letters(self):
        """Long strings without letters should be blocked."""
        text = "12345678901234567890!"  # 21 chars, no letters
        result = check_blocklist(text)
        assert result.is_violation is True
        assert result.violation_type == ViolationType.SPAM_GIBBERISH

    def test_allows_short_numeric_input(self):
        """Short numeric inputs should not be blocked (avoid false positive)."""
        text = "12345"  # Short, might be legitimate
        result = check_blocklist(text)
        assert result.is_violation is False

    def test_case_insensitive(self):
        """Blocklist should be case insensitive."""
        text = "SEXUAL FANTASY with someone"
        result = check_blocklist(text)
        assert result.is_violation is True


class TestLLMRefusalDetection:
    """Tests for LLM refusal detection."""

    def test_detects_cant_assist_pattern(self):
        """Should detect 'I can't assist' refusal."""
        response = (
            "I can't assist with this request as it involves inappropriate content."
        )
        is_refusal, match = detect_llm_refusal(response)
        assert is_refusal is True
        assert match is not None

    def test_detects_not_able_pattern(self):
        """Should detect 'not able to' refusal."""
        response = "I'm not able to assist with this request due to content policy."
        is_refusal, match = detect_llm_refusal(response)
        assert is_refusal is True

    def test_detects_policy_violation_language(self):
        """Should detect policy violation language."""
        response = (
            "This request contains inappropriate content and violates my guidelines."
        )
        is_refusal, match = detect_llm_refusal(response)
        assert is_refusal is True

    def test_allows_normal_json_response(self):
        """Normal JSON responses should not be flagged."""
        response = '{"executive_summary": "Consider the ethical implications...", "options": []}'
        is_refusal, match = detect_llm_refusal(response)
        assert is_refusal is False
        assert match is None

    def test_allows_helpful_guidance(self):
        """Helpful guidance should not be flagged."""
        response = """
        I'm happy to help you think through this ethical dilemma.
        Consider the following perspectives from the Bhagavad Geeta...
        """
        is_refusal, match = detect_llm_refusal(response)
        assert is_refusal is False


class TestValidateSubmissionContent:
    """Tests for submission validation."""

    def test_allows_valid_submission(self):
        """Valid submissions should pass without exception."""
        # Should not raise
        validate_submission_content(
            title="Workplace ethics dilemma",
            description="My manager asked me to falsify a report.",
        )

    def test_raises_for_blocked_content(self):
        """Blocked content should raise ContentPolicyError."""
        with pytest.raises(ContentPolicyError) as exc_info:
            validate_submission_content(
                title="Test", description="I want to have sex act with someone"
            )
        assert exc_info.value.violation_type == ViolationType.EXPLICIT_SEXUAL

    def test_checks_both_title_and_description(self):
        """Both title and description should be checked."""
        with pytest.raises(ContentPolicyError):
            validate_submission_content(
                title="sexual fantasy request", description="normal description"
            )


class TestPolicyViolationResponse:
    """Tests for policy violation response structure."""

    def test_response_has_required_fields(self):
        """Policy violation response should have all required fields."""
        response = get_policy_violation_response()

        assert "executive_summary" in response
        assert "options" in response
        assert "recommended_action" in response
        assert "reflection_prompts" in response
        assert "sources" in response
        assert "confidence" in response
        assert "scholar_flag" in response
        assert "policy_violation" in response

    def test_response_has_three_options(self):
        """Response should have exactly 3 options."""
        response = get_policy_violation_response()
        assert len(response["options"]) == 3

    def test_response_has_zero_confidence(self):
        """Policy violation response should have zero confidence."""
        response = get_policy_violation_response()
        assert response["confidence"] == 0.0

    def test_response_flagged_for_scholar_review(self):
        """Response should be flagged for scholar review."""
        response = get_policy_violation_response()
        assert response["scholar_flag"] is True

    def test_response_marked_as_policy_violation(self):
        """Response should have policy_violation flag."""
        response = get_policy_violation_response()
        assert response["policy_violation"] is True


class TestContentPolicyError:
    """Tests for ContentPolicyError exception."""

    def test_error_contains_educational_message(self):
        """Error message should be educational, not punitive."""
        error = ContentPolicyError(ViolationType.EXPLICIT_SEXUAL)

        # Should contain guidance on proper use
        assert "ethical dilemma" in error.message.lower()
        assert "Bhagavad Geeta" in error.message or "values" in error.message.lower()

    def test_error_preserves_violation_type(self):
        """Error should preserve the violation type."""
        error = ContentPolicyError(ViolationType.EXPLICIT_VIOLENCE)
        assert error.violation_type == ViolationType.EXPLICIT_VIOLENCE


class TestConfigurationToggles:
    """Tests for content filter configuration."""

    def test_blocklist_disabled_via_master_switch(self):
        """Blocklist should be bypassed when master switch is off."""
        with patch("services.content_filter.settings") as mock_settings:
            mock_settings.CONTENT_FILTER_ENABLED = False
            mock_settings.CONTENT_FILTER_BLOCKLIST_ENABLED = True

            # This would normally be blocked
            result = check_blocklist("sexual fantasy request")
            assert result.is_violation is False

    def test_blocklist_disabled_via_layer_switch(self):
        """Blocklist should be bypassed when layer 1 switch is off."""
        with patch("services.content_filter.settings") as mock_settings:
            mock_settings.CONTENT_FILTER_ENABLED = True
            mock_settings.CONTENT_FILTER_BLOCKLIST_ENABLED = False

            # This would normally be blocked
            result = check_blocklist("sexual fantasy request")
            assert result.is_violation is False

    def test_refusal_detection_disabled_via_master_switch(self):
        """Refusal detection should be bypassed when master switch is off."""
        with patch("services.content_filter.settings") as mock_settings:
            mock_settings.CONTENT_FILTER_ENABLED = False
            mock_settings.CONTENT_FILTER_LLM_REFUSAL_DETECTION = True

            # This would normally be detected as refusal
            is_refusal, _ = detect_llm_refusal("I can't assist with this request")
            assert is_refusal is False

    def test_refusal_detection_disabled_via_layer_switch(self):
        """Refusal detection should be bypassed when layer 2 switch is off."""
        with patch("services.content_filter.settings") as mock_settings:
            mock_settings.CONTENT_FILTER_ENABLED = True
            mock_settings.CONTENT_FILTER_LLM_REFUSAL_DETECTION = False

            # This would normally be detected as refusal
            is_refusal, _ = detect_llm_refusal("I can't assist with this request")
            assert is_refusal is False


class TestPolicyViolationResponseImmutability:
    """Tests for policy violation response safety."""

    def test_response_is_deep_copy(self):
        """Response should be a deep copy to prevent mutation."""
        response1 = get_policy_violation_response()
        response2 = get_policy_violation_response()

        # Modify response1
        response1["options"][0]["title"] = "MODIFIED"

        # response2 should be unaffected
        assert response2["options"][0]["title"] == "Reflect on Your Underlying Concern"


class TestProfanityAbuseDetection:
    """Tests for profanity/abuse detection (direct abuse vs. contextual mentions)."""

    # === SHOULD BLOCK: Direct abuse ===

    def test_blocks_direct_f_word_attack(self):
        """Direct 'f*ck you' should be blocked."""
        result = check_blocklist("fuck you")
        assert result.is_violation is True
        # May be caught by EXPLICIT_SEXUAL or PROFANITY_ABUSE - both are valid
        assert result.violation_type in (
            ViolationType.PROFANITY_ABUSE,
            ViolationType.EXPLICIT_SEXUAL,
        )

    def test_blocks_obfuscated_f_word(self):
        """Obfuscated 'f4ck you' should be blocked."""
        result = check_blocklist("f4ck you")
        assert result.is_violation is True
        assert result.violation_type == ViolationType.PROFANITY_ABUSE

    def test_blocks_you_suck(self):
        """'You suck' should be blocked."""
        result = check_blocklist("you suck")
        assert result.is_violation is True
        assert result.violation_type == ViolationType.PROFANITY_ABUSE

    def test_blocks_direct_insult(self):
        """Direct insults like 'you are an idiot' should be blocked."""
        result = check_blocklist("you are an idiot")
        assert result.is_violation is True
        assert result.violation_type == ViolationType.PROFANITY_ABUSE

    def test_blocks_go_to_hell(self):
        """'Go to hell' should be blocked."""
        result = check_blocklist("go to hell")
        assert result.is_violation is True
        assert result.violation_type == ViolationType.PROFANITY_ABUSE

    def test_blocks_abuse_acronyms(self):
        """Abuse acronyms like 'stfu' should be blocked."""
        result = check_blocklist("stfu")
        assert result.is_violation is True
        assert result.violation_type == ViolationType.PROFANITY_ABUSE

    def test_blocks_slurs(self):
        """Slurs should always be blocked."""
        result = check_blocklist("you are a f4ggot")
        assert result.is_violation is True
        assert result.violation_type == ViolationType.PROFANITY_ABUSE

    # === SHOULD ALLOW: Contextual mentions ===

    def test_allows_describing_harsh_situation(self):
        """Describing a harsh workplace situation should pass."""
        text = "My boss called me incompetent in front of everyone"
        result = check_blocklist(text)
        assert result.is_violation is False

    def test_allows_quoted_profanity_in_context(self):
        """Quoting what someone else said should pass."""
        text = "He said 'this project is bullshit' and I don't know how to respond"
        result = check_blocklist(text)
        assert result.is_violation is False

    def test_allows_mild_profanity_expression(self):
        """Mild expressions like 'damn' or 'hell' in context should pass."""
        text = "I feel like crap about this decision. It's a damn mess."
        result = check_blocklist(text)
        assert result.is_violation is False

    def test_allows_ethical_dilemma_with_harsh_context(self):
        """Complex ethical dilemmas involving harsh situations should pass."""
        text = """
        My coworker told our boss that my work was 'completely worthless'.
        Should I confront them about this or let it go?
        """
        result = check_blocklist(text)
        assert result.is_violation is False

    def test_allows_reporting_harassment(self):
        """Describing harassment for ethical guidance should pass."""
        text = """
        Someone at work called me a derogatory name. I want to report it
        but I'm worried about retaliation. What should I do?
        """
        result = check_blocklist(text)
        assert result.is_violation is False

    def test_allows_die_in_philosophical_context(self):
        """'die' as verb in philosophical context should pass."""
        text = "I would rather die than compromise my principles"
        result = check_blocklist(text)
        assert result.is_violation is False

    def test_blocks_directed_die(self):
        """'die' when directed at someone should be blocked."""
        result = check_blocklist("go die loser")
        assert result.is_violation is True
        assert result.violation_type == ViolationType.PROFANITY_ABUSE


class TestDifferentiatedErrorMessages:
    """Tests for differentiated error messages by violation type."""

    def test_spam_message_is_specific(self):
        """Spam/gibberish error should mention 'clear description'."""
        error = ContentPolicyError(ViolationType.SPAM_GIBBERISH)
        assert "clear description" in error.message.lower()
        assert "specific situation" in error.message.lower()

    def test_profanity_message_is_specific(self):
        """Profanity error should mention 'rephrase' and 'offensive'."""
        error = ContentPolicyError(ViolationType.PROFANITY_ABUSE)
        assert "rephrase" in error.message.lower()
        assert "offensive" in error.message.lower()

    def test_explicit_content_has_geeta_guidance(self):
        """Explicit content error should mention Bhagavad Geeta."""
        error = ContentPolicyError(ViolationType.EXPLICIT_SEXUAL)
        assert "bhagavad geeta" in error.message.lower() or "ethical" in error.message.lower()


class TestProfanityConfigToggle:
    """Tests for profanity filter configuration toggle."""

    def test_profanity_disabled_allows_abuse(self):
        """Profanity check should be bypassed when disabled."""
        with patch("services.content_filter.settings") as mock_settings:
            mock_settings.CONTENT_FILTER_ENABLED = True
            mock_settings.CONTENT_FILTER_BLOCKLIST_ENABLED = True
            mock_settings.CONTENT_FILTER_PROFANITY_ENABLED = False

            # This would normally be blocked by profanity filter
            # Note: may still be blocked by explicit patterns
            result = check_blocklist("you are an idiot")
            # When profanity is disabled, direct insults should pass
            # (unless caught by other patterns)
            assert result.violation_type != ViolationType.PROFANITY_ABUSE or result.is_violation is False
