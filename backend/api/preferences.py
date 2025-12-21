"""User preferences API for cross-device sync."""

import logging
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm import Session

from api.dependencies import limiter
from api.middleware.auth import get_current_user
from db.connection import get_db
from models.user import User
from models.user_preferences import UserPreferences

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/users/me", tags=["preferences"])

# Maximum bookmarks per user
MAX_BOOKMARKS = 500

# Valid canonical ID pattern (e.g., BG_2_47, BG_18_78)
CANONICAL_ID_PATTERN = re.compile(r"^BG_\d{1,2}_\d{1,3}$")


# --- Response Schemas ---


class BookmarksResponse(BaseModel):
    """Bookmarks data in preferences response."""

    items: list[str] = Field(default_factory=list)
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReadingProgressResponse(BaseModel):
    """Reading progress data in preferences response."""

    chapter: Optional[int] = None
    verse: Optional[int] = None
    font_size: str = "medium"
    section_prefs: dict = Field(default_factory=dict)
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class LearningGoalResponse(BaseModel):
    """Learning goal data in preferences response."""

    goal_id: Optional[str] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PreferencesResponse(BaseModel):
    """Full preferences response."""

    bookmarks: BookmarksResponse
    reading: ReadingProgressResponse
    learning_goal: LearningGoalResponse

    model_config = {"from_attributes": True}


# --- Request Schemas ---


class BookmarksUpdate(BaseModel):
    """Bookmarks update request."""

    model_config = ConfigDict(extra="forbid")

    items: list[str] = Field(default_factory=list)

    @field_validator("items")
    @classmethod
    def validate_bookmarks(cls, v: list[str]) -> list[str]:
        """Validate bookmark list length and format."""
        if len(v) > MAX_BOOKMARKS:
            raise ValueError(f"Cannot exceed {MAX_BOOKMARKS} bookmarks")
        for item in v:
            if not CANONICAL_ID_PATTERN.match(item):
                raise ValueError(f"Invalid bookmark format: {item}")
        return v


class ReadingProgressUpdate(BaseModel):
    """Reading progress update request (partial)."""

    model_config = ConfigDict(extra="forbid")

    chapter: Optional[int] = None
    verse: Optional[int] = None
    font_size: Optional[str] = None
    section_prefs: Optional[dict] = None


class LearningGoalUpdate(BaseModel):
    """Learning goal update request."""

    model_config = ConfigDict(extra="forbid")

    goal_id: Optional[str] = None


class PreferencesUpdate(BaseModel):
    """Partial preferences update request."""

    model_config = ConfigDict(extra="forbid")

    bookmarks: Optional[BookmarksUpdate] = None
    reading: Optional[ReadingProgressUpdate] = None
    learning_goal: Optional[LearningGoalUpdate] = None


class LocalBookmarks(BaseModel):
    """Local bookmarks for merge request."""

    model_config = ConfigDict(extra="forbid")

    items: list[str] = Field(default_factory=list)
    updated_at: Optional[datetime] = None

    @field_validator("items")
    @classmethod
    def validate_bookmarks(cls, v: list[str]) -> list[str]:
        """Validate bookmark format (allow empty for merge)."""
        for item in v:
            if not CANONICAL_ID_PATTERN.match(item):
                raise ValueError(f"Invalid bookmark format: {item}")
        return v


class LocalReadingProgress(BaseModel):
    """Local reading progress for merge request."""

    model_config = ConfigDict(extra="forbid")

    chapter: Optional[int] = None
    verse: Optional[int] = None
    font_size: Optional[str] = None
    section_prefs: Optional[dict] = None
    updated_at: Optional[datetime] = None


class LocalLearningGoal(BaseModel):
    """Local learning goal for merge request."""

    model_config = ConfigDict(extra="forbid")

    goal_id: Optional[str] = None
    updated_at: Optional[datetime] = None


class LocalPreferences(BaseModel):
    """Local preferences to merge with server."""

    model_config = ConfigDict(extra="forbid")

    bookmarks: Optional[LocalBookmarks] = None
    reading: Optional[LocalReadingProgress] = None
    learning_goal: Optional[LocalLearningGoal] = None


# --- Helper Functions ---


def get_or_create_preferences(db: Session, user_id: str) -> UserPreferences:
    """Get user preferences, creating if doesn't exist."""
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == user_id).first()

    if prefs is None:
        prefs = UserPreferences(user_id=user_id)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
        logger.info(f"Created preferences for user {user_id}")

    return prefs


