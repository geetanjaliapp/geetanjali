"""Admin endpoints for data synchronization operations."""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.dependencies import verify_admin_api_key
from data.featured_verses import get_featured_verse_ids
from data.principles import get_principle_groups, get_principles
from db.connection import get_db
from models import Principle, PrincipleGroup, Verse

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# Featured Verses Sync
# =============================================================================


class SyncFeaturedResponse(BaseModel):
    """Response model for featured verses sync."""

    status: str
    message: str
    total_featured: int
    synced: int
    not_found: int


def sync_featured_verses(db: Session) -> dict:
    """
    Sync featured verses from static list to database.

    This updates the is_featured column based on the curated list in code.
    Should be called after ingestion or on startup.

    OPTIMIZATION: Uses bulk UPDATE with IN clause instead of N individual updates.
    Reduces 180+ queries to 2 queries.

    Args:
        db: Database session

    Returns:
        Stats dict with synced/not_found counts
    """
    featured_ids = get_featured_verse_ids()

    # Step 1: Reset all to not featured (1 query)
    db.query(Verse).update({"is_featured": False})

    # Step 2: Bulk update all featured verses in one query
    # Uses canonical_id IN (...) instead of loop
    synced = (
        db.query(Verse)
        .filter(Verse.canonical_id.in_(featured_ids))
        .update({"is_featured": True}, synchronize_session="fetch")
    )

    # Step 3: Find which IDs weren't found (only if needed for logging)
    not_found = []
    if synced < len(featured_ids):
        found_ids = {
            row[0]
            for row in db.query(Verse.canonical_id)
            .filter(Verse.canonical_id.in_(featured_ids))
            .all()
        }
        not_found = [cid for cid in featured_ids if cid not in found_ids]

    db.commit()

    if not_found:
        logger.warning(
            f"Featured verses not found in DB: {not_found[:10]}{'...' if len(not_found) > 10 else ''}"
        )

    logger.info(f"Synced {synced}/{len(featured_ids)} featured verses")

    return {
        "total_featured": len(featured_ids),
        "synced": synced,
        "not_found": len(not_found),
        "not_found_ids": not_found,
    }


@router.post("/sync-featured", response_model=SyncFeaturedResponse)
def trigger_sync_featured(
    db: Session = Depends(get_db), _: bool = Depends(verify_admin_api_key)
):
    """
    Sync featured verses from curated list to database.

    This marks verses as is_featured=True based on the static curated list.
    Run this after data ingestion to ensure featured flags are set.

    Returns:
        Sync statistics
    """
    try:
        stats = sync_featured_verses(db)

        return SyncFeaturedResponse(
            status="success",
            message=f"Synced {stats['synced']} of {stats['total_featured']} featured verses.",
            total_featured=stats["total_featured"],
            synced=stats["synced"],
            not_found=stats["not_found"],
        )

    except Exception as e:
        logger.error(f"Failed to sync featured verses: {e}")
        raise HTTPException(status_code=500, detail="Failed to sync featured verses")


# =============================================================================
# Metadata Sync (Book & Chapter Intros)
# =============================================================================


class SyncMetadataResponse(BaseModel):
    """Response model for metadata sync."""

    status: str
    message: str
    book_synced: bool
    chapters_synced: int


