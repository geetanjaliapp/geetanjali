"""Topics API endpoints for principle content and associated verses.

Provides user-facing endpoints for the Topics feature:
- /topics - List all principles grouped by yoga path
- /topics/{id} - Get detailed principle with associated verses

Different from /taxonomy/principles which returns flat data for internal use.
Topics returns grouped, user-friendly data with verse associations.
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import cast, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session

from api.dependencies import limiter
from config import settings
from db.connection import get_db
from models import Principle, PrincipleGroup, Verse
from services.audio import audio_file_exists
from services.cache import cache, topic_detail_key, topics_list_key

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/topics")


# =============================================================================
# Response Schemas
# =============================================================================


class PrincipleSummary(BaseModel):
    """Principle summary for list views."""

    id: str = Field(..., description="Unique identifier")
    label: str = Field(..., description="English display label")
    short_label: str = Field(..., description="Short label for pills/tags")
    sanskrit: str = Field(..., description="Sanskrit in Devanagari")
    transliteration: str = Field(..., description="IAST transliteration")
    description: str = Field(..., description="Brief description")
    verse_count: int = Field(..., description="Number of verses with this principle")


class GroupWithPrinciples(BaseModel):
    """Yoga path with its principles."""

    id: str = Field(..., description="Group identifier")
    label: str = Field(..., description="English label")
    sanskrit: str = Field(..., description="Sanskrit in Devanagari")
    transliteration: str = Field(..., description="IAST transliteration")
    description: str = Field(..., description="Brief description of the path")
    principles: list[PrincipleSummary] = Field(
        default_factory=list, description="Principles in this group"
    )


class TopicsListResponse(BaseModel):
    """Response for GET /topics."""

    groups: list[GroupWithPrinciples] = Field(
        default_factory=list, description="Yoga paths with their principles"
    )
    total_principles: int = Field(..., description="Total number of principles")
    total_verses: int = Field(..., description="Total verses in database")


class FAQ(BaseModel):
    """FAQ content for rich snippets."""

    question: str = Field(..., description="FAQ question")
    answer: str = Field(..., description="FAQ answer")


class RelatedPrinciple(BaseModel):
    """Minimal principle info for related links."""

    id: str
    label: str
    short_label: str


class GroupSummary(BaseModel):
    """Minimal group info for topic detail."""

    id: str
    label: str
    transliteration: str


class VerseSummary(BaseModel):
    """Verse summary for topic detail."""

    canonical_id: str = Field(..., description="Verse identifier (e.g., BG_2_47)")
    chapter: int = Field(..., description="Chapter number")
    verse: int = Field(..., description="Verse number")
    sanskrit_devanagari: str = Field(..., description="Sanskrit text")
    paraphrase_en: str = Field(..., description="English paraphrase")
    has_audio: bool = Field(..., description="Whether audio is available")


class TopicDetailResponse(BaseModel):
    """Response for GET /topics/{id}."""

    # Core fields
    id: str
    label: str
    short_label: str
    sanskrit: str
    transliteration: str
    description: str
    leadership_context: str
    group: GroupSummary

    # Extended content
    extended_description: str | None = None
    practical_application: str | None = None
    common_misconceptions: str | None = None
    faq: FAQ | None = None
    related_principles: list[RelatedPrinciple] = Field(default_factory=list)
    chapter_focus: list[int] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)

    # Verses
    verse_count: int
    verses: list[VerseSummary] = Field(default_factory=list)


# =============================================================================
# Helper Functions
# =============================================================================


def _get_verse_counts_by_principle(db: Session) -> dict[str, int]:
    """
    Count verses per principle using efficient aggregation.

    Returns dict mapping principle_id to verse count.
    """
    # Get all principles we need to count for
    principles = db.query(Principle.id).all()
    principle_ids = [p.id for p in principles]

    counts: dict[str, int] = {}
    for pid in principle_ids:
        count = (
            db.query(func.count(Verse.id))
            .filter(Verse.consulting_principles.isnot(None))
            .filter(cast(Verse.consulting_principles, JSONB).contains([pid]))
            .scalar()
        )
        counts[pid] = count or 0

    return counts


def _principle_to_summary(p: Principle, verse_count: int) -> dict[str, Any]:
    """Convert Principle to summary dict."""
    return {
        "id": p.id,
        "label": p.label,
        "short_label": p.short_label,
        "sanskrit": p.sanskrit,
        "transliteration": p.transliteration,
        "description": p.description,
        "verse_count": verse_count,
    }


def _group_with_principles(
    g: PrincipleGroup, verse_counts: dict[str, int]
) -> dict[str, Any]:
    """Convert PrincipleGroup with nested principles."""
    return {
        "id": g.id,
        "label": g.label,
        "sanskrit": g.sanskrit,
        "transliteration": g.transliteration,
        "description": g.description,
        "principles": [
            _principle_to_summary(p, verse_counts.get(p.id, 0))
            for p in sorted(g.principles, key=lambda x: x.display_order)
        ],
    }


def _get_related_principles(
    db: Session, related_ids: list[str] | None
) -> list[dict[str, Any]]:
    """Get related principle info for IDs."""
    if not related_ids:
        return []

    principles = db.query(Principle).filter(Principle.id.in_(related_ids)).all()
    return [
        {"id": p.id, "label": p.label, "short_label": p.short_label}
        for p in principles
    ]


def _get_verses_for_principle(
    db: Session, principle_id: str, limit: int = 50
) -> list[dict[str, Any]]:
    """Get verses tagged with a principle."""
    verses = (
        db.query(Verse)
        .filter(Verse.consulting_principles.isnot(None))
        .filter(cast(Verse.consulting_principles, JSONB).contains([principle_id]))
        .order_by(Verse.chapter, Verse.verse)
        .limit(limit)
        .all()
    )

    return [
        {
            "canonical_id": v.canonical_id,
            "chapter": v.chapter,
            "verse": v.verse,
            "sanskrit_devanagari": v.sanskrit_devanagari or "",
            "paraphrase_en": v.paraphrase_en or "",
            "has_audio": audio_file_exists(v.canonical_id),
        }
        for v in verses
    ]


def _get_verse_count_for_principle(db: Session, principle_id: str) -> int:
    """Get count of verses tagged with a principle."""
    return (
        db.query(func.count(Verse.id))
        .filter(Verse.consulting_principles.isnot(None))
        .filter(cast(Verse.consulting_principles, JSONB).contains([principle_id]))
        .scalar()
        or 0
    )


# =============================================================================
# Endpoints
# =============================================================================


@router.get("", response_model=TopicsListResponse)
@limiter.limit("60/minute")
async def list_topics(
    request: Request, db: Session = Depends(get_db)
):
    """
    List all principles grouped by yoga path.

    Returns 16 principles organized into 4 groups:
    - **Karma** (कर्म योग): Path of selfless action
    - **Jnana** (ज्ञान योग): Path of wisdom and discernment
    - **Bhakti** (भक्ति योग): Path of devotion and surrender
    - **Sadachara** (सदाचार): Path of virtuous conduct

    Each principle includes a verse count for display.
    """
    # Check cache first
    cache_key = topics_list_key()
    cached = cache.get(cache_key)
    if cached:
        return cached

    # Get groups with principles eagerly loaded
    groups = (
        db.query(PrincipleGroup)
        .order_by(PrincipleGroup.display_order)
        .all()
    )

    # Get verse counts
    verse_counts = _get_verse_counts_by_principle(db)

    # Get total verse count
    total_verses = db.query(func.count(Verse.id)).scalar() or 0

    # Build response
    groups_data = [_group_with_principles(g, verse_counts) for g in groups]
    total_principles = sum(len(g["principles"]) for g in groups_data)

    result = {
        "groups": groups_data,
        "total_principles": total_principles,
        "total_verses": total_verses,
    }

    # Cache the result
    cache.set(cache_key, result, settings.CACHE_TTL_TOPICS)

    return result


@router.get("/{principle_id}", response_model=TopicDetailResponse)
@limiter.limit("60/minute")
async def get_topic(
    request: Request,
    principle_id: str,
    include_verses: bool = Query(True, description="Include associated verses"),
    verse_limit: int = Query(50, ge=1, le=100, description="Max verses to return"),
    db: Session = Depends(get_db),
):
    """
    Get detailed principle content with associated verses.

    Returns:
    - Full principle content (description, extended content, FAQ)
    - Yoga path information
    - Related principles
    - Associated verses with audio availability

    Use `include_verses=false` for lighter responses when verses aren't needed.
    """
    # Check cache (only for default verse_limit to avoid cache fragmentation)
    use_cache = verse_limit == 50
    cache_key = topic_detail_key(principle_id, include_verses) if use_cache else ""

    if use_cache:
        cached = cache.get(cache_key)
        if cached:
            return cached

    # Get principle
    principle = db.query(Principle).filter(Principle.id == principle_id).first()
    if not principle:
        raise HTTPException(
            status_code=404, detail=f"Topic '{principle_id}' not found"
        )

    # Get group
    group = (
        db.query(PrincipleGroup)
        .filter(PrincipleGroup.id == principle.group_id)
        .first()
    )

    # Get verses and count
    verses: list[dict[str, Any]] = []
    if include_verses:
        verses = _get_verses_for_principle(db, principle_id, verse_limit)
    verse_count = _get_verse_count_for_principle(db, principle_id)

    # Get related principles
    related = _get_related_principles(db, principle.related_principles)

    # Build FAQ if available
    faq = None
    if principle.faq_question and principle.faq_answer:
        faq = {"question": principle.faq_question, "answer": principle.faq_answer}

    result = {
        "id": principle.id,
        "label": principle.label,
        "short_label": principle.short_label,
        "sanskrit": principle.sanskrit,
        "transliteration": principle.transliteration,
        "description": principle.description,
        "leadership_context": principle.leadership_context,
        "group": {
            "id": group.id if group else "",
            "label": group.label if group else "",
            "transliteration": group.transliteration if group else "",
        },
        "extended_description": principle.extended_description,
        "practical_application": principle.practical_application,
        "common_misconceptions": principle.common_misconceptions,
        "faq": faq,
        "related_principles": related,
        "chapter_focus": principle.chapter_focus or [],
        "keywords": principle.keywords or [],
        "verse_count": verse_count,
        "verses": verses,
    }

    # Cache the result
    if use_cache:
        cache.set(cache_key, result, settings.CACHE_TTL_TOPICS)

    return result
