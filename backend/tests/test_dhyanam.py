"""Tests for Geeta Dhyanam endpoints."""

import uuid

import pytest
from fastapi import status

from models import DhyanamVerse

# Mark all tests in this module as integration tests (require DB)
pytestmark = pytest.mark.integration


@pytest.fixture
def sample_dhyanam_verse(db_session):
    """Create a sample dhyanam verse for testing."""
    verse = DhyanamVerse(
        id=str(uuid.uuid4()),
        verse_number=1,
        sanskrit="ॐ पार्थाय प्रतिबोधितां भगवता",
        iast="oṁ pārthāya pratibodhitāṁ bhagavatā",
        english="Om, this was taught to Arjuna by the Lord",
        hindi="ॐ, यह भगवान द्वारा अर्जुन को सिखाया गया",
        theme="Invocation",
        duration_ms=5000,
        audio_url="/audio/dhyanam/verse_1.mp3",
    )
    db_session.add(verse)
    db_session.commit()
    db_session.refresh(verse)
    return verse


@pytest.fixture
def all_dhyanam_verses(db_session):
    """Create all 9 dhyanam verses for testing."""
    verses = []
    for i in range(1, 10):
        verse = DhyanamVerse(
            id=str(uuid.uuid4()),
            verse_number=i,
            sanskrit=f"Sanskrit verse {i}",
            iast=f"IAST verse {i}",
            english=f"English translation {i}",
            hindi=f"Hindi translation {i}",
            theme=f"Theme {i}",
            duration_ms=5000 + i * 100,
            audio_url=f"/audio/dhyanam/verse_{i}.mp3",
        )
        db_session.add(verse)
        verses.append(verse)
    db_session.commit()
    for v in verses:
        db_session.refresh(v)
    return verses


class TestDhyanamAPI:
    """Tests for /api/v1/dhyanam endpoints."""

    def test_get_all_dhyanam_verses(self, client, all_dhyanam_verses):
        """Test getting all dhyanam verses."""
        response = client.get("/api/v1/dhyanam")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 9
        # Verify ordering
        for i, verse in enumerate(data, start=1):
            assert verse["verse_number"] == i

    def test_get_all_dhyanam_empty(self, client):
        """Test getting dhyanam verses when none exist."""
        response = client.get("/api/v1/dhyanam")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not available" in response.json()["detail"]

    def test_get_single_dhyanam_verse(self, client, sample_dhyanam_verse):
        """Test getting a single dhyanam verse by number."""
        response = client.get("/api/v1/dhyanam/1")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["verse_number"] == 1
        assert data["theme"] == "Invocation"
        assert "sanskrit" in data
        assert "iast" in data
        assert "english" in data
        assert "hindi" in data

    def test_get_dhyanam_verse_not_found(self, client, sample_dhyanam_verse):
        """Test getting a non-existent dhyanam verse number."""
        response = client.get("/api/v1/dhyanam/9")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"]

    def test_get_dhyanam_verse_invalid_number_low(self, client):
        """Test getting dhyanam verse with number below 1."""
        response = client.get("/api/v1/dhyanam/0")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "between 1 and 9" in response.json()["detail"]

    def test_get_dhyanam_verse_invalid_number_high(self, client):
        """Test getting dhyanam verse with number above 9."""
        response = client.get("/api/v1/dhyanam/10")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "between 1 and 9" in response.json()["detail"]

    def test_get_dhyanam_count(self, client, all_dhyanam_verses):
        """Test getting dhyanam verse count."""
        response = client.get("/api/v1/dhyanam/count")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["count"] == 9

    def test_get_dhyanam_count_empty(self, client):
        """Test getting dhyanam count when none exist."""
        response = client.get("/api/v1/dhyanam/count")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["count"] == 0
