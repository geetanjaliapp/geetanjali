"""Tests for request validation (token counting, deduplication)."""

import pytest

from utils.token_counter import check_request_tokens, estimate_tokens


class TestTokenCounting:
    """Tests for token estimation."""

    def test_estimate_tokens_empty(self):
        """Empty string should return 0."""
        assert estimate_tokens("") == 0

    def test_estimate_tokens_short(self):
        """Short text estimate."""
        # "Hello world" = 11 chars → 11/4 = 2.75 → 3
        assert estimate_tokens("Hello world") >= 1

    def test_estimate_tokens_long(self):
        """Longer text estimate."""
        text = "This is a longer question about ethics and morality." * 10
        tokens = estimate_tokens(text)
        assert tokens > 100
        assert tokens < len(text)  # Less than char count

    def test_estimate_tokens_model_parameter(self):
        """Model parameter doesn't change estimate (for future use)."""
        text = "Some text to estimate"
        estimate_gemini = estimate_tokens(text, model="gemini")
        estimate_anthropic = estimate_tokens(text, model="anthropic")
        assert estimate_gemini == estimate_anthropic

    def test_check_request_tokens_valid(self):
        """Normal request should pass validation."""
        result = check_request_tokens(
            "Career dilemma",
            "Should I switch to product management?"
        )
        assert result["valid"]
        assert result["total_tokens"] < 100

    def test_check_request_tokens_invalid(self):
        """Oversized request should raise ValueError."""
        oversized_desc = "x" * 10000
        with pytest.raises(ValueError) as exc_info:
            check_request_tokens("Title", oversized_desc)
        assert "too detailed" in str(exc_info.value)

    def test_check_request_tokens_returns_breakdown(self):
        """Should return token breakdown."""
        result = check_request_tokens(
            "Short title",
            "Short description"
        )
        assert "title_tokens" in result
        assert "description_tokens" in result
        assert "total_tokens" in result
        assert "valid" in result

    def test_check_request_tokens_error_message_helpful(self):
        """Error message should tell user what's wrong."""
        oversized = "x" * 10000
        with pytest.raises(ValueError) as exc_info:
            check_request_tokens("Title", oversized, max_tokens=2000)
        msg = str(exc_info.value)
        assert "too detailed" in msg
        assert "tokens" in msg
        assert "simplify" in msg

    def test_check_request_tokens_custom_limit(self):
        """Should respect custom token limit."""
        # Set low limit
        with pytest.raises(ValueError):
            check_request_tokens(
                "Title",
                "Some description",
                max_tokens=1  # Very restrictive
            )

    def test_estimate_tokens_minimum_one(self):
        """Should return minimum 1 token for non-empty text."""
        # Very short text
        assert estimate_tokens("a") >= 1
        assert estimate_tokens("ab") >= 1

    def test_check_request_tokens_empty_strings(self):
        """Empty title/description should be valid."""
        result = check_request_tokens("", "")
        assert result["valid"]
        assert result["total_tokens"] == 0


@pytest.mark.integration
class TestOversizedCaseRejection:
    """Tests for token validation on case creation."""

    def test_oversized_case_rejected(self, client):
        """Case with too many tokens should be rejected."""
        oversized = "x" * 10000
        response = client.post("/api/v1/cases", json={
            "title": "Title",
            "description": oversized
        })
        assert response.status_code == 422
        assert "too detailed" in response.json()["detail"]

    def test_normal_case_accepted(self, client):
        """Normal case should be accepted."""
        response = client.post("/api/v1/cases", json={
            "title": "Career change",
            "description": "Should I switch to product management? I've been an engineer for 5 years."
        })
        assert response.status_code == 201

    def test_token_validation_before_other_validations(self, client):
        """Token validation should run before content filter."""
        # Oversized request should fail even if content is clean
        oversized = "x" * 10000
        response = client.post("/api/v1/cases", json={
            "title": "Safe title",
            "description": oversized
        })
        assert response.status_code == 422
        assert "too detailed" in response.json()["detail"]

    def test_large_title_counted(self, client):
        """Large title should count toward token limit."""
        large_title = "x" * 5000
        large_desc = "y" * 5000
        response = client.post("/api/v1/cases", json={
            "title": large_title,
            "description": large_desc
        })
        # Both title and description together exceed limit
        assert response.status_code == 422
