"""SEO page generator service.

This module handles generation of static HTML pages for search engine crawlers.
It uses hash-based change detection to only regenerate pages when source data
or templates have changed.

Key features:
- PostgreSQL advisory locks for concurrency protection
- Template hash tracking to detect template changes
- Atomic file writes (temp file + rename)
- Optional gzip pre-compression for nginx gzip_static

Usage:
    from services.seo import SeoGeneratorService

    # In a request context with DB session
    service = SeoGeneratorService(db)
    result = service.generate_all()
"""

import gzip
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import NamedTuple

from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy import text
from sqlalchemy.orm import Session

from models import SeoPage

from .hash_utils import compute_source_hash, compute_template_tree_hash

logger = logging.getLogger(__name__)

# Advisory lock ID for SEO generation (arbitrary unique number)
SEO_GENERATION_LOCK_ID = 8675309


class GenerationInProgressError(Exception):
    """Raised when another SEO generation is already running."""

    pass


class SeoGenerationResult(NamedTuple):
    """Result of SEO generation operation."""

    total_pages: int
    generated: int
    skipped: int
    errors: int
    duration_ms: int


class SeoGeneratorService:
    """
    Service for generating SEO static HTML pages.

    Uses PostgreSQL advisory locks to prevent concurrent generation.
    Tracks source and template hashes to enable incremental regeneration.

    Example:
        service = SeoGeneratorService(db)
        result = service.generate_all(force=False)
    """

    def __init__(
        self,
        db: Session,
        output_dir: Path | None = None,
        templates_dir: Path | None = None,
    ):
        """
        Initialize the SEO generator service.

        Args:
            db: Database session
            output_dir: Directory for generated HTML files (default: /app/seo-output)
            templates_dir: Directory containing Jinja2 templates
        """
        self.db = db
        self.output_dir = output_dir or Path("/app/seo-output")
        self.templates_dir = (
            templates_dir or Path(__file__).parent.parent.parent / "templates"
        )

        # Lazy-loaded Jinja2 environment
        self._env: Environment | None = None

        # Track template hashes (cached for this generation run)
        self._template_hashes: dict[str, str] = {}

    @property
    def env(self) -> Environment:
        """Lazy-load Jinja2 environment."""
        if self._env is None:
            # Enable autoescape for security - prevents XSS if data is compromised
            # Templates should use |safe filter only for fields with intentional HTML
            self._env = Environment(
                loader=FileSystemLoader(self.templates_dir),
                autoescape=select_autoescape(["html", "htm", "xml"]),
            )
        return self._env

    def _acquire_lock(self) -> bool:
        """
        Acquire exclusive PostgreSQL advisory lock for SEO generation.

        Returns:
            True if lock acquired, False if another process holds it
        """
        result = self.db.execute(
            text("SELECT pg_try_advisory_lock(:lock_id)"),
            {"lock_id": SEO_GENERATION_LOCK_ID},
        ).scalar()
        return bool(result)

    def _release_lock(self) -> None:
        """Release PostgreSQL advisory lock."""
        self.db.execute(
            text("SELECT pg_advisory_unlock(:lock_id)"),
            {"lock_id": SEO_GENERATION_LOCK_ID},
        )

    def _get_template_hash(self, template_name: str) -> str:
        """
        Get cached template hash or compute if not cached.

        Computes hash over the template AND its dependencies (base.html, minimal.css)
        so that changes to any file in the template tree trigger regeneration.

        Args:
            template_name: Template file name (e.g., "seo/verse.html")

        Returns:
            16-character template hash
        """
        if template_name not in self._template_hashes:
            # All SEO templates extend base.html and include minimal.css
            # Hash the entire dependency tree for accurate change detection
            template_paths = [
                self.templates_dir / template_name,
                self.templates_dir / "seo" / "base.html",
                self.templates_dir / "seo" / "minimal.css",
            ]
            # Only include files that exist (static pages may use different base)
            existing_paths = [p for p in template_paths if p.exists()]
            self._template_hashes[template_name] = compute_template_tree_hash(
                existing_paths
            )
        return self._template_hashes[template_name]

    def _write_atomic(self, path: Path, content: str, create_gzip: bool = True) -> int:
        """
        Write content atomically using temp file + rename.

        This prevents nginx from serving partial content during writes.
        Temp files are cleaned up on failure to prevent orphans.

        Args:
            path: Target file path
            content: HTML content to write
            create_gzip: Whether to also create .gz version

        Returns:
            File size in bytes

        Raises:
            ValueError: If path would escape output directory (path traversal)
        """
        # Security: Validate path stays within output directory
        resolved_path = path.resolve()
        resolved_output_dir = self.output_dir.resolve()
        if not str(resolved_path).startswith(str(resolved_output_dir) + "/"):
            raise ValueError(f"Path traversal detected: {path} escapes {self.output_dir}")

        # Ensure parent directory exists
        path.parent.mkdir(parents=True, exist_ok=True)

        content_bytes = content.encode("utf-8")
        temp_path = path.with_suffix(".tmp")

        # Write HTML file atomically with cleanup on failure
        try:
            temp_path.write_bytes(content_bytes)
            temp_path.rename(path)
        except Exception:
            temp_path.unlink(missing_ok=True)
            raise

        # Create gzip version for nginx gzip_static
        if create_gzip:
            gz_path = path.with_suffix(path.suffix + ".gz")
            gz_temp = gz_path.with_suffix(".tmp")
            try:
                with gzip.open(gz_temp, "wb", compresslevel=9) as f:
                    f.write(content_bytes)
                gz_temp.rename(gz_path)
            except Exception:
                gz_temp.unlink(missing_ok=True)
                raise

        return len(content_bytes)

    def _needs_regeneration(
        self,
        page_key: str,
        source_hash: str,
        template_hash: str,
    ) -> bool:
        """
        Check if a page needs regeneration by comparing hashes.

        Args:
            page_key: Unique page identifier
            source_hash: Current hash of source data
            template_hash: Current hash of template

        Returns:
            True if page needs regeneration
        """
        page = self.db.query(SeoPage).filter(SeoPage.page_key == page_key).first()

        if page is None:
            return True

        return page.needs_regeneration(source_hash, template_hash)

    def _record_page(
        self,
        page_key: str,
        page_type: str,
        source_hash: str,
        template_hash: str,
        file_path: str,
        file_size: int,
        generation_ms: int,
    ) -> None:
        """
        Record or update page generation metadata.

        Args:
            page_key: Unique page identifier
            page_type: Page category (verse, chapter, topic, etc.)
            source_hash: Hash of source data
            template_hash: Hash of template
            file_path: Relative path to generated file
            file_size: File size in bytes
            generation_ms: Generation time in milliseconds
        """
        page = self.db.query(SeoPage).filter(SeoPage.page_key == page_key).first()

        if page:
            page.source_hash = source_hash
            page.template_hash = template_hash
            page.generated_at = datetime.utcnow()
            page.file_path = file_path
            page.file_size_bytes = file_size
            page.generation_ms = generation_ms
        else:
            page = SeoPage(
                page_key=page_key,
                page_type=page_type,
                source_hash=source_hash,
                template_hash=template_hash,
                generated_at=datetime.utcnow(),
                file_path=file_path,
                file_size_bytes=file_size,
                generation_ms=generation_ms,
            )
            self.db.add(page)

    def generate_all(self, force: bool = False) -> SeoGenerationResult:
        """
        Generate all SEO pages with concurrency protection.

        Args:
            force: If True, regenerate all pages regardless of hash

        Returns:
            SeoGenerationResult with generation statistics

        Raises:
            GenerationInProgressError: If another generation is running
        """
        start_time = time.time()

        # Acquire exclusive lock
        if not self._acquire_lock():
            raise GenerationInProgressError(
                "Another SEO generation is already in progress"
            )

        try:
            logger.info("=" * 60)
            logger.info("SEO GENERATION: Starting")
            if force:
                logger.info("SEO GENERATION: Force mode - regenerating all pages")
            logger.info("=" * 60)

            generated = 0
            skipped = 0
            errors = 0

            # Generate verse pages
            verse_stats = self._generate_verse_pages(force)
            generated += verse_stats["generated"]
            skipped += verse_stats["skipped"]
            errors += verse_stats["errors"]

            # Generate chapter pages
            chapter_stats = self._generate_chapter_pages(force)
            generated += chapter_stats["generated"]
            skipped += chapter_stats["skipped"]
            errors += chapter_stats["errors"]

            # Generate static pages (home, about, 404, etc.)
            static_stats = self._generate_static_pages(force)
            generated += static_stats["generated"]
            skipped += static_stats["skipped"]
            errors += static_stats["errors"]

            # Generate topic pages (principles)
            topic_stats = self._generate_topic_pages(force)
            generated += topic_stats["generated"]
            skipped += topic_stats["skipped"]
            errors += topic_stats["errors"]

            # Commit all changes
            self.db.commit()

            total_pages = generated + skipped
            duration_ms = int((time.time() - start_time) * 1000)

            logger.info("=" * 60)
            logger.info(
                f"SEO GENERATION: Complete - "
                f"{generated} generated, {skipped} skipped, {errors} errors"
            )
            logger.info(f"SEO GENERATION: Duration {duration_ms}ms")
            logger.info("=" * 60)

            return SeoGenerationResult(
                total_pages=total_pages,
                generated=generated,
                skipped=skipped,
                errors=errors,
                duration_ms=duration_ms,
            )

        except Exception:
            # Rollback on any unhandled exception to prevent partial state
            self.db.rollback()
            raise
        finally:
            self._release_lock()

    def _generate_verse_pages(self, force: bool) -> dict[str, int]:
        """Generate all verse detail pages."""
        from models import Verse

        stats = {"generated": 0, "skipped": 0, "errors": 0}
        template_name = "seo/verse.html"
        template_hash = self._get_template_hash(template_name)
        template = self.env.get_template(template_name)

        verses = self.db.query(Verse).order_by(Verse.chapter, Verse.verse).all()
        logger.info(f"SEO GENERATION: Processing {len(verses)} verses")

        for i, verse in enumerate(verses):
            try:
                page_key = verse.canonical_id
                page_type = "verse"

                # Compute source hash from verse data
                source_data = {
                    "canonical_id": verse.canonical_id,
                    "chapter": verse.chapter,
                    "verse": verse.verse,
                    "sanskrit_devanagari": verse.sanskrit_devanagari,
                    "sanskrit_iast": verse.sanskrit_iast,
                    "translation_en": verse.translation_en,
                    "paraphrase_en": verse.paraphrase_en,
                    "consulting_principles": verse.consulting_principles,
                }
                source_hash = compute_source_hash(source_data)

                if not force and not self._needs_regeneration(
                    page_key, source_hash, template_hash
                ):
                    stats["skipped"] += 1
                    continue

                # Generate page
                gen_start = time.time()

                # Get prev/next verses for navigation
                prev_verse = verses[i - 1] if i > 0 else None
                next_verse = verses[i + 1] if i < len(verses) - 1 else None

                html = template.render(
                    verse=verse,
                    prev_verse=prev_verse,
                    next_verse=next_verse,
                )

                # Write file atomically
                file_path = f"verses/{verse.canonical_id}.html"
                output_path = self.output_dir / file_path
                file_size = self._write_atomic(output_path, html)

                gen_ms = int((time.time() - gen_start) * 1000)

                # Record in database
                self._record_page(
                    page_key=page_key,
                    page_type=page_type,
                    source_hash=source_hash,
                    template_hash=template_hash,
                    file_path=file_path,
                    file_size=file_size,
                    generation_ms=gen_ms,
                )

                stats["generated"] += 1

                if (stats["generated"] + stats["skipped"]) % 100 == 0:
                    logger.info(
                        f"SEO GENERATION: Processed {stats['generated'] + stats['skipped']}/{len(verses)} verses"
                    )

            except Exception as e:
                logger.error(
                    f"SEO GENERATION: Error generating verse {verse.canonical_id}: {e}",
                    exc_info=True,
                )
                stats["errors"] += 1

        logger.info(
            f"SEO GENERATION: Verses - "
            f"{stats['generated']} generated, {stats['skipped']} skipped"
        )
        return stats

    def _generate_chapter_pages(self, force: bool) -> dict[str, int]:
        """Generate all chapter index pages."""
        from collections import defaultdict

        from models import ChapterMetadata, Verse

        stats = {"generated": 0, "skipped": 0, "errors": 0}
        template_name = "seo/chapter.html"
        template_hash = self._get_template_hash(template_name)
        template = self.env.get_template(template_name)

        # Get chapter metadata
        chapters = (
            self.db.query(ChapterMetadata)
            .order_by(ChapterMetadata.chapter_number)
            .all()
        )

        if not chapters:
            logger.warning("SEO GENERATION: No chapter metadata found")
            return stats

        # Prefetch all verses in one query to avoid N+1
        all_verses = (
            self.db.query(Verse).order_by(Verse.chapter, Verse.verse).all()
        )
        verses_by_chapter: dict[int, list] = defaultdict(list)
        for verse in all_verses:
            verses_by_chapter[verse.chapter].append(verse)

        logger.info(f"SEO GENERATION: Processing {len(chapters)} chapters")

        for i, chapter in enumerate(chapters):
            try:
                page_key = f"chapter_{chapter.chapter_number}"
                page_type = "chapter"

                # Get verses for this chapter from prefetched data
                verses = verses_by_chapter[chapter.chapter_number]

                # Compute source hash
                source_data = {
                    "chapter_number": chapter.chapter_number,
                    "english_title": chapter.english_title,
                    "sanskrit_name": chapter.sanskrit_name,
                    "summary": chapter.summary,
                    "verse_count": len(verses),
                    "verse_ids": [v.canonical_id for v in verses],
                }
                source_hash = compute_source_hash(source_data)

                if not force and not self._needs_regeneration(
                    page_key, source_hash, template_hash
                ):
                    stats["skipped"] += 1
                    continue

                # Generate page
                gen_start = time.time()

                prev_chapter = chapters[i - 1] if i > 0 else None
                next_chapter = chapters[i + 1] if i < len(chapters) - 1 else None

                html = template.render(
                    chapter=chapter,
                    verses=verses,
                    prev_chapter=prev_chapter,
                    next_chapter=next_chapter,
                )

                # Write file
                file_path = f"verses/chapter/{chapter.chapter_number}.html"
                output_path = self.output_dir / file_path
                file_size = self._write_atomic(output_path, html)

                gen_ms = int((time.time() - gen_start) * 1000)

                self._record_page(
                    page_key=page_key,
                    page_type=page_type,
                    source_hash=source_hash,
                    template_hash=template_hash,
                    file_path=file_path,
                    file_size=file_size,
                    generation_ms=gen_ms,
                )

                stats["generated"] += 1

            except Exception as e:
                logger.error(
                    f"SEO GENERATION: Error generating chapter {chapter.chapter_number}: {e}",
                    exc_info=True,
                )
                stats["errors"] += 1

        logger.info(
            f"SEO GENERATION: Chapters - "
            f"{stats['generated']} generated, {stats['skipped']} skipped"
        )
        return stats

    def _generate_static_pages(self, force: bool) -> dict[str, int]:
        """Generate static pages (home, about, verse index, 404)."""
        stats = {"generated": 0, "skipped": 0, "errors": 0}

        static_pages = [
            ("home", "seo/home.html", "index.html"),
            ("about", "seo/about.html", "about.html"),
            ("verse_index", "seo/verse_index.html", "verses/index.html"),
            ("404", "seo/404.html", "404.html"),
        ]

        for page_key, template_name, file_path in static_pages:
            try:
                template_hash = self._get_template_hash(template_name)

                # Static pages use template hash as source hash
                # (they don't have dynamic source data, or it's embedded in template)
                source_hash = template_hash

                if not force and not self._needs_regeneration(
                    page_key, source_hash, template_hash
                ):
                    stats["skipped"] += 1
                    continue

                gen_start = time.time()
                template = self.env.get_template(template_name)

                # Render with appropriate context
                context = self._get_static_page_context(page_key)
                html = template.render(**context)

                output_path = self.output_dir / file_path
                file_size = self._write_atomic(output_path, html)

                gen_ms = int((time.time() - gen_start) * 1000)

                self._record_page(
                    page_key=page_key,
                    page_type=page_key,  # Type matches key for static pages
                    source_hash=source_hash,
                    template_hash=template_hash,
                    file_path=file_path,
                    file_size=file_size,
                    generation_ms=gen_ms,
                )

                stats["generated"] += 1
                logger.info(f"SEO GENERATION: Generated {page_key}")

            except Exception as e:
                logger.error(
                    f"SEO GENERATION: Error generating {page_key}: {e}",
                    exc_info=True,
                )
                stats["errors"] += 1

        return stats

    def _get_static_page_context(self, page_key: str) -> dict:
        """Get template context for static pages."""
        from models import ChapterMetadata

        if page_key == "home":
            chapters = (
                self.db.query(ChapterMetadata)
                .order_by(ChapterMetadata.chapter_number)
                .all()
            )
            return {"chapters": chapters}

        if page_key == "verse_index":
            chapters = (
                self.db.query(ChapterMetadata)
                .order_by(ChapterMetadata.chapter_number)
                .all()
            )
            return {"chapters": chapters}

        # About and 404 don't need special context
        return {}

    def _generate_topic_pages(self, force: bool) -> dict[str, int]:
        """Generate topic pages for principles and topics index."""
        from sqlalchemy.orm import joinedload

        from models import Principle, PrincipleGroup

        stats = {"generated": 0, "skipped": 0, "errors": 0}

        # Query principles and groups from database
        principles = (
            self.db.query(Principle)
            .order_by(Principle.display_order)
            .all()
        )
        # Eager load principles relationship to avoid N+1 queries in template
        groups = (
            self.db.query(PrincipleGroup)
            .options(joinedload(PrincipleGroup.principles))
            .order_by(PrincipleGroup.display_order)
            .all()
        )

        if not principles:
            logger.warning("SEO GENERATION: No principles found in database")
            return stats

        logger.info(f"SEO GENERATION: Processing {len(principles)} principles")

        # Generate individual principle pages
        template_name = "seo/topic.html"
        template_hash = self._get_template_hash(template_name)
        template = self.env.get_template(template_name)

        for i, principle in enumerate(principles):
            try:
                page_key = f"topic_{principle.id}"
                page_type = "topic"

                # Compute source hash from principle data
                source_data = {
                    "id": principle.id,
                    "label": principle.label,
                    "short_label": principle.short_label,
                    "sanskrit": principle.sanskrit,
                    "transliteration": principle.transliteration,
                    "description": principle.description,
                    "leadership_context": principle.leadership_context,
                    "group_id": principle.group_id,
                    "keywords": principle.keywords,
                    "chapter_focus": principle.chapter_focus,
                    "extended_description": principle.extended_description,
                    "practical_application": principle.practical_application,
                    "common_misconceptions": principle.common_misconceptions,
                    "faq_question": principle.faq_question,
                    "faq_answer": principle.faq_answer,
                    "related_principles": principle.related_principles,
                }
                source_hash = compute_source_hash(source_data)

                if not force and not self._needs_regeneration(
                    page_key, source_hash, template_hash
                ):
                    stats["skipped"] += 1
                    continue

                # Generate page
                gen_start = time.time()

                # Get group for this principle
                group = next((g for g in groups if g.id == principle.group_id), None)

                # Get related principles if specified
                related_principles = []
                if principle.related_principles:
                    related_principles = [
                        p for p in principles
                        if p.id in principle.related_principles
                    ]

                # Get prev/next for navigation
                prev_principle = principles[i - 1] if i > 0 else None
                next_principle = principles[i + 1] if i < len(principles) - 1 else None

                html = template.render(
                    principle=principle,
                    group=group,
                    related_principles=related_principles,
                    prev_principle=prev_principle,
                    next_principle=next_principle,
                )

                # Write file
                file_path = f"topics/{principle.id}.html"
                output_path = self.output_dir / file_path
                file_size = self._write_atomic(output_path, html)

                gen_ms = int((time.time() - gen_start) * 1000)

                self._record_page(
                    page_key=page_key,
                    page_type=page_type,
                    source_hash=source_hash,
                    template_hash=template_hash,
                    file_path=file_path,
                    file_size=file_size,
                    generation_ms=gen_ms,
                )

                stats["generated"] += 1

            except Exception as e:
                logger.error(
                    f"SEO GENERATION: Error generating topic {principle.id}: {e}",
                    exc_info=True,
                )
                stats["errors"] += 1

        # Generate topics index page
        index_stats = self._generate_topics_index(groups, force)
        stats["generated"] += index_stats["generated"]
        stats["skipped"] += index_stats["skipped"]
        stats["errors"] += index_stats["errors"]

        logger.info(
            f"SEO GENERATION: Topics - "
            f"{stats['generated']} generated, {stats['skipped']} skipped"
        )
        return stats

    def _generate_topics_index(
        self, groups: list, force: bool
    ) -> dict[str, int]:
        """Generate topics index page."""
        stats = {"generated": 0, "skipped": 0, "errors": 0}

        try:
            page_key = "topics_index"
            page_type = "topics_index"
            template_name = "seo/topics_index.html"
            template_hash = self._get_template_hash(template_name)

            # Source hash based on all groups and their principles
            source_data = {
                "groups": [
                    {
                        "id": g.id,
                        "label": g.label,
                        "principles": [p.id for p in g.principles],
                    }
                    for g in groups
                ]
            }
            source_hash = compute_source_hash(source_data)

            if not force and not self._needs_regeneration(
                page_key, source_hash, template_hash
            ):
                stats["skipped"] += 1
                return stats

            gen_start = time.time()
            template = self.env.get_template(template_name)

            html = template.render(groups=groups)

            file_path = "topics/index.html"
            output_path = self.output_dir / file_path
            file_size = self._write_atomic(output_path, html)

            gen_ms = int((time.time() - gen_start) * 1000)

            self._record_page(
                page_key=page_key,
                page_type=page_type,
                source_hash=source_hash,
                template_hash=template_hash,
                file_path=file_path,
                file_size=file_size,
                generation_ms=gen_ms,
            )

            stats["generated"] += 1
            logger.info("SEO GENERATION: Generated topics index")

        except Exception as e:
            logger.error(
                f"SEO GENERATION: Error generating topics index: {e}",
                exc_info=True,
            )
            stats["errors"] += 1

        return stats

    def get_status(self) -> dict:
        """
        Get current SEO generation status.

        Returns:
            Dict with page counts and last generation time
        """
        from sqlalchemy import func

        # Count pages by type
        type_counts = (
            self.db.query(SeoPage.page_type, func.count(SeoPage.page_key))
            .group_by(SeoPage.page_type)
            .all()
        )

        # Get last generation time
        last_generated = self.db.query(func.max(SeoPage.generated_at)).scalar()

        # Total file size
        total_size = self.db.query(func.sum(SeoPage.file_size_bytes)).scalar() or 0

        # Convert query results to dict (list of (str, int) tuples)
        pages_by_type: dict[str, int] = {row[0]: row[1] for row in type_counts}

        return {
            "pages_by_type": pages_by_type,
            "total_pages": sum(pages_by_type.values()),
            "total_size_bytes": total_size,
            "last_generated_at": last_generated.isoformat() if last_generated else None,
        }
