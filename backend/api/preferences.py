"""User preferences API for cross-device sync."""

import logging
import re
from datetime import datetime, timezone

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

# Minimum datetime for comparison (timezone-aware)
MIN_DATETIME = datetime.min.replace(tzinfo=timezone.utc)


def normalize_timestamp(ts: datetime | None) -> datetime:
    """Normalize timestamp to timezone-aware UTC for comparison."""
    if ts is None:
        return MIN_DATETIME
    # Make naive datetimes UTC-aware
    if ts.tzinfo is None:
        return ts.replace(tzinfo=timezone.utc)
    return ts


# Maximum favorites per user
MAX_FAVORITES = 500

# Valid canonical ID pattern (e.g., BG_2_47, BG_18_78)
CANONICAL_ID_PATTERN = re.compile(r"^BG_\d{1,2}_\d{1,3}$")


# --- Response Schemas ---


class FavoritesResponse(BaseModel):
    """Favorites data in preferences response."""

    items: list[str] = Field(default_factory=list)
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReadingProgressResponse(BaseModel):
    """Reading progress data in preferences response."""

    chapter: int | None = None
    verse: int | None = None
    font_size: str = "medium"
    section_prefs: dict = Field(default_factory=dict)
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class LearningGoalsResponse(BaseModel):
    """Learning goals data in preferences response."""

    goal_ids: list[str] = Field(default_factory=list)
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class ThemeResponse(BaseModel):
    """Theme preferences data in response."""

    mode: str = "system"  # light/dark/system
    theme_id: str = "default"  # default/sutra/serenity/forest
    font_family: str = "mixed"  # serif/sans/mixed
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class PreferencesResponse(BaseModel):
    """Full preferences response."""

    favorites: FavoritesResponse
    reading: ReadingProgressResponse
    learning_goals: LearningGoalsResponse
    theme: ThemeResponse

    model_config = {"from_attributes": True}


# --- Request Schemas ---


class FavoritesUpdate(BaseModel):
    """Favorites update request."""

    model_config = ConfigDict(extra="forbid")

    items: list[str] = Field(default_factory=list)

    @field_validator("items")
    @classmethod
    def validate_favorites(cls, v: list[str]) -> list[str]:
        """Validate favorites list length and format."""
        if len(v) > MAX_FAVORITES:
            raise ValueError(f"Cannot exceed {MAX_FAVORITES} favorites")
        for item in v:
            if not CANONICAL_ID_PATTERN.match(item):
                raise ValueError(f"Invalid verse ID format: {item}")
        return v


class ReadingProgressUpdate(BaseModel):
    """Reading progress update request (partial)."""

    model_config = ConfigDict(extra="forbid")

    chapter: int | None = None
    verse: int | None = None
    font_size: str | None = None
    section_prefs: dict | None = None


class LearningGoalsUpdate(BaseModel):
    """Learning goals update request."""

    model_config = ConfigDict(extra="forbid")

    goal_ids: list[str] = Field(default_factory=list)


class ThemeUpdate(BaseModel):
    """Theme preferences update request."""

    model_config = ConfigDict(extra="forbid")

    mode: str | None = None  # light/dark/system
    theme_id: str | None = None  # default/sutra/serenity/forest
    font_family: str | None = None  # serif/sans/mixed

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str | None) -> str | None:
        if v is not None and v not in ("light", "dark", "system"):
            raise ValueError("mode must be light, dark, or system")
        return v

    @field_validator("theme_id")
    @classmethod
    def validate_theme_id(cls, v: str | None) -> str | None:
        if v is not None and v not in ("default", "sutra", "serenity", "forest"):
            raise ValueError("theme_id must be default, sutra, serenity, or forest")
        return v

    @field_validator("font_family")
    @classmethod
    def validate_font_family(cls, v: str | None) -> str | None:
        if v is not None and v not in ("serif", "sans", "mixed"):
            raise ValueError("font_family must be serif, sans, or mixed")
        return v


class PreferencesUpdate(BaseModel):
    """Partial preferences update request."""

    model_config = ConfigDict(extra="forbid")

    favorites: FavoritesUpdate | None = None
    reading: ReadingProgressUpdate | None = None
    learning_goals: LearningGoalsUpdate | None = None
    theme: ThemeUpdate | None = None


class LocalFavorites(BaseModel):
    """Local favorites for merge request."""

    model_config = ConfigDict(extra="forbid")

    items: list[str] = Field(default_factory=list)
    updated_at: datetime | None = None

    @field_validator("items")
    @classmethod
    def validate_favorites(cls, v: list[str]) -> list[str]:
        """Validate favorites format (allow empty for merge)."""
        for item in v:
            if not CANONICAL_ID_PATTERN.match(item):
                raise ValueError(f"Invalid verse ID format: {item}")
        return v


