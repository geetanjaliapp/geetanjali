"""Tests for Reading Mode metadata API.

Critical paths:
- Get book metadata (success and 404)
- Get all chapters
- Get specific chapter (valid and invalid chapter numbers)
"""

from models.metadata import BookMetadata, ChapterMetadata


class TestBookMetadata:
    """Test book metadata endpoint."""

    def test_get_book_metadata_success(self, client, db_session):
        """Returns book metadata when it exists."""
        # Create test book metadata
        book = BookMetadata(
            book_key="bhagavad_geeta",
            sanskrit_title="श्रीमद्भगवद्गीता",
            transliteration="Śrīmad Bhagavad Gītā",
            english_title="The Bhagavad Geeta",
            tagline="The Song of the Divine",
            intro_text="An ancient dialogue between Krishna and Arjuna.",
            verse_count=700,
            chapter_count=18,
        )
        db_session.add(book)
        db_session.commit()

        response = client.get("/api/v1/reading/book")

        assert response.status_code == 200
        data = response.json()
        assert data["book_key"] == "bhagavad_geeta"
        assert data["verse_count"] == 700
        assert data["chapter_count"] == 18

    def test_get_book_metadata_not_found(self, client, db_session):
        """Returns 404 when book metadata doesn't exist."""
        response = client.get("/api/v1/reading/book")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


class TestChapterMetadata:
    """Test chapter metadata endpoints."""

    def test_get_all_chapters(self, client, db_session):
        """Returns all chapters ordered by chapter number."""
        # Create test chapters (out of order to test sorting)
        for num in [3, 1, 2]:
            chapter = ChapterMetadata(
                chapter_number=num,
                sanskrit_name=f"अध्याय {num}",
                transliteration=f"Adhyāya {num}",
                english_title=f"Chapter {num}",
                subtitle=f"Subtitle {num}",
                summary=f"Summary for chapter {num}",
                verse_count=40 + num,
                key_themes=["theme1", "theme2"],
            )
            db_session.add(chapter)
        db_session.commit()

        response = client.get("/api/v1/reading/chapters")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        # Verify ordering
        assert data[0]["chapter_number"] == 1
        assert data[1]["chapter_number"] == 2
        assert data[2]["chapter_number"] == 3

    def test_get_all_chapters_empty(self, client, db_session):
        """Returns empty list when no chapters exist."""
        response = client.get("/api/v1/reading/chapters")

        assert response.status_code == 200
        data = response.json()
        assert data == []

    def test_get_specific_chapter_success(self, client, db_session):
        """Returns chapter metadata for valid chapter number."""
        chapter = ChapterMetadata(
            chapter_number=2,
            sanskrit_name="सांख्ययोग",
            transliteration="Sāṅkhya Yoga",
            english_title="The Yoga of Knowledge",
            subtitle="Understanding the Self",
            summary="This chapter explains the nature of the Self.",
            verse_count=72,
            key_themes=["knowledge", "self", "duty"],
        )
        db_session.add(chapter)
        db_session.commit()

        response = client.get("/api/v1/reading/chapters/2")

        assert response.status_code == 200
        data = response.json()
        assert data["chapter_number"] == 2
        assert data["english_title"] == "The Yoga of Knowledge"
        assert data["verse_count"] == 72
        assert "knowledge" in data["key_themes"]

    def test_get_specific_chapter_not_found(self, client, db_session):
        """Returns 404 for chapter that doesn't exist in database."""
        # Create chapter 1, then request chapter 2
        chapter = ChapterMetadata(
            chapter_number=1,
            sanskrit_name="अर्जुनविषादयोग",
            transliteration="Arjuna Viṣāda Yoga",
            english_title="Arjuna's Sorrow",
            subtitle="The Battlefield",
            summary="Arjuna's crisis on the battlefield.",
            verse_count=47,
            key_themes=["sorrow", "conflict"],
        )
        db_session.add(chapter)
        db_session.commit()

        response = client.get("/api/v1/reading/chapters/2")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_chapter_invalid_number_zero(self, client, db_session):
        """Returns 400 for chapter number 0."""
        response = client.get("/api/v1/reading/chapters/0")

        assert response.status_code == 400
        assert "between 1 and 18" in response.json()["detail"]

    def test_get_chapter_invalid_number_too_high(self, client, db_session):
        """Returns 400 for chapter number > 18."""
        response = client.get("/api/v1/reading/chapters/19")

        assert response.status_code == 400
        assert "between 1 and 18" in response.json()["detail"]

    def test_get_chapter_invalid_number_negative(self, client, db_session):
        """Returns 400 for negative chapter number."""
        response = client.get("/api/v1/reading/chapters/-1")

        assert response.status_code == 400
        assert "between 1 and 18" in response.json()["detail"]


class TestChapterMetadataFields:
    """Test that chapter metadata returns expected fields."""

    def test_chapter_has_all_required_fields(self, client, db_session):
        """Chapter response includes all required fields."""
        chapter = ChapterMetadata(
            chapter_number=1,
            sanskrit_name="अर्जुनविषादयोग",
            transliteration="Arjuna Viṣāda Yoga",
            english_title="Arjuna's Sorrow",
            subtitle="The Battlefield",
            summary="Arjuna faces a moral crisis.",
            verse_count=47,
            key_themes=["sorrow", "duty", "conflict"],
        )
        db_session.add(chapter)
        db_session.commit()

        response = client.get("/api/v1/reading/chapters/1")

        assert response.status_code == 200
        data = response.json()

        # All expected fields present
        assert "chapter_number" in data
        assert "sanskrit_name" in data
        assert "transliteration" in data
        assert "english_title" in data
        assert "subtitle" in data
        assert "summary" in data
        assert "verse_count" in data
        assert "key_themes" in data
