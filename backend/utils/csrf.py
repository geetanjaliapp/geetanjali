"""CSRF protection utilities."""

import secrets
from typing import Optional
from fastapi import Request, Response

from config import settings


def generate_csrf_token() -> str:
    """Generate a secure random CSRF token."""
    return secrets.token_urlsafe(32)


def set_csrf_cookie(response: Response, token: str) -> None:
    """Set CSRF token cookie (JS-readable for double-submit pattern)."""
    response.set_cookie(
        key=settings.CSRF_TOKEN_COOKIE_KEY,
        value=token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        httponly=False,  # JS must be able to read it
        secure=settings.COOKIE_SECURE,
        samesite="lax",
    )


def get_csrf_from_cookie(request: Request) -> Optional[str]:
    """Get CSRF token from cookie."""
    return request.cookies.get(settings.CSRF_TOKEN_COOKIE_KEY)


def get_csrf_from_header(request: Request) -> Optional[str]:
    """Get CSRF token from header."""
    return request.headers.get(settings.CSRF_HEADER_NAME)


def validate_csrf(request: Request) -> bool:
    """
    Validate that CSRF header matches cookie.

    Uses constant-time comparison to prevent timing attacks.
    """
    cookie_token = get_csrf_from_cookie(request)
    header_token = get_csrf_from_header(request)

    if not cookie_token or not header_token:
        return False

    return secrets.compare_digest(cookie_token, header_token)
