"""Audio file utilities for verse recitations."""

import logging
import threading
from functools import lru_cache
from pathlib import Path

from config import settings

logger = logging.getLogger(__name__)


# Cache for audio durations (loaded from DB on first access)
# Thread-safe initialization using a lock
_duration_cache: dict[str, int] = {}
_duration_cache_loaded = False
_duration_cache_lock = threading.Lock()


def get_audio_directory() -> Path:
    """Get the audio files directory path.

    In Docker: /app/public/audio (mounted volume)
    Locally: ../public/audio (relative to backend/)
    """
    audio_dir = Path(settings.AUDIO_FILES_PATH)
    if not audio_dir.is_absolute():
        # Resolve relative to backend directory
        backend_dir = Path(__file__).parent.parent
        audio_dir = (backend_dir / audio_dir).resolve()
    return audio_dir


@lru_cache(maxsize=1024)
def audio_file_exists(canonical_id: str) -> bool:
    """Check if audio file exists for a verse (cached).

    Args:
        canonical_id: Verse canonical ID (e.g., BG_2_47)

    Returns:
        True if audio file exists
    """
    audio_dir = get_audio_directory()
    parts = canonical_id.split("_")
    if len(parts) != 3:
        return False

    chapter = parts[1].zfill(2)  # Pad to 2 digits
    file_path = audio_dir / "mp3" / chapter / f"{canonical_id}.mp3"
    return file_path.exists()


def get_audio_url(canonical_id: str) -> str | None:
    """Get audio URL for a verse if available.

    Args:
        canonical_id: Verse canonical ID (e.g., BG_2_47)

    Returns:
        URL path to audio file, or None if not available
    """
    if not audio_file_exists(canonical_id):
        return None

    parts = canonical_id.split("_")
    if len(parts) != 3:
        return None

    chapter = parts[1].zfill(2)
    return f"/audio/mp3/{chapter}/{canonical_id}.mp3"


def clear_audio_cache():
    """Clear the audio file existence cache."""
    audio_file_exists.cache_clear()
    global _duration_cache_loaded
    _duration_cache.clear()
    _duration_cache_loaded = False


def _load_duration_cache():
    """Load all audio durations from database into cache.

    Thread-safe: uses a lock to ensure only one thread loads the cache.
    Uses the application's database engine for connection pooling.
    """
    global _duration_cache_loaded

    # Quick check without lock (double-checked locking pattern)
    if _duration_cache_loaded:
        return

    with _duration_cache_lock:
        # Check again inside lock
        if _duration_cache_loaded:
            return

        try:
            # Import here to avoid circular imports and use app's engine
            from sqlalchemy import text

            from db.connection import engine

            with engine.connect() as conn:
                result = conn.execute(
                    text(
                        "SELECT canonical_id, audio_duration_ms FROM verse_audio_metadata WHERE audio_duration_ms IS NOT NULL"
                    )
                )
                for row in result:
                    _duration_cache[row[0]] = row[1]
            _duration_cache_loaded = True
            logger.debug(f"Loaded {len(_duration_cache)} audio durations into cache")
        except Exception as e:
            # If DB access fails, cache remains empty but we mark as loaded to avoid retries
            # Log the error for debugging - text mode auto-advance will fall back gracefully
            logger.warning(f"Failed to load audio duration cache: {e}")
            _duration_cache_loaded = True


def get_audio_duration_ms(canonical_id: str) -> int | None:
    """Get audio duration in milliseconds for a verse.

    Args:
        canonical_id: Verse canonical ID (e.g., BG_2_47)

    Returns:
        Duration in milliseconds, or None if not available
    """
    _load_duration_cache()
    return _duration_cache.get(canonical_id)


def get_audio_info(canonical_id: str) -> tuple[str | None, int | None]:
    """Get audio URL and duration for a verse.

    Args:
        canonical_id: Verse canonical ID (e.g., BG_2_47)

    Returns:
        Tuple of (audio_url, duration_ms) - either or both may be None
    """
    url = get_audio_url(canonical_id)
    duration = get_audio_duration_ms(canonical_id) if url else None
    return url, duration


def extract_duration_ffprobe(file_path: Path) -> int | None:
    """Extract audio duration in milliseconds using ffprobe.

    Args:
        file_path: Path to audio file (MP3, etc.)

    Returns:
        Duration in milliseconds, or None if extraction fails
    """
    import json
    import subprocess

    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v", "quiet",
                "-show_entries", "format=duration",
                "-of", "json",
                str(file_path),
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )

        if result.returncode != 0:
            return None

        data = json.loads(result.stdout)
        duration_seconds = float(data["format"]["duration"])
        return int(duration_seconds * 1000)

    except (subprocess.TimeoutExpired, json.JSONDecodeError, KeyError, ValueError):
        return None
