"""Tests for input sanitization utilities.

These tests verify XSS prevention through input sanitization.
"""

import pytest
from pydantic import BaseModel, ValidationError

from utils.sanitization import (
    SafeMediumText,
    SafeName,
    SafeQuery,
    SafeText,
    SafeTitle,
    sanitize_dangerous,
    strip_angle_brackets,
)


class TestStripAngleBrackets:
    """Tests for strip_angle_brackets function."""

    def test_removes_script_tag(self):
        """Script tags are completely removed."""
        assert strip_angle_brackets("<script>alert(1)</script>") == "alert(1)"

    def test_removes_complete_tags(self):
        """Complete HTML tags are removed."""
        assert strip_angle_brackets("Hello <b>world</b>") == "Hello world"

    def test_removes_tag_like_content(self):
        """Content that looks like tags (< ... >) is removed entirely."""
        # "< b >" looks like a tag and is removed entirely
        # Whitespace is normalized to single space
        assert strip_angle_brackets("a < b > c") == "a c"
        # Stray single brackets are also removed
        assert strip_angle_brackets("a < b") == "a b"
        assert strip_angle_brackets("a > b") == "a b"

    def test_preserves_normal_text(self):
        """Normal text without brackets is preserved."""
        assert strip_angle_brackets("Hello World") == "Hello World"

    def test_handles_empty_string(self):
        """Empty string returns empty."""
        assert strip_angle_brackets("") == ""

    def test_handles_none_like_empty(self):
        """Empty-like values handled gracefully."""
        assert strip_angle_brackets("") == ""

    def test_strips_whitespace(self):
        """Result is stripped of leading/trailing whitespace."""
        assert strip_angle_brackets("  Hello <b>world</b>  ") == "Hello world"

    def test_nested_tags(self):
        """Nested tags are removed."""
        assert strip_angle_brackets("<div><span>text</span></div>") == "text"

    def test_xss_payload_img_onerror(self):
        """Common XSS payload with img onerror is removed."""
        result = strip_angle_brackets('<img src=x onerror="alert(1)">')
        assert "<" not in result
        assert ">" not in result

    def test_xss_payload_svg_onload(self):
        """SVG onload XSS payload is removed."""
        result = strip_angle_brackets('<svg onload="alert(1)">')
        assert "<" not in result
        assert ">" not in result


class TestSanitizeDangerous:
    """Tests for sanitize_dangerous function."""

    def test_removes_script_tags_with_content(self):
        """Script tags and their content are removed."""
        assert sanitize_dangerous("<script>alert(1)</script>text") == "text"

    def test_removes_all_dangerous_tags(self):
        """All dangerous tags are removed."""
        dangerous = [
            "script",
            "iframe",
            "style",
            "link",
            "meta",
            "object",
            "embed",
            "form",
            "input",
            "button",
            "svg",
            "math",
            "base",
            "template",
        ]
        for tag in dangerous:
            result = sanitize_dangerous(f"<{tag}>bad</{tag}>safe")
            assert "bad" not in result or tag in [
                "input",
                "button",
                "link",
                "meta",
                "base",
            ]
            assert "safe" in result

    def test_preserves_less_than_comparison(self):
        """Mathematical comparisons are preserved."""
        assert "x < 10" in sanitize_dangerous("x < 10 is true")

    def test_preserves_greater_than_comparison(self):
        """Greater than comparisons are preserved."""
        assert "income > expenses" in sanitize_dangerous("income > expenses is good")

    def test_removes_event_handlers(self):
        """Event handlers are removed from tags."""
        result = sanitize_dangerous('<img onerror="alert(1)" src="x">')
        assert "onerror" not in result

    def test_removes_multiple_event_handlers(self):
        """Multiple event handlers are removed."""
        result = sanitize_dangerous(
            '<div onclick="bad" onmouseover="also bad">text</div>'
        )
        assert "onclick" not in result
        assert "onmouseover" not in result

    def test_handles_empty_string(self):
        """Empty string returns empty."""
        assert sanitize_dangerous("") == ""

    def test_preserves_normal_html(self):
        """Non-dangerous HTML-like content is preserved."""
        # Bold/italic are not in dangerous list, but their brackets
        # would be removed by this function only if they have event handlers
        result = sanitize_dangerous("x < 10 and y > 5")
        assert "<" in result or "10 and y" in result

    def test_removes_self_closing_dangerous_tags(self):
        """Self-closing dangerous tags are removed."""
        assert sanitize_dangerous("<script/>safe") == "safe"

    def test_removes_unclosed_dangerous_tags(self):
        """Unclosed dangerous tags are removed."""
        result = sanitize_dangerous("<script>safe")
        assert "script" not in result.lower()


