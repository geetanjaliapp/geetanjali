"""Tests for featured case curation job."""

from unittest.mock import MagicMock, patch

from jobs.curate_featured import (
    CURATED_DILEMMAS,
    _generate_unique_slug,
    _invalidate_featured_cache,
    curate_missing_categories,
)

# =============================================================================
# Test CURATED_DILEMMAS structure
# =============================================================================


class TestCuratedDilemmasStructure:
    """Tests for the CURATED_DILEMMAS dictionary structure."""

    def test_has_required_categories(self):
        """Test that all required categories are defined."""
        required = {"career", "relationships", "ethics", "leadership"}
        assert required == set(CURATED_DILEMMAS.keys())

    def test_each_category_has_required_fields(self):
        """Test that each category has title, dilemma, and followups."""
        for category, data in CURATED_DILEMMAS.items():
            assert "title" in data, f"{category} missing title"
            assert "dilemma" in data, f"{category} missing dilemma"
            assert "followups" in data, f"{category} missing followups"

    def test_followups_are_non_empty_lists(self):
        """Test that followups are non-empty lists."""
        for category, data in CURATED_DILEMMAS.items():
            assert isinstance(
                data["followups"], list
            ), f"{category} followups not a list"
            assert len(data["followups"]) > 0, f"{category} has empty followups"

    def test_dilemmas_are_substantial(self):
        """Test that dilemmas have meaningful content (>100 chars)."""
        for category, data in CURATED_DILEMMAS.items():
            assert len(data["dilemma"]) > 100, f"{category} dilemma too short"


# =============================================================================
# Test curate_missing_categories - Input Validation
# =============================================================================


class TestCurateMissingCategoriesValidation:
    """Tests for input validation in curate_missing_categories."""

    @patch("jobs.curate_featured._create_curated_case")
    @patch("jobs.curate_featured._invalidate_featured_cache")
    @patch("jobs.curate_featured.time.sleep")
    def test_unknown_category_fails(self, mock_sleep, mock_cache, mock_create):
        """Test that unknown categories are marked as failed."""
        result = curate_missing_categories(["unknown_category"])

        assert "unknown_category" in result["failed"]
        assert result["created"] == []
        mock_create.assert_not_called()

    @patch("jobs.curate_featured._create_curated_case")
    @patch("jobs.curate_featured._invalidate_featured_cache")
    @patch("jobs.curate_featured.time.sleep")
    def test_empty_list_returns_empty_results(
        self, mock_sleep, mock_cache, mock_create
    ):
        """Test that empty category list returns empty results."""
        result = curate_missing_categories([])

        assert result["created"] == []
        assert result["failed"] == []
        mock_create.assert_not_called()

    @patch("jobs.curate_featured._create_curated_case")
    @patch("jobs.curate_featured._invalidate_featured_cache")
    @patch("jobs.curate_featured.time.sleep")
    def test_mixed_valid_invalid_categories(self, mock_sleep, mock_cache, mock_create):
        """Test handling of mixed valid and invalid categories."""
        mock_create.return_value = "test-case-id"

        result = curate_missing_categories(["career", "invalid", "ethics"])

        assert "career" in result["created"]
        assert "ethics" in result["created"]
        assert "invalid" in result["failed"]
        assert mock_create.call_count == 2


# =============================================================================
# Test curate_missing_categories - Success/Failure Handling
# =============================================================================