def sync_metadata(db: Session) -> dict:
    """
    Sync book and chapter metadata from static data to database.

    This updates the book_metadata and chapter_metadata tables based on
    the curated content in data/chapter_metadata.py.

    Args:
        db: Database session

    Returns:
        Stats dict with sync results
    """
    from datetime import datetime

    from data.chapter_metadata import get_all_chapter_metadata, get_book_metadata
    from models import BookMetadata, ChapterMetadata

    book_data = get_book_metadata()
    chapters_data = get_all_chapter_metadata()

    # Sync book metadata
    book_synced = False
    existing_book = (
        db.query(BookMetadata).filter(BookMetadata.book_key == "bhagavad_geeta").first()
    )

    if existing_book:
        # Update existing
        existing_book.sanskrit_title = book_data["sanskrit_title"]
        existing_book.transliteration = book_data["transliteration"]
        existing_book.english_title = book_data["english_title"]
        existing_book.tagline = book_data["tagline"]
        existing_book.intro_text = book_data["intro_text"]
        existing_book.verse_count = book_data["verse_count"]
        existing_book.chapter_count = book_data["chapter_count"]
        existing_book.updated_at = datetime.utcnow()
        book_synced = True
    else:
        # Create new
        new_book = BookMetadata(
            book_key="bhagavad_geeta",
            sanskrit_title=book_data["sanskrit_title"],
            transliteration=book_data["transliteration"],
            english_title=book_data["english_title"],
            tagline=book_data["tagline"],
            intro_text=book_data["intro_text"],
            verse_count=book_data["verse_count"],
            chapter_count=book_data["chapter_count"],
        )
        db.add(new_book)
        book_synced = True

    # Sync chapter metadata
    chapters_synced = 0
    for ch_data in chapters_data:
        existing_ch = (
            db.query(ChapterMetadata)
            .filter(ChapterMetadata.chapter_number == ch_data["chapter_number"])
            .first()
        )

        if existing_ch:
            # Update existing
            existing_ch.sanskrit_name = ch_data["sanskrit_name"]
            existing_ch.transliteration = ch_data["transliteration"]
            existing_ch.english_title = ch_data["english_title"]
            existing_ch.subtitle = ch_data["subtitle"]
            existing_ch.summary = ch_data["summary"]
            existing_ch.verse_count = ch_data["verse_count"]
            existing_ch.key_themes = ch_data["key_themes"]
            existing_ch.updated_at = datetime.utcnow()
        else:
            # Create new
            new_ch = ChapterMetadata(
                chapter_number=ch_data["chapter_number"],
                sanskrit_name=ch_data["sanskrit_name"],
                transliteration=ch_data["transliteration"],
                english_title=ch_data["english_title"],
                subtitle=ch_data["subtitle"],
                summary=ch_data["summary"],
                verse_count=ch_data["verse_count"],
                key_themes=ch_data["key_themes"],
            )
            db.add(new_ch)

        chapters_synced += 1

    db.commit()

    logger.info(f"Synced book metadata and {chapters_synced} chapters")

    return {
        "book_synced": book_synced,
        "chapters_synced": chapters_synced,
    }


@router.post("/sync-metadata", response_model=SyncMetadataResponse)
def trigger_sync_metadata(
    db: Session = Depends(get_db), _: bool = Depends(verify_admin_api_key)
):
    """
    Sync book and chapter metadata from curated content to database.

    This populates/updates the book_metadata and chapter_metadata tables
    with content for the Reading Mode cover page and chapter intros.

    Returns:
        Sync statistics
    """
    try:
        stats = sync_metadata(db)

        return SyncMetadataResponse(
            status="success",
            message=f"Synced book metadata and {stats['chapters_synced']} chapters.",
            book_synced=stats["book_synced"],
            chapters_synced=stats["chapters_synced"],
        )

    except Exception as e:
        logger.error(f"Failed to sync metadata: {e}")
        raise HTTPException(status_code=500, detail="Failed to sync metadata")


# =============================================================================
# Dhyanam Sync (9 Invocation Verses)
# =============================================================================


class SyncDhyanamResponse(BaseModel):
    """Response model for dhyanam sync."""

    status: str
    message: str
    total_dhyanam: int
    synced: int
    created: int
    updated: int


