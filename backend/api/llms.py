"""LLM-facing discovery endpoints.

Serves the /llms.txt convention (llmstxt.org, Jeremy Howard, 2024):

- ``/llms.txt`` is a *markdown index* -- background, guidance, and links. Tools parse it with
  regex, so it stays small and structured. Putting the corpus here would break every consumer
  built against the convention.
- ``/llms-full.txt`` carries the corpus: all 701 verses as plain markdown.

Both are Redis-cached like the sitemap. Verse text changes approximately never, so a 1-hour TTL
is generous; ``invalidate_llms_cache()`` exists for the case where it does.
"""

import logging

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from api.dependencies import limiter
from config import settings
from db.connection import get_db
from models.verse import Verse
from services.cache import cache

logger = logging.getLogger(__name__)
router = APIRouter()

LLMS_INDEX_CACHE_KEY = "llms:index"
LLMS_FULL_CACHE_KEY = "llms:full"

BASE_URL = settings.FRONTEND_URL

# Served as text/plain: the convention is markdown *content*, but browsers must not be prompted
# to download it and crawlers should read it inline.
MEDIA_TYPE = "text/plain; charset=utf-8"


def build_llms_index() -> str:
    """Build the /llms.txt index: H1, summary blockquote, then link sections."""
    return f"""# Geetanjali

> Ethical guidance grounded in the Bhagavad Gita. Two journeys: a consultation flow that answers
> a real dilemma with verse-grounded reasoning, and a discovery flow over all 701 verses with
> Sanskrit, English translation, and audio.

Verse text carries its source and licence per verse. Audio recitations are AI-generated. Guidance
responses are produced by a large language model grounded in retrieved verses, and are not advice
from a person.

## Content

- [All verses]({BASE_URL}/llms-full.txt): the complete text of all 701 verses -- Devanagari, IAST
  transliteration, English translation and paraphrase. Start here for the corpus.
- [Verse browser]({BASE_URL}/verses): search and browse verses by chapter, topic, or text.
- [Topics]({BASE_URL}/topics/): verses grouped by the ethical principle they speak to.
- [Sitemap]({BASE_URL}/sitemap.xml): every indexable URL, including one per verse.

## About

- [About Geetanjali]({BASE_URL}/about): what the project is and how guidance is produced.
- [Privacy]({BASE_URL}/privacy): what is collected and what is not.
- [Terms]({BASE_URL}/terms): terms of use.
"""


def build_llms_full(verses: list) -> str:
    """Render every verse as markdown, grouped by chapter.

    Takes verses ordered by (chapter, verse); emits a chapter heading on each transition.
    """
    lines = [
        "# Geetanjali -- Bhagavad Gita, complete text",
        "",
        "All 701 verses. Each entry gives the canonical id, Devanagari, IAST transliteration,",
        "and the English translation from the cited source.",
        "",
        "Entries may also carry a 'Leadership insight (AI-generated)' line. That text is produced",
        "by a language model, not drawn from the source text or any translation of it. It is",
        "labelled on every entry so it is not ingested as scripture.",
        "",
        f"Source: {BASE_URL} -- see {BASE_URL}/llms.txt for the index.",
        "",
    ]

    current_chapter = None
    for v in verses:
        if v.chapter != current_chapter:
            current_chapter = v.chapter
            lines.append(f"## Chapter {current_chapter}")
            lines.append("")

        lines.append(f"### {v.canonical_id} ({v.chapter}.{v.verse})")
        lines.append("")
        if v.sanskrit_devanagari:
            lines.append(f"Devanagari: {v.sanskrit_devanagari}")
        if v.sanskrit_iast:
            lines.append(f"IAST: {v.sanskrit_iast}")
        if v.translation_en:
            lines.append(f"Translation: {v.translation_en}")
        # Labelled inline, not just in the header: a consumer that chunks this file will split
        # entries apart from the preamble, and an unlabelled chunk reads as source text.
        if v.paraphrase_en:
            lines.append(f"Leadership insight (AI-generated): {v.paraphrase_en}")
        lines.append("")
        lines.append(f"Link: {BASE_URL}/verses/{v.canonical_id}")
        lines.append("")

    return "\n".join(lines)


@router.get("/llms.txt", include_in_schema=False)
@limiter.limit("60/minute")
async def get_llms_index(request: Request):
    """Serve the /llms.txt index. No database access -- the index is static per deploy."""
    cached = cache.get(LLMS_INDEX_CACHE_KEY)
    if cached:
        return Response(content=cached, media_type=MEDIA_TYPE, headers={"X-Cache": "HIT"})

    content = build_llms_index()
    cache.set(LLMS_INDEX_CACHE_KEY, content, settings.CACHE_TTL_SITEMAP)
    return Response(content=content, media_type=MEDIA_TYPE, headers={"X-Cache": "MISS"})


@router.get("/llms-full.txt", include_in_schema=False)
@limiter.limit("10/minute")
async def get_llms_full(request: Request, db: Session = Depends(get_db)):
    """Serve the full verse corpus as markdown.

    Rate-limited harder than the index: this renders ~450KB and is meant to be fetched once and
    ingested, not polled.
    """
    cached = cache.get(LLMS_FULL_CACHE_KEY)
    if cached:
        logger.debug("llms-full.txt served from cache")
        return Response(content=cached, media_type=MEDIA_TYPE, headers={"X-Cache": "HIT"})

    logger.info("Generating fresh llms-full.txt")

    # Select only the columns rendered below -- the full model carries fields this never emits.
    verses = (
        db.query(
            Verse.canonical_id,
            Verse.chapter,
            Verse.verse,
            Verse.sanskrit_devanagari,
            Verse.sanskrit_iast,
            Verse.translation_en,
            Verse.paraphrase_en,
        )
        .order_by(Verse.chapter, Verse.verse)
        .all()
    )

    content = build_llms_full(verses)
    cache.set(LLMS_FULL_CACHE_KEY, content, settings.CACHE_TTL_SITEMAP)
    logger.info(f"llms-full.txt generated: {len(verses)} verses, {len(content)} chars")

    return Response(content=content, media_type=MEDIA_TYPE, headers={"X-Cache": "MISS"})


def invalidate_llms_cache() -> bool:
    """Invalidate both LLM discovery documents. Call when verse text changes (rare)."""
    index_cleared = cache.delete(LLMS_INDEX_CACHE_KEY)
    full_cleared = cache.delete(LLMS_FULL_CACHE_KEY)
    return index_cleared or full_cleared
