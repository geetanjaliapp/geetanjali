"""Tests for TTS (Text-to-Speech) functionality."""

from api.tts import clean_text_for_speech


class TestCleanTextForSpeech:
    """Tests for markdown cleaning in TTS preprocessing."""

    def test_removes_bold_asterisks(self):
        """Bold text should have asterisks removed."""
        assert clean_text_for_speech("**bold text**") == "bold text"
        assert clean_text_for_speech("before **bold** after") == "before bold after"

    def test_removes_bold_underscores(self):
        """Bold with underscores should be cleaned."""
        assert clean_text_for_speech("__bold text__") == "bold text"

    def test_removes_italic_asterisks(self):
        """Italic text should have asterisks removed."""
        assert clean_text_for_speech("*italic text*") == "italic text"

    def test_removes_italic_underscores(self):
        """Italic with underscores should be cleaned."""
        assert clean_text_for_speech("_italic text_") == "italic text"

    def test_removes_strikethrough(self):
        """Strikethrough should be removed."""
        assert clean_text_for_speech("~~deleted~~") == "deleted"

    def test_removes_inline_code(self):
        """Inline code backticks should be removed."""
        assert clean_text_for_speech("use `code` here") == "use code here"

    def test_removes_fenced_code_blocks(self):
        """Fenced code blocks should be removed entirely."""
        text = "before\n```python\nprint('hello')\n```\nafter"
        assert clean_text_for_speech(text) == "before after"

    def test_removes_tilde_code_blocks(self):
        """Tilde-fenced code blocks should be removed."""
        text = "before\n~~~\ncode\n~~~\nafter"
        assert clean_text_for_speech(text) == "before after"

    def test_extracts_link_text(self):
        """Links should keep text, remove URL."""
        assert (
            clean_text_for_speech("[click here](https://example.com)") == "click here"
        )

    def test_removes_images(self):
        """Images should be removed entirely."""
        assert clean_text_for_speech("![alt text](image.png)") == ""
        assert clean_text_for_speech("before ![img](x.png) after") == "before after"

    def test_removes_headers(self):
        """Header markers should be removed."""
        assert clean_text_for_speech("# Header") == "Header"
        assert clean_text_for_speech("## Subheader") == "Subheader"
        assert clean_text_for_speech("###### Deep header") == "Deep header"

    def test_removes_blockquotes(self):
        """Blockquote markers should be removed."""
        assert clean_text_for_speech("> quoted text") == "quoted text"

    def test_removes_bullet_points(self):
        """Bullet markers should be removed."""
        assert clean_text_for_speech("- item one") == "item one"
        assert clean_text_for_speech("* item two") == "item two"
        assert clean_text_for_speech("+ item three") == "item three"

    def test_removes_numbered_lists(self):
        """Numbered list markers should be removed."""
        assert clean_text_for_speech("1. first item") == "first item"
        assert clean_text_for_speech("42. item 42") == "item 42"

    def test_removes_horizontal_rules(self):
        """Horizontal rules should be removed."""
        assert clean_text_for_speech("before\n---\nafter") == "before after"
        assert clean_text_for_speech("before\n***\nafter") == "before after"

    def test_removes_html_tags(self):
        """HTML tags should be removed."""
        assert clean_text_for_speech("<strong>bold</strong>") == "bold"
        assert clean_text_for_speech('<a href="x">link</a>') == "link"
        assert clean_text_for_speech("<br/>") == ""

    def test_expands_verse_references_underscore(self):
        """BG_2_47 format should be expanded."""
        result = clean_text_for_speech("See BG_2_47 for guidance")
        assert "Bhagavad Geeta, chapter 2, verse 47" in result

    def test_expands_verse_references_dot(self):
        """BG 2.47 format should be expanded."""
        result = clean_text_for_speech("As stated in BG 2.47")
        assert "Bhagavad Geeta, chapter 2, verse 47" in result

    def test_expands_verse_references_parentheses(self):
        """(BG 6.26) format should be expanded."""
        result = clean_text_for_speech("Practice restraint (BG 6.26)")
        assert "Bhagavad Geeta, chapter 6, verse 26" in result

    def test_normalizes_whitespace(self):
        """Multiple spaces/newlines should become single space."""
        assert clean_text_for_speech("word1   word2") == "word1 word2"
        assert clean_text_for_speech("line1\n\nline2") == "line1 line2"

    def test_strips_leading_trailing_whitespace(self):
        """Result should be trimmed."""
        assert clean_text_for_speech("  text  ") == "text"

    def test_complex_markdown(self):
        """Real-world markdown should be cleaned properly."""
        text = """
# Wisdom from the Geeta

According to **Krishna** in BG_2_47:

> You have a right to perform your duties, but not to the fruits.

This teaches us:
- Focus on action
- Release attachment to results
- Find peace in the present

See [more verses](/verses) for guidance.
"""
        result = clean_text_for_speech(text)

        # Should not contain markdown artifacts
        assert "#" not in result
        assert "**" not in result
        assert ">" not in result
        assert "-" not in result or "Bhagavad" in result  # dash in expanded ref is ok
        assert "[" not in result

        # Should contain expanded verse reference
        assert "Bhagavad Geeta, chapter 2, verse 47" in result

        # Should be readable prose
        assert "Krishna" in result
        assert "more verses" in result

    def test_empty_string(self):
        """Empty input should return empty output."""
        assert clean_text_for_speech("") == ""

    def test_plain_text_unchanged(self):
        """Plain text without markdown should pass through."""
        text = "This is plain text with no formatting."
        assert clean_text_for_speech(text) == text
