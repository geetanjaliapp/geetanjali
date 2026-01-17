#!/usr/bin/env python3
"""
SEO Page Generator

Generates static HTML pages for search engine crawlers.
Run during docker build to bake pages into frontend image.

Usage:
    python -m scripts.generate_seo --output /path/to/output
    python -m scripts.generate_seo --api-url http://localhost:8000 --output /tmp/seo
    python -m scripts.generate_seo --content-dir ../frontend/src/content --output /tmp/seo
"""

import argparse
import asyncio
import json
import time
from pathlib import Path

import httpx
from jinja2 import Environment, FileSystemLoader


def load_content(content_dir: Path) -> dict:
    """Load all content JSON files from content directory."""
    content = {}

    meta_file = content_dir / "meta.json"
    if meta_file.exists():
        content["meta"] = json.loads(meta_file.read_text())
    else:
        content["meta"] = {}

    home_file = content_dir / "home.json"
    if home_file.exists():
        content["home"] = json.loads(home_file.read_text())
    else:
        content["home"] = {}

    about_file = content_dir / "about.json"
    if about_file.exists():
        content["about"] = json.loads(about_file.read_text())
    else:
        content["about"] = {}

    return content

# Chapter metadata - titles and descriptions for all 18 chapters
CHAPTERS = [
    {
        "number": 1,
        "title": "Arjuna Vishada Yoga",
        "description": "The Yoga of Arjuna's Dejection - Arjuna's moral crisis on the battlefield",
        "verse_count": 47,
    },
    {
        "number": 2,
        "title": "Sankhya Yoga",
        "description": "The Yoga of Knowledge - Krishna introduces the eternal nature of the soul",
        "verse_count": 72,
    },
    {
        "number": 3,
        "title": "Karma Yoga",
        "description": "The Yoga of Action - Selfless action without attachment to results",
        "verse_count": 43,
    },
    {
        "number": 4,
        "title": "Jnana Karma Sanyasa Yoga",
        "description": "The Yoga of Knowledge and Renunciation of Action",
        "verse_count": 42,
    },
    {
        "number": 5,
        "title": "Karma Sanyasa Yoga",
        "description": "The Yoga of Renunciation - Comparing renunciation and selfless action",
        "verse_count": 29,
    },
    {
        "number": 6,
        "title": "Dhyana Yoga",
        "description": "The Yoga of Meditation - Practice and benefits of meditation",
        "verse_count": 47,
    },
    {
        "number": 7,
        "title": "Jnana Vijnana Yoga",
        "description": "The Yoga of Knowledge and Wisdom - Understanding the divine nature",
        "verse_count": 30,
    },
    {
        "number": 8,
        "title": "Aksara Brahma Yoga",
        "description": "The Yoga of the Imperishable Brahman - The eternal absolute",
        "verse_count": 28,
    },
    {
        "number": 9,
        "title": "Raja Vidya Raja Guhya Yoga",
        "description": "The Yoga of Royal Knowledge and Royal Secret",
        "verse_count": 34,
    },
    {
        "number": 10,
        "title": "Vibhuti Yoga",
        "description": "The Yoga of Divine Glories - Krishna's divine manifestations",
        "verse_count": 42,
    },
    {
        "number": 11,
        "title": "Visvarupa Darsana Yoga",
        "description": "The Yoga of the Vision of the Universal Form",
        "verse_count": 55,
    },
    {
        "number": 12,
        "title": "Bhakti Yoga",
        "description": "The Yoga of Devotion - The path of loving devotion",
        "verse_count": 20,
    },
    {
        "number": 13,
        "title": "Ksetra Ksetrajna Vibhaga Yoga",
        "description": "The Yoga of the Field and its Knower - Body and soul",
        "verse_count": 35,
    },
    {
        "number": 14,
        "title": "Gunatraya Vibhaga Yoga",
        "description": "The Yoga of the Division of the Three Gunas",
        "verse_count": 27,
    },
    {
        "number": 15,
        "title": "Purusottama Yoga",
        "description": "The Yoga of the Supreme Person - The supreme being",
        "verse_count": 20,
    },
    {
        "number": 16,
        "title": "Daivasura Sampad Vibhaga Yoga",
        "description": "The Yoga of Divine and Demonic Qualities",
        "verse_count": 24,
    },
    {
        "number": 17,
        "title": "Sraddhatraya Vibhaga Yoga",
        "description": "The Yoga of the Division of Threefold Faith",
        "verse_count": 28,
    },
    {
        "number": 18,
        "title": "Moksa Sanyasa Yoga",
        "description": "The Yoga of Liberation through Renunciation - Final teachings",
        "verse_count": 78,
    },
]


