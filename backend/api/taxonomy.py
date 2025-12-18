"""Taxonomy API endpoints for principles and goals.

Provides public endpoints for accessing the principle and goal taxonomies.
These serve as the single source of truth for the frontend.
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, cast

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from api.dependencies import limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/taxonomy")

# Load taxonomy data once at module level
CONFIG_DIR = Path(__file__).parent.parent / "config"


def _load_json(filename: str) -> Dict[str, Any]:
    """Load a JSON config file."""
    filepath = CONFIG_DIR / filename
    if not filepath.exists():
        logger.error(f"Config file not found: {filepath}")
        return {}
    with open(filepath, "r", encoding="utf-8") as f:
        return cast(Dict[str, Any], json.load(f))


# Cache loaded taxonomy data
_principles_cache: Optional[Dict[str, Any]] = None
_goals_cache: Optional[Dict[str, Any]] = None
_groups_cache: Optional[Dict[str, Any]] = None


def get_principles() -> Dict[str, Any]:
    """Get principles taxonomy with caching."""
    global _principles_cache
    if _principles_cache is None:
        _principles_cache = _load_json("principle_taxonomy.json")
    return _principles_cache


def get_goals() -> Dict[str, Any]:
    """Get goals taxonomy with caching."""
    global _goals_cache
    if _goals_cache is None:
        _goals_cache = _load_json("goal_taxonomy.json")
    return _goals_cache


def get_groups() -> Dict[str, Any]:
    """Get principle groups with caching."""
    global _groups_cache
    if _groups_cache is None:
        _groups_cache = _load_json("principle_groups.json")
    return _groups_cache


def _ensure_id(key: str, data: Dict[str, Any]) -> Dict[str, Any]:
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
    keywords: List[str] = Field(
        default_factory=list, description="Keywords for matching"
    )
    group: str = Field(..., description="Parent yoga group ID")
    chapterFocus: List[int] = Field(
        default_factory=list, description="Key chapters for this principle"
    )


class PrincipleGroupResponse(BaseModel):
    """A yoga path grouping of principles."""

    id: str = Field(..., description="Unique identifier (e.g., 'karma')")
    label: str = Field(..., description="English label (e.g., 'Action')")
    sanskrit: str = Field(..., description="Sanskrit name in Devanagari")
    transliteration: str = Field(..., description="Sanskrit transliteration")
    description: str = Field(..., description="Brief description of the path")
    principles: List[str] = Field(
        default_factory=list, description="Principle IDs in this group"
    )


class PrinciplesListResponse(BaseModel):
    """Response for listing all principles."""

    principles: List[PrincipleResponse] = Field(
        default_factory=list, description="All principles"
    )
    groups: List[PrincipleGroupResponse] = Field(
        default_factory=list, description="Principle groupings"
    )
    count: int = Field(..., description="Total number of principles")


class GoalResponse(BaseModel):
    """A learning goal with principle mappings."""

    id: str = Field(..., description="Unique identifier (e.g., 'inner_peace')")
    label: str = Field(..., description="Display label")
    description: str = Field(..., description="Brief description")
    icon: str = Field(..., description="Icon identifier")
    principles: List[str] = Field(
        default_factory=list, description="Mapped principle IDs"
    )


class GoalsListResponse(BaseModel):
    """Response for listing all goals."""

    goals: List[GoalResponse] = Field(default_factory=list, description="All goals")
    count: int = Field(..., description="Total number of goals")


# =============================================================================
# Endpoints
# =============================================================================


@router.get("/principles", response_model=PrinciplesListResponse)
@limiter.limit("60/minute")
async def list_principles(request: Request) -> Dict[str, Any]:
    """
    Get all principles with full metadata.

    Returns 16 principles organized into 4 yoga groups:
    - **Karma (Action)**: dharma, nishkama_karma, svadharma, seva
    - **Jnana (Knowledge)**: viveka, jnana, sthitaprajna, tyaga
    - **Bhakti (Devotion)**: bhakti, sharanagati, shraddha, dhyana
    - **Sadachara (Character)**: samatvam, discipline, virtue, abhyasa

    Use this endpoint to populate principle filters and displays.
    """
    principles_data = get_principles()
    groups_data = get_groups()

    principles = [_ensure_id(key, data) for key, data in principles_data.items()]
    groups = [_ensure_id(key, data) for key, data in groups_data.items()]

    return {
        "principles": principles,
        "groups": groups,
        "count": len(principles),
    }


@router.get("/principles/{principle_id}", response_model=PrincipleResponse)
@limiter.limit("60/minute")
async def get_principle(request: Request, principle_id: str) -> Dict[str, Any]:
    """
    Get a single principle by ID.

    Returns full metadata for the specified principle including
    Sanskrit text, description, and leadership context.
    """
    principles_data = get_principles()

    if principle_id not in principles_data:
        raise HTTPException(
            status_code=404, detail=f"Principle '{principle_id}' not found"
        )

    return _ensure_id(principle_id, principles_data[principle_id])


@router.get("/goals", response_model=GoalsListResponse)
@limiter.limit("60/minute")
async def list_goals(request: Request) -> Dict[str, Any]:
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
async def get_goal(request: Request, goal_id: str) -> Dict[str, Any]:
    """
    Get a single goal by ID.

    Returns the goal's label, description, and mapped principles.
    """
    goals_data = get_goals()

    if goal_id not in goals_data:
        raise HTTPException(status_code=404, detail=f"Goal '{goal_id}' not found")

    return _ensure_id(goal_id, goals_data[goal_id])


@router.get("/groups", response_model=List[PrincipleGroupResponse])
@limiter.limit("60/minute")
async def list_groups(request: Request) -> List[Dict[str, Any]]:
    """
    Get all principle groups (yoga paths).

    Returns the 4 yoga paths used to organize principles:
    - **karma**: The path of selfless action
    - **jnana**: The path of wisdom and discernment
    - **bhakti**: The path of love and surrender
    - **sadachara**: The path of virtuous conduct
    """
    groups_data = get_groups()
    return [_ensure_id(key, data) for key, data in groups_data.items()]