class TestCurateMissingCategoriesExecution:
    """Tests for execution behavior in curate_missing_categories."""

    @patch("jobs.curate_featured._create_curated_case")
    @patch("jobs.curate_featured._invalidate_featured_cache")
    @patch("jobs.curate_featured.time.sleep")
    def test_successful_creation(self, mock_sleep, mock_cache, mock_create):
        """Test successful case creation."""
        mock_create.return_value = "test-case-id"

        result = curate_missing_categories(["career"])

        assert "career" in result["created"]
        assert result["failed"] == []
        mock_create.assert_called_once_with("career")

    @patch("jobs.curate_featured._create_curated_case")
    @patch("jobs.curate_featured._invalidate_featured_cache")
    @patch("jobs.curate_featured.time.sleep")
    def test_creation_returns_none(self, mock_sleep, mock_cache, mock_create):
        """Test handling when _create_curated_case returns None."""
        mock_create.return_value = None

        result = curate_missing_categories(["career"])

        assert "career" in result["failed"]
        assert result["created"] == []

    @patch("jobs.curate_featured._create_curated_case")
    @patch("jobs.curate_featured._invalidate_featured_cache")
    @patch("jobs.curate_featured.time.sleep")
    def test_creation_raises_exception(self, mock_sleep, mock_cache, mock_create):
        """Test handling when _create_curated_case raises exception."""
        mock_create.side_effect = Exception("LLM error")

        result = curate_missing_categories(["career"])

        assert "career" in result["failed"]
        assert result["created"] == []

    @patch("jobs.curate_featured._create_curated_case")
    @patch("jobs.curate_featured._invalidate_featured_cache")
    @patch("jobs.curate_featured.time.sleep")
    def test_cache_invalidated_after_completion(
        self, mock_sleep, mock_cache, mock_create
    ):
        """Test that cache is invalidated after curation completes."""
        mock_create.return_value = "test-case-id"

        curate_missing_categories(["career"])

        mock_cache.assert_called_once()

    @patch("jobs.curate_featured._create_curated_case")
    @patch("jobs.curate_featured._invalidate_featured_cache")
    @patch("jobs.curate_featured.time.sleep")
    def test_delay_between_categories(self, mock_sleep, mock_cache, mock_create):
        """Test that there's a delay between processing categories."""
        mock_create.return_value = "test-case-id"

        curate_missing_categories(["career", "ethics"])

        # Should sleep once between the two categories
        assert mock_sleep.call_count == 1
        mock_sleep.assert_called_with(2)


# =============================================================================
# Test _generate_unique_slug
# =============================================================================


class TestGenerateUniqueSlug:
    """Tests for unique slug generation."""

    def test_generates_correct_length(self):
        """Test that slug has correct default length."""
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None

        slug = _generate_unique_slug(mock_db)

        assert len(slug) == 10

    def test_generates_custom_length(self):
        """Test slug generation with custom length."""
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None

        slug = _generate_unique_slug(mock_db, length=15)

        assert len(slug) == 15

    def test_only_lowercase_alphanumeric(self):
        """Test that slug contains only lowercase letters and digits."""
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None

        slug = _generate_unique_slug(mock_db)

        assert (
            slug.islower()
            or slug.isdigit()
            or all(c.islower() or c.isdigit() for c in slug)
        )

    def test_retries_on_collision(self):
        """Test that function retries when slug already exists."""
        mock_db = MagicMock()
        # First call returns existing, second returns None
        mock_db.query.return_value.filter.return_value.first.side_effect = [
            MagicMock(),  # First slug exists
            None,  # Second slug is unique
        ]

        slug = _generate_unique_slug(mock_db)

        # Should have queried twice
        assert mock_db.query.return_value.filter.return_value.first.call_count == 2
        assert len(slug) == 10


# =============================================================================
# Test _invalidate_featured_cache
# =============================================================================


class TestInvalidateFeaturedCache:
    """Tests for cache invalidation."""

    @patch("jobs.curate_featured.cache")
    @patch("jobs.curate_featured.featured_cases_key")
    def test_deletes_cache_key(self, mock_key, mock_cache):
        """Test that cache key is deleted."""
        mock_key.return_value = "featured:cases"

        _invalidate_featured_cache()

        mock_cache.delete.assert_called_once_with("featured:cases")

    @patch("jobs.curate_featured.cache")
    @patch("jobs.curate_featured.featured_cases_key")
    def test_handles_cache_error_gracefully(self, mock_key, mock_cache):
        """Test that cache errors don't raise."""
        mock_key.return_value = "featured:cases"
        mock_cache.delete.side_effect = Exception("Redis error")

        # Should not raise
        _invalidate_featured_cache()
