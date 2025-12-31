"""Pydantic schemas for API request/response validation."""

import re
from datetime import datetime
from typing import Any, Generic, TypeVar

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

from utils.sanitization import SafeMediumText, SafeName, SafeText, SafeTitle

T = TypeVar("T")


# ============================================================================
# User Schemas
# ============================================================================


class UserBase(BaseModel):
    """Base user schema."""

    email: EmailStr
    name: str
    role: str | None = None
    org_id: str | None = None


class UserCreate(UserBase):
    """Schema for creating a user."""

    pass


class UserResponse(UserBase):
    """Schema for user response."""

    id: str
    email_verified: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Authentication Schemas
# ============================================================================


def validate_password_complexity(password: str) -> str:
    """Validate password meets complexity requirements.

    Requirements (reasonable, not overly complex):
    - Minimum 8 characters
    - At least one letter (a-z, A-Z)
    - At least one number (0-9)
    """
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not re.search(r"[a-zA-Z]", password):
        raise ValueError("Password must contain at least one letter")
    if not re.search(r"\d", password):
        raise ValueError("Password must contain at least one number")
    return password


class SignupRequest(BaseModel):
    """Schema for user signup request."""

    email: EmailStr = Field(..., description="User email address")
    name: SafeName = Field(..., min_length=1, description="User full name")
    password: str = Field(
        ...,
        min_length=8,
        description="Password (min 8 chars, requires letter + number)",
    )

    @field_validator("password")
    @classmethod
    def check_password_complexity(cls, v: str) -> str:
        return validate_password_complexity(v)


class LoginRequest(BaseModel):
    """Schema for user login request."""

    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., description="User password")


class AuthResponse(BaseModel):
    """Schema for authentication response (signup/login)."""

    access_token: str = Field(..., description="JWT access token (15 min expiry)")
    token_type: str = Field(default="bearer", description="Token type")
    user: UserResponse = Field(..., description="User profile")


class RefreshResponse(BaseModel):
    """Schema for token refresh response."""

    access_token: str = Field(..., description="New JWT access token")
    token_type: str = Field(default="bearer", description="Token type")


class ForgotPasswordRequest(BaseModel):
    """Schema for forgot password request."""

    email: EmailStr = Field(..., description="User email address")


class ResetPasswordRequest(BaseModel):
    """Schema for reset password request."""

    token: str = Field(..., description="Password reset token")
    password: str = Field(
        ...,
        min_length=8,
        description="New password (min 8 chars, requires letter + number)",
    )

    @field_validator("password")
    @classmethod
    def check_password_complexity(cls, v: str) -> str:
        return validate_password_complexity(v)


class MessageResponse(BaseModel):
    """Generic message response schema."""

    message: str = Field(..., description="Response message")


class EmailVerificationResponse(BaseModel):
    """Response schema for email verification endpoint."""

    message: str = Field(..., description="Response message")
    status: str = Field(
        ...,
        description="Verification status: 'verified' or 'already_verified'",
    )


# ============================================================================
# Case Schemas
# ============================================================================


class CaseBase(BaseModel):
    """Base case schema."""

    title: SafeTitle = Field(..., description="Short problem title")
    description: SafeText = Field(
        ...,
        description="Detailed problem statement (max 5,000 characters)",
    )
    role: str | None = Field(None, max_length=100, description="Requester's role")
    stakeholders: list[SafeMediumText] | None = Field(
        None, description="Key affected parties"
    )
    constraints: list[SafeMediumText] | None = Field(
        None, description="Hard constraints"
    )
    horizon: str | None = Field(None, description="Time horizon: short/medium/long")
    sensitivity: str = Field("low", description="Sensitivity level: low/medium/high")
    attachments: dict[str, Any] | None = Field(
        None, description="Optional supporting docs"
    )
    locale: str = Field("en", description="Language/locale preference")
    session_id: str | None = Field(None, description="Session ID for anonymous users")


class CaseCreate(CaseBase):
    """Schema for creating a case."""

    pass


