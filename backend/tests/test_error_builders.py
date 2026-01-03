"""Tests for API error response builders."""

from fastapi import status

from api.errors import (
    ERR_AUTH_REQUIRED,
    bad_request,
    conflict,
    forbidden,
    not_found,
    rate_limited,
    server_error,
    unauthorized,
    validation_error,
)


class TestNotFound:
    """Tests for not_found error builder."""

    def test_basic_not_found(self):
        """Should create 404 with resource name."""
        exc = not_found("Case")
        assert exc.status_code == status.HTTP_404_NOT_FOUND
        assert exc.detail == "Case not found"

    def test_not_found_with_id(self):
        """Should include resource ID in message."""
        exc = not_found("Output", "abc-123")
        assert exc.status_code == status.HTTP_404_NOT_FOUND
        assert exc.detail == "Output 'abc-123' not found"

    def test_not_found_various_resources(self):
        """Should work with different resource names."""
        for resource in ["Verse", "User", "Subscriber"]:
            exc = not_found(resource)
            assert resource in exc.detail


class TestValidationError:
    """Tests for validation_error builder."""

    def test_validation_error(self):
        """Should create 422 with custom message."""
        exc = validation_error("Title is required")
        assert exc.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert exc.detail == "Title is required"


class TestBadRequest:
    """Tests for bad_request builder."""

    def test_bad_request(self):
        """Should create 400 with custom message."""
        exc = bad_request("Invalid date format")
        assert exc.status_code == status.HTTP_400_BAD_REQUEST
        assert exc.detail == "Invalid date format"


class TestUnauthorized:
    """Tests for unauthorized builder."""

    def test_unauthorized_default(self):
        """Should use default auth required message."""
        exc = unauthorized()
        assert exc.status_code == status.HTTP_401_UNAUTHORIZED
        assert exc.detail == ERR_AUTH_REQUIRED

    def test_unauthorized_custom(self):
        """Should accept custom message."""
        exc = unauthorized("Session expired")
        assert exc.status_code == status.HTTP_401_UNAUTHORIZED
        assert exc.detail == "Session expired"


class TestForbidden:
    """Tests for forbidden builder."""

    def test_forbidden_default(self):
        """Should use default permission denied message."""
        exc = forbidden()
        assert exc.status_code == status.HTTP_403_FORBIDDEN
        assert exc.detail == "Permission denied"

    def test_forbidden_custom(self):
        """Should accept custom message."""
        exc = forbidden("You don't have access to this case")
        assert exc.status_code == status.HTTP_403_FORBIDDEN
        assert "access" in exc.detail


class TestConflict:
    """Tests for conflict builder."""

    def test_conflict(self):
        """Should create 409 with custom message."""
        exc = conflict("Email already registered")
        assert exc.status_code == status.HTTP_409_CONFLICT
        assert exc.detail == "Email already registered"


class TestRateLimited:
    """Tests for rate_limited builder."""

    def test_rate_limited_default(self):
        """Should use default message."""
        exc = rate_limited()
        assert exc.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert exc.detail == "Too many requests"

    def test_rate_limited_custom(self):
        """Should accept custom message."""
        exc = rate_limited("Please wait 60 seconds")
        assert exc.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert "60 seconds" in exc.detail


class TestServerError:
    """Tests for server_error builder."""

    def test_server_error_default(self):
        """Should use default message."""
        exc = server_error()
        assert exc.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert exc.detail == "Internal server error"

    def test_server_error_custom(self):
        """Should accept custom message."""
        exc = server_error("Failed to process request")
        assert exc.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Failed" in exc.detail
