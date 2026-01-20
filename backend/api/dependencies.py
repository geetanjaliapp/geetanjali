"""FastAPI dependencies for common patterns across endpoints."""

import logging
import secrets
from datetime import datetime, timedelta

from fastapi import Depends, Header, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from api.errors import (
    ERR_AUTH_REQUIRED,
    ERR_CASE_ACCESS_DENIED,
    ERR_CASE_NOT_FOUND,
    ERR_OUTPUT_ACCESS_DENIED,
    ERR_OUTPUT_NOT_FOUND,
    validation_error,
)
from api.middleware.auth import (
    get_optional_user,
    get_session_id,
    user_can_access_resource,
)
from config import settings
from db.connection import get_db
from db.repositories.case_repository import CaseRepository
from models.case import Case, CaseStatus
from models.output import Output
from models.user import User
from services.cache import cache
from services.content_filter import ContentPolicyError, validate_submission_content

logger = logging.getLogger(__name__)

# Public exports
__all__ = [
    "limiter",
    "verify_admin_api_key",
    "check_daily_limit",
    "increment_daily_consult_count",
    "get_case_with_access",
    "get_case_with_auth",
    "get_output_with_access",
    "get_session_id",  # Re-exported from api.middleware.auth
    "validate_content",
]

# Shared rate limiter instance for all API modules
limiter = Limiter(key_func=get_remote_address)


def validate_content(
    title: str,
    description: str,
    *,
    context: str = "submission",
    **log_extra: str | int,
) -> None:
    """
    Validate content against content policy, raising HTTPException on violation.

    This is a convenience wrapper around validate_submission_content that handles
    the ContentPolicyError -> HTTPException conversion with consistent logging.

    Args:
        title: Title/subject text to validate
        description: Description/body text to validate
        context: Context label for logging (e.g., "submission", "follow-up", "contact")
        **log_extra: Additional fields to include in log extra dict (e.g., case_id="...")

    Raises:
        HTTPException 422: If content violates content policy

    Example:
        validate_content(case_data.title, case_data.description)
        validate_content("", message.content, context="follow-up", case_id=case.id)
    """
    try:
        validate_submission_content(title, description)
    except ContentPolicyError as e:
        extra = {"violation_type": e.violation_type.value, **log_extra}
        logger.warning(
            f"Content policy violation in {context} (type={e.violation_type.value})",
            extra=extra,
        )
        raise validation_error(e.message)


def verify_admin_api_key(
    x_api_key: str | None = Header(None, alias="X-API-Key"),
) -> bool:
    """
    Verify admin API key for protected endpoints.

    This is a simple guard until proper admin user roles are implemented.
    Requires X-API-Key header matching the configured API_KEY.
    Uses constant-time comparison to prevent timing attacks.

    Security: Returns 404 (not 401/422) when key is missing or invalid
    to avoid revealing endpoint existence to unauthorized callers.
    """
    if not x_api_key or not secrets.compare_digest(x_api_key, settings.API_KEY):
        raise HTTPException(status_code=404, detail="Not found")
    return True


