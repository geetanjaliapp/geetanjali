"""Taxonomy API endpoints for principles and goals.

Provides public endpoints for accessing the principle and goal taxonomies.

Principles and groups are read from the database (synced from JSON via
StartupSyncService). Goals still read from JSON config files.
"""

import json
import logging
from pathlib import Path
from typing import Any, cast

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from api.dependencies import limiter
from db.connection import get_db
from models import Principle, PrincipleGroup

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/taxonomy")

# Load goals from JSON (no DB model for goals yet)
CONFIG_DIR = Path(__file__).parent.parent / "config"


def _load_json(filename: str) -> dict[str, Any]:
    """Load a JSON config file."""
    filepath = CONFIG_DIR / filename
    if not filepath.exists():
        logger.error(f"Config file not found: {filepath}")
        return {}
    with open(filepath, encoding="utf-8") as f:
        return cast(dict[str, Any], json.load(f))


# Cache for goals (still read from JSON)
_goals_cache: dict[str, Any] | None = None


def get_goals() -> dict[str, Any]:
    """Get goals taxonomy with caching."""
    global _goals_cache
    if _goals_cache is None:
        _goals_cache = _load_json("goal_taxonomy.json")
    return _goals_cache


def _ensure_id(key: str, data: dict[str, Any]) -> dict[str, Any]:
    """Ensure item has 'id' field, adding from dict key if missing."""
    return {**data, "id": key} if "id" not in data else data


# =============================================================================
# Response Schemas
# =============================================================================


class PrincipleResponse(BaseModel):
    """A single principle with full metadata."""

    id: str = Field(..., description="Unique identifier (e.g., 'dharma')")
    label: str = Field(..., description="English display label")
    shortLabel: str = Field(..., description="Short label for pills/tags")
    sanskrit: str = Field(..., description="Sanskrit in Devanagari script")
    transliteration: str = Field(..., description="Sanskrit transliteration")
    description: str = Field(..., description="Brief description of the principle")
    leadershipContext: str = Field(
        ..., description="How this applies to leadership/work"
    )
    keywords: list[str] = Field(
        default_factory=list, description="Keywords for matching"
    )
    group: str = Field(..., description="Parent yoga group ID")
    chapterFocus: list[int] = Field(
        default_factory=list, description="Key chapters for this principle"
    )
    # Extended content (optional - for SEO)
    extendedDescription: str | None = Field(
        None, description="Extended description for topic pages"
    )
    practicalApplication: str | None = Field(
        None, description="Practical application examples"
    )
    commonMisconceptions: str | None = Field(
        None, description="Common misconceptions about this principle"
    )
    faqQuestion: str | None = Field(None, description="FAQ question")
    faqAnswer: str | None = Field(None, description="FAQ answer")
    relatedPrinciples: list[str] | None = Field(
        None, description="Related principle IDs"
    )


class PrincipleGroupResponse(BaseModel):
    """A yoga path grouping of principles."""

    id: str = Field(..., description="Unique identifier (e.g., 'karma')")
    label: str = Field(..., description="English label (e.g., 'Action')")
    sanskrit: str = Field(..., description="Sanskrit name in Devanagari")
    transliteration: str = Field(..., description="Sanskrit transliteration")
    description: str = Field(..., description="Brief description of the path")
    principles: list[str] = Field(
        default_factory=list, description="Principle IDs in this group"
    )


class PrinciplesListResponse(BaseModel):
    """Response for listing all principles."""

    principles: list[PrincipleResponse] = Field(
        default_factory=list, description="All principles"
    )
    groups: list[PrincipleGroupResponse] = Field(
        default_factory=list, description="Principle groupings"
    )
    count: int = Field(..., description="Total number of principles")


class GoalResponse(BaseModel):
    """A learning goal with principle mappings."""

    id: str = Field(..., description="Unique identifier (e.g., 'inner_peace')")
    label: str = Field(..., description="Display label")
    description: str = Field(..., description="Brief description")
    icon: str = Field(..., description="Icon identifier")
    principles: list[str] = Field(
        default_factory=list, description="Mapped principle IDs"
    )


class GoalsListResponse(BaseModel):
    """Response for listing all goals."""

    goals: list[GoalResponse] = Field(default_factory=list, description="All goals")
    count: int = Field(..., description="Total number of goals")


# =============================================================================
# Helper Functions
# =============================================================================


