"""Tests for audio service functionality."""

from unittest.mock import patch

from services.audio import (
    audio_file_exists,
    clear_audio_cache,
    get_audio_duration_ms,
    get_audio_info,
    get_audio_url,
)


class TestGetAudioUrl:
    """Tests for audio URL generation."""

    def test_returns_url_for_existing_file(self, tmp_path):
        """Should return URL path when audio file exists."""
        # Create a mock audio file
        chapter_dir = tmp_path / "mp3" / "02"
        chapter_dir.mkdir(parents=True)
        (chapter_dir / "BG_2_47.mp3").touch()

        with patch("services.audio.get_audio_directory", return_value=tmp_path):
            clear_audio_cache()
            url = get_audio_url("BG_2_47")

        assert url == "/audio/mp3/02/BG_2_47.mp3"

    def test_returns_none_for_missing_file(self, tmp_path):
        """Should return None when audio file doesn't exist."""
        with patch("services.audio.get_audio_directory", return_value=tmp_path):
            clear_audio_cache()
            url = get_audio_url("BG_99_99")

        assert url is None

    def test_returns_none_for_invalid_id(self, tmp_path):
        """Should return None for malformed canonical IDs."""
        with patch("services.audio.get_audio_directory", return_value=tmp_path):
            clear_audio_cache()

            assert get_audio_url("invalid") is None
            assert get_audio_url("BG_2") is None
            assert get_audio_url("") is None

    def test_pads_single_digit_chapter(self, tmp_path):
        """Chapter 1 should be padded to 01 in path."""
        chapter_dir = tmp_path / "mp3" / "01"
        chapter_dir.mkdir(parents=True)
        (chapter_dir / "BG_1_1.mp3").touch()

        with patch("services.audio.get_audio_directory", return_value=tmp_path):
            clear_audio_cache()
            url = get_audio_url("BG_1_1")

        assert url == "/audio/mp3/01/BG_1_1.mp3"


class TestAudioFileExists:
    """Tests for audio file existence checking."""

    def test_returns_true_for_existing_file(self, tmp_path):
        """Should return True when file exists."""
        chapter_dir = tmp_path / "mp3" / "18"
        chapter_dir.mkdir(parents=True)
        (chapter_dir / "BG_18_78.mp3").touch()

        with patch("services.audio.get_audio_directory", return_value=tmp_path):
            clear_audio_cache()
            exists = audio_file_exists("BG_18_78")

        assert exists is True

    def test_returns_false_for_missing_file(self, tmp_path):
        """Should return False when file doesn't exist."""
        with patch("services.audio.get_audio_directory", return_value=tmp_path):
            clear_audio_cache()
            exists = audio_file_exists("BG_99_99")

        assert exists is False

    def test_caches_result(self, tmp_path):
        """Result should be cached for performance."""
        chapter_dir = tmp_path / "mp3" / "02"
        chapter_dir.mkdir(parents=True)
        (chapter_dir / "BG_2_47.mp3").touch()

        with patch("services.audio.get_audio_directory", return_value=tmp_path):
            clear_audio_cache()

            # First call
            result1 = audio_file_exists("BG_2_47")
            # Delete the file
            (chapter_dir / "BG_2_47.mp3").unlink()
            # Second call should return cached result
            result2 = audio_file_exists("BG_2_47")

        assert result1 is True
        assert result2 is True  # Cached


class TestGetAudioDurationMs:
    """Tests for audio duration retrieval."""

    def test_returns_duration_from_cache(self):
        """Should return duration when in cache."""
        with patch("services.audio._duration_cache", {"BG_2_47": 8500}):
            with patch("services.audio._duration_cache_loaded", True):
                duration = get_audio_duration_ms("BG_2_47")

        assert duration == 8500

    def test_returns_none_for_unknown_verse(self):
        """Should return None for verse not in cache."""
        with patch("services.audio._duration_cache", {}):
            with patch("services.audio._duration_cache_loaded", True):
                duration = get_audio_duration_ms("BG_99_99")

        assert duration is None


class TestGetAudioInfo:
    """Tests for combined audio info retrieval."""

    def test_returns_url_and_duration(self, tmp_path):
        """Should return both URL and duration."""
        chapter_dir = tmp_path / "mp3" / "02"
        chapter_dir.mkdir(parents=True)
        (chapter_dir / "BG_2_47.mp3").touch()

        with patch("services.audio.get_audio_directory", return_value=tmp_path):
            with patch("services.audio._duration_cache", {"BG_2_47": 8500}):
                with patch("services.audio._duration_cache_loaded", True):
                    clear_audio_cache()
                    # Re-patch after clear
                    with patch("services.audio._duration_cache", {"BG_2_47": 8500}):
                        with patch("services.audio._duration_cache_loaded", True):
                            url, duration = get_audio_info("BG_2_47")

        assert url == "/audio/mp3/02/BG_2_47.mp3"
        assert duration == 8500

    def test_returns_none_duration_when_no_url(self, tmp_path):
        """Should return None for duration if no audio file."""
        with patch("services.audio.get_audio_directory", return_value=tmp_path):
            clear_audio_cache()
            url, duration = get_audio_info("BG_99_99")

        assert url is None
        assert duration is None
