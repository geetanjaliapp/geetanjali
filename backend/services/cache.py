"""Redis caching service with graceful fallback.

This module provides a caching layer that:
- Uses Redis when available
- Falls back to no-op when Redis is unavailable
- Never blocks or crashes the application due to cache issues
- Includes cache stampede protection via TTL jitter
"""

import hashlib
import json
import logging
import random
from datetime import datetime, timedelta
from typing import Any

from config import settings
from utils.metrics_events import cache_hits_total, cache_misses_total

logger = logging.getLogger(__name__)


def _extract_key_type(key: str) -> str:
    """Extract key type from cache key for metrics labeling.

    Examples:
        "verse:BG_2_47" -> "verse"
        "search:karma:ch2:pNone:l20:o0" -> "search"
        "metadata:chapters:all" -> "metadata"
        "public_case:abc123" -> "case"
        "rag_output:hash123" -> "rag"
    """
    if key.startswith("verse:"):
        return "verse"
    elif key.startswith("search:"):
        return "search"
    elif key.startswith("metadata:"):
        return "metadata"
    elif key.startswith("public_case:") or key.startswith("case_view:"):
        return "case"
    elif key.startswith("rag_output:"):
        return "rag"
    elif key.startswith("featured_cases:"):
        return "featured"
    else:
        return "other"


# Thread-safe random for TTL jitter (cryptographically secure)
_system_random = random.SystemRandom()

# Redis client (lazy initialized)
_redis_client = None
_redis_available: bool | None = None


def get_redis_client():
    """
    Get Redis client with connection check.

    Returns None if Redis is unavailable or disabled.
    Uses lazy initialization with connection caching.
    """
    global _redis_client, _redis_available

    # Check if caching is disabled
    if not settings.REDIS_ENABLED or not settings.REDIS_URL:
        return None

    # If we already know Redis is unavailable, don't retry
    if _redis_available is False:
        return None

    # Initialize client if not already done
    if _redis_client is None:
        try:
            import redis

            _redis_client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_timeout=2,
                socket_connect_timeout=2,
            )
            # Test connection
            _redis_client.ping()
            _redis_available = True
            logger.info("Redis cache connected successfully")
        except Exception as e:
            logger.warning(f"Redis unavailable, caching disabled: {e}")
            _redis_available = False
            _redis_client = None

    return _redis_client


def reset_redis_connection():
    """Reset Redis connection state (useful for reconnection attempts)."""
    global _redis_client, _redis_available
    _redis_client = None
    _redis_available = None


