"""Dynamic sitemap generation endpoint.

Generates an XML sitemap with:
- Static pages (home, about, verses index, etc.)
- All verse pages (~700 URLs)

Cached in Redis for performance (1 hour TTL).
"""

import logging
from xml.etree.ElementTree import Element, SubElement, tostring

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from api.dependencies import limiter
from config import settings
from db.connection import get_db
from models.verse import Verse
from services.cache import cache

logger = logging.getLogger(__name__)
router = APIRouter()

# Cache settings
SITEMAP_CACHE_KEY = "sitemap:xml"

# Base URL for sitemap (production URL)
BASE_URL = "https://geetanjaliapp.com"

# Static pages with their priorities and change frequencies
STATIC_PAGES = [
    {"path": "/", "priority": "1.0", "changefreq": "weekly"},
    {"path": "/about", "priority": "0.8", "changefreq": "monthly"},
    {"path": "/verses", "priority": "0.9", "changefreq": "weekly"},
    {"path": "/consultations", "priority": "0.8", "changefreq": "daily"},
    {"path": "/cases/new", "priority": "0.7", "changefreq": "monthly"},
]


def build_sitemap_xml(verses: list) -> str:
    """
    Build XML sitemap string.

    Args:
        verses: List of Verse objects

    Returns:
        XML sitemap string
    """
    # Create root element with namespace
    urlset = Element("urlset")
    urlset.set("xmlns", "http://www.sitemaps.org/schemas/sitemap/0.9")

    # Add static pages
    for page in STATIC_PAGES:
        url = SubElement(urlset, "url")
        SubElement(url, "loc").text = f"{BASE_URL}{page['path']}"
        SubElement(url, "changefreq").text = page["changefreq"]
        SubElement(url, "priority").text = page["priority"]

    # Add verse pages
    for verse in verses:
        url = SubElement(urlset, "url")
        SubElement(url, "loc").text = f"{BASE_URL}/verses/{verse.canonical_id}"
        SubElement(url, "changefreq").text = "monthly"
        SubElement(url, "priority").text = "0.8"
        if verse.updated_at:
            SubElement(url, "lastmod").text = verse.updated_at.strftime("%Y-%m-%d")

    # Convert to string with XML declaration
    xml_str = tostring(urlset, encoding="unicode")
    return f'<?xml version="1.0" encoding="UTF-8"?>\n{xml_str}'


@router.get("/sitemap.xml", include_in_schema=False)
@limiter.limit("60/minute")
async def get_sitemap(request: Request, db: Session = Depends(get_db)):
    """
    Generate dynamic XML sitemap.

    Returns cached sitemap if available, otherwise generates fresh one.
    Includes all static pages and verse pages.
    """
    # Try to get from cache
    cached_sitemap = cache.get(SITEMAP_CACHE_KEY)
    if cached_sitemap:
        logger.debug("Sitemap served from cache")
        return Response(
            content=cached_sitemap,
            media_type="application/xml",
            headers={"X-Cache": "HIT"},
        )

    # Generate fresh sitemap
    logger.info("Generating fresh sitemap")

    # P2.1 FIX: Only select columns needed for sitemap (99% memory reduction)
    # Previously loaded all columns including large text fields (~5.6MB)
    # Now only loads canonical_id and updated_at (~52KB)
    verses = (
        db.query(Verse.canonical_id, Verse.updated_at)
        .order_by(Verse.chapter, Verse.verse)
        .all()
    )

    # Build XML
    sitemap_xml = build_sitemap_xml(verses)

    # Cache the result
    cache.set(SITEMAP_CACHE_KEY, sitemap_xml, settings.CACHE_TTL_SITEMAP)
    logger.info(f"Sitemap generated: {len(verses)} verses")

    return Response(
        content=sitemap_xml, media_type="application/xml", headers={"X-Cache": "MISS"}
    )


def sitemap_cache_key() -> str:
    """Build cache key for sitemap."""
    return SITEMAP_CACHE_KEY


def invalidate_sitemap_cache() -> bool:
    """
    Invalidate sitemap cache.

    Call this when verses are added/updated (rare).
    """
    return cache.delete(SITEMAP_CACHE_KEY)
