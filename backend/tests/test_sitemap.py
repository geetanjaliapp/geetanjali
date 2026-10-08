"""The sitemap is the list of URLs we tell search engines people can visit.

Every URL shape it emits must appear in scripts/synthetic/sitemap-shapes.json, which the frontend
route test and the synthetic browser check walk. Adding a shape here without adding it there fails
this test, so a URL cannot be advertised without something checking that a person can open it.
"""

import json
import os
import re
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import urlparse
from xml.etree.ElementTree import fromstring

import pytest

from api.sitemap import build_sitemap_xml

SHAPES_FILE = (
    Path(__file__).resolve().parents[2]
    / "scripts"
    / "synthetic"
    / "sitemap-shapes.json"
)
NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"

# `make test` runs inside the backend container, where only backend/ is mounted. Skip there;
# in CI the repo root is always present, so a missing file must fail rather than skip.
pytestmark = [
    pytest.mark.unit,
    pytest.mark.skipif(
        not SHAPES_FILE.exists() and os.environ.get("CI") != "true",
        reason="repo root not mounted (backend container)",
    ),
]


def _shapes():
    return json.loads(SHAPES_FILE.read_text())["shapes"]


def _paths():
    xml = build_sitemap_xml(
        verses=[
            SimpleNamespace(canonical_id="BG_2_47", updated_at=datetime(2026, 1, 1))
        ],
        chapters=[SimpleNamespace(chapter_number=2)],
        principles=[SimpleNamespace(id="nishkama_karma")],
    )
    return [urlparse(loc.text).path for loc in fromstring(xml).iter(f"{NS}loc")]


def test_every_sitemap_url_matches_exactly_one_shape():
    shapes = _shapes()
    for path in _paths():
        matches = [s["pattern"] for s in shapes if re.search(s["pattern"], path)]
        assert len(matches) == 1, (
            f"{path} matched {matches}; add or fix its shape in {SHAPES_FILE.name}"
        )


def test_every_shape_is_still_emitted():
    paths = _paths()
    stale = [
        s["pattern"]
        for s in _shapes()
        if not any(re.search(s["pattern"], p) for p in paths)
    ]
    assert stale == [], f"shapes no longer in the sitemap: {stale}"


def test_each_sample_matches_its_own_pattern():
    for shape in _shapes():
        assert re.search(shape["pattern"], shape["sample"]), shape
