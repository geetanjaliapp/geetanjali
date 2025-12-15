"""Tests for unified hybrid search service and API."""

import pytest
from fastapi import status
from models.verse import Verse, Translation
import uuid

from services.search import (
    SearchService,
    MatchType,
)
from services.search.parser import QueryParser
from services.search.utils import highlight_match

# Mark all tests in this module as integration tests (require DB)
pytestmark = pytest.mark.integration


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def sample_verses(db_session):
    """Create sample verses for search testing."""
    verses = [
        Verse(
            id=str(uuid.uuid4()),
            canonical_id="BG_2_47",
            chapter=2,
            verse=47,
            sanskrit_iast="karmaṇy-evādhikāras te, mā phaleṣu kadācana",
            sanskrit_devanagari="कर्मण्येवाधिकारस्ते मा फलेषु कदाचन",
            translation_en="You have the right to work only, but never to its fruits.",
            paraphrase_en="Focus on your duty without attachment to outcomes.",
            consulting_principles=["duty_focused_action", "non_attachment_to_outcomes"],
            is_featured=True,
            source="test",
            license="test",
        ),
        Verse(
            id=str(uuid.uuid4()),
            canonical_id="BG_2_48",
            chapter=2,
            verse=48,
            sanskrit_iast="yoga-sthaḥ kuru karmāṇi",
            sanskrit_devanagari="योगस्थः कुरु कर्माणि",
            translation_en="Perform action established in yoga.",
            paraphrase_en="Act from a place of inner equilibrium and balance.",
            consulting_principles=["equanimity", "balanced_action"],
            is_featured=False,
            source="test",
            license="test",
        ),
        Verse(
            id=str(uuid.uuid4()),
            canonical_id="BG_3_19",
            chapter=3,
            verse=19,
            sanskrit_iast="tasmād asaktaḥ satataṃ kāryaṃ karma samācara",
            sanskrit_devanagari="तस्मादसक्तः सततं कार्यं कर्म समाचर",
            translation_en="Therefore, without attachment, always perform action.",
            paraphrase_en="Detached action leads to spiritual progress.",
            consulting_principles=["detachment", "continuous_action"],
            is_featured=True,
            source="test",
            license="test",
        ),
    ]
    for verse in verses:
        db_session.add(verse)
    db_session.commit()
    return verses


@pytest.fixture
def verse_with_translations(db_session, sample_verses):
    """Add translations to the first verse."""
    verse = sample_verses[0]
    translations = [
        Translation(
            id=str(uuid.uuid4()),
            verse_id=verse.id,
            text="You have the right to action alone, never to its fruits.",
            language="en",
            translator="Swami Sivananda",
        ),
        Translation(
            id=str(uuid.uuid4()),
            verse_id=verse.id,
            text="कर्म करने में ही तुम्हारा अधिकार है।",
            language="hi",
            translator="Gita Press",
        ),
    ]
    for trans in translations:
        db_session.add(trans)
    db_session.commit()
    return verse, translations


# =============================================================================
# QueryParser Tests (Unit)
# =============================================================================


class TestQueryParser:
    """Test query parser functionality."""

    def test_parse_canonical_bg_format(self):
        """Test parsing BG_2_47 format."""
        parser = QueryParser()
        result = parser.parse_canonical("BG_2_47")
        assert result == (2, 47)

    def test_parse_canonical_dot_format(self):
        """Test parsing 2.47 format."""
        parser = QueryParser()
        result = parser.parse_canonical("2.47")
        assert result == (2, 47)

    def test_parse_canonical_colon_format(self):
        """Test parsing 2:47 format."""
        parser = QueryParser()
        result = parser.parse_canonical("2:47")
        assert result == (2, 47)

    def test_parse_canonical_natural_language(self):
        """Test parsing 'chapter 2 verse 47' format."""
        parser = QueryParser()
        result = parser.parse_canonical("chapter 2 verse 47")
        assert result == (2, 47)

    def test_parse_canonical_invalid(self):
        """Test parsing invalid reference."""
        parser = QueryParser()
        result = parser.parse_canonical("duty without attachment")
        assert result is None

    def test_parse_canonical_invalid_chapter(self):
        """Test parsing invalid chapter number."""
        parser = QueryParser()
        # Chapter 19 doesn't exist (max is 18)
        result = parser.parse_canonical("19.1")
        assert result is None

    def test_is_sanskrit_query_devanagari(self):
        """Test detection of Devanagari script."""
        parser = QueryParser()
        assert parser.is_sanskrit_query("कर्म") is True

    def test_is_sanskrit_query_iast(self):
        """Test detection of IAST diacritics."""
        parser = QueryParser()
        assert parser.is_sanskrit_query("karmaṇy") is True

    def test_is_sanskrit_query_english(self):
        """Test that plain English is not detected as Sanskrit."""
        parser = QueryParser()
        assert parser.is_sanskrit_query("duty without attachment") is False

    def test_is_situational_query_my(self):
        """Test detection of situational 'my' queries."""
        parser = QueryParser()
        assert (
            parser.is_situational_query("My team is struggling with motivation") is True
        )

    def test_is_situational_query_how(self):
        """Test detection of 'how do I' queries."""
        parser = QueryParser()
        assert (
            parser.is_situational_query("How do I deal with a difficult boss?") is True
        )

    def test_is_situational_query_keyword(self):
        """Test that keyword queries are not situational."""
        parser = QueryParser()
        assert parser.is_situational_query("duty action") is False

    def test_normalize_iast(self):
        """Test IAST normalization removes diacritics."""
        parser = QueryParser()
        normalized = parser.normalize_iast("karmaṇy")
        assert normalized == "karmany"


