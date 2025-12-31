"""Authentication API endpoints."""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Request,
    Response,
    status,
)
from sqlalchemy.orm import Session

from api.dependencies import limiter
from api.errors import (
    ERR_INVALID_CREDENTIALS,
    ERR_INVALID_REFRESH_TOKEN,
    ERR_USER_NOT_FOUND,
)
from api.middleware.auth import get_current_user, get_session_id
from api.schemas import (
    AuthResponse,
    DeleteAccountRequest,
    EmailVerificationResponse,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RefreshResponse,
    ResetPasswordRequest,
    SignupRequest,
    UserResponse,
)
from config import settings
from db.connection import get_db
from db.repositories.case_repository import CaseRepository
from db.repositories.refresh_token_repository import RefreshTokenRepository
from db.repositories.user_repository import UserRepository
from models.user import User
from services.email import (
    send_account_deleted_email,
    send_account_verification_email,
    send_password_changed_email,
    send_password_reset_email,
)
from utils.auth import (
    hash_password,
    validate_email,
    validate_password_strength,
    verify_password,
)
from utils.csrf import generate_csrf_token, set_csrf_cookie
from utils.jwt import create_access_token, create_refresh_token

# Email verification token settings
EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS = 24

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
        email_verified=user.email_verified,
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
    existing_user = user_repo.get_by_email(signup_data.email)

    if existing_user:
        if existing_user.is_active:
            # Active user with same email - reject with vague message
            # Prevents account enumeration (doesn't confirm email exists)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to create account. If you already have an account, try signing in or resetting your password.",
            )
        else:
            # Inactive user - reactivate with fresh data (fresh start)
            logger.info(f"Reactivating inactive account: {existing_user.id}")
            password_hash = hash_password(signup_data.password)
            user_repo.update(
                existing_user.id,
                {
                    "is_active": True,
                    "deleted_at": None,
                    "name": signup_data.name,
                    "password_hash": password_hash,
                    "email_verified": False,  # Reset verification
                    "email_verification_token": None,  # Clear old tokens
                    "email_verification_expires_at": None,
                    "email_verified_at": None,
                    "last_login": None,
                },
            )
            user = user_repo.get(existing_user.id)
            assert user is not None  # Just updated, must exist
    else:
        # New user - create fresh account
        password_hash = hash_password(signup_data.password)
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

    # Generate and send email verification
    verification_token = secrets.token_urlsafe(32)
    verification_expires = datetime.utcnow() + timedelta(
        hours=EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS
    )
    user_repo.set_email_verification_token(
        user, verification_token, verification_expires
    )

    verify_url = f"{settings.FRONTEND_URL}/verify-email/{verification_token}"
    email_sent = send_account_verification_email(user.email, user.name, verify_url)
    if not email_sent:
        logger.warning(f"Failed to send verification email to {user.email}")

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

    # Check user exists, is active, and has password
    # Inactive users are treated as non-existent (don't reveal account state)
    if not user or not user.is_active or not user.password_hash:
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
            detail=ERR_INVALID_REFRESH_TOKEN,
        )

    # Get user
    user_repo = UserRepository(db)
    user = user_repo.get(token_record.user_id)

    # Check user exists and is active
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=ERR_USER_NOT_FOUND
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
    # Token ID: SHA-256 hash for O(1) indexed lookup
    reset_token_id = hashlib.sha256(reset_token.encode()).hexdigest()
    # Token hash: bcrypt for verification (defense in depth)
    reset_token_hash = hash_password(reset_token)
    reset_token_expires = datetime.utcnow() + timedelta(hours=RESET_TOKEN_EXPIRE_HOURS)

    # Store both token ID (for lookup) and hash (for verification)
    user_repo.update(
        user.id,
        {
            "reset_token_id": reset_token_id,
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

    # O(1) lookup by token ID (SHA-256 hash of token)
    user_repo = UserRepository(db)
    reset_token_id = hashlib.sha256(reset_data.token.encode()).hexdigest()
    user = user_repo.get_by_reset_token_id(reset_token_id)

    if not user:
        logger.warning("Invalid or expired password reset token")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link. Please request a new one.",
        )

    # Verify with bcrypt hash (defense in depth - prevents DB tampering)
    if not user.reset_token_hash or not verify_password(
        reset_data.token, user.reset_token_hash
    ):
        logger.warning("Reset token hash mismatch - possible tampering")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link. Please request a new one.",
        )

    # Update password and clear reset token
    # Also mark email as verified (user proved ownership via email link)
    new_password_hash = hash_password(reset_data.password)
    user_repo.update(
        user.id,
        {
            "password_hash": new_password_hash,
            "reset_token_id": None,
            "reset_token_hash": None,
            "reset_token_expires": None,
            "email_verified": True,
            "email_verified_at": datetime.utcnow(),
            "email_verification_token": None,
            "email_verification_expires_at": None,
        },
    )

    # Revoke all existing refresh tokens for security
    RefreshTokenRepository(db).revoke_all_for_user(user.id)

    # Send password changed confirmation email
    email_sent = send_password_changed_email(user.email, user.name)
    if not email_sent:
        logger.warning(f"Failed to send password changed email to {user.email}")

    logger.info(f"Password reset successful for user: {user.id}")
    return MessageResponse(
        message="Your password has been reset successfully. Please sign in with your new password."
    )


