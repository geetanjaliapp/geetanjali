"""Tests for verse endpoints."""

import pytest
from fastapi import status
from models.verse import Verse
import uuid


@pytest.fixture
def sample_verse(db_session):
    """Create a sample verse for testing."""
    verse = Verse(
        id=str(uuid.uuid4()),
        canonical_id="BG_2_47",
        chapter=2,
        verse=47,
        sanskrit_iast="karmaṇy-evādhikāras te, mā phaleṣu kadācana",
        paraphrase_en="Act focused on duty, not fruits.",
        consulting_principles=["duty_focused_action", "non_attachment_to_outcomes"],
        source="gita/gita",
        license="Unlicense"
    )
    db_session.add(verse)
    db_session.commit()
    db_session.refresh(verse)
    return verse


def test_get_verse_by_canonical_id(client, sample_verse):
    """Test getting a verse by canonical ID."""
    response = client.get(f"/api/v1/verses/{sample_verse.canonical_id}")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["canonical_id"] == "BG_2_47"
    assert data["chapter"] == 2
    assert data["verse"] == 47
    assert "duty_focused_action" in data["consulting_principles"]


def test_get_verse_not_found(client):
    """Test getting a non-existent verse."""
    response = client.get("/api/v1/verses/BG_99_99")

    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_search_verses_by_chapter(client, sample_verse):
    """Test searching verses by chapter."""
    response = client.get("/api/v1/verses?chapter=2")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data) > 0
    assert all(v["chapter"] == 2 for v in data)


def test_search_verses_by_canonical_id(client, sample_verse):
    """Test searching verses by canonical ID query."""
    response = client.get("/api/v1/verses?q=BG_2_47")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data) == 1
    assert data[0]["canonical_id"] == "BG_2_47"


def test_list_all_verses(client, sample_verse):
    """Test listing all verses."""
    response = client.get("/api/v1/verses")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data) > 0