def _principle_to_response(p: Principle) -> dict[str, Any]:
    """Convert Principle model to response dict."""
    return {
        "id": p.id,
        "label": p.label,
        "shortLabel": p.short_label,
        "sanskrit": p.sanskrit,
        "transliteration": p.transliteration,
        "description": p.description,
        "leadershipContext": p.leadership_context,
        "keywords": p.keywords or [],
        "group": p.group_id,
        "chapterFocus": p.chapter_focus or [],
        # Extended content
        "extendedDescription": p.extended_description,
        "practicalApplication": p.practical_application,
        "commonMisconceptions": p.common_misconceptions,
        "faqQuestion": p.faq_question,
        "faqAnswer": p.faq_answer,
        "relatedPrinciples": p.related_principles,
    }


def _group_to_response(g: PrincipleGroup) -> dict[str, Any]:
    """Convert PrincipleGroup model to response dict."""
    return {
        "id": g.id,
        "label": g.label,
        "sanskrit": g.sanskrit,
        "transliteration": g.transliteration,
        "description": g.description,
        "principles": [p.id for p in g.principles],
    }


# =============================================================================
# Endpoints
# =============================================================================


@router.get("/principles", response_model=PrinciplesListResponse)
@limiter.limit("60/minute")
async def list_principles(
    request: Request, db: Session = Depends(get_db)
) -> dict[str, Any]:
    """
    Get all principles with full metadata.

    Returns 16 principles organized into 4 yoga groups:
    - **Karma (Action)**: dharma, nishkama_karma, svadharma, seva
    - **Jnana (Knowledge)**: viveka, jnana, sthitaprajna, tyaga
    - **Bhakti (Devotion)**: bhakti, sharanagati, shraddha, dhyana
    - **Sadachara (Character)**: samatvam, discipline, virtue, abhyasa

    Use this endpoint to populate principle filters and displays.
    """
    # Query from database
    principles = (
        db.query(Principle).order_by(Principle.display_order).all()
    )
    groups = (
        db.query(PrincipleGroup).order_by(PrincipleGroup.display_order).all()
    )

    return {
        "principles": [_principle_to_response(p) for p in principles],
        "groups": [_group_to_response(g) for g in groups],
        "count": len(principles),
    }


@router.get("/principles/{principle_id}", response_model=PrincipleResponse)
@limiter.limit("60/minute")
async def get_principle(
    request: Request, principle_id: str, db: Session = Depends(get_db)
) -> dict[str, Any]:
    """
    Get a single principle by ID.

    Returns full metadata for the specified principle including
    Sanskrit text, description, and leadership context.
    """
    principle = db.query(Principle).filter(Principle.id == principle_id).first()

    if not principle:
        raise HTTPException(
            status_code=404, detail=f"Principle '{principle_id}' not found"
        )

    return _principle_to_response(principle)


@router.get("/goals", response_model=GoalsListResponse)
@limiter.limit("60/minute")
async def list_goals(request: Request) -> dict[str, Any]:
    """
    Get all learning goals with principle mappings.

    Returns 8 goals that users can select based on their interests:
    - **inner_peace**: Finding calm amidst life's storms
    - **spiritual_growth**: Deepening connection with the divine
    - **work_excellence**: Excelling without burning out
    - **decision_clarity**: Making wise choices with confidence
    - **personal_growth**: Building character and better habits
    - **leadership**: Guiding others with wisdom and integrity
    - **resilience**: Overcoming setbacks and adversity
    - **exploring**: Just curious about the Geeta's wisdom

    Each goal maps to 4 principles (except 'exploring' which includes all).
    """
    goals_data = get_goals()
    goals = [_ensure_id(key, data) for key, data in goals_data.items()]

    return {
        "goals": goals,
        "count": len(goals),
    }


@router.get("/goals/{goal_id}", response_model=GoalResponse)
@limiter.limit("60/minute")
async def get_goal(request: Request, goal_id: str) -> dict[str, Any]:
    """
    Get a single goal by ID.

    Returns the goal's label, description, and mapped principles.
    """
    goals_data = get_goals()

    if goal_id not in goals_data:
        raise HTTPException(status_code=404, detail=f"Goal '{goal_id}' not found")

    return _ensure_id(goal_id, goals_data[goal_id])


@router.get("/groups", response_model=list[PrincipleGroupResponse])
@limiter.limit("60/minute")
async def list_groups(
    request: Request, db: Session = Depends(get_db)
) -> list[dict[str, Any]]:
    """
    Get all principle groups (yoga paths).

    Returns the 4 yoga paths used to organize principles:
    - **karma**: The path of selfless action
    - **jnana**: The path of wisdom and discernment
    - **bhakti**: The path of love and surrender
    - **sadachara**: The path of virtuous conduct
    """
    groups = db.query(PrincipleGroup).order_by(PrincipleGroup.display_order).all()
    return [_group_to_response(g) for g in groups]
