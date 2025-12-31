#!/usr/bin/env python3
"""Simple healthcheck script for worker container.

Checks if Redis is reachable, which indicates the worker can function.
Exit 0 = healthy, Exit 1 = unhealthy.
"""

import sys

from config import settings


def check_redis():
    """Check Redis connectivity."""
    try:
        from redis import Redis

        if not settings.REDIS_URL:
            return False
        redis_conn = Redis.from_url(settings.REDIS_URL)
        redis_conn.ping()
        return True
    except Exception:
        return False


if __name__ == "__main__":
    if check_redis():
        sys.exit(0)
    else:
        sys.exit(1)