@router.delete("/account", response_model=MessageResponse)
@limiter.limit("3/hour")
async def delete_account(
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    delete_request: DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete current user's account (soft delete).

    Requires password re-authentication to prevent accidental deletion
    or deletion from stolen JWT tokens.

    This will:
    - Delete all user's cases, preferences, and refresh tokens (CASCADE data)
    - Nullify user_id on feedback and subscriber records (SET NULL data)
    - Mark user as inactive with deleted_at timestamp
    - Clear password hash
    - Send goodbye email (in background)

    The user can re-register with the same email later (fresh start).

    Args:
        request: FastAPI request object
        response: FastAPI response object
        delete_request: Request body containing password for re-auth
        db: Database session
        current_user: Current authenticated user

    Returns:
        Success message

    Raises:
        HTTPException 401: If password is incorrect
    """
    from models.case import Case
    from models.feedback import Feedback
    from models.refresh_token import RefreshToken
    from models.subscriber import Subscriber
    from models.user_preferences import UserPreferences

    # Verify password for re-authentication
    if not current_user.password_hash or not verify_password(
        delete_request.password, current_user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password. Please verify your password to delete your account.",
        )

    user_id = current_user.id
    user_email = current_user.email
    user_name = current_user.name
    logger.info(f"Account deletion requested for user: {user_id}")

    # Delete CASCADE data (user's own data)
    db.query(Case).filter(Case.user_id == user_id).delete()
    db.query(UserPreferences).filter(UserPreferences.user_id == user_id).delete()
    db.query(RefreshToken).filter(RefreshToken.user_id == user_id).delete()

    # SET NULL data (preserve records for analytics, remove user association)
    db.query(Feedback).filter(Feedback.user_id == user_id).update({"user_id": None})
    db.query(Subscriber).filter(Subscriber.user_id == user_id).update({"user_id": None})

    # Soft delete user
    user_repo = UserRepository(db)
    user_repo.update(
        user_id,
        {
            "is_active": False,
            "deleted_at": datetime.utcnow(),
            "password_hash": None,  # Clear sensitive data
        },
    )

    db.commit()

    # Send account deleted confirmation email in background
    # User has already left, so we don't need to wait for this
    background_tasks.add_task(send_account_deleted_email, user_email, user_name)

    # Clear auth cookies
    response.delete_cookie(key=REFRESH_TOKEN_COOKIE_KEY, path="/")

    logger.info(f"Account deleted (soft delete) for user: {user_id}")
    return MessageResponse(
        message="Your account has been deleted. You can create a new account with the same email if you wish to return."
    )


@router.post("/verify-email/{token}", response_model=EmailVerificationResponse)
@limiter.limit("10/hour")
async def verify_email(
    request: Request,
    token: str,
    db: Session = Depends(get_db),
):
    """
    Verify user email address using token from email.

    Args:
        token: Email verification token
        db: Database session

    Returns:
        Success message

    Raises:
        HTTPException: 400 if token is invalid/expired
    """
    # Validate token format (secrets.token_urlsafe(32) produces ~43 chars)
    if not token or len(token) > 64 or len(token) < 32:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification link.",
        )

    logger.info("Email verification attempt")

    user_repo = UserRepository(db)
    user = user_repo.get_by_email_verification_token(token)

    if not user or not user.is_active:
        logger.warning("Invalid email verification token or inactive user")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification link.",
        )

    # Check if already verified (idempotent)
    if user.email_verified:
        return EmailVerificationResponse(
            message="Your email is already verified.",
            status="already_verified",
        )

    # Check token expiry
    if (
        user.email_verification_expires_at
        and user.email_verification_expires_at < datetime.utcnow()
    ):
        logger.warning(f"Expired email verification token for user: {user.id}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification link has expired. Please request a new one.",
        )

    # Mark email as verified
    user_repo.verify_user_email(user)

    logger.info(f"Email verified for user: {user.id}")
    return EmailVerificationResponse(
        message="Your email has been verified successfully!",
        status="verified",
    )


@router.post("/resend-verification", response_model=MessageResponse)
@limiter.limit("3/hour")
async def resend_verification(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Resend email verification for current user.

    Args:
        db: Database session
        current_user: Current authenticated user

    Returns:
        Success message

    Raises:
        HTTPException: 400 if already verified
    """
    logger.info(f"Resend verification requested for user: {current_user.id}")

    # Check if already verified
    if current_user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your email is already verified.",
        )

    # Generate new verification token
    user_repo = UserRepository(db)
    verification_token = secrets.token_urlsafe(32)
    verification_expires = datetime.utcnow() + timedelta(
        hours=EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS
    )
    user_repo.set_email_verification_token(
        current_user, verification_token, verification_expires
    )

    # Send verification email
    verify_url = f"{settings.FRONTEND_URL}/verify-email/{verification_token}"
    email_sent = send_account_verification_email(
        current_user.email, current_user.name, verify_url
    )

    if not email_sent:
        logger.warning(f"Failed to send verification email to {current_user.email}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification email. Please try again later.",
        )

    logger.info(f"Verification email resent for user: {current_user.id}")
    return MessageResponse(message="Verification email sent. Please check your inbox.")
