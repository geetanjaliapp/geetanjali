"""Pydantic schemas for API request/response validation."""

from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr


# ============================================================================
# User Schemas
# ============================================================================


class UserBase(BaseModel):
    """Base user schema."""

    email: EmailStr
    name: str
    role: Optional[str] = None
    org_id: Optional[str] = None


class UserCreate(UserBase):
    """Schema for creating a user."""

    pass


class UserResponse(UserBase):
    """Schema for user response."""

    id: str
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Authentication Schemas
# ============================================================================


class SignupRequest(BaseModel):
    """Schema for user signup request."""

    email: EmailStr = Field(..., description="User email address")
    name: str = Field(..., min_length=1, max_length=255, description="User full name")
    password: str = Field(..., min_length=8, description="Password (minimum 8 characters)")


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


# ============================================================================
# Case Schemas
# ============================================================================


class CaseBase(BaseModel):
    """Base case schema."""

    title: str = Field(..., max_length=500, description="Short problem title")
    description: str = Field(
        ...,
        max_length=10000,
        description="Detailed problem statement (max 10,000 characters)"
    )
    role: Optional[str] = Field(None, max_length=100, description="Requester's role")
    stakeholders: Optional[List[str]] = Field(None, description="Key affected parties")
    constraints: Optional[List[str]] = Field(None, description="Hard constraints")
    horizon: Optional[str] = Field(None, description="Time horizon: short/medium/long")
    sensitivity: str = Field("low", description="Sensitivity level: low/medium/high")
    attachments: Optional[Dict[str, Any]] = Field(None, description="Optional supporting docs")
    locale: str = Field("en", description="Language/locale preference")
    session_id: Optional[str] = Field(None, description="Session ID for anonymous users")


class CaseCreate(CaseBase):
    """Schema for creating a case."""

    pass


class CaseResponse(CaseBase):
    """Schema for case response."""

    id: str
    user_id: Optional[str]
    session_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Verse Schemas
# ============================================================================


class VerseBase(BaseModel):
    """Base verse schema."""

    canonical_id: str = Field(..., pattern=r"^BG_\d+_\d+$", description="Format: BG_chapter_verse")
    chapter: int = Field(..., ge=1, le=18, description="Chapter number (1-18)")
    verse: int = Field(..., ge=1, description="Verse number")
    sanskrit_iast: Optional[str] = Field(None, description="Sanskrit in IAST transliteration")
    sanskrit_devanagari: Optional[str] = Field(None, description="Sanskrit in Devanagari script")
    translation_en: Optional[str] = Field(None, description="Primary English translation")
    paraphrase_en: Optional[str] = Field(None, description="LLM-generated leadership summary")
    consulting_principles: Optional[List[str]] = Field(None, description="Leadership principles")


class VerseCreate(VerseBase):
    """Schema for creating a verse."""

    source: str
    license: str


class VerseResponse(VerseBase):
    """Schema for verse response."""

    id: str
    source: Optional[str]
    license: Optional[str]
    created_at: datetime

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
    translator: Optional[str] = None
    school: Optional[str] = None
    source: Optional[str] = None
    license: Optional[str] = None
    year: Optional[int] = None
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
    pros: List[str]
    cons: List[str]
    sources: List[str] = Field(..., description="Canonical verse IDs")


class RecommendedActionSchema(BaseModel):
    """Schema for recommended action."""

    option: int = Field(..., description="Option number (1-based)")
    steps: List[str] = Field(..., description="Implementation steps")
    sources: List[str] = Field(..., description="Canonical verse IDs")


class SourceSchema(BaseModel):
    """Schema for a source verse."""

    canonical_id: str
    paraphrase: str
    relevance: float = Field(..., ge=0.0, le=1.0)


class OutputResultSchema(BaseModel):
    """Schema for complete output result."""

    executive_summary: str
    options: List[OptionSchema] = Field(..., min_items=3, max_items=3)
    recommended_action: RecommendedActionSchema
    reflection_prompts: List[str]
    sources: List[SourceSchema]
    confidence: float = Field(..., ge=0.0, le=1.0)
    scholar_flag: bool


class OutputResponse(BaseModel):
    """Schema for output response."""

    id: str
    case_id: str
    result_json: OutputResultSchema
    executive_summary: str
    confidence: float
    scholar_flag: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Message Schemas
# ============================================================================


class MessageCreate(BaseModel):
    """Schema for creating a message."""

    content: str = Field(..., max_length=10000, description="Message content")


class MessageResponse(BaseModel):
    """Schema for message response."""

    id: str
    case_id: str
    role: str  # "user" or "assistant"
    content: str
    output_id: Optional[str] = None
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
    checks: Dict[str, bool]
