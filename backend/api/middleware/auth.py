"""Authentication middleware for protecting routes."""

import re

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from api.errors import ERR_INVALID_TOKEN, ERR_USER_NOT_FOUND
from db.connection import get_db
from db.repositories.user_repository import UserRepository
from models.user import User
from utils.jwt import decode_access_token

# UUID v4 format regex for session ID validation
SESSION_ID_PATTERN = re.compile(
    r"^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$", re.IGNORECASE
)

# HTTPBearer scheme for extracting Bearer tokens from Authorization header
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    Dependency to get the current authenticated user from JWT token.

    Args:
        credentials: HTTP Authorization credentials (Bearer token)
        db: Database session

    Returns:
        Authenticated User object

    Raises:
        HTTPException: 401 if token is invalid or user not found
    """
    token = credentials.credentials

    # Decode and validate JWT token
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERR_INVALID_TOKEN,
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("user_id")
    if not user_id or not isinstance(user_id, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Fetch user from database
    user_repo = UserRepository(db)
    user = user_repo.get(user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERR_USER_NOT_FOUND,
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user  # type: ignore[no-any-return]


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        HTTPBearer(auto_error=False)
    ),
    db: Session = Depends(get_db),
) -> User | None:
    """
    Dependency to optionally get the current user (doesn't raise error if no token).

    Args:
        credentials: HTTP Authorization credentials (Bearer token), optional
        db: Database session

    Returns:
        User object if authenticated, None otherwise
    """
    if credentials is None:
        return None

    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        if payload is None:
            return None

        user_id = payload.get("user_id")
        if not user_id:
            return None

        user_repo = UserRepository(db)
        if not isinstance(user_id, str):
            return None
        return user_repo.get(user_id)
    except (KeyError, ValueError, TypeError):
        # Handle malformed token payload
        return None


def require_role(required_role: str):
    """
    Dependency factory to require a specific user role.

    Args:
        required_role: Required role (e.g., "scholar", "admin")

    Returns:
        Dependency function

    Example:
        @router.post("/scholar-only")
        def scholar_endpoint(user: User = Depends(require_role("scholar"))):
            ...
    """

    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {required_role}",
            )
        return current_user

    return role_checker


async def get_session_id(
    x_session_id: str | None = Header(None, alias="X-Session-ID"),
) -> str | None:
    """
    Extract and validate session ID from X-Session-ID header for anonymous users.

    Args:
        x_session_id: Session ID from header (must be valid UUID v4 format)

    Returns:
        Session ID if present and valid, None otherwise

    Raises:
        HTTPException: 400 if session ID format is invalid
    """
    if x_session_id is None:
        return None

    # Validate UUID format to prevent injection attacks
    if not SESSION_ID_PATTERN.match(x_session_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid session ID format (expected UUID)",
        )

    return x_session_id


def user_can_access_resource(
    resource_user_id: str | None,
    resource_session_id: str | None,
    current_user: User | None,
    session_id: str | None,
) -> bool:
    """
    Check if a user/session can access a resource.

    Access is granted if:
    - Authenticated user owns the resource (user_id matches)
    - Anonymous session owns the resource (session_id matches and resource has no user_id)

    Args:
        resource_user_id: The user_id of the resource owner
        resource_session_id: The session_id of the resource owner (for anonymous)
        current_user: Current authenticated user (or None)
        session_id: Current session ID (or None)

    Returns:
        True if access is allowed, False otherwise
    """
    # Authenticated user access
    if current_user and resource_user_id:
        return bool(current_user.id == resource_user_id)

    # Anonymous session access
    if not current_user and not resource_user_id:
        # Both anonymous - check session ID match
        if session_id and resource_session_id:
            return session_id == resource_session_id
        # Deny access if session ownership cannot be verified
        # (either request or resource missing session ID)
        return False

    return False
