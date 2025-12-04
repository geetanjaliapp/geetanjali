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


# Cache key builders
def verse_key(canonical_id: str) -> str:
    """Build cache key for a single verse."""
    return f"verse:{canonical_id}"


def verse_list_key(
    chapter: Optional[int] = None,
    featured: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
) -> str:
    """Build cache key for verse list queries."""
    return f"verses:ch{chapter}:feat{featured}:s{skip}:l{limit}"


def daily_verse_key() -> str:
    """Build cache key for daily verse (includes date for automatic expiry)."""
    return f"verse:daily:{datetime.utcnow().date().isoformat()}"


def user_profile_key(user_id: str) -> str:
    """Build cache key for user profile."""
    return f"user:{user_id}:profile"


def public_case_key(slug: str) -> str:
    """Build cache key for public case by slug."""
    return f"public_case:{slug}"


def public_case_messages_key(slug: str) -> str:
    """Build cache key for public case messages."""
    return f"public_case:{slug}:messages"


def public_case_outputs_key(slug: str) -> str:
    """Build cache key for public case outputs."""
    return f"public_case:{slug}:outputs"


# Convenience instance
cache = CacheService()
