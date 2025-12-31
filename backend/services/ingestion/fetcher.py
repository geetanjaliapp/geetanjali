"""
Fetcher service for retrieving data from URLs or files with caching and retry logic.
"""

import hashlib
import logging
import time
from pathlib import Path

import requests
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)


class Fetcher:
    """
    Fetch data from URLs or files with retry logic and local caching.

    Attributes:
        cache_dir: Directory for caching fetched content
        session: Persistent HTTP session with headers
    """

    def __init__(self, cache_dir: str = "./data_cache"):
        """
        Initialize Fetcher with cache directory.

        Args:
            cache_dir: Path to cache directory (default: ./data_cache)
        """
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "Geetanjali/1.0 (Educational Research Bot; +https://github.com/geetanjali)"
            }
        )

        logger.info(f"Fetcher initialized with cache dir: {self.cache_dir}")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    def fetch_url(
        self, url: str, cache_ttl: int = 86400, force_refresh: bool = False
    ) -> str:
        """
        Fetch content from URL with caching and retry logic.

        Args:
            url: URL to fetch
            cache_ttl: Cache time-to-live in seconds (default: 24 hours)
            force_refresh: Bypass cache and fetch fresh content

        Returns:
            str: Fetched content

        Raises:
            requests.RequestException: If fetch fails after retries
        """
        cache_key = hashlib.md5(url.encode(), usedforsecurity=False).hexdigest()
        cache_file = self.cache_dir / f"{cache_key}.cache"

        # Check cache unless force_refresh
        if not force_refresh and cache_file.exists():
            age = time.time() - cache_file.stat().st_mtime
            if age < cache_ttl:
                logger.debug(f"Cache hit for {url} (age: {age:.0f}s)")
                return cache_file.read_text(encoding="utf-8")
            else:
                logger.debug(f"Cache expired for {url} (age: {age:.0f}s)")

        # Fetch from URL
        logger.info(f"Fetching from URL: {url}")
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            content = response.text

            # Cache the content
            cache_file.write_text(content, encoding="utf-8")
            logger.info(f"Cached content from {url} ({len(content)} bytes)")

            return str(content)

        except requests.RequestException as e:
            logger.error(f"Failed to fetch {url}: {e}")
            raise

    def fetch_file(self, path: str) -> str:
        """
        Load content from local file.

        Args:
            path: File path to read

        Returns:
            str: File content

        Raises:
            FileNotFoundError: If file doesn't exist
            IOError: If file can't be read
        """
        file_path = Path(path)
        logger.info(f"Reading from file: {file_path}")

        try:
            content = file_path.read_text(encoding="utf-8")
            logger.info(f"Read {len(content)} bytes from {file_path}")
            return content
        except Exception as e:
            logger.error(f"Failed to read {file_path}: {e}")
            raise

    def clear_cache(self, url: str | None = None) -> int:
        """
        Clear cache for specific URL or all cached content.

        Args:
            url: Specific URL to clear (None = clear all)

        Returns:
            int: Number of cache files deleted
        """
        if url:
            cache_key = hashlib.md5(url.encode(), usedforsecurity=False).hexdigest()
            cache_file = self.cache_dir / f"{cache_key}.cache"
            if cache_file.exists():
                cache_file.unlink()
                logger.info(f"Cleared cache for {url}")
                return 1
            return 0
        else:
            count = 0
            for cache_file in self.cache_dir.glob("*.cache"):
                cache_file.unlink()
                count += 1
            logger.info(f"Cleared {count} cache files")
            return count