def sync_geeta_dhyanam(db: Session) -> dict[str, int]:
    """
    Sync Geeta Dhyanam verses from static data to database.

    This syncs the 9 invocation verses from data/geeta_dhyanam.py
    to the dhyanam_verses table.

    Args:
        db: Database session

    Returns:
        Stats dict with sync results
    """
    from datetime import datetime

    from data.geeta_dhyanam import get_geeta_dhyanam
    from models import DhyanamVerse

    dhyanam_data = get_geeta_dhyanam()

    synced = 0
    created = 0
    updated = 0

    for verse_data in dhyanam_data:
        existing = (
            db.query(DhyanamVerse)
            .filter(DhyanamVerse.verse_number == verse_data["verse_number"])
            .first()
        )

        if existing:
            # Update existing
            existing.sanskrit = verse_data["sanskrit"]
            existing.iast = verse_data["iast"]
            existing.english = verse_data["english"]
            existing.hindi = verse_data["hindi"]
            existing.theme = verse_data["theme"]
            existing.duration_ms = verse_data["duration_ms"]
            existing.audio_url = verse_data["audio_url"]
            existing.updated_at = datetime.utcnow()
            updated += 1
        else:
            # Create new
            new_verse = DhyanamVerse(
                verse_number=verse_data["verse_number"],
                sanskrit=verse_data["sanskrit"],
                iast=verse_data["iast"],
                english=verse_data["english"],
                hindi=verse_data["hindi"],
                theme=verse_data["theme"],
                duration_ms=verse_data["duration_ms"],
                audio_url=verse_data["audio_url"],
            )
            db.add(new_verse)
            created += 1

        synced += 1

    db.commit()

    logger.info(
        f"Synced {synced} Geeta Dhyanam verses (created={created}, updated={updated})"
    )

    return {
        "total_dhyanam": len(dhyanam_data),
        "synced": synced,
        "created": created,
        "updated": updated,
    }


@router.post("/sync-dhyanam", response_model=SyncDhyanamResponse)
def trigger_sync_dhyanam(
    db: Session = Depends(get_db), _: bool = Depends(verify_admin_api_key)
):
    """
    Sync Geeta Dhyanam invocation verses from curated content to database.

    This populates/updates the dhyanam_verses table with the 9 sacred
    verses traditionally recited before studying the Bhagavad Geeta.

    Returns:
        Sync statistics
    """
    try:
        stats = sync_geeta_dhyanam(db)

        return SyncDhyanamResponse(
            status="success",
            message=f"Synced {stats['synced']} Geeta Dhyanam verses ({stats['created']} created, {stats['updated']} updated).",
            total_dhyanam=stats["total_dhyanam"],
            synced=stats["synced"],
            created=stats["created"],
            updated=stats["updated"],
        )

    except Exception as e:
        logger.error(f"Failed to sync Dhyanam: {e}")
        raise HTTPException(status_code=500, detail="Failed to sync Dhyanam")


# =============================================================================
# Verse Audio Metadata Sync
# =============================================================================


class SyncAudioMetadataResponse(BaseModel):
    """Response model for audio metadata sync."""

    status: str
    message: str
    total_verses: int
    synced: int
    created: int
    updated: int


def sync_verse_audio_metadata(
    db: Session, chapter: int | None = None
) -> dict[str, int]:
    """
    Sync verse audio metadata from static data to database.

    This syncs metadata from data/verse_audio_metadata/ to the
    verse_audio_metadata table, providing TTS generation hints.

    Args:
        db: Database session
        chapter: Optional chapter filter (1-18)

    Returns:
        Stats dict with sync results
    """
    from datetime import datetime

    from data.verse_audio_metadata import get_verse_metadata
    from models import Verse, VerseAudioMetadata

    # Get verses to sync
    query = db.query(Verse)
    if chapter:
        query = query.filter(Verse.chapter == chapter)
    verses = query.all()

    synced = 0
    created = 0
    updated = 0

    for verse in verses:
        metadata = get_verse_metadata(verse.canonical_id)

        existing = (
            db.query(VerseAudioMetadata)
            .filter(VerseAudioMetadata.canonical_id == verse.canonical_id)
            .first()
        )

        # Extract discourse_context once for use in both branches
        discourse_ctx = metadata.get("discourse_context")
        discourse_context_str = str(discourse_ctx) if discourse_ctx else None

        if existing:
            # Update existing (preserve audio file paths if set)
            existing.speaker = str(metadata.get("speaker", "krishna"))
            existing.addressee = str(metadata.get("addressee", "arjuna"))
            existing.discourse_type = str(metadata.get("discourse_type", "teaching"))
            existing.discourse_context = discourse_context_str
            existing.emotional_tone = str(metadata.get("emotional_tone", "neutral"))
            existing.intensity = str(metadata.get("intensity", "moderate"))
            existing.pacing = str(metadata.get("pacing", "moderate"))
            existing.theological_weight = str(
                metadata.get("theological_weight", "standard")
            )
            existing.updated_at = datetime.utcnow()
            updated += 1
        else:
            # Create new
            new_meta = VerseAudioMetadata(
                verse_id=verse.id,
                canonical_id=verse.canonical_id,
                speaker=str(metadata.get("speaker", "krishna")),
                addressee=str(metadata.get("addressee", "arjuna")),
                discourse_type=str(metadata.get("discourse_type", "teaching")),
                discourse_context=discourse_context_str,
                emotional_tone=str(metadata.get("emotional_tone", "neutral")),
                intensity=str(metadata.get("intensity", "moderate")),
                pacing=str(metadata.get("pacing", "moderate")),
                theological_weight=str(metadata.get("theological_weight", "standard")),
            )
            db.add(new_meta)
            created += 1

        synced += 1

    db.commit()

    chapter_msg = f" for chapter {chapter}" if chapter else ""
    logger.info(f"Synced {synced} verse audio metadata entries{chapter_msg}")

    return {
        "total_verses": len(verses),
        "synced": synced,
        "created": created,
        "updated": updated,
    }


