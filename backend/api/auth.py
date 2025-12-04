"""Authentication API endpoints."""

import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from api.schemas import (
    SignupRequest,
    LoginRequest,
    AuthResponse,
    RefreshResponse,
    UserResponse,
)
from api.middleware.auth import get_current_user, get_session_id
from db.connection import get_db
from db.repositories.user_repository import UserRepository
from db.repositories.refresh_token_repository import RefreshTokenRepository
from db.repositories.case_repository import CaseRepository
from models.user import User
from utils.auth import (
    hash_password,
    verify_password,
    validate_password_strength,
    validate_email,
)
from utils.jwt import create_access_token, create_refresh_token
from utils.csrf import generate_csrf_token, set_csrf_cookie
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])

# Rate limiter for auth endpoints (stricter limits to prevent brute force)
limiter = Limiter(key_func=get_remote_address)

# Cookie settings for refresh token
REFRESH_TOKEN_COOKIE_KEY = "refresh_token"


def get_refresh_token_max_age() -> int:
    """Calculate refresh token cookie max age from settings."""
    return settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60


@router.post(
    "/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED
)
@limiter.limit("5/minute")
async def signup(
    request: Request,
    signup_data: SignupRequest,
    response: Response,
    db: Session = Depends(get_db),
    session_id: str = Depends(get_session_id),
):
    """
    Create a new user account.

    Args:
        signup_data: Signup request data (email, name, password)
        response: FastAPI response object (for setting cookies)
        db: Database session

    Returns:
        AuthResponse with access token and user profile

    Raises:
        HTTPException: 400 if validation fails, 409 if email already exists
    """
    logger.info(f"Signup attempt for email: {signup_data.email}")

    # Validate email format
    if not validate_email(signup_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid email format"
        )

    # Validate password strength
    is_valid, error_msg = validate_password_strength(signup_data.password)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

    # Check if email already exists
    user_repo = UserRepository(db)
    if user_repo.email_exists(signup_data.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email already registered"
        )

    # Hash password
    password_hash = hash_password(signup_data.password)

    # Create user
    user = user_repo.create_user(
        email=signup_data.email,
        name=signup_data.name,
        password_hash=password_hash,
        role="user",
    )

    # Migrate any anonymous session cases to this user
    if session_id:
        case_repo = CaseRepository(db)
        migrated_count = case_repo.migrate_session_to_user(session_id, user.id)
        if migrated_count > 0:
            logger.info(
                f"Migrated {migrated_count} anonymous consultations to user {user.id}"
            )

    # Create refresh token
    refresh_token = create_refresh_token()
    token_repo = RefreshTokenRepository(db)
    token_repo.create_for_user(user.id, refresh_token)

    # Create access token
    access_token = create_access_token(user.id, user.role)

    # Set refresh token as httpOnly cookie
    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE_KEY,
        value=refresh_token,
        max_age=get_refresh_token_max_age(),
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
    )

    # Set CSRF token cookie for double-submit protection
    csrf_token = generate_csrf_token()
    set_csrf_cookie(response, csrf_token)

    logger.info(f"User created successfully: {user.id}")

    return AuthResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role,
            org_id=user.org_id,
            created_at=user.created_at,
        ),
    )


@router.post("/login", response_model=AuthResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    login_data: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
    session_id: str = Depends(get_session_id),
):
    """
    Authenticate user and return access token.

    Args:
        login_data: Login credentials (email, password)
        response: FastAPI response object (for setting cookies)
        db: Database session

    Returns:
        AuthResponse with access token and user profile

    Raises:
        HTTPException: 401 if credentials are invalid
    """
    logger.info(f"Login attempt for email: {login_data.email}")

    # Fetch user by email
    user_repo = UserRepository(db)
    user = user_repo.get_by_email(login_data.email)

    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )

    # Verify password
    if not verify_password(login_data.password, user.password_hash):
        logger.warning(f"Failed login attempt for: {login_data.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )

    # Update last login timestamp
    user_repo.update(user.id, {"last_login": datetime.utcnow()})

    # Migrate any anonymous session cases to this user (if they browsed before logging in)
    if session_id:
        case_repo = CaseRepository(db)
        migrated_count = case_repo.migrate_session_to_user(session_id, user.id)
        if migrated_count > 0:
            logger.info(
                f"Migrated {migrated_count} anonymous consultations to user {user.id} on login"
            )

    # Create refresh token
    refresh_token = create_refresh_token()
    token_repo = RefreshTokenRepository(db)
    token_repo.create_for_user(user.id, refresh_token)

    # Create access token
    access_token = create_access_token(user.id, user.role)

    # Set refresh token as httpOnly cookie
    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE_KEY,
        value=refresh_token,
        max_age=get_refresh_token_max_age(),
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
    )

    # Set CSRF token cookie for double-submit protection
    csrf_token = generate_csrf_token()
    set_csrf_cookie(response, csrf_token)

    logger.info(f"User logged in successfully: {user.id}")

    return AuthResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role,
            org_id=user.org_id,
            created_at=user.created_at,
        ),
    )


@router.post("/refresh", response_model=RefreshResponse)
@limiter.limit("30/minute")
async def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    """
    Refresh access token using refresh token from cookie.

    Args:
        request: FastAPI request object (to read cookies)
        response: FastAPI response object (to set new cookie)
        db: Database session

    Returns:
        RefreshResponse with new access token

    Raises:
        HTTPException: 401 if refresh token is invalid or expired
    """
    # Get refresh token from cookie
    refresh_token = request.cookies.get(REFRESH_TOKEN_COOKIE_KEY)

    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token not found"
        )

    # Validate refresh token
    token_repo = RefreshTokenRepository(db)
    token_record = token_repo.get_by_token(refresh_token)

    if not token_record or not token_record.is_valid():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # Get user
    user_repo = UserRepository(db)
    user = user_repo.get(token_record.user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )

    # Create new access token
    access_token = create_access_token(user.id, user.role)

    # Optional: Rotate refresh token (security best practice)
    # Revoke old token and create new one
    token_repo.revoke_token(token_record.id)
    new_refresh_token = create_refresh_token()
    token_repo.create_for_user(user.id, new_refresh_token)

    # Set new refresh token cookie
    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE_KEY,
        value=new_refresh_token,
        max_age=get_refresh_token_max_age(),
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
    )

    logger.info(f"Token refreshed for user: {user.id}")

    return RefreshResponse(access_token=access_token, token_type="bearer")


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    """
    Logout user by revoking refresh token.

    Args:
        request: FastAPI request object (to read cookies)
        response: FastAPI response object (to clear cookie)
        db: Database session

    Returns:
        204 No Content
    """
    # Get refresh token from cookie
    refresh_token = request.cookies.get(REFRESH_TOKEN_COOKIE_KEY)

    if refresh_token:
        # Revoke refresh token
        token_repo = RefreshTokenRepository(db)
        token_record = token_repo.get_by_token(refresh_token)

        if token_record:
            token_repo.revoke_token(token_record.id)
            logger.info(f"User logged out: {token_record.user_id}")

    # Clear refresh token cookie
    response.delete_cookie(key=REFRESH_TOKEN_COOKIE_KEY)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user's profile.

    Args:
        current_user: Current authenticated user (from JWT)

    Returns:
        User profile
    """
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
        org_id=current_user.org_id,
        created_at=current_user.created_at,
    )
