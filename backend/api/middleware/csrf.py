"""CSRF protection middleware."""

import logging
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware

from utils.csrf import validate_csrf

logger = logging.getLogger(__name__)

# HTTP methods that require CSRF validation
CSRF_PROTECTED_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Paths exempt from CSRF (auth endpoints need to work without prior CSRF token)
CSRF_EXEMPT_PATHS = {
    "/api/v1/auth/login",
    "/api/v1/auth/signup",
    "/api/v1/auth/refresh",
    "/api/v1/auth/logout",
    "/api/v1/auth/forgot-password",  # Pre-auth flow, no session to protect
    "/api/v1/auth/reset-password",  # Pre-auth flow, uses one-time token
    # Newsletter endpoints - protected by rate limiting and/or secret tokens
    "/api/v1/newsletter/subscribe",  # Rate limited 3/hr, requires email verification
}

# Path prefixes exempt from CSRF (for parameterized routes)
CSRF_EXEMPT_PREFIXES = (
    "/api/v1/newsletter/verify/",      # Token-based auth (token in URL)
    "/api/v1/newsletter/unsubscribe/",  # Token-based auth (token in URL)
    "/api/v1/newsletter/preferences/",  # Token-based auth (token in URL)
)


class CSRFMiddleware(BaseHTTPMiddleware):
    """
    Middleware to validate CSRF tokens on state-changing requests.

    Uses the double-submit cookie pattern:
    - CSRF token is stored in a JS-readable cookie
    - Frontend reads the cookie and sends it in the X-CSRF-Token header
    - This middleware validates that the header matches the cookie
    """

    async def dispatch(self, request: Request, call_next):
        # Skip non-protected methods (GET, HEAD, OPTIONS)
        if request.method not in CSRF_PROTECTED_METHODS:
            return await call_next(request)

        # Skip exempt paths (login, signup, etc.)
        if request.url.path in CSRF_EXEMPT_PATHS:
            return await call_next(request)

        # Skip exempt path prefixes (token-based routes)
        if request.url.path.startswith(CSRF_EXEMPT_PREFIXES):
            return await call_next(request)

        # Skip if request has Bearer token authentication
        # Bearer tokens cannot be automatically sent by browsers (unlike cookies),
        # so they provide equivalent CSRF protection. This also handles edge cases
        # where privacy features (e.g., Data Saver) block JS cookie access.
        auth_header = request.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            return await call_next(request)

        # Skip if no cookies present (API key auth, first-time visitors)
        if not request.cookies:
            return await call_next(request)

        # Skip if no CSRF cookie exists (user hasn't logged in yet)
        from config import settings

        if settings.CSRF_TOKEN_COOKIE_KEY not in request.cookies:
            return await call_next(request)

        # Validate CSRF token
        if not validate_csrf(request):
            # Log detailed failure reason for debugging
            from utils.csrf import get_csrf_from_cookie, get_csrf_from_header

            cookie_token = get_csrf_from_cookie(request)
            header_token = get_csrf_from_header(request)

            if not header_token:
                reason = "missing X-CSRF-Token header"
            elif not cookie_token:
                reason = "missing csrf_token cookie"
            else:
                reason = "token mismatch"

            logger.warning(
                f"CSRF validation failed for {request.method} {request.url.path}: {reason}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="CSRF validation failed"
            )

        return await call_next(request)
