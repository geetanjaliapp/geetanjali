"""Newsletter API endpoints for Daily Wisdom subscription."""

import logging
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.dependencies import limiter
from api.middleware.auth import get_optional_user
from api.taxonomy import get_goals
from config import settings
from db.connection import get_db
from models import SendTime, Subscriber, User
from services.email import (
    send_newsletter_verification_email,
    send_newsletter_welcome_email,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/newsletter")

# Constants
VERIFICATION_TOKEN_EXPIRY_HOURS = 24


def _mask_email(email: str) -> str:
    """Mask email for logging (PII protection)."""
    if not email or "@" not in email:
        return "***"
    local, domain = email.rsplit("@", 1)
    if len(local) <= 2:
        masked_local = "*" * len(local)
    else:
        masked_local = local[0] + "*" * (len(local) - 2) + local[-1]
    return f"{masked_local}@{domain}"


# =============================================================================
# Request/Response Schemas
# =============================================================================


class SubscribeRequest(BaseModel):
    """Request to subscribe to Daily Wisdom newsletter."""

    email: EmailStr = Field(..., description="Email address for newsletter")
    name: str | None = Field(
        None,
        min_length=1,
        max_length=100,
        description="How to greet subscriber",
    )
    goal_ids: list[str] = Field(
        default_factory=list,
        max_length=10,  # Max 10 goals
        description="Learning goal IDs",
    )
    send_time: str = Field(default="morning", description="Preferred send time")


class SubscribeResponse(BaseModel):
    """Response after subscription request."""

    message: str
    requires_verification: bool = True


class VerifyResponse(BaseModel):
    """Response after email verification."""

    message: str
    email: str
    verified: bool


class UnsubscribeResponse(BaseModel):
    """Response after unsubscribe request."""

    message: str
    email: str


class PreferencesRequest(BaseModel):
    """Request to update subscription preferences."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(
        None,
        min_length=1,
        max_length=100,
    )
    goal_ids: list[str] | None = Field(None, max_length=10)
    send_time: str | None = None


class PreferencesResponse(BaseModel):
    """Response with current preferences."""

    email: str
    name: str | None
    goal_ids: list[str]
    send_time: str
    verified: bool


class StatusResponse(BaseModel):
    """Response for subscription status check."""

    subscribed: bool


# =============================================================================
# Helper Functions
# =============================================================================


def generate_verification_token() -> str:
    """Generate a secure verification token."""
    return secrets.token_urlsafe(32)


def get_subscriber_by_email(db: Session, email: str) -> Subscriber | None:
    """Get subscriber by email address."""
    return db.query(Subscriber).filter(Subscriber.email == email.lower()).first()


def get_subscriber_by_token(db: Session, token: str) -> Subscriber | None:
    """Get subscriber by verification token."""
    return db.query(Subscriber).filter(Subscriber.verification_token == token).first()


def validate_goal_ids(goal_ids: list[str]) -> list[str]:
    """
    Validate goal IDs against the taxonomy.

    Args:
        goal_ids: List of goal IDs to validate

    Returns:
        List of invalid goal IDs (empty if all valid)
    """
    if not goal_ids:
        return []

    valid_goals = set(get_goals().keys())
    invalid = [gid for gid in goal_ids if gid not in valid_goals]
    return invalid


# =============================================================================
# API Endpoints
# =============================================================================


@router.post("/subscribe", response_model=SubscribeResponse)
@limiter.limit("3/hour")
async def subscribe(
    request: Request,
    data: SubscribeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """
    Subscribe to Daily Wisdom newsletter.

    - Creates new subscription or reactivates existing one
    - Sends verification email for double opt-in
    - Rate limited: 3 requests per hour per IP
    """
    email = data.email.lower()

    # Validate send_time
    if data.send_time not in [t.value for t in SendTime]:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid send_time. Must be one of: {[t.value for t in SendTime]}",
        )

    # Validate goal_ids against taxonomy
    if data.goal_ids:
        invalid_goals = validate_goal_ids(data.goal_ids)
        if invalid_goals:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid goal_ids: {invalid_goals}. Use /api/v1/taxonomy/goals for valid options.",
            )

    # Check for existing subscriber
    subscriber = get_subscriber_by_email(db, email)

    if subscriber:
        # Reactivate if previously unsubscribed
        if subscriber.unsubscribed_at:
            subscriber.unsubscribed_at = None
            subscriber.verified = False  # Re-verify
            subscriber.goal_ids = data.goal_ids
            subscriber.send_time = data.send_time
            if data.name:
                subscriber.name = data.name
            # Generate new verification token
            subscriber.verification_token = generate_verification_token()
            subscriber.verification_expires_at = datetime.utcnow() + timedelta(
                hours=VERIFICATION_TOKEN_EXPIRY_HOURS
            )
            try:
                db.commit()
            except Exception:
                db.rollback()
                logger.exception(
                    f"Error reactivating subscription for {_mask_email(email)}"
                )
                raise HTTPException(
                    status_code=500, detail="An error occurred. Please try again."
                )
            logger.info(f"Reactivating subscription for {_mask_email(email)}")
        elif subscriber.verified:
            # Already subscribed and verified
            return SubscribeResponse(
                message="You're already subscribed to Daily Wisdom!",
                requires_verification=False,
            )
        else:
            # Pending verification - resend email
            subscriber.verification_token = generate_verification_token()
            subscriber.verification_expires_at = datetime.utcnow() + timedelta(
                hours=VERIFICATION_TOKEN_EXPIRY_HOURS
            )
            # Update preferences in case they changed
            subscriber.goal_ids = data.goal_ids
            subscriber.send_time = data.send_time
            if data.name:
                subscriber.name = data.name
            try:
                db.commit()
            except Exception:
                db.rollback()
                logger.exception(
                    f"Error resending verification for {_mask_email(email)}"
                )
                raise HTTPException(
                    status_code=500, detail="An error occurred. Please try again."
                )
            logger.info(f"Resending verification for {_mask_email(email)}")
    else:
        # Create new subscriber
        subscriber = Subscriber(
            email=email,
            name=data.name,
            goal_ids=data.goal_ids,
            send_time=data.send_time,
            verification_token=generate_verification_token(),
            verification_expires_at=datetime.utcnow()
            + timedelta(hours=VERIFICATION_TOKEN_EXPIRY_HOURS),
            user_id=current_user.id if current_user else None,
        )
        db.add(subscriber)
        try:
            db.commit()
            db.refresh(subscriber)
            logger.info(f"New subscription created for {_mask_email(email)}")
        except IntegrityError:
            # Race condition: another request created the same email
            db.rollback()
            # Retry lookup and handle as existing subscriber
            subscriber = get_subscriber_by_email(db, email)
            if subscriber and subscriber.verified:
                return SubscribeResponse(
                    message="You're already subscribed to Daily Wisdom!",
                    requires_verification=False,
                )
            elif subscriber:
                # Pending verification - generate new token
                subscriber.verification_token = generate_verification_token()
                subscriber.verification_expires_at = datetime.utcnow() + timedelta(
                    hours=VERIFICATION_TOKEN_EXPIRY_HOURS
                )
                db.commit()
                logger.info(
                    f"Race condition handled, resending verification for {_mask_email(email)}"
                )
            else:
                # Unexpected: IntegrityError but no subscriber found
                logger.error(
                    f"IntegrityError but subscriber not found for {_mask_email(email)}"
                )
                raise HTTPException(
                    status_code=500,
                    detail="An error occurred. Please try again.",
                )

    # Send verification email in background
    verify_url = f"{settings.FRONTEND_URL}/n/verify/{subscriber.verification_token}"
    background_tasks.add_task(
        send_newsletter_verification_email,
        email=subscriber.email,
        name=subscriber.name,
        verify_url=verify_url,
    )

    return SubscribeResponse(
        message="Please check your email to confirm your subscription.",
        requires_verification=True,
    )


@router.post("/verify/{token}", response_model=VerifyResponse)
@limiter.limit("10/hour")
async def verify_subscription(
    request: Request,
    token: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Verify email subscription via confirmation.

    Called when user clicks confirm button on verification page.
    Using POST prevents CSRF via img tags or browser prefetch.
    """
    subscriber = get_subscriber_by_token(db, token)

    if not subscriber:
        raise HTTPException(
            status_code=404, detail="Invalid or expired verification link"
        )

    # Check expiry
    if (
        subscriber.verification_expires_at
        and subscriber.verification_expires_at < datetime.utcnow()
    ):
        raise HTTPException(
            status_code=400,
            detail="Verification link has expired. Please subscribe again.",
        )

    # Already verified
    if subscriber.verified:
        return VerifyResponse(
            message="Your subscription is already verified!",
            email=subscriber.email,
            verified=True,
        )

    # Verify subscriber
    subscriber.verified = True
    subscriber.verified_at = datetime.utcnow()
    # Generate new token for unsubscribe/preferences (replaces verification token)
    unsubscribe_token = generate_verification_token()
    subscriber.verification_token = unsubscribe_token
    subscriber.verification_expires_at = None
    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception(
            f"Error verifying subscription for {_mask_email(subscriber.email)}"
        )
        raise HTTPException(
            status_code=500, detail="An error occurred. Please try again."
        )

    logger.info(f"Subscription verified for {_mask_email(subscriber.email)}")

    unsubscribe_url = f"{settings.FRONTEND_URL}/n/unsubscribe/{unsubscribe_token}"
    preferences_url = f"{settings.FRONTEND_URL}/n/preferences/{unsubscribe_token}"
    background_tasks.add_task(
        send_newsletter_welcome_email,
        email=subscriber.email,
        name=subscriber.name,
        unsubscribe_url=unsubscribe_url,
        preferences_url=preferences_url,
        app_url=settings.FRONTEND_URL,
    )

    return VerifyResponse(
        message="Your subscription is confirmed! You'll receive your first Daily Wisdom soon.",
        email=subscriber.email,
        verified=True,
    )


@router.post("/unsubscribe/{token}", response_model=UnsubscribeResponse)
@limiter.limit("60/minute")
async def unsubscribe(
    request: Request,
    token: str,
    db: Session = Depends(get_db),
):
    """
    Unsubscribe from Daily Wisdom newsletter.

    Called when user confirms unsubscribe on the unsubscribe page.
    Using POST prevents CSRF via img tags or browser prefetch.
    Generous rate limit (60/min) prevents abuse while allowing legitimate use.
    """
    subscriber = get_subscriber_by_token(db, token)

    if not subscriber:
        raise HTTPException(status_code=404, detail="Invalid unsubscribe link")

    if subscriber.unsubscribed_at:
        return UnsubscribeResponse(
            message="You've already been unsubscribed.",
            email=subscriber.email,
        )

    # Soft delete - preserve data for analytics
    subscriber.unsubscribed_at = datetime.utcnow()
    # Rotate token to invalidate old unsubscribe/preferences links
    subscriber.verification_token = generate_verification_token()
    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception(f"Error unsubscribing {_mask_email(subscriber.email)}")
        raise HTTPException(
            status_code=500, detail="An error occurred. Please try again."
        )

    logger.info(f"Unsubscribed: {_mask_email(subscriber.email)}")

    return UnsubscribeResponse(
        message="You've been unsubscribed from Daily Wisdom. We're sorry to see you go!",
        email=subscriber.email,
    )


class StatusWithPrefsResponse(BaseModel):
    """Response for subscription status check with optional preferences."""

    subscribed: bool
    preferences: PreferencesResponse | None = None


@router.get("/status", response_model=StatusWithPrefsResponse)
async def get_subscription_status(
    current_user: User = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """
    Check newsletter subscription status for authenticated user.

    Returns whether the user's email is actively subscribed,
    along with current preferences if subscribed.
    Used to sync localStorage and show update form in Settings.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    subscriber = get_subscriber_by_email(db, current_user.email)
    is_subscribed = subscriber is not None and subscriber.is_active

    if is_subscribed and subscriber:
        return StatusWithPrefsResponse(
            subscribed=True,
            preferences=PreferencesResponse(
                email=subscriber.email,
                name=subscriber.name,
                goal_ids=subscriber.goal_ids or [],
                send_time=subscriber.send_time,
                verified=subscriber.verified,
            ),
        )

    return StatusWithPrefsResponse(subscribed=False)


@router.patch("/my-preferences", response_model=PreferencesResponse)
@limiter.limit("10/hour")
async def update_my_preferences(
    request: Request,
    data: PreferencesRequest,
    current_user: User = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """
    Update subscription preferences for authenticated user.

    Allows updating name, goals, and send time without needing a token.
    Only works for the user's own email subscription.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    subscriber = get_subscriber_by_email(db, current_user.email)

    if not subscriber:
        raise HTTPException(
            status_code=404, detail="No subscription found for your email"
        )

    if subscriber.unsubscribed_at:
        raise HTTPException(
            status_code=400, detail="This subscription is no longer active"
        )

    # Update fields if provided
    if data.name is not None:
        subscriber.name = data.name.strip() if data.name.strip() else None
    if data.goal_ids is not None:
        invalid_goals = validate_goal_ids(data.goal_ids)
        if invalid_goals:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid goal_ids: {invalid_goals}. Use /api/v1/taxonomy/goals for valid options.",
            )
        subscriber.goal_ids = data.goal_ids
    if data.send_time is not None:
        if data.send_time not in [t.value for t in SendTime]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid send_time. Must be one of: {[t.value for t in SendTime]}",
            )
        subscriber.send_time = data.send_time

    try:
        db.commit()
        db.refresh(subscriber)
    except Exception:
        db.rollback()
        logger.exception(
            f"Error updating preferences for {_mask_email(subscriber.email)}"
        )
        raise HTTPException(
            status_code=500, detail="An error occurred. Please try again."
        )

    logger.info(f"Preferences updated via auth for {_mask_email(subscriber.email)}")

    return PreferencesResponse(
        email=subscriber.email,
        name=subscriber.name,
        goal_ids=subscriber.goal_ids or [],
        send_time=subscriber.send_time,
        verified=subscriber.verified,
    )