def build_preferences_response(prefs: UserPreferences) -> PreferencesResponse:
    """Build PreferencesResponse from UserPreferences model."""
    return PreferencesResponse(
        bookmarks=BookmarksResponse(
            items=prefs.bookmarks or [],
            updated_at=prefs.bookmarks_updated_at,
        ),
        reading=ReadingProgressResponse(
            chapter=prefs.reading_chapter,
            verse=prefs.reading_verse,
            font_size=prefs.reading_font_size,
            section_prefs=prefs.reading_section_prefs or {},
            updated_at=prefs.reading_updated_at,
        ),
        learning_goal=LearningGoalResponse(
            goal_id=prefs.learning_goal_id,
            updated_at=prefs.learning_goal_updated_at,
        ),
    )


# --- Endpoints ---


@router.get("/preferences", response_model=PreferencesResponse)
@limiter.limit("30/minute")
async def get_preferences(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PreferencesResponse:
    """
    Get current user's preferences.

    Creates empty preferences if none exist.
    """
    prefs = get_or_create_preferences(db, current_user.id)
    return build_preferences_response(prefs)


@router.put("/preferences", response_model=PreferencesResponse)
@limiter.limit("30/minute")
async def update_preferences(
    request: Request,
    data: PreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PreferencesResponse:
    """
    Update user preferences (partial update).

    Only updates fields that are provided.
    """
    prefs = get_or_create_preferences(db, current_user.id)
    now = datetime.now(timezone.utc)

    if data.bookmarks is not None:
        prefs.bookmarks = data.bookmarks.items[:MAX_BOOKMARKS]
        prefs.bookmarks_updated_at = now
        logger.debug(f"Updated bookmarks for user {current_user.id}")

    if data.reading is not None:
        if data.reading.chapter is not None:
            prefs.reading_chapter = data.reading.chapter
        if data.reading.verse is not None:
            prefs.reading_verse = data.reading.verse
        if data.reading.font_size is not None:
            prefs.reading_font_size = data.reading.font_size
        if data.reading.section_prefs is not None:
            prefs.reading_section_prefs = data.reading.section_prefs
        prefs.reading_updated_at = now

    if data.learning_goal is not None:
        prefs.learning_goal_id = data.learning_goal.goal_id
        prefs.learning_goal_updated_at = now

    db.commit()
    db.refresh(prefs)

    return build_preferences_response(prefs)


@router.post("/preferences/merge", response_model=PreferencesResponse)
@limiter.limit("10/minute")
async def merge_preferences(
    request: Request,
    local: LocalPreferences,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PreferencesResponse:
    """
    Merge local preferences with server.

    Used on login to combine localStorage data with server data.

    Merge strategy:
    - Bookmarks: Union (combine both sets, no duplicates)
    - Reading: Most recent timestamp wins
    - Goal: Most recent timestamp wins
    """
    prefs = get_or_create_preferences(db, current_user.id)
    now = datetime.now(timezone.utc)

    # Bookmarks: Union merge
    if local.bookmarks:
        server_set = set(prefs.bookmarks or [])
        local_set = set(local.bookmarks.items or [])
        merged = list(server_set | local_set)[:MAX_BOOKMARKS]

        if merged != (prefs.bookmarks or []):
            prefs.bookmarks = merged
            prefs.bookmarks_updated_at = now
            logger.info(
                f"Merged bookmarks for user {current_user.id}: "
                f"{len(server_set)} server + {len(local_set)} local = {len(merged)} merged"
            )

    # Reading: Most recent wins
    if local.reading:
        local_ts = local.reading.updated_at or datetime.min
        server_ts = prefs.reading_updated_at or datetime.min

        if local_ts > server_ts:
            # Local is newer - use local values
            if local.reading.chapter is not None:
                prefs.reading_chapter = local.reading.chapter
            if local.reading.verse is not None:
                prefs.reading_verse = local.reading.verse
            if local.reading.font_size is not None:
                prefs.reading_font_size = local.reading.font_size
            if local.reading.section_prefs is not None:
                prefs.reading_section_prefs = local.reading.section_prefs
            prefs.reading_updated_at = now
            logger.debug(f"Reading progress: local wins for user {current_user.id}")

    # Learning goal: Most recent wins
    if local.learning_goal:
        local_ts = local.learning_goal.updated_at or datetime.min
        server_ts = prefs.learning_goal_updated_at or datetime.min

        if local_ts > server_ts:
            prefs.learning_goal_id = local.learning_goal.goal_id
            prefs.learning_goal_updated_at = now
            logger.debug(f"Learning goal: local wins for user {current_user.id}")

    db.commit()
    db.refresh(prefs)

    return build_preferences_response(prefs)
