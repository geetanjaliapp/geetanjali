"""RSS feed endpoint for daily verses.

Generates an RSS 2.0 feed with the last 30 days of daily verses,
allowing users to subscribe and receive Bhagavad Geeta wisdom.

Cached in Redis for performance (1 hour TTL).
"""

import logging
from datetime import date, timedelta
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
FEED_CACHE_KEY = "feed:rss"

# Feed settings
BASE_URL = "https://geetanjaliapp.com"
FEED_DAYS = 30  # Number of past days to include


def get_daily_verse_for_date(
    target_date: date, featured_verses: list, all_verses: list
) -> tuple:
    """
    Calculate which verse was/will be the daily verse for a given date.

    Uses the same deterministic logic as the /daily endpoint.

    Args:
        target_date: The date to get the verse for
        featured_verses: List of featured verses (preferred)
        all_verses: Fallback list of all verses

    Returns:
        Tuple of (verse, date)
    """
    day_of_year = target_date.timetuple().tm_yday

    if featured_verses:
        verse_index = day_of_year % len(featured_verses)
        return featured_verses[verse_index], target_date
    elif all_verses:
        verse_index = day_of_year % len(all_verses)
        return all_verses[verse_index], target_date

    return None, target_date


def format_rfc822_date(d: date) -> str:
    """Format date as RFC 822 for RSS pubDate."""
    # RSS requires RFC 822 format: "Wed, 02 Oct 2002 13:00:00 GMT"
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ]

    weekday = days[d.weekday()]
    month = months[d.month - 1]

    return f"{weekday}, {d.day:02d} {month} {d.year} 06:00:00 GMT"


def build_rss_xml(daily_verses: list) -> str:
    """
    Build RSS 2.0 XML feed.

    Args:
        daily_verses: List of (verse, date) tuples

    Returns:
        RSS XML string
    """
    # Create root RSS element
    rss = Element("rss")
    rss.set("version", "2.0")
    rss.set("xmlns:atom", "http://www.w3.org/2005/Atom")

    # Create channel
    channel = SubElement(rss, "channel")

    # Channel metadata
    SubElement(channel, "title").text = "Geetanjali - Daily Verse"
    SubElement(channel, "link").text = BASE_URL
    SubElement(channel, "description").text = (
        "Daily wisdom from the Bhagavad Geeta. "
        "Receive timeless guidance for ethical leadership and life decisions."
    )
    SubElement(channel, "language").text = "en-us"
    SubElement(channel, "lastBuildDate").text = format_rfc822_date(date.today())
    SubElement(channel, "ttl").text = "60"  # Minutes

    # Self-referencing atom:link (RSS best practice)
    atom_link = SubElement(channel, "atom:link")
    atom_link.set("href", f"{BASE_URL}/feed.xml")
    atom_link.set("rel", "self")
    atom_link.set("type", "application/rss+xml")

    # Image
    image = SubElement(channel, "image")
    SubElement(image, "url").text = f"{BASE_URL}/logo.svg"
    SubElement(image, "title").text = "Geetanjali"
    SubElement(image, "link").text = BASE_URL

    # Add items (daily verses)
    for verse, verse_date in daily_verses:
        if not verse:
            continue

        item = SubElement(channel, "item")

        # Title: "Bhagavad Geeta 2.47 - Daily Verse"
        chapter_verse = f"{verse.chapter}.{verse.verse}"
        SubElement(item, "title").text = f"Bhagavad Geeta {chapter_verse}"

        # Link to verse page
        SubElement(item, "link").text = f"{BASE_URL}/verses/{verse.canonical_id}"

        # GUID (unique identifier)
        guid = SubElement(item, "guid")
        guid.text = f"{BASE_URL}/verses/{verse.canonical_id}#{verse_date.isoformat()}"
        guid.set("isPermaLink", "false")

        # Publication date
        SubElement(item, "pubDate").text = format_rfc822_date(verse_date)

        # Description (content)
        description_parts = []

        if verse.paraphrase_en:
            description_parts.append(
                f"<p><strong>Insight:</strong> {verse.paraphrase_en}</p>"
            )

        if verse.translation_en:
            description_parts.append(
                f"<p><strong>Translation:</strong> {verse.translation_en}</p>"
            )

        if verse.sanskrit_iast:
            description_parts.append(f"<p><em>{verse.sanskrit_iast}</em></p>")

        description_parts.append(
            f'<p><a href="{BASE_URL}/verses/{verse.canonical_id}">Read more on Geetanjali</a></p>'
        )

        SubElement(item, "description").text = "\n".join(description_parts)

        # Category
        SubElement(item, "category").text = f"Chapter {verse.chapter}"

    # Convert to string with XML declaration
    xml_str = tostring(rss, encoding="unicode")
    return f'<?xml version="1.0" encoding="UTF-8"?>\n{xml_str}'


@router.get("/feed.xml", include_in_schema=False)
@limiter.limit("60/minute")
async def get_rss_feed(request: Request, db: Session = Depends(get_db)):
    """
    Generate RSS 2.0 feed of daily verses.

    Returns the last 30 days of daily verses, allowing users to subscribe
    and receive Bhagavad Geeta wisdom in their RSS reader.
    """
    # Try cache first
    cached_feed = cache.get(FEED_CACHE_KEY)
    if cached_feed:
        logger.debug("RSS feed served from cache")
        return Response(
            content=cached_feed,
            media_type="application/rss+xml",
            headers={"X-Cache": "HIT"},
        )

    # Generate fresh feed
    logger.info("Generating fresh RSS feed")

    # P2.2 FIX: Only select columns needed for RSS feed (60-80% memory reduction)
    # Previously loaded all columns; now only loads what's used in build_rss_xml
    feed_columns = [
        Verse.canonical_id,
        Verse.chapter,
        Verse.verse,
        Verse.paraphrase_en,
        Verse.translation_en,
        Verse.sanskrit_iast,
        Verse.is_featured,
    ]

    # Get featured verses (preferred for daily verse)
    featured_verses = (
        db.query(*feed_columns)
        .filter(Verse.is_featured.is_(True))
        .order_by(Verse.chapter, Verse.verse)
        .all()
    )

    # Fallback to all verses if no featured (reuse same column projection)
    all_verses = []
    if not featured_verses:
        all_verses = db.query(*feed_columns).order_by(Verse.chapter, Verse.verse).all()

    # Calculate daily verses for the past N days
    today = date.today()
    daily_verses = []

    for days_ago in range(FEED_DAYS):
        target_date = today - timedelta(days=days_ago)
        verse, verse_date = get_daily_verse_for_date(
            target_date, featured_verses, all_verses
        )
        if verse:
            daily_verses.append((verse, verse_date))

    # Build RSS XML
    feed_xml = build_rss_xml(daily_verses)

    # Cache the result
    cache.set(FEED_CACHE_KEY, feed_xml, settings.CACHE_TTL_FEED)
    logger.info(f"RSS feed generated with {len(daily_verses)} items")

    return Response(
        content=feed_xml, media_type="application/rss+xml", headers={"X-Cache": "MISS"}
    )


def invalidate_feed_cache() -> bool:
    """
    Invalidate RSS feed cache.

    Call this when featured verses change.
    """
    return cache.delete(FEED_CACHE_KEY)
