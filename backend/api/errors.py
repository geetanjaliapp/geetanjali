"""Centralized error message constants and response builders for API responses.

This module provides a single source of truth for error messages and HTTP error
builders used across the API, improving consistency and maintainability.

Usage (constants):
    from api.errors import ERR_CASE_NOT_FOUND
    raise HTTPException(status_code=404, detail=ERR_CASE_NOT_FOUND)

Usage (builders - preferred):
    from api.errors import not_found, validation_error, unauthorized
    raise not_found("Case")
    raise not_found("Output", output_id)
    raise validation_error("Title is required")
    raise unauthorized()
"""

from fastapi import HTTPException, status

# Authentication errors
ERR_INVALID_CREDENTIALS = "Invalid email or password"
ERR_INVALID_API_KEY = "Invalid or missing API key"
ERR_USER_NOT_FOUND = "User not found"
ERR_AUTH_REQUIRED = "Authentication required"
ERR_INVALID_TOKEN = "Invalid or expired token"
ERR_INVALID_REFRESH_TOKEN = "Invalid or expired refresh token"

# Case errors
ERR_CASE_NOT_FOUND = "Case not found"
ERR_CASE_ACCESS_DENIED = "You don't have access to this case"

# Output errors
ERR_OUTPUT_NOT_FOUND = "Output not found"
ERR_OUTPUT_ACCESS_DENIED = "You don't have access to this output"

# Verse errors
ERR_VERSE_NOT_FOUND = "Verse not found"
ERR_NO_VERSES_IN_DB = "No verses found in database"


# =============================================================================
# HTTP Error Response Builders
# =============================================================================
# These functions create HTTPException instances with consistent formatting.
# Use these instead of manually constructing HTTPException for common cases.


def not_found(resource: str, resource_id: str | None = None) -> HTTPException:
    """
    Create a 404 Not Found response.

    Args:
        resource: Name of the resource (e.g., "Case", "Verse", "Output")
        resource_id: Optional ID that was not found

    Returns:
        HTTPException with 404 status

    Examples:
        raise not_found("Case")
        raise not_found("Output", output_id)
    """
    if resource_id:
        detail = f"{resource} '{resource_id}' not found"
    else:
        detail = f"{resource} not found"
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def validation_error(message: str) -> HTTPException:
    """
    Create a 422 Unprocessable Entity response for validation failures.

    Args:
        message: Description of the validation failure

    Returns:
        HTTPException with 422 status

    Example:
        raise validation_error("Title must be at least 5 characters")
    """
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=message
    )


def bad_request(message: str) -> HTTPException:
    """
    Create a 400 Bad Request response.

    Args:
        message: Description of the bad request

    Returns:
        HTTPException with 400 status

    Example:
        raise bad_request("Invalid date format")
    """
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)


def unauthorized(message: str = ERR_AUTH_REQUIRED) -> HTTPException:
    """
    Create a 401 Unauthorized response.

    Args:
        message: Optional custom message (default: "Authentication required")

    Returns:
        HTTPException with 401 status

    Example:
        raise unauthorized()
        raise unauthorized("Session expired")
    """
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=message)


def forbidden(message: str = "Permission denied") -> HTTPException:
    """
    Create a 403 Forbidden response.

    Args:
        message: Optional custom message (default: "Permission denied")

    Returns:
        HTTPException with 403 status

    Example:
        raise forbidden()
        raise forbidden("You don't have access to this case")
    """
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=message)


def conflict(message: str) -> HTTPException:
    """
    Create a 409 Conflict response.

    Args:
        message: Description of the conflict

    Returns:
        HTTPException with 409 status

    Example:
        raise conflict("Email already registered")
    """
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message)


def rate_limited(message: str = "Too many requests") -> HTTPException:
    """
    Create a 429 Too Many Requests response.

    Args:
        message: Optional custom message

    Returns:
        HTTPException with 429 status

    Example:
        raise rate_limited()
        raise rate_limited("Please wait before trying again")
    """
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=message
    )


def server_error(message: str = "Internal server error") -> HTTPException:
    """
    Create a 500 Internal Server Error response.

    Args:
        message: Optional custom message

    Returns:
        HTTPException with 500 status

    Example:
        raise server_error("Failed to process request")
    """
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=message
    )
