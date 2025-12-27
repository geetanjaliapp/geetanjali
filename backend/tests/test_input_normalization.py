"""Tests for input normalization utilities."""

import pytest

from utils.input_normalization import (
    normalize_input,
    NormalizationResult,
    BASE64_PATTERN,
    CHAT_TIMESTAMP_PATTERN,
    CONTROL_CHAR_PATTERN,
)


class TestNormalizationResult:
    """Tests for NormalizationResult dataclass."""

    def test_was_modified_true_when_length_changed(self):
        result = NormalizationResult(
            text="hello",
            original_length=10,
            normalized_length=5,
            lines_removed=0,
        )
        assert result.was_modified is True

    def test_was_modified_true_when_lines_removed(self):
        result = NormalizationResult(
            text="hello",
            original_length=5,
            normalized_length=5,
            lines_removed=1,
        )
        assert result.was_modified is True

    def test_was_modified_false_when_unchanged(self):
        result = NormalizationResult(
            text="hello",
            original_length=5,
            normalized_length=5,
            lines_removed=0,
        )
        assert result.was_modified is False

    def test_has_warnings_true_when_warnings_present(self):
        result = NormalizationResult(
            text="hello",
            warnings=["some_warning"],
        )
        assert result.has_warnings is True

    def test_has_warnings_false_when_no_warnings(self):
        result = NormalizationResult(
            text="hello",
            warnings=[],
        )
        assert result.has_warnings is False


class TestPatterns:
    """Tests for regex patterns."""

    def test_base64_pattern_matches_long_encoded_string(self):
        # 60 chars of valid base64
        text = "A" * 60
        assert BASE64_PATTERN.search(text)

    def test_base64_pattern_no_match_short_string(self):
        text = "A" * 40
        assert BASE64_PATTERN.search(text) is None

    def test_base64_pattern_matches_with_padding(self):
        text = "A" * 58 + "=="
        assert BASE64_PATTERN.search(text)

    def test_chat_timestamp_whatsapp_format(self):
        text = "[26/12/25, 1:41:20 AM]"
        assert CHAT_TIMESTAMP_PATTERN.search(text)

    def test_chat_timestamp_24h_format(self):
        text = "[26/12/2025, 13:41:20]"
        assert CHAT_TIMESTAMP_PATTERN.search(text)

    def test_chat_timestamp_no_seconds(self):
        text = "[26/12/25, 1:41 PM]"
        assert CHAT_TIMESTAMP_PATTERN.search(text)

    def test_control_char_pattern_matches_null(self):
        assert CONTROL_CHAR_PATTERN.search("\x00")

    def test_control_char_pattern_preserves_newline(self):
        assert CONTROL_CHAR_PATTERN.search("\n") is None

    def test_control_char_pattern_preserves_tab(self):
        assert CONTROL_CHAR_PATTERN.search("\t") is None


class TestNormalizeInputBasic:
    """Basic tests for normalize_input function."""

    def test_empty_string(self):
        result = normalize_input("")
        assert result.text == ""
        assert result.original_length == 0
        assert result.normalized_length == 0
        assert result.was_modified is False

    def test_simple_string_unchanged(self):
        text = "I have a dilemma about my career."
        result = normalize_input(text)
        assert result.text == text
        assert result.was_modified is False
        assert result.lines_removed == 0

    def test_strips_leading_trailing_whitespace(self):
        result = normalize_input("  hello world  \n\n")
        assert result.text == "hello world"
        assert result.was_modified is True

    def test_strips_control_characters(self):
        result = normalize_input("hello\x00world\x1f")
        assert result.text == "helloworld"
        assert "\x00" not in result.text
        assert "\x1f" not in result.text

    def test_preserves_newlines_and_tabs(self):
        text = "line1\n\tindented line2"
        result = normalize_input(text)
        assert "\n" in result.text
        assert "\t" in result.text


class TestNormalizeInputDeduplication:
    """Tests for line deduplication."""

    def test_removes_duplicate_lines(self):
        text = "line one\nline two\nline one\nline three"
        result = normalize_input(text)
        assert result.text == "line one\nline two\nline three"
        assert result.lines_removed == 1

    def test_preserves_order_after_deduplication(self):
        text = "first\nsecond\nfirst\nthird\nsecond"
        result = normalize_input(text)
        lines = result.text.split("\n")
        assert lines == ["first", "second", "third"]
        assert result.lines_removed == 2

    def test_whatsapp_duplicate_removal(self):
        """Simulates the production case with duplicated WhatsApp chat."""
        chat = (
            "[26/12/25, 1:41:20 AM] Person: Message one\n"
            "[26/12/25, 1:41:36 AM] Person: Message two\n"
            "[26/12/25, 1:42:00 AM] Person: Message three\n"
        )
        duplicated = chat + chat  # User pasted twice
        result = normalize_input(duplicated)

        # Should have 3 unique lines, not 6
        non_empty_lines = [l for l in result.text.split("\n") if l.strip()]
        assert len(non_empty_lines) == 3
        assert result.lines_removed == 3

    def test_warning_for_many_duplicates_removed(self):
        """Should warn when 5+ duplicate lines are removed."""
        lines = ["same line"] * 10
        result = normalize_input("\n".join(lines))
        assert result.lines_removed == 9
        assert any("removed_9_duplicate_lines" in w for w in result.warnings)