@router.post("/sync-audio-metadata", response_model=SyncAudioMetadataResponse)
def trigger_sync_audio_metadata(
    chapter: int | None = None,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin_api_key),
):
    """
    Sync verse audio metadata from curated content to database.

    This populates/updates the verse_audio_metadata table with TTS
    generation hints (speaker, tone, pacing, etc.) from the code-first
    curation in data/verse_audio_metadata/.

    Args:
        chapter: Optional chapter filter (1-18). If not provided, syncs all.

    Returns:
        Sync statistics
    """
    if chapter is not None and (chapter < 1 or chapter > 18):
        raise HTTPException(status_code=400, detail="Chapter must be between 1 and 18")

    try:
        stats = sync_verse_audio_metadata(db, chapter)

        chapter_msg = f" for chapter {chapter}" if chapter else ""
        return SyncAudioMetadataResponse(
            status="success",
            message=f"Synced {stats['synced']} verse audio metadata entries{chapter_msg}.",
            total_verses=stats["total_verses"],
            synced=stats["synced"],
            created=stats["created"],
            updated=stats["updated"],
        )

    except Exception as e:
        logger.error(f"Failed to sync audio metadata: {e}")
        raise HTTPException(status_code=500, detail="Failed to sync audio metadata")


# =============================================================================
# Principles Taxonomy Sync
# =============================================================================


class SyncPrinciplesResponse(BaseModel):
    """Response model for principles sync."""

    status: str
    message: str
    groups_synced: int
    principles_synced: int
    created: int
    updated: int


