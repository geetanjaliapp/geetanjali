"""Authentication API endpoints."""

import logging
import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session

from api.dependencies import limiter
from api.errors import ERR_INVALID_CREDENTIALS
from api.schemas import (
    SignupRequest,
    LoginRequest,
    AuthResponse,
    RefreshResponse,
    UserResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    MessageResponse,
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
from services.email import send_password_reset_email
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])

REFRESH_TOKEN_COOKIE_KEY = "refresh_token"


def set_auth_cookies(response: Response, refresh_token: str) -> None:
    """Set refresh token and CSRF cookies on response."""
    max_age = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE_KEY,
        value=refresh_token,
        max_age=max_age,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        path="/",  # Ensure cookie is sent for all paths
    )
    set_csrf_cookie(response, generate_csrf_token())


def build_user_response(user: User) -> UserResponse:
    """Build UserResponse from User model."""
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        org_id=user.org_id,
        created_at=user.created_at,
    )


def build_auth_response(user: User, access_token: str) -> AuthResponse:
    """Build AuthResponse with token and user profile."""
    return AuthResponse(
        access_token=access_token,
        token_type="bearer",
        user=build_user_response(user),
    )


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
    logger.info("Signup attempt")

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

    # Create tokens and set cookies
    refresh_token = create_refresh_token()
    RefreshTokenRepository(db).create_for_user(user.id, refresh_token)
    access_token = create_access_token(user.id, user.role)
    set_auth_cookies(response, refresh_token)

    logger.info(f"User created: {user.id}")
    return build_auth_response(user, access_token)


@router.post("/login", response_model=AuthResponse)
@limiter.limit("5/minute")
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
    logger.info("Login attempt")

    # Fetch user by email
    user_repo = UserRepository(db)
    user = user_repo.get_by_email(login_data.email)

    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=ERR_INVALID_CREDENTIALS
        )

    # Verify password
    if not verify_password(login_data.password, user.password_hash):
        logger.warning("Failed login attempt")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=ERR_INVALID_CREDENTIALS
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

    # Create tokens and set cookies
    refresh_token = create_refresh_token()
    RefreshTokenRepository(db).create_for_user(user.id, refresh_token)
    access_token = create_access_token(user.id, user.role)
    set_auth_cookies(response, refresh_token)

    logger.info(f"User logged in: {user.id}")
    return build_auth_response(user, access_token)


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

    # Rotate tokens (security best practice)
    access_token = create_access_token(user.id, user.role)
    token_repo.revoke_token(token_record.id)
    new_refresh_token = create_refresh_token()
    token_repo.create_for_user(user.id, new_refresh_token)
    set_auth_cookies(response, new_refresh_token)

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

    # Clear refresh token cookie (path must match set_cookie)
    response.delete_cookie(key=REFRESH_TOKEN_COOKIE_KEY, path="/")

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Get current authenticated user's profile."""
    return build_user_response(current_user)


# Password reset token settings
RESET_TOKEN_EXPIRE_HOURS = 1
RESET_TOKEN_BYTES = 32


@router.post("/forgot-password", response_model=MessageResponse)
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    forgot_data: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    Request a password reset email.

    Always returns success message to prevent email enumeration.

    Args:
        forgot_data: Email address to send reset link to
        db: Database session

    Returns:
        Success message (always, for security)
    """
    logger.info(f"Password reset requested for: {forgot_data.email}")

    # Always return same message to prevent email enumeration
    success_message = (
        "If an account exists with this email, you will receive a password reset link."
    )

    user_repo = UserRepository(db)
    user = user_repo.get_by_email(forgot_data.email)

    if not user:
        # Don't reveal that user doesn't exist
        logger.info("Password reset requested for non-existent email")
        return MessageResponse(message=success_message)

    # Generate secure reset token
    reset_token = secrets.token_urlsafe(RESET_TOKEN_BYTES)
    reset_token_hash = hash_password(reset_token)
    reset_token_expires = datetime.utcnow() + timedelta(hours=RESET_TOKEN_EXPIRE_HOURS)

    # Store hashed token in database
    user_repo.update(
        user.id,
        {
            "reset_token_hash": reset_token_hash,
            "reset_token_expires": reset_token_expires,
        },
    )

    # Build reset URL
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"

    # Send email (don't fail the request if email fails)
    email_sent = send_password_reset_email(user.email, reset_url)
    if not email_sent:
        logger.warning(f"Failed to send password reset email to {user.email}")

    return MessageResponse(message=success_message)


@router.post("/reset-password", response_model=MessageResponse)
@limiter.limit("5/minute")
async def reset_password(
    request: Request,
    reset_data: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    Reset password using token from email.

    Args:
        reset_data: Reset token and new password
        db: Database session

    Returns:
        Success message

    Raises:
        HTTPException: 400 if token is invalid/expired or password invalid
    """
    logger.info("Password reset attempt")

    # Validate password strength
    is_valid, error_msg = validate_password_strength(reset_data.password)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

    # Find user with matching reset token
    user_repo = UserRepository(db)
    users_with_tokens = user_repo.get_users_with_valid_reset_tokens()

    # Iterate through users and verify token hash
    matching_user = None
    for user in users_with_tokens:
        if user.reset_token_hash and verify_password(
            reset_data.token, user.reset_token_hash
        ):
            matching_user = user
            break

    if not matching_user:
        logger.warning("Invalid or expired password reset token")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link. Please request a new one.",
        )

    user = matching_user

    # Update password and clear reset token
    new_password_hash = hash_password(reset_data.password)
    user_repo.update(
        user.id,
        {
            "password_hash": new_password_hash,
            "reset_token_hash": None,
            "reset_token_expires": None,
        },
    )

    # Revoke all existing refresh tokens for security
    RefreshTokenRepository(db).revoke_all_for_user(user.id)

    logger.info(f"Password reset successful for user: {user.id}")
    return MessageResponse(
        message="Your password has been reset successfully. Please sign in with your new password."
    )