def fetch_all_verses(api_url: str) -> list[dict]:
    """Fetch all verses from API with pagination."""
    verses = []
    skip = 0
    limit = 50  # API max limit

    print("Fetching verses from API...")

    while True:
        response = httpx.get(
            f"{api_url}/api/v1/verses",
            params={"skip": skip, "limit": limit},
            timeout=60,
        )
        response.raise_for_status()
        batch = response.json()

        if not batch:
            break

        verses.extend(batch)
        skip += limit

        if len(batch) < limit:
            break

    print(f"  Fetched {len(verses)} verses")
    return verses


def fetch_daily_verse(api_url: str) -> dict | None:
    """Fetch the daily verse from API."""
    try:
        response = httpx.get(f"{api_url}/api/v1/verses/daily", timeout=30)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        print(f"  Warning: Could not fetch daily verse: {e}")
    return None


async def fetch_all_translations(
    api_url: str, verses: list[dict]
) -> dict[str, list[dict]]:
    """Fetch all translations in parallel with rate limiting."""
    translations: dict[str, list[dict]] = {}
    semaphore = asyncio.Semaphore(10)  # Max 10 concurrent requests

    async def fetch_one(client: httpx.AsyncClient, verse: dict):
        canonical_id = verse["canonical_id"]
        async with semaphore:
            try:
                response = await client.get(
                    f"{api_url}/api/v1/verses/{canonical_id}/translations"
                )
                if response.status_code == 200:
                    translations[canonical_id] = response.json()
            except Exception:
                pass  # Skip failed translations, they're optional

    print("Fetching translations...")
    async with httpx.AsyncClient(timeout=30) as client:
        await asyncio.gather(*[fetch_one(client, v) for v in verses])

    print(f"  Fetched translations for {len(translations)} verses")
    return translations


def generate_verses(
    env: Environment,
    verses: list[dict],
    translations: dict[str, list[dict]],
    output_dir: str,
):
    """Generate all verse detail pages."""
    template = env.get_template("seo/verse.html")
    verses_dir = Path(output_dir) / "verses"
    verses_dir.mkdir(parents=True, exist_ok=True)

    # Sort verses by chapter and verse number for navigation
    sorted_verses = sorted(verses, key=lambda v: (v["chapter"], v["verse"]))

    print("Generating verse pages...")
    for i, verse in enumerate(sorted_verses):
        prev_verse = sorted_verses[i - 1] if i > 0 else None
        next_verse = sorted_verses[i + 1] if i < len(sorted_verses) - 1 else None

        verse_translations = translations.get(verse["canonical_id"], [])

        html = template.render(
            verse=verse,
            translations=verse_translations,
            prev_verse=prev_verse,
            next_verse=next_verse,
        )

        output_file = verses_dir / f"{verse['canonical_id']}.html"
        output_file.write_text(html)

        if (i + 1) % 100 == 0:
            print(f"  Generated {i + 1}/{len(sorted_verses)} verse pages")

    print(f"  Generated {len(sorted_verses)} verse pages")