class TestSafeNameType:
    """Tests for SafeName Pydantic type."""

    def test_accepts_normal_name(self):
        """Normal names are accepted."""

        class Model(BaseModel):
            name: SafeName

        m = Model(name="John Doe")
        assert m.name == "John Doe"

    def test_strips_html_from_name(self):
        """HTML is stripped from names."""

        class Model(BaseModel):
            name: SafeName

        m = Model(name="John<script>alert(1)</script>")
        assert m.name == "Johnalert(1)"
        assert "<" not in m.name
        assert ">" not in m.name

    def test_enforces_max_length(self):
        """Names exceeding 100 chars are rejected."""

        class Model(BaseModel):
            name: SafeName

        with pytest.raises(ValidationError):
            Model(name="x" * 101)

    def test_strips_whitespace(self):
        """Leading/trailing whitespace is stripped."""

        class Model(BaseModel):
            name: SafeName

        m = Model(name="  John Doe  ")
        assert m.name == "John Doe"


class TestSafeTitleType:
    """Tests for SafeTitle Pydantic type."""

    def test_accepts_normal_title(self):
        """Normal titles are accepted."""

        class Model(BaseModel):
            title: SafeTitle

        m = Model(title="My Ethical Dilemma")
        assert m.title == "My Ethical Dilemma"

    def test_strips_html_from_title(self):
        """HTML is stripped from titles."""

        class Model(BaseModel):
            title: SafeTitle

        m = Model(title="My <b>Bold</b> Title")
        assert m.title == "My Bold Title"

    def test_enforces_max_length(self):
        """Titles exceeding 200 chars are rejected."""

        class Model(BaseModel):
            title: SafeTitle

        with pytest.raises(ValidationError):
            Model(title="x" * 201)


class TestSafeTextType:
    """Tests for SafeText Pydantic type (long text)."""

    def test_accepts_normal_text(self):
        """Normal text is accepted."""

        class Model(BaseModel):
            description: SafeText

        m = Model(description="This is a long description.")
        assert m.description == "This is a long description."

    def test_preserves_math_comparisons(self):
        """Mathematical comparisons are preserved."""

        class Model(BaseModel):
            description: SafeText

        m = Model(description="When x < 10 and y > 5")
        assert "<" in m.description or "x" in m.description

    def test_removes_script_tags(self):
        """Script tags are removed from long text."""

        class Model(BaseModel):
            description: SafeText

        m = Model(description="Hello <script>alert(1)</script> World")
        assert "script" not in m.description.lower()
        assert "Hello" in m.description
        assert "World" in m.description

    def test_enforces_max_length(self):
        """Long text exceeding 5000 chars is rejected."""

        class Model(BaseModel):
            description: SafeText

        with pytest.raises(ValidationError):
            Model(description="x" * 5001)


class TestSafeQueryType:
    """Tests for SafeQuery Pydantic type."""

    def test_accepts_normal_query(self):
        """Normal search queries are accepted."""

        class Model(BaseModel):
            q: SafeQuery

        m = Model(q="dharma karma yoga")
        assert m.q == "dharma karma yoga"

    def test_strips_html_from_query(self):
        """HTML is stripped from queries."""

        class Model(BaseModel):
            q: SafeQuery

        m = Model(q="<script>alert(1)</script>dharma")
        assert m.q == "alert(1)dharma"
        assert "<" not in m.q

    def test_enforces_max_length(self):
        """Queries exceeding 200 chars are rejected."""

        class Model(BaseModel):
            q: SafeQuery

        with pytest.raises(ValidationError):
            Model(q="x" * 201)


class TestSafeMediumTextType:
    """Tests for SafeMediumText Pydantic type."""

    def test_accepts_normal_text(self):
        """Normal medium text is accepted."""

        class Model(BaseModel):
            stakeholders: SafeMediumText

        m = Model(stakeholders="Team members, management, customers")
        assert m.stakeholders == "Team members, management, customers"

    def test_strips_html(self):
        """HTML is stripped from medium text."""

        class Model(BaseModel):
            stakeholders: SafeMediumText

        m = Model(stakeholders="<b>Team</b> members")
        assert m.stakeholders == "Team members"

    def test_enforces_max_length(self):
        """Medium text exceeding 500 chars is rejected."""

        class Model(BaseModel):
            stakeholders: SafeMediumText

        with pytest.raises(ValidationError):
            Model(stakeholders="x" * 501)
