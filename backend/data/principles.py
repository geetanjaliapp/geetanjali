"""Principle taxonomy data loader.

Loads principle groups and principles from JSON config files.
Data is synced to DB via StartupSyncService, and API reads from DB.

Config files:
- config/principle_groups.json: 4 yoga paths
- config/principle_taxonomy.json: 16 consulting principles
"""

import json
from pathlib import Path
from typing import Any, TypedDict

CONFIG_DIR = Path(__file__).parent.parent / "config"


class PrincipleGroupData(TypedDict):
    """Structure for a principle group (yoga path)."""

    id: str
    label: str
    sanskrit: str
    transliteration: str
    description: str
    principles: list[str]


class PrincipleData(TypedDict, total=False):
    """Structure for a consulting principle."""

    id: str
    label: str
    shortLabel: str
    sanskrit: str
    transliteration: str
    description: str
    leadershipContext: str
    keywords: list[str]
    group: str
    chapterFocus: list[int]
    # Extended content (optional - for SEO, camelCase to match JSON)
    extendedDescription: str
    practicalApplication: str
    commonMisconceptions: str
    faqQuestion: str
    faqAnswer: str
    relatedPrinciples: list[str]


def _load_json(filename: str) -> dict[str, Any]:
    """Load a JSON config file."""
    filepath = CONFIG_DIR / filename
    if not filepath.exists():
        raise FileNotFoundError(f"Config file not found: {filepath}")
    with open(filepath, encoding="utf-8") as f:
        result: dict[str, Any] = json.load(f)
        return result


def get_principle_groups() -> list[PrincipleGroupData]:
    """
    Get all principle groups (yoga paths) with display order.

    Returns:
        List of 4 principle groups in display order:
        1. karma (Action)
        2. jnana (Knowledge)
        3. bhakti (Devotion)
        4. sadachara (Character)
    """
    data = _load_json("principle_groups.json")

    # Define display order
    order = ["karma", "jnana", "bhakti", "sadachara"]

    groups = []
    for i, group_id in enumerate(order):
        if group_id in data:
            group = data[group_id].copy()
            group["id"] = group_id
            group["display_order"] = i + 1
            groups.append(group)

    return groups


def get_principles() -> list[PrincipleData]:
    """
    Get all principles with display order.

    Returns:
        List of 16 principles in display order (grouped by yoga path)
    """
    principles_data = _load_json("principle_taxonomy.json")
    groups_data = _load_json("principle_groups.json")

    # Build display order based on group membership
    group_order = ["karma", "jnana", "bhakti", "sadachara"]

    principles = []
    global_order = 0

    for group_id in group_order:
        if group_id not in groups_data:
            continue

        group_principles = groups_data[group_id].get("principles", [])

        for i, principle_id in enumerate(group_principles):
            if principle_id in principles_data:
                global_order += 1
                principle = principles_data[principle_id].copy()
                principle["id"] = principle_id
                principle["display_order"] = global_order
                principle["group_order"] = i + 1  # Order within group
                principles.append(principle)

    return principles


def get_principle_by_id(principle_id: str) -> PrincipleData | None:
    """Get a single principle by ID."""
    principles_data = _load_json("principle_taxonomy.json")

    if principle_id not in principles_data:
        return None

    principle: PrincipleData = principles_data[principle_id].copy()
    principle["id"] = principle_id
    return principle


def get_group_by_id(group_id: str) -> PrincipleGroupData | None:
    """Get a single group by ID."""
    groups_data = _load_json("principle_groups.json")

    if group_id not in groups_data:
        return None

    group: PrincipleGroupData = groups_data[group_id].copy()
    group["id"] = group_id
    return group