class CaseResponse(CaseBase):
    """Schema for case response."""

    id: str
    user_id: str | None
    session_id: str | None
    status: str = Field(
        "draft",
        description="Processing status: draft/pending/processing/completed/failed",
    )
    is_public: bool = Field(False, description="Whether case is publicly accessible")
    public_slug: str | None = Field(
        None, description="Short slug for public URL when is_public=True"
    )
    share_mode: str | None = Field(
        None, description="Share visibility mode: 'full' or 'essential'"
    )
    view_count: int = Field(0, description="Number of times public case was viewed")
    is_deleted: bool = Field(False, description="Whether case is soft deleted")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CaseShareToggle(BaseModel):
    """Schema for toggling case public visibility."""

    is_public: bool = Field(..., description="Whether to make the case public")
    share_mode: str | None = Field(
        "full", description="Share visibility mode: 'full' or 'essential'"
    )


# ============================================================================
# Verse Schemas
# ============================================================================


class VerseBase(BaseModel):
    """Base verse schema."""

    canonical_id: str = Field(
        ..., pattern=r"^BG_\d+_\d+$", description="Format: BG_chapter_verse"
    )
    chapter: int = Field(..., ge=1, le=18, description="Chapter number (1-18)")
    verse: int = Field(..., ge=1, description="Verse number")
    sanskrit_iast: str | None = Field(
        None, description="Sanskrit in IAST transliteration"
    )
    sanskrit_devanagari: str | None = Field(
        None, description="Sanskrit in Devanagari script"
    )
    translation_en: str | None = Field(None, description="Primary English translation")
    paraphrase_en: str | None = Field(
        None, description="LLM-generated leadership summary"
    )
    consulting_principles: list[str] | None = Field(
        None, description="Leadership principles"
    )


class VerseCreate(VerseBase):
    """Schema for creating a verse."""

    source: str
    license: str


class VerseResponse(VerseBase):
    """Schema for verse response."""

    id: str
    is_featured: bool = Field(default=False, description="Whether verse is featured")
    source: str | None
    license: str | None
    created_at: datetime
    audio_url: str | None = Field(
        None, description="URL to audio recitation if available"
    )
    duration_ms: int | None = Field(None, description="Audio duration in milliseconds")

    @model_validator(mode="after")
    def compute_audio_info(self) -> "VerseResponse":
        """Compute audio_url and duration_ms based on canonical_id.

        Note: This creates coupling between schema and services layer.
        Consider moving to API layer in future refactoring (v1.18+).
        The import is deferred to avoid circular dependencies.
        """
        if self.canonical_id and (self.audio_url is None or self.duration_ms is None):
            from services.audio import get_audio_info

            url, duration = get_audio_info(self.canonical_id)
            if self.audio_url is None:
                self.audio_url = url
            if self.duration_ms is None:
                self.duration_ms = duration
        return self

    class Config:
        from_attributes = True


# ============================================================================
# Translation Schemas
# ============================================================================


class TranslationResponse(BaseModel):
    """Schema for translation response."""

    id: str
    verse_id: str
    text: str
    language: str = "en"
    translator: str | None = None
    school: str | None = None
    source: str | None = None
    license: str | None = None
    year: int | None = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Output Schemas
# ============================================================================


class OptionSchema(BaseModel):
    """Schema for a single option in consulting brief."""

    title: str
    description: str
    pros: list[str]
    cons: list[str]
    sources: list[str] = Field(..., description="Canonical verse IDs")


class RecommendedActionSchema(BaseModel):
    """Schema for recommended action."""

    option: int = Field(..., description="Option number (1-based)")
    steps: list[str] = Field(..., description="Implementation steps")
    sources: list[str] = Field(..., description="Canonical verse IDs")


class SourceSchema(BaseModel):
    """Schema for a source verse."""

    canonical_id: str
    paraphrase: str = ""  # May be empty for legacy data
    relevance: float = Field(default=0.8, ge=0.0, le=1.0)


