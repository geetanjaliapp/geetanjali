"""Centralized error message constants for API responses.

This module provides a single source of truth for error messages used across
the API, improving consistency and maintainability.

Usage:
    from api.errors import ERR_CASE_NOT_FOUND
    raise HTTPException(status_code=404, detail=ERR_CASE_NOT_FOUND)

For dynamic messages with IDs, use f-strings:
    raise HTTPException(status_code=404, detail=f"Output {output_id} not found")
"""

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
