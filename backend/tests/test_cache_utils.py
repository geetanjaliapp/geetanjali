"""Tests for cache utility functions."""

from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest

# Mark all tests in this module as unit tests
pytestmark = pytest.mark.unit


class TestTTLJitter:
    """Tests for TTL jitter functions (cache stampede protection)."""

    def test_add_ttl_jitter_returns_value_in_range(self):
        """Test jitter returns value within expected range."""
        from services.cache import add_ttl_jitter

        base_ttl = 1000
        jitter_percent = 0.1  # ±10%

        # Run multiple times to verify distribution
        results = [add_ttl_jitter(base_ttl, jitter_percent) for _ in range(100)]

        min_expected = int(base_ttl * (1 - jitter_percent))  # 900
        max_expected = int(base_ttl * (1 + jitter_percent))  # 1100

        for result in results:
            assert (
                min_expected <= result <= max_expected
            ), f"Result {result} outside range [{min_expected}, {max_expected}]"

    def test_add_ttl_jitter_has_variance(self):
        """Test that jitter actually produces different values."""
        from services.cache import add_ttl_jitter

        base_ttl = 10000
        results = [add_ttl_jitter(base_ttl, 0.1) for _ in range(50)]

        # Should have at least some variance (not all identical)
        unique_values = set(results)
        assert len(unique_values) > 1, "Jitter should produce varying values"

    def test_add_ttl_jitter_zero_ttl(self):
        """Test jitter handles zero TTL gracefully."""
        from services.cache import add_ttl_jitter

        result = add_ttl_jitter(0, 0.1)
        assert result == 0

    def test_add_ttl_jitter_negative_ttl(self):
        """Test jitter handles negative TTL gracefully."""
        from services.cache import add_ttl_jitter

        result = add_ttl_jitter(-100, 0.1)
        assert result == -100

    def test_add_ttl_jitter_minimum_one(self):
        """Test jitter never returns less than 1 for positive TTL."""
        from services.cache import add_ttl_jitter

        # Very small TTL with large jitter could theoretically go negative
        results = [add_ttl_jitter(10, 0.9) for _ in range(100)]

        for result in results:
            assert result >= 1, "Result should never be less than 1"

    def test_calculate_midnight_ttl_positive(self):
        """Test midnight TTL returns positive value."""
        from services.cache import calculate_midnight_ttl

        ttl = calculate_midnight_ttl()
        assert ttl > 0
        assert ttl <= 86400  # Max one day in seconds

    def test_calculate_midnight_ttl_with_jitter(self):
        """Test midnight TTL with jitter returns values with variance."""
        from services.cache import calculate_midnight_ttl_with_jitter

        results = [calculate_midnight_ttl_with_jitter() for _ in range(50)]

        # All should be positive
        for result in results:
            assert result > 0

        # Should have variance
        unique_values = set(results)
        assert len(unique_values) > 1, "Jitter should produce varying values"


class TestCacheIncr:
    """Tests for cache incr method."""

    @patch("services.cache.get_redis_client")
    def test_incr_increments_counter(self, mock_get_client):
        """Test incr increments counter and returns new value."""
        from services.cache import cache

        mock_client = MagicMock()
        mock_client.incr.return_value = 5
        mock_get_client.return_value = mock_client

        result = cache.incr("test_counter")

        assert result == 5
        mock_client.incr.assert_called_once_with("test_counter")

    @patch("services.cache.get_redis_client")
    def test_incr_sets_ttl_on_first_increment(self, mock_get_client):
        """Test incr sets TTL on first increment (value=1)."""
        from services.cache import cache

        mock_client = MagicMock()
        mock_client.incr.return_value = 1  # First increment
        mock_get_client.return_value = mock_client

        cache.incr("test_counter", ttl=3600)

        mock_client.expire.assert_called_once_with("test_counter", 3600)

    @patch("services.cache.get_redis_client")
    def test_incr_does_not_reset_ttl_on_subsequent(self, mock_get_client):
        """Test incr does not reset TTL on subsequent increments."""
        from services.cache import cache

        mock_client = MagicMock()
        mock_client.incr.return_value = 5  # Not first increment
        mock_get_client.return_value = mock_client

        cache.incr("test_counter", ttl=3600)

        mock_client.expire.assert_not_called()

    @patch("services.cache.get_redis_client")
    def test_incr_returns_zero_when_redis_unavailable(self, mock_get_client):
        """Test incr returns 0 when Redis is unavailable."""
        from services.cache import cache

        mock_get_client.return_value = None

        result = cache.incr("test_counter")

        assert result == 0