class LocalReadingProgress(BaseModel):
    """Local reading progress for merge request."""

    model_config = ConfigDict(extra="forbid")

    chapter: int | None = None
    verse: int | None = None
    font_size: str | None = None
    section_prefs: dict | None = None
    updated_at: datetime | None = None


class LocalLearningGoals(BaseModel):
    """Local learning goals for merge request."""

    model_config = ConfigDict(extra="forbid")

    goal_ids: list[str] = Field(default_factory=list)
    updated_at: datetime | None = None


class LocalTheme(BaseModel):
    """Local theme preferences for merge request."""

    model_config = ConfigDict(extra="forbid")

    mode: str | None = None  # light/dark/system
    theme_id: str | None = None  # default/sutra/serenity/forest
    font_family: str | None = None  # serif/sans/mixed
    updated_at: datetime | None = None


class LocalPreferences(BaseModel):
    """Local preferences to merge with server."""

    model_config = ConfigDict(extra="forbid")

    favorites: LocalFavorites | None = None
    reading: LocalReadingProgress | None = None
    learning_goals: LocalLearningGoals | None = None
    theme: LocalTheme | None = None


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
        favorites=FavoritesResponse(
            items=prefs.favorites or [],
            updated_at=prefs.favorites_updated_at,
        ),
        reading=ReadingProgressResponse(
            chapter=prefs.reading_chapter,
            verse=prefs.reading_verse,
            font_size=prefs.reading_font_size,
            section_prefs=prefs.reading_section_prefs or {},
            updated_at=prefs.reading_updated_at,
        ),
        learning_goals=LearningGoalsResponse(
            goal_ids=prefs.learning_goal_ids or [],
            updated_at=prefs.learning_goal_updated_at,
        ),
        theme=ThemeResponse(
            mode=prefs.theme_mode,
            theme_id=prefs.theme_id,
            font_family=prefs.font_family,
            updated_at=prefs.theme_updated_at,
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

    if data.favorites is not None:
        prefs.favorites = data.favorites.items[:MAX_FAVORITES]
        prefs.favorites_updated_at = now
        logger.debug(f"Updated favorites for user {current_user.id}")

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

    if data.learning_goals is not None:
        prefs.learning_goal_ids = data.learning_goals.goal_ids
        prefs.learning_goal_updated_at = now

    if data.theme is not None:
        if data.theme.mode is not None:
            prefs.theme_mode = data.theme.mode
        if data.theme.theme_id is not None:
            prefs.theme_id = data.theme.theme_id
        if data.theme.font_family is not None:
            prefs.font_family = data.theme.font_family
        prefs.theme_updated_at = now
        logger.debug(f"Updated theme for user {current_user.id}")

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
    - Favorites: Union (combine both sets, no duplicates)
    - Reading: Most recent timestamp wins
    - Learning Goals: Most recent timestamp wins
    - Theme: Most recent timestamp wins
    """
    prefs = get_or_create_preferences(db, current_user.id)
    now = datetime.now(timezone.utc)

    # Favorites: Union merge
    if local.favorites:
        server_set = set(prefs.favorites or [])
        local_set = set(local.favorites.items or [])
        merged = list(server_set | local_set)[:MAX_FAVORITES]

        if merged != (prefs.favorites or []):
            prefs.favorites = merged
            prefs.favorites_updated_at = now
            logger.info(
                f"Merged favorites for user {current_user.id}: "
                f"{len(server_set)} server + {len(local_set)} local = {len(merged)} merged"
            )

    # Reading: Most recent wins
    if local.reading:
        local_ts = normalize_timestamp(local.reading.updated_at)
        server_ts = normalize_timestamp(prefs.reading_updated_at)

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

    # Learning goals: Most recent wins
    if local.learning_goals:
        local_ts = normalize_timestamp(local.learning_goals.updated_at)
        server_ts = normalize_timestamp(prefs.learning_goal_updated_at)

        if local_ts > server_ts:
            prefs.learning_goal_ids = local.learning_goals.goal_ids
            prefs.learning_goal_updated_at = now
            logger.debug(f"Learning goals: local wins for user {current_user.id}")

    # Theme: Most recent wins
    if local.theme:
        local_ts = normalize_timestamp(local.theme.updated_at)
        server_ts = normalize_timestamp(prefs.theme_updated_at)

        if local_ts > server_ts:
            # Local is newer - use local values
            if local.theme.mode is not None:
                prefs.theme_mode = local.theme.mode
            if local.theme.theme_id is not None:
                prefs.theme_id = local.theme.theme_id
            if local.theme.font_family is not None:
                prefs.font_family = local.theme.font_family
            prefs.theme_updated_at = now
            logger.debug(f"Theme: local wins for user {current_user.id}")

    db.commit()
    db.refresh(prefs)

    return build_preferences_response(prefs)
