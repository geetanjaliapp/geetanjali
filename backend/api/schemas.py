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
# Case Schemas
# ============================================================================


class CaseBase(BaseModel):
    """Base case schema."""

    title: str = Field(..., max_length=500, description="Short problem title")
    description: str = Field(..., description="Detailed problem statement")
    role: Optional[str] = Field(None, max_length=100, description="Requester's role")
    stakeholders: Optional[List[str]] = Field(None, description="Key affected parties")
    constraints: Optional[List[str]] = Field(None, description="Hard constraints")
    horizon: Optional[str] = Field(None, description="Time horizon: short/medium/long")
    sensitivity: str = Field("low", description="Sensitivity level: low/medium/high")
    attachments: Optional[Dict[str, Any]] = Field(None, description="Optional supporting docs")
    locale: str = Field("en", description="Language/locale preference")


class CaseCreate(CaseBase):
    """Schema for creating a case."""

    pass


class CaseResponse(CaseBase):
    """Schema for case response."""

    id: str
    user_id: str
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
    paraphrase_en: Optional[str] = Field(None, description="English paraphrase (≤25 words)")
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