async def check_daily_limit(
    request: Request,
    db: Session = Depends(get_db),
    session_id: str | None = Depends(get_session_id),
) -> None:
    """
    Check if user/IP has exceeded daily consultation limit.

    Raises HTTPException 429 if limit exceeded.
    Tracks by session_id (for registered users) or IP (for anonymous).
    Uses Redis cache with 24-hour TTL for auto-reset.

    Args:
        request: FastAPI request (for IP extraction)
        db: Database session (unused but required for dependency pattern)
        session_id: Session ID from header (for tracking registered users)

    Raises:
        HTTPException: 429 if daily limit exceeded

    Note:
        Limit resets at UTC midnight. Cache key format: consult:daily:TYPE:KEY:YYYY-MM-DD
    """
    if not settings.DAILY_CONSULT_LIMIT_ENABLED:
        return  # Feature flag disabled - skip check

    # Get client identifier (prefer session_id, fallback to IP)
    client_ip = request.client.host if request.client else "unknown"
    tracking_key = session_id or client_ip
    tracking_type = "session" if session_id else "ip"

    # Get today's date in UTC (ISO format for consistency)
    today = datetime.utcnow().date().isoformat()  # YYYY-MM-DD
    cache_key = f"consult:daily:{tracking_type}:{tracking_key}:{today}"

    # Get current consumption for today
    current_count = cache.get(cache_key)
    if current_count is None:
        current_count = 0
    else:
        current_count = int(current_count)

    # Check against limit
    if current_count >= settings.DAILY_CONSULT_LIMIT:
        logger.warning(
            "Daily consultation limit exceeded",
            extra={
                "tracking_type": tracking_type,
                "tracking_key": tracking_key,
                "current_count": current_count,
                "limit": settings.DAILY_CONSULT_LIMIT,
                "date": today,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="🙏 Daily reflection pause\n\n"
                   "You've engaged in many thoughtful consultations today.\n"
                   "The Geeta teaches that wisdom comes from reflection, "
                   "not constant inquiry.\n"
                   "Return tomorrow to continue your journey.",
        )


def increment_daily_consult_count(
    request: Request,
    session_id: str | None = None,
) -> None:
    """
    Increment daily consumption count after successful consultation.

    Called AFTER consultation is successfully queued/created.
    Tracks by session_id or IP.

    Args:
        request: FastAPI request (for IP extraction)
        session_id: Session ID from header (if provided)
    """
    if not settings.DAILY_CONSULT_LIMIT_ENABLED:
        return

    client_ip = request.client.host if request.client else "unknown"
    tracking_key = session_id or client_ip
    tracking_type = "session" if session_id else "ip"

    today = datetime.utcnow().date().isoformat()
    cache_key = f"consult:daily:{tracking_type}:{tracking_key}:{today}"

    # Increment with 24hr TTL (auto-resets next day)
    cache.incr(cache_key, ttl=86400)  # 86400 = 24 hours


class CaseAccessDep:
    """
    Dependency that retrieves a case and validates access.

    Use as a dependency to get a case with access control:

        @router.get("/cases/{case_id}")
        def get_case(case: Case = Depends(get_case_with_access)):
            return case
    """

    def __init__(self, require_auth: bool = False):
        """
        Args:
            require_auth: If True, requires authenticated user (not anonymous)
        """
        self.require_auth = require_auth

    def __call__(
        self,
        case_id: str,
        db: Session = Depends(get_db),
        current_user: User | None = Depends(get_optional_user),
        session_id: str | None = Depends(get_session_id),
    ) -> Case:
        """
        Retrieve case and validate access.

        Args:
            case_id: Case ID from path parameter
            db: Database session
            current_user: Authenticated user (optional)
            session_id: Session ID from X-Session-ID header

        Returns:
            Case object if found and accessible

        Raises:
            HTTPException 404: Case not found
            HTTPException 403: Access denied
            HTTPException 401: Auth required but not provided
        """
        if self.require_auth and current_user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=ERR_AUTH_REQUIRED,
            )

        repo = CaseRepository(db)
        case = repo.get(case_id)

        if not case:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=ERR_CASE_NOT_FOUND,
            )

        if not user_can_access_resource(
            resource_user_id=case.user_id,
            resource_session_id=case.session_id,
            current_user=current_user,
            session_id=session_id,
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=ERR_CASE_ACCESS_DENIED,
            )

        # Auto-fail stale processing cases (stuck > STALE_PROCESSING_TIMEOUT)
        if case.status == CaseStatus.PROCESSING:
            timeout_seconds = settings.STALE_PROCESSING_TIMEOUT
            # Use naive UTC to match database format (datetime.utcnow)
            cutoff = datetime.utcnow() - timedelta(seconds=timeout_seconds)
            # updated_at tracks when status changed to PROCESSING
            if case.updated_at and case.updated_at < cutoff:
                logger.warning(
                    f"Auto-failing stale case {case.id}: processing for "
                    f">{timeout_seconds}s (updated_at={case.updated_at})"
                )
                case.status = CaseStatus.FAILED
                db.commit()

        return case


# Pre-configured dependency instances
get_case_with_access = CaseAccessDep(require_auth=False)
get_case_with_auth = CaseAccessDep(require_auth=True)


class OutputAccessDep:
    """
    Dependency that retrieves an output and validates access via its parent case.

    Use as a dependency to get an output with access control:

        @router.get("/outputs/{output_id}")
        def get_output(output: Output = Depends(get_output_with_access)):
            return output
    """

    def __init__(self, require_auth: bool = False):
        """
        Args:
            require_auth: If True, requires authenticated user (not anonymous)
        """
        self.require_auth = require_auth

    def __call__(
        self,
        output_id: str,
        db: Session = Depends(get_db),
        current_user: User | None = Depends(get_optional_user),
        session_id: str | None = Depends(get_session_id),
    ) -> Output:
        """
        Retrieve output and validate access via parent case.

        Args:
            output_id: Output ID from path parameter
            db: Database session
            current_user: Authenticated user (optional)
            session_id: Session ID from X-Session-ID header

        Returns:
            Output object if found and accessible

        Raises:
            HTTPException 404: Output or parent case not found
            HTTPException 403: Access denied
            HTTPException 401: Auth required but not provided
        """
        if self.require_auth and current_user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=ERR_AUTH_REQUIRED,
            )

        # Fetch the output
        output = db.query(Output).filter(Output.id == output_id).first()
        if not output:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=ERR_OUTPUT_NOT_FOUND,
            )

        # Fetch parent case to check access
        repo = CaseRepository(db)
        case = repo.get(output.case_id)

        if not case:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=ERR_CASE_NOT_FOUND,
            )

        if not user_can_access_resource(
            resource_user_id=case.user_id,
            resource_session_id=case.session_id,
            current_user=current_user,
            session_id=session_id,
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=ERR_OUTPUT_ACCESS_DENIED,
            )

        return output


get_output_with_access = OutputAccessDep(require_auth=False)