class OutputResultSchema(BaseModel):
    """Schema for complete output result."""

    executive_summary: str
    # Allow 0+ options for degraded/legacy outputs (target is 3)
    options: list[OptionSchema] = Field(default_factory=list)
    recommended_action: RecommendedActionSchema | None = None
    reflection_prompts: list[str] = Field(default_factory=list)
    sources: list[SourceSchema] = Field(default_factory=list)
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    scholar_flag: bool = True

    @model_validator(mode="before")
    @classmethod
    def normalize_sources(cls, data: Any) -> Any:
        """Convert legacy string sources to SourceSchema format."""
        if isinstance(data, dict) and "sources" in data:
            sources = data.get("sources", [])
            if sources and isinstance(sources[0], str):
                # Legacy format: sources are canonical IDs as strings
                data["sources"] = [
                    {"canonical_id": s, "paraphrase": "", "relevance": 0.8}
                    for s in sources
                    if isinstance(s, str)
                ]
        return data


class UserFeedbackSummary(BaseModel):
    """Summary of current user's feedback on an output."""

    rating: bool  # True = thumbs up, False = thumbs down
    comment: str | None = None


class OutputResponse(BaseModel):
    """Schema for output response."""

    id: str
    case_id: str
    result_json: OutputResultSchema
    executive_summary: str
    confidence: float
    scholar_flag: bool
    created_at: datetime
    user_feedback: UserFeedbackSummary | None = None

    class Config:
        from_attributes = True


# ============================================================================
# Message Schemas
# ============================================================================


class MessageCreate(BaseModel):
    """Schema for creating a message."""

    content: SafeText = Field(..., description="Message content")


class ChatMessageResponse(BaseModel):
    """Schema for chat message response."""

    id: str
    case_id: str
    role: str  # "user" or "assistant"
    content: str
    output_id: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Follow-up Schemas
# ============================================================================


class FollowUpRequest(BaseModel):
    """Schema for follow-up conversation request."""

    content: SafeText = Field(
        ...,
        min_length=1,
        description="The follow-up question or message",
    )


class LLMAttributionSchema(BaseModel):
    """Schema for LLM attribution metadata."""

    model: str = Field(..., description="LLM model used")
    provider: str = Field(..., description="LLM provider (anthropic/ollama)")
    input_tokens: int | None = Field(None, description="Input tokens used")
    output_tokens: int | None = Field(None, description="Output tokens generated")


class FollowUpResponse(BaseModel):
    """Schema for follow-up conversation response."""

    message_id: str = Field(..., description="ID of the created message")
    content: str = Field(..., description="Markdown response from assistant")
    role: str = Field(default="assistant", description="Message role")
    created_at: datetime = Field(..., description="Timestamp of response")
    llm_attribution: LLMAttributionSchema | None = Field(
        None, description="LLM metadata (may be omitted)"
    )


# ============================================================================
# Feedback Schemas
# ============================================================================


class FeedbackCreate(BaseModel):
    """Schema for creating feedback on an output."""

    rating: bool = Field(..., description="True for thumbs up, False for thumbs down")
    comment: SafeMediumText | None = Field(
        None, description="Optional feedback comment"
    )


class FeedbackResponse(BaseModel):
    """Schema for feedback response."""

    id: str
    output_id: str
    user_id: str | None = None
    rating: bool
    comment: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Health Check Schemas
# ============================================================================


class HealthCheckResponse(BaseModel):
    """Schema for health check response."""

    status: str
    service: str
    environment: str


class ReadinessCheckResponse(BaseModel):
    """Schema for readiness check response."""

    status: str
    checks: dict[str, bool]