def calculate_midnight_ttl() -> int:
    """Calculate seconds until midnight UTC for daily verse cache."""
    now = datetime.utcnow()
    midnight = (now + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return int((midnight - now).total_seconds())


def add_ttl_jitter(ttl: int, jitter_percent: float = 0.1) -> int:
    """
    Add random jitter to TTL to prevent cache stampede.

    Cache stampede occurs when many cache entries expire at the same time,
    causing all clients to hit the database simultaneously. By adding random
    jitter to TTL values, cache expiration is spread out over time.

    Args:
        ttl: Base TTL in seconds
        jitter_percent: Random variation as percentage (0.1 = ±10%)

    Returns:
        TTL with random jitter applied

    Example:
        >>> add_ttl_jitter(3600, 0.1)  # Returns 3240-3960 (±10%)
        >>> add_ttl_jitter(86400, 0.05)  # Returns 82080-90720 (±5%)
    """
    if ttl <= 0:
        return ttl

    jitter_range = int(ttl * jitter_percent)
    jitter = _system_random.randint(-jitter_range, jitter_range)
    return max(1, ttl + jitter)


def calculate_midnight_ttl_with_jitter(jitter_percent: float = 0.1) -> int:
    """
    Calculate seconds until midnight UTC with jitter for stampede protection.

    The daily verse cache is a prime candidate for cache stampede because:
    1. All users request the same endpoint
    2. All caches expire at exactly midnight UTC
    3. High traffic spike at midnight as everyone refetches

    By adding ±10% jitter (default), cache expiration is spread over ~2.4 hours
    centered around midnight (10:48 PM to 1:12 AM UTC equivalent).

    Args:
        jitter_percent: Random variation (default 0.1 = ±10%)

    Returns:
        Jittered TTL in seconds
    """
    base_ttl = calculate_midnight_ttl()
    return add_ttl_jitter(base_ttl, jitter_percent)


class CacheService:
    """
    Simple cache service with Redis backend and no-op fallback.

    All operations are safe to call even when Redis is unavailable.
    Errors are logged but never raised to the caller.
    """

    @staticmethod
    def get(key: str) -> Any | None:
        """
        Get value from cache.

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found/unavailable
        """
        client = get_redis_client()
        if not client:
            return None

        key_type = _extract_key_type(key)
        try:
            value = client.get(key)
            if value:
                cache_hits_total.labels(key_type=key_type).inc()
                return json.loads(value)
            else:
                cache_misses_total.labels(key_type=key_type).inc()
        except Exception as e:
            logger.warning(f"Cache get error for {key}: {e}")
            cache_misses_total.labels(key_type=key_type).inc()

        return None

    @staticmethod
    def set(key: str, value: Any, ttl: int) -> bool:
        """
        Set value in cache with TTL.

        Args:
            key: Cache key
            value: Value to cache (must be JSON-serializable)
            ttl: Time-to-live in seconds

        Returns:
            True if cached successfully, False otherwise
        """
        client = get_redis_client()
        if not client or ttl <= 0:
            return False

        try:
            serialized = json.dumps(value, default=str)
            client.setex(key, ttl, serialized)
            return True
        except Exception as e:
            logger.warning(f"Cache set error for {key}: {e}")
            return False

    @staticmethod
    def delete(key: str) -> bool:
        """
        Delete key from cache.

        Args:
            key: Cache key to delete

        Returns:
            True if deleted successfully, False otherwise
        """
        client = get_redis_client()
        if not client:
            return False

        try:
            client.delete(key)
            return True
        except Exception as e:
            logger.warning(f"Cache delete error for {key}: {e}")
            return False

    @staticmethod
    def invalidate_pattern(pattern: str) -> int:
        """
        Delete all keys matching pattern.

        Args:
            pattern: Redis pattern (e.g., "verses:*")

        Returns:
            Number of keys deleted
        """
        client = get_redis_client()
        if not client:
            return 0

        try:
            keys = client.keys(pattern)
            if keys:
                return int(client.delete(*keys))
        except Exception as e:
            logger.warning(f"Cache invalidate pattern error for {pattern}: {e}")

        return 0

    @staticmethod
    def is_available() -> bool:
        """Check if cache is available."""
        return get_redis_client() is not None

    @staticmethod
    def setnx(key: str, value: Any, ttl: int) -> bool:
        """
        Set value only if key doesn't exist (atomic operation).

        Used for deduplication scenarios like view count tracking.

        Args:
            key: Cache key
            value: Value to set
            ttl: Time-to-live in seconds

        Returns:
            True if key was set (didn't exist), False if key already exists
        """
        client = get_redis_client()
        if not client or ttl <= 0:
            return True  # No Redis = allow operation to proceed

        try:
            serialized = json.dumps(value, default=str)
            # SET with NX (only set if not exists) and EX (expiry in seconds)
            result = client.set(key, serialized, ex=ttl, nx=True)
            return result is True
        except Exception as e:
            logger.warning(f"Cache setnx error for {key}: {e}")
            return True  # On error, allow operation to proceed

    @staticmethod
    def incr(key: str, ttl: int = 0) -> int:
        """
        Atomically increment a counter.

        Args:
            key: Cache key for the counter
            ttl: Optional TTL for the key (only set on first incr)

        Returns:
            New counter value, or 0 if Redis unavailable
        """
        client = get_redis_client()
        if not client:
            return 0

        try:
            value: int = client.incr(key)
            # Set expiry only on first increment (when value is 1)
            if value == 1 and ttl > 0:
                client.expire(key, ttl)
            return value
        except Exception as e:
            logger.warning(f"Cache incr error for {key}: {e}")
            return 0

    @staticmethod
    def get_int(key: str) -> int:
        """
        Get an integer value from cache.

        Args:
            key: Cache key

        Returns:
            Integer value or 0 if not found/unavailable
        """
        client = get_redis_client()
        if not client:
            return 0

        try:
            value = client.get(key)
            if value:
                try:
                    return int(value)
                except ValueError:
                    logger.error(f"Cache corruption: non-integer value for {key}")
                    return 0
        except Exception as e:
            logger.warning(f"Cache get_int error for {key}: {e}")

        return 0


# Cache key builders
def verse_key(canonical_id: str) -> str:
    """Build cache key for a single verse."""
    return f"verse:{canonical_id}"


def verse_list_key(
    chapter: int | None = None,
    featured: bool | None = None,
    principles: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> str:
    """Build cache key for verse list queries."""
    return f"verses:ch{chapter}:feat{featured}:p{principles}:s{skip}:l{limit}"


def daily_verse_key() -> str:
    """Build cache key for daily verse (includes date for automatic expiry)."""
    return f"verse:daily:{datetime.utcnow().date().isoformat()}"


def book_metadata_key() -> str:
    """Build cache key for book metadata."""
    return "metadata:book:bhagavad_geeta"


def chapters_metadata_key() -> str:
    """Build cache key for all chapters metadata."""
    return "metadata:chapters:all"


def chapter_metadata_key(chapter_number: int) -> str:
    """Build cache key for single chapter metadata."""
    return f"metadata:chapter:{chapter_number}"


def search_key(
    query: str,
    chapter: int | None = None,
    principle: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> str:
    """Build cache key for search results."""
    # Normalize query for consistent caching
    normalized = query.lower().strip()
    return f"search:{normalized}:ch{chapter}:p{principle}:l{limit}:o{offset}"


def principles_key() -> str:
    """Build cache key for principles list."""
    return "search:principles:all"


def featured_count_key() -> str:
    """Build cache key for featured verse count."""
    return "verses:featured:count"


def featured_verse_ids_key() -> str:
    """Build cache key for featured verse ID list.

    Used by random verse endpoint to avoid loading all verses.
    """
    return "verses:featured:ids"


def all_verse_ids_key() -> str:
    """Build cache key for all verse ID list.

    Used by random verse endpoint when featured_only=False.
    """
    return "verses:all:ids"


def public_case_key(slug: str) -> str:
    """Build cache key for public case by slug."""
    return f"public_case:{slug}"


def public_case_messages_key(slug: str) -> str:
    """Build cache key for public case messages."""
    return f"public_case:{slug}:messages"


def public_case_outputs_key(slug: str) -> str:
    """Build cache key for public case outputs."""
    return f"public_case:{slug}:outputs"


def rag_output_key(description_hash: str) -> str:
    """Build cache key for RAG pipeline output.

    P1.1 FIX: Cache RAG outputs by case description hash to avoid
    re-running expensive pipeline for identical queries.
    """
    return f"rag_output:{description_hash}"


def featured_cases_key() -> str:
    """Build cache key for featured cases."""
    return "featured_cases:all"


def public_case_view_key(slug: str, client_id: str) -> str:
    """Build cache key for tracking unique case views.

    Used to deduplicate view counts at the server level.
    Key expires after 24 hours.
    """
    return f"case_view:{slug}:{client_id}"


def daily_views_counter_key() -> str:
    """Build cache key for daily case views counter.

    Used for accurate 24h view tracking. Key includes date
    so it automatically resets daily.
    """
    return f"case_views_daily:{datetime.utcnow().date().isoformat()}"


# TTS Binary Cache (separate from JSON cache)
# Uses a binary Redis client without decode_responses
_redis_binary_client = None
_redis_binary_available: bool | None = None

# TTS cache TTL (24 hours - audio content doesn't change)
TTS_CACHE_TTL = 86400


def _get_binary_redis_client():
    """Get Redis client for binary data (without decode_responses)."""
    global _redis_binary_client, _redis_binary_available

    if not settings.REDIS_ENABLED or not settings.REDIS_URL:
        return None

    if _redis_binary_available is False:
        return None

    if _redis_binary_client is None:
        try:
            import redis

            _redis_binary_client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=False,  # Keep binary data as bytes
                socket_timeout=2,
                socket_connect_timeout=2,
            )
            _redis_binary_client.ping()
            _redis_binary_available = True
            logger.debug("Redis binary cache connected")
        except Exception as e:
            logger.warning(f"Redis binary unavailable: {e}")
            _redis_binary_available = False
            _redis_binary_client = None

    return _redis_binary_client


def tts_cache_key(text: str, lang: str, rate: str, pitch: str) -> str:
    """Build cache key for TTS audio.

    Uses hash of text to keep key size reasonable.
    """
    text_hash = hashlib.sha256(text.encode()).hexdigest()[:16]
    return f"tts:{lang}:{rate}:{pitch}:{text_hash}"


def tts_cache_get(key: str) -> bytes | None:
    """Get TTS audio bytes from cache."""
    client = _get_binary_redis_client()
    if not client:
        return None

    try:
        data = client.get(key)
        if data:
            cache_hits_total.labels(key_type="tts").inc()
            return data
        cache_misses_total.labels(key_type="tts").inc()
    except Exception as e:
        logger.warning(f"TTS cache get error for {key}: {e}")
        cache_misses_total.labels(key_type="tts").inc()

    return None


def tts_cache_set(key: str, audio_bytes: bytes, ttl: int = TTS_CACHE_TTL) -> bool:
    """Store TTS audio bytes in cache."""
    client = _get_binary_redis_client()
    if not client or ttl <= 0:
        return False

    try:
        client.setex(key, ttl, audio_bytes)
        return True
    except Exception as e:
        logger.warning(f"TTS cache set error for {key}: {e}")
        return False


# Convenience instance
cache = CacheService()