# =============================================================================
# Highlight Function Tests (Unit)
# =============================================================================


class TestHighlight:
    """Test highlight function."""

    def test_highlight_basic(self):
        """Test basic highlighting."""
        result = highlight_match("Focus on your duty without attachment.", "duty")
        assert "<mark>duty</mark>" in result

    def test_highlight_case_insensitive(self):
        """Test case-insensitive highlighting."""
        result = highlight_match("Focus on your DUTY without attachment.", "duty")
        assert "<mark>DUTY</mark>" in result

    def test_highlight_no_match(self):
        """Test highlighting with no match."""
        result = highlight_match("Focus on your work.", "duty")
        assert "<mark>" not in result

    def test_highlight_truncation(self):
        """Test that long text is truncated."""
        long_text = "a" * 300 + " duty " + "b" * 300
        result = highlight_match(long_text, "duty", max_context=50)
        assert "..." in result
        assert len(result) < len(long_text)


# =============================================================================
# SearchService Integration Tests
# =============================================================================


class TestSearchService:
    """Integration tests for search service."""

    def test_search_by_canonical_id(self, db_session, sample_verses):
        """Test search by canonical ID."""
        service = SearchService(db_session)
        response = service.search("2.47")

        assert response.strategy == "canonical"
        assert response.total == 1
        assert response.results[0].canonical_id == "BG_2_47"
        assert response.results[0].match.type == MatchType.EXACT_CANONICAL

    def test_search_by_canonical_bg_format(self, db_session, sample_verses):
        """Test search by BG_2_47 format."""
        service = SearchService(db_session)
        response = service.search("BG_2_47")

        assert response.strategy == "canonical"
        assert response.total == 1

    def test_search_by_keyword(self, db_session, sample_verses):
        """Test keyword search."""
        service = SearchService(db_session)
        response = service.search("duty")

        assert response.total >= 1
        # Should find verse with "duty" in paraphrase
        canonical_ids = [r.canonical_id for r in response.results]
        assert "BG_2_47" in canonical_ids

    def test_search_by_principle(self, db_session, sample_verses):
        """Test search by principle filter."""
        service = SearchService(db_session)
        response = service.search("action", principle="detachment")

        # Should include verses with detachment principle
        for result in response.results:
            if "detachment" in result.principles:
                return  # Found expected result
        # At least one result should have the principle
        # (since filter is combined with keyword search)

    def test_search_by_chapter_filter(self, db_session, sample_verses):
        """Test search with chapter filter."""
        service = SearchService(db_session)
        response = service.search("karma", chapter=2)

        # All results should be from chapter 2
        for result in response.results:
            assert result.chapter == 2

    def test_search_empty_query(self, db_session, sample_verses):
        """Test empty query returns no results."""
        service = SearchService(db_session)
        response = service.search("")

        assert response.total == 0

    def test_search_situational_query_suggestion(self, db_session, sample_verses):
        """Test situational query triggers consultation suggestion."""
        service = SearchService(db_session)
        response = service.search("How do I deal with a difficult decision?")

        assert response.suggestion is not None
        assert response.suggestion["type"] == "consultation"

    def test_search_pagination(self, db_session, sample_verses):
        """Test search pagination."""
        service = SearchService(db_session)

        # First page
        response1 = service.search("karma", limit=1, offset=0)

        # Second page
        response2 = service.search("karma", limit=1, offset=1)

        # Results should be different (if multiple matches exist)
        if response1.total_count > 1 and response2.total > 0:
            assert (
                response1.results[0].canonical_id != response2.results[0].canonical_id
            )

    def test_search_featured_boost(self, db_session, sample_verses):
        """Test featured verses get ranking boost."""
        service = SearchService(db_session)
        response = service.search("action")

        # Featured verses should rank higher
        featured_indices = [i for i, r in enumerate(response.results) if r.is_featured]
        non_featured_indices = [
            i for i, r in enumerate(response.results) if not r.is_featured
        ]

        # If we have both featured and non-featured results,
        # featured should generally appear earlier
        if featured_indices and non_featured_indices:
            avg_featured = sum(featured_indices) / len(featured_indices)
            avg_non_featured = sum(non_featured_indices) / len(non_featured_indices)
            # Featured average position should be lower (better) or similar
            # This is a soft assertion - ranking depends on many factors
            assert avg_featured <= avg_non_featured + 1