# ============================================================================
# Pagination Schemas
# ============================================================================


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response wrapper.

    Usage:
        @router.get("/items", response_model=PaginatedResponse[ItemResponse])
        async def list_items(skip: int = 0, limit: int = 10):
            items = db.query(Item).offset(skip).limit(limit).all()
            total = db.query(Item).count()
            return PaginatedResponse.create(items, total, skip // limit + 1, limit)
    """

    data: list[T] = Field(..., description="List of items")
    total: int = Field(..., description="Total number of items", ge=0)
    page: int = Field(..., description="Current page number", ge=1)
    page_size: int = Field(..., description="Items per page", ge=1)
    total_pages: int = Field(..., description="Total number of pages", ge=1)

    @classmethod
    def create(
        cls, items: list[T], total: int, page: int, page_size: int
    ) -> "PaginatedResponse[T]":
        """Create a paginated response.

        Args:
            items: List of items for current page
            total: Total number of items across all pages
            page: Current page number (1-indexed)
            page_size: Number of items per page

        Returns:
            PaginatedResponse instance
        """
        total_pages = max(1, (total + page_size - 1) // page_size)
        return cls(
            data=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )


# ============================================================================
# Reading Mode Metadata Schemas
# ============================================================================


class BookMetadataResponse(BaseModel):
    """Schema for book metadata response (cover page content)."""

    book_key: str = Field(..., description="Book identifier (e.g., 'bhagavad_geeta')")
    sanskrit_title: str = Field(..., description="Title in Sanskrit")
    transliteration: str = Field(..., description="Romanized Sanskrit title")
    english_title: str = Field(..., description="English title")
    tagline: str = Field(..., description="Brief tagline/subtitle")
    intro_text: str = Field(..., description="Introduction text for cover page")
    verse_count: int = Field(..., description="Total verses in the book")
    chapter_count: int = Field(..., description="Total chapters in the book")

    class Config:
        from_attributes = True


class ChapterMetadataResponse(BaseModel):
    """Schema for chapter metadata response (chapter intro content)."""

    chapter_number: int = Field(..., ge=1, le=18, description="Chapter number (1-18)")
    sanskrit_name: str = Field(..., description="Chapter name in Sanskrit")
    transliteration: str = Field(..., description="Romanized chapter name")
    english_title: str = Field(..., description="English chapter title")
    subtitle: str | None = Field(None, description="Optional subtitle")
    summary: str = Field(..., description="Chapter summary/introduction")
    verse_count: int = Field(..., description="Number of verses in chapter")
    key_themes: list[str] | None = Field(None, description="Key themes in chapter")
    hero_verse_id: str | None = Field(None, description="Hero verse canonical ID")

    class Config:
        from_attributes = True


class GeetaDhyanamVerseResponse(BaseModel):
    """Schema for a single Geeta Dhyanam (invocation) verse."""

    model_config = ConfigDict(from_attributes=True)

    verse_number: int = Field(..., ge=1, le=9, description="Verse number (1-9)")
    sanskrit: str = Field(..., description="Sanskrit text in Devanagari")
    iast: str = Field(..., description="IAST transliteration")
    english: str = Field(..., description="English translation")
    hindi: str = Field(..., description="Hindi translation")
    theme: str = Field(..., description="Theme/purpose of the verse")
    duration_ms: int = Field(..., description="Audio duration in milliseconds")
    audio_url: str = Field(..., description="Path to pre-generated audio file")


# ============================================================================
# Featured Cases Schemas
# ============================================================================


class VerseRefResponse(BaseModel):
    """Verse reference for featured case display."""

    canonical_id: str = Field(..., description="Canonical verse ID (e.g., BG_2_47)")
    display: str = Field(..., description="Display format (e.g., BG 2.47)")


class FeaturedCaseResponse(BaseModel):
    """Schema for a single featured case on homepage."""

    slug: str | None = Field(
        None, description="Public slug for linking (null for fallback)"
    )
    category: str = Field(
        ..., description="Category: career, relationships, ethics, leadership"
    )
    dilemma_preview: str = Field(..., description="Truncated dilemma text (~150 chars)")
    guidance_summary: str = Field(
        ..., description="Executive summary excerpt (~300 chars)"
    )
    recommended_steps: list[str] = Field(
        default_factory=list, description="First 2-3 recommended action steps"
    )
    verse_references: list[VerseRefResponse] = Field(
        default_factory=list, description="Up to 3 verse references"
    )
    has_followups: bool = Field(
        False, description="Whether case has follow-up discussion"
    )


class FeaturedCasesResponse(BaseModel):
    """Schema for featured cases API response."""

    cases: list[FeaturedCaseResponse] = Field(
        ..., description="Featured cases by category"
    )
    categories: list[str] = Field(..., description="Available categories")
    cached_at: datetime = Field(..., description="When response was cached")