class TestCacheGetInt:
    """Tests for cache get_int method."""

    @patch("services.cache.get_redis_client")
    def test_get_int_returns_integer(self, mock_get_client):
        """Test get_int returns integer value."""
        from services.cache import cache

        mock_client = MagicMock()
        mock_client.get.return_value = "42"
        mock_get_client.return_value = mock_client

        result = cache.get_int("test_key")

        assert result == 42

    @patch("services.cache.get_redis_client")
    def test_get_int_returns_zero_for_missing_key(self, mock_get_client):
        """Test get_int returns 0 for missing key."""
        from services.cache import cache

        mock_client = MagicMock()
        mock_client.get.return_value = None
        mock_get_client.return_value = mock_client

        result = cache.get_int("missing_key")

        assert result == 0

    @patch("services.cache.get_redis_client")
    def test_get_int_handles_non_integer_value(self, mock_get_client):
        """Test get_int handles corrupted non-integer data gracefully."""
        from services.cache import cache

        mock_client = MagicMock()
        mock_client.get.return_value = "not_a_number"
        mock_get_client.return_value = mock_client

        result = cache.get_int("corrupted_key")

        assert result == 0  # Should return 0, not crash

    @patch("services.cache.get_redis_client")
    def test_get_int_returns_zero_when_redis_unavailable(self, mock_get_client):
        """Test get_int returns 0 when Redis is unavailable."""
        from services.cache import cache

        mock_get_client.return_value = None

        result = cache.get_int("test_key")

        assert result == 0


class TestDailyViewsCounterKey:
    """Tests for daily views counter key builder."""

    def test_daily_views_counter_key_includes_date(self):
        """Test daily views key includes current date."""
        from services.cache import daily_views_counter_key

        key = daily_views_counter_key()

        today = datetime.utcnow().date().isoformat()
        assert key == f"case_views_daily:{today}"

    def test_daily_views_counter_key_format(self):
        """Test daily views key has correct prefix."""
        from services.cache import daily_views_counter_key

        key = daily_views_counter_key()

        assert key.startswith("case_views_daily:")


class TestExtractKeyType:
    """Tests for cache key type extraction."""

    def test_extract_key_type_verse(self):
        """Test verse key type extraction."""
        from services.cache import _extract_key_type

        assert _extract_key_type("verse:BG_2_47") == "verse"
        assert _extract_key_type("verses:featured:count") == "other"

    def test_extract_key_type_search(self):
        """Test search key type extraction."""
        from services.cache import _extract_key_type

        assert _extract_key_type("search:karma:ch2:pNone:l20:o0") == "search"

    def test_extract_key_type_metadata(self):
        """Test metadata key type extraction."""
        from services.cache import _extract_key_type

        assert _extract_key_type("metadata:chapters:all") == "metadata"

    def test_extract_key_type_case(self):
        """Test case key type extraction."""
        from services.cache import _extract_key_type

        assert _extract_key_type("public_case:abc123") == "case"
        assert _extract_key_type("case_view:slug:ip") == "case"

    def test_extract_key_type_rag(self):
        """Test RAG key type extraction."""
        from services.cache import _extract_key_type

        assert _extract_key_type("rag_output:hash123") == "rag"

    def test_extract_key_type_featured(self):
        """Test featured key type extraction."""
        from services.cache import _extract_key_type

        assert _extract_key_type("featured_cases:all") == "featured"

    def test_extract_key_type_unknown(self):
        """Test unknown key type returns other."""
        from services.cache import _extract_key_type

        assert _extract_key_type("unknown:key") == "other"