def sync_principles(db: Session) -> dict[str, int]:
    """
    Sync principle groups and principles from config files to database.

    Syncs in order:
    1. Principle groups (4 yoga paths)
    2. Principles (16 consulting principles)

    Args:
        db: Database session

    Returns:
        Stats dict with sync results
    """
    groups_data = get_principle_groups()
    principles_data = get_principles()

    groups_synced = 0
    principles_synced = 0
    created = 0
    updated = 0

    # Step 1: Sync principle groups
    for group_data in groups_data:
        existing_group = (
            db.query(PrincipleGroup)
            .filter(PrincipleGroup.id == group_data["id"])
            .first()
        )

        if existing_group:
            existing_group.label = group_data["label"]
            existing_group.sanskrit = group_data["sanskrit"]
            existing_group.transliteration = group_data["transliteration"]
            existing_group.description = group_data["description"]
            display_order: int = group_data.get("display_order") or 0  # type: ignore[assignment]
            existing_group.display_order = display_order
            existing_group.updated_at = datetime.utcnow()
        else:
            display_order_new: int = group_data.get("display_order") or 0  # type: ignore[assignment]
            new_group = PrincipleGroup(
                id=group_data["id"],
                label=group_data["label"],
                sanskrit=group_data["sanskrit"],
                transliteration=group_data["transliteration"],
                description=group_data["description"],
                display_order=display_order_new,
            )
            db.add(new_group)
            created += 1

        groups_synced += 1

    # Flush groups so FK references work
    db.flush()

    # Step 2: Sync principles
    for principle_data in principles_data:
        existing_principle = (
            db.query(Principle)
            .filter(Principle.id == principle_data["id"])
            .first()
        )

        if existing_principle:
            # Update existing
            existing_principle.label = principle_data["label"]
            existing_principle.short_label = principle_data["shortLabel"]
            existing_principle.sanskrit = principle_data["sanskrit"]
            existing_principle.transliteration = principle_data["transliteration"]
            existing_principle.description = principle_data["description"]
            existing_principle.leadership_context = principle_data["leadershipContext"]
            existing_principle.group_id = principle_data["group"]
            existing_principle.keywords = principle_data["keywords"]
            existing_principle.chapter_focus = principle_data["chapterFocus"]
            p_display_order: int = principle_data.get("display_order") or 0  # type: ignore[assignment]
            existing_principle.display_order = p_display_order
            # Extended content (optional)
            existing_principle.extended_description = principle_data.get(
                "extended_description"
            )
            existing_principle.practical_application = principle_data.get(
                "practical_application"
            )
            existing_principle.common_misconceptions = principle_data.get(
                "common_misconceptions"
            )
            existing_principle.faq_question = principle_data.get("faq_question")
            existing_principle.faq_answer = principle_data.get("faq_answer")
            existing_principle.related_principles = principle_data.get(
                "related_principles"
            )
            existing_principle.updated_at = datetime.utcnow()
            updated += 1
        else:
            # Create new
            p_display_order_new: int = principle_data.get("display_order") or 0  # type: ignore[assignment]
            new_principle = Principle(
                id=principle_data["id"],
                label=principle_data["label"],
                short_label=principle_data["shortLabel"],
                sanskrit=principle_data["sanskrit"],
                transliteration=principle_data["transliteration"],
                description=principle_data["description"],
                leadership_context=principle_data["leadershipContext"],
                group_id=principle_data["group"],
                keywords=principle_data["keywords"],
                chapter_focus=principle_data["chapterFocus"],
                display_order=p_display_order_new,
                # Extended content (optional)
                extended_description=principle_data.get("extended_description"),
                practical_application=principle_data.get("practical_application"),
                common_misconceptions=principle_data.get("common_misconceptions"),
                faq_question=principle_data.get("faq_question"),
                faq_answer=principle_data.get("faq_answer"),
                related_principles=principle_data.get("related_principles"),
            )
            db.add(new_principle)
            created += 1

        principles_synced += 1

    db.commit()

    logger.info(
        f"Synced {groups_synced} principle groups and {principles_synced} principles "
        f"(created={created}, updated={updated})"
    )

    return {
        "groups_synced": groups_synced,
        "principles_synced": principles_synced,
        "created": created,
        "updated": updated,
    }


@router.post("/sync-principles", response_model=SyncPrinciplesResponse)
def trigger_sync_principles(
    db: Session = Depends(get_db), _: bool = Depends(verify_admin_api_key)
):
    """
    Sync principle taxonomy from config files to database.

    This populates/updates the principle_groups and principles tables
    from the JSON config files (principle_groups.json, principle_taxonomy.json).

    Returns:
        Sync statistics
    """
    try:
        stats = sync_principles(db)

        return SyncPrinciplesResponse(
            status="success",
            message=f"Synced {stats['groups_synced']} groups and {stats['principles_synced']} principles.",
            groups_synced=stats["groups_synced"],
            principles_synced=stats["principles_synced"],
            created=stats["created"],
            updated=stats["updated"],
        )

    except Exception as e:
        logger.error(f"Failed to sync principles: {e}")
        raise HTTPException(status_code=500, detail="Failed to sync principles")