@router.get("/preferences/{token}", response_model=PreferencesResponse)
@limiter.limit("30/minute")
async def get_preferences(
    request: Request,
    token: str,
    db: Session = Depends(get_db),
):
    """Get current subscription preferences."""
    subscriber = get_subscriber_by_token(db, token)

    if not subscriber:
        raise HTTPException(status_code=404, detail="Invalid link")

    return PreferencesResponse(
        email=subscriber.email,
        name=subscriber.name,
        goal_ids=subscriber.goal_ids or [],
        send_time=subscriber.send_time,
        verified=subscriber.verified,
    )


@router.patch("/preferences/{token}", response_model=PreferencesResponse)
@limiter.limit("10/hour")
async def update_preferences(
    request: Request,
    token: str,
    data: PreferencesRequest,
    db: Session = Depends(get_db),
):
    """Update subscription preferences (goals, time, name)."""
    subscriber = get_subscriber_by_token(db, token)

    if not subscriber:
        raise HTTPException(status_code=404, detail="Invalid link")

    if subscriber.unsubscribed_at:
        raise HTTPException(
            status_code=400, detail="This subscription is no longer active"
        )

    # Update fields if provided
    if data.name is not None:
        # Convert empty string to None
        subscriber.name = data.name.strip() if data.name.strip() else None
    if data.goal_ids is not None:
        # Validate goal_ids against taxonomy
        invalid_goals = validate_goal_ids(data.goal_ids)
        if invalid_goals:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid goal_ids: {invalid_goals}. Use /api/v1/taxonomy/goals for valid options.",
            )
        subscriber.goal_ids = data.goal_ids
    if data.send_time is not None:
        if data.send_time not in [t.value for t in SendTime]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid send_time. Must be one of: {[t.value for t in SendTime]}",
            )
        subscriber.send_time = data.send_time

    try:
        db.commit()
        db.refresh(subscriber)
    except Exception:
        db.rollback()
        logger.exception(
            f"Error updating preferences for {_mask_email(subscriber.email)}"
        )
        raise HTTPException(
            status_code=500, detail="An error occurred. Please try again."
        )

    logger.info(f"Preferences updated for {_mask_email(subscriber.email)}")

    return PreferencesResponse(
        email=subscriber.email,
        name=subscriber.name,
        goal_ids=subscriber.goal_ids or [],
        send_time=subscriber.send_time,
        verified=subscriber.verified,
    )