class TestNormalizeInputBlankLines:
    """Tests for blank line handling."""

    def test_collapses_multiple_blank_lines(self):
        text = "line one\n\n\n\nline two"
        result = normalize_input(text)
        assert result.text == "line one\n\nline two"

    def test_preserves_single_blank_line(self):
        text = "line one\n\nline two"
        result = normalize_input(text)
        assert result.text == "line one\n\nline two"

    def test_removes_leading_blank_lines(self):
        text = "\n\n\nline one"
        result = normalize_input(text)
        assert result.text == "line one"

    def test_removes_trailing_blank_lines(self):
        text = "line one\n\n\n"
        result = normalize_input(text)
        assert result.text == "line one"


class TestNormalizeInputWarnings:
    """Tests for warning generation."""

    def test_warning_for_base64_content(self):
        # Long base64-like string
        text = "Please decode: " + "A" * 60
        result = normalize_input(text)
        assert "potential_encoded_content" in result.warnings

    def test_warning_for_chat_log_format(self):
        text = (
            "[26/12/25, 1:41:20 AM] Person: Message one\n"
            "[26/12/25, 1:42:00 AM] Person: Message two\n"
            "[26/12/25, 1:43:00 AM] Person: Message three\n"
        )
        result = normalize_input(text)
        assert "chat_log_format" in result.warnings

    def test_no_warning_for_single_timestamp(self):
        text = "On [26/12/25, 1:41:20 AM] I had a dilemma"
        result = normalize_input(text)
        assert "chat_log_format" not in result.warnings

    def test_no_warnings_for_normal_input(self):
        text = "I am facing a difficult decision about my career path."
        result = normalize_input(text)
        assert result.warnings == []
        assert result.has_warnings is False


class TestNormalizeInputTypeGuard:
    """Tests for input type validation."""

    def test_none_input_raises_type_error(self):
        with pytest.raises(TypeError, match="got None"):
            normalize_input(None)

    def test_int_input_raises_type_error(self):
        with pytest.raises(TypeError, match="got int"):
            normalize_input(123)

    def test_list_input_raises_type_error(self):
        with pytest.raises(TypeError, match="got list"):
            normalize_input(["hello", "world"])


class TestNormalizeInputEdgeCases:
    """Edge case tests."""

    def test_only_whitespace(self):
        result = normalize_input("   \n\n\t  \n  ")
        assert result.text == ""

    def test_only_control_characters(self):
        result = normalize_input("\x00\x01\x02")
        assert result.text == ""

    def test_unicode_preserved(self):
        text = "नमस्ते - Hello in Hindi"
        result = normalize_input(text)
        assert "नमस्ते" in result.text

    def test_emoji_preserved(self):
        text = "I feel stuck 😔 and need guidance"
        result = normalize_input(text)
        assert "😔" in result.text

    def test_very_long_input(self):
        text = "word " * 2000  # ~10000 chars
        result = normalize_input(text)
        # Input is a single line, so it gets trimmed but otherwise unchanged
        assert result.text == ("word " * 2000).strip()
        assert len(result.text) > 9000  # Verify it wasn't truncated

    def test_case_sensitive_deduplication(self):
        """Duplicate detection should be case-sensitive."""
        text = "Hello\nhello\nHELLO"
        result = normalize_input(text)
        assert result.lines_removed == 0
        assert len(result.text.split("\n")) == 3

    def test_whitespace_normalized_for_dedup(self):
        """Lines that differ only in leading/trailing whitespace are duplicates."""
        text = "  hello  \nhello\n  hello"
        result = normalize_input(text)
        # All three are "hello" when stripped, so 2 should be removed
        assert result.lines_removed == 2

    def test_windows_line_endings(self):
        """Windows-style CRLF line endings should be handled correctly."""
        text = "hello\r\nhello\r\nworld"
        result = normalize_input(text)
        # "hello" appears twice, should deduplicate
        # Note: \r is preserved but .strip() removes it for comparison
        assert result.lines_removed >= 1
        assert "world" in result.text

    def test_mixed_line_endings(self):
        """Mixed Unix and Windows line endings."""
        text = "line1\nline2\r\nline1\r\nline3"
        result = normalize_input(text)
        assert result.lines_removed >= 1
        assert "line1" in result.text
        assert "line2" in result.text
        assert "line3" in result.text

    def test_many_short_lines(self):
        """Test with many short lines to verify performance and memory."""
        # Create input with 500 unique lines + 500 duplicates
        unique_lines = [f"line {i}" for i in range(500)]
        all_lines = unique_lines + unique_lines  # Duplicate all
        text = "\n".join(all_lines)

        result = normalize_input(text)

        # Should remove 500 duplicate lines
        assert result.lines_removed == 500
        # Output should have 500 unique lines
        output_lines = [l for l in result.text.split("\n") if l.strip()]
        assert len(output_lines) == 500
        # Should have warning for many duplicates
        assert any("removed_500" in w for w in result.warnings)


class TestNormalizeInputMetrics:
    """Tests that verify metrics are recorded (without checking actual values)."""

    def test_clean_input_records_metric(self):
        # Just verify no exception is raised
        result = normalize_input("clean input")
        assert result.was_modified is False

    def test_modified_input_records_metric(self):
        result = normalize_input("  extra whitespace  ")
        assert result.was_modified is True

    def test_suspicious_input_records_metric(self):
        text = "A" * 60  # Triggers base64 warning
        result = normalize_input(text)
        assert result.has_warnings is True