def generate_chapters(env: Environment, verses: list[dict], output_dir: str):
    """Generate all chapter pages."""
    template = env.get_template("seo/chapter.html")
    chapter_dir = Path(output_dir) / "verses" / "chapter"
    chapter_dir.mkdir(parents=True, exist_ok=True)

    # Group verses by chapter
    verses_by_chapter: dict[int, list[dict]] = {}
    for verse in verses:
        ch = verse["chapter"]
        if ch not in verses_by_chapter:
            verses_by_chapter[ch] = []
        verses_by_chapter[ch].append(verse)

    # Sort verses within each chapter
    for ch in verses_by_chapter:
        verses_by_chapter[ch].sort(key=lambda v: v["verse"])

    print("Generating chapter pages...")
    for i, chapter in enumerate(CHAPTERS):
        ch_num = chapter["number"]
        prev_chapter = CHAPTERS[i - 1] if i > 0 else None
        next_chapter = CHAPTERS[i + 1] if i < len(CHAPTERS) - 1 else None

        html = template.render(
            chapter=chapter,
            verses=verses_by_chapter.get(ch_num, []),
            prev_chapter=prev_chapter,
            next_chapter=next_chapter,
        )

        output_file = chapter_dir / f"{ch_num}.html"
        output_file.write_text(html)

    print(f"  Generated {len(CHAPTERS)} chapter pages")


def generate_verse_index(env: Environment, output_dir: str):
    """Generate main verse index page."""
    template = env.get_template("seo/verse_index.html")
    verses_dir = Path(output_dir) / "verses"
    verses_dir.mkdir(parents=True, exist_ok=True)

    html = template.render(chapters=CHAPTERS)

    output_file = verses_dir / "index.html"
    output_file.write_text(html)
    print("  Generated verse index page")


def generate_home(
    env: Environment, output_dir: str, daily_verse: dict | None, content: dict
):
    """Generate homepage."""
    template = env.get_template("seo/home.html")

    html = template.render(
        chapters=CHAPTERS,
        daily_verse=daily_verse,
        content=content.get("home", {}),
        meta=content.get("meta", {}),
    )

    output_file = Path(output_dir) / "index.html"
    output_file.write_text(html)
    print("  Generated homepage")


def generate_about(env: Environment, output_dir: str, content: dict):
    """Generate about page."""
    template = env.get_template("seo/about.html")
    html = template.render(
        content=content.get("about", {}),
        meta=content.get("meta", {}),
    )

    output_file = Path(output_dir) / "about.html"
    output_file.write_text(html)
    print("  Generated about page")


def main():
    parser = argparse.ArgumentParser(description="Generate SEO static pages")
    parser.add_argument("--output", required=True, help="Output directory")
    parser.add_argument(
        "--api-url", default="http://localhost:8000", help="Backend API URL"
    )
    parser.add_argument(
        "--content-dir",
        default=None,
        help="Content JSON directory (default: ../frontend/src/content)",
    )
    args = parser.parse_args()

    start = time.time()
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Setup Jinja2 with templates directory relative to backend root
    templates_dir = Path(__file__).parent.parent / "templates"
    env = Environment(loader=FileSystemLoader(templates_dir))

    # Load content from JSON files (single source of truth)
    if args.content_dir:
        content_dir = Path(args.content_dir)
    else:
        content_dir = Path(__file__).parent.parent.parent / "frontend" / "src" / "content"

    content = load_content(content_dir)
    print(f"Loaded content from {content_dir}")

    # Fetch all data
    verses = fetch_all_verses(args.api_url)
    daily_verse = fetch_daily_verse(args.api_url)
    translations = asyncio.run(fetch_all_translations(args.api_url, verses))

    # Generate all pages
    generate_verses(env, verses, translations, args.output)
    generate_chapters(env, verses, args.output)
    generate_verse_index(env, args.output)
    generate_home(env, args.output, daily_verse, content)
    generate_about(env, args.output, content)

    elapsed = time.time() - start

    # Count generated files
    total_files = sum(1 for _ in Path(args.output).rglob("*.html"))
    print(f"\nGenerated {total_files} pages in {elapsed:.1f}s")


if __name__ == "__main__":
    main()
