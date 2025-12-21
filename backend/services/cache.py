"""Redis caching service with graceful fallback.

This module provides a caching layer that:
- Uses Redis when available
- Falls back to no-op when Redis is unavailable
- Never blocks or crashes the application due to cache issues
"""

import json
import logging
from typing import Optional, Any
from datetime import datetime, timedelta

from config import settings

logger = logging.getLogger(__name__)

# Redis client (lazy initialized)
_redis_client = None
_redis_available: Optional[bool] = None


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


class CacheService:
    """
    Simple cache service with Redis backend and no-op fallback.

    All operations are safe to call even when Redis is unavailable.
    Errors are logged but never raised to the caller.
    """

    @staticmethod
    def get(key: str) -> Optional[Any]:
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

        try:
            value = client.get(key)
            if value:
                return json.loads(value)
        except Exception as e:
            logger.warning(f"Cache get error for {key}: {e}")

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


# Cache key builders
def verse_key(canonical_id: str) -> str:
    """Build cache key for a single verse."""
    return f"verse:{canonical_id}"


def verse_list_key(
    chapter: Optional[int] = None,
    featured: Optional[bool] = None,
    principles: Optional[str] = None,
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


# Convenience instance
cache = CacheService()