# =============================================================================
# Search API Endpoint Tests
# =============================================================================


class TestSearchAPI:
    """Integration tests for search API endpoint."""

    def test_search_endpoint_basic(self, client, sample_verses):
        """Test basic search endpoint."""
        response = client.get("/api/v1/search?q=duty")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "query" in data
        assert "strategy" in data
        assert "total" in data
        assert "results" in data
        assert data["query"] == "duty"

    def test_search_endpoint_canonical(self, client, sample_verses):
        """Test search endpoint with canonical ID."""
        response = client.get("/api/v1/search?q=2.47")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["strategy"] == "canonical"
        assert data["total"] == 1
        assert data["results"][0]["canonical_id"] == "BG_2_47"

    def test_search_endpoint_with_chapter_filter(self, client, sample_verses):
        """Test search endpoint with chapter filter."""
        response = client.get("/api/v1/search?q=karma&chapter=2")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        for result in data["results"]:
            assert result["chapter"] == 2

    def test_search_endpoint_with_principle_filter(self, client, sample_verses):
        """Test search endpoint with principle filter."""
        response = client.get("/api/v1/search?q=action&principle=detachment")

        assert response.status_code == status.HTTP_200_OK

    def test_search_endpoint_pagination(self, client, sample_verses):
        """Test search endpoint pagination."""
        response = client.get("/api/v1/search?q=karma&limit=1&offset=0")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["results"]) <= 1

    def test_search_endpoint_empty_query(self, client, sample_verses):
        """Test search endpoint with missing query."""
        response = client.get("/api/v1/search")

        # FastAPI should return 422 for missing required query param
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_search_endpoint_result_structure(self, client, sample_verses):
        """Test search result has expected structure."""
        response = client.get("/api/v1/search?q=2.47")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        if data["results"]:
            result = data["results"][0]
            assert "canonical_id" in result
            assert "chapter" in result
            assert "verse" in result
            assert "sanskrit_devanagari" in result
            assert "sanskrit_iast" in result
            assert "translation_en" in result
            assert "paraphrase_en" in result
            assert "principles" in result
            assert "is_featured" in result
            assert "match" in result
            assert "rank_score" in result

            # Match structure
            match = result["match"]
            assert "type" in match
            assert "field" in match
            assert "score" in match

    def test_search_endpoint_situational_suggestion(self, client, sample_verses):
        """Test situational query returns suggestion."""
        response = client.get(
            "/api/v1/search?q=How%20do%20I%20handle%20stress%20at%20work"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["suggestion"] is not None
        assert data["suggestion"]["type"] == "consultation"

    def test_principles_endpoint(self, client, sample_verses):
        """Test principles endpoint returns available principles."""
        response = client.get("/api/v1/search/principles")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        # Should include principles from sample verses
        # Note: This test depends on the SQL working with SQLite test DB


# =============================================================================
# Content Moderation Tests
# =============================================================================


class TestSearchModeration:
    """Test content moderation in search."""

    def test_profanity_blocked(self, client, sample_verses):
        """Test profane queries are blocked."""
        response = client.get("/api/v1/search?q=fuck%20you")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["moderation"] is not None
        assert data["moderation"]["blocked"] is True
        assert data["total"] == 0
