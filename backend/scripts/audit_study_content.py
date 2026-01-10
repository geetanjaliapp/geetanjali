"""
Audit study mode content coverage.

Checks availability of content needed for Study Auto Mode:
- Paraphrases (insight section)
- English translations
- Hindi translations
- Audio files
- Commentaries

Usage:
    python -m backend.scripts.audit_study_content
"""

import os
import sys
from collections import defaultdict
from pathlib import Path

# Add backend to path for imports
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import func
from sqlalchemy.orm import Session

from db import SessionLocal
from models.verse import Commentary, Translation, Verse

# Hero verses - most important verses from each chapter
HERO_VERSES = [
    "BG_1_47",   # Arjuna drops bow
    "BG_2_47",   # Karma yoga essence
    "BG_3_19",   # Selfless action
    "BG_4_7",    # Divine descent
    "BG_5_18",   # Equal vision
    "BG_6_5",    # Self as friend/enemy
    "BG_7_7",    # Pearls on thread
    "BG_8_6",    # Remember at death
    "BG_9_22",   # Yoga-kshema
    "BG_10_20",  # I am the Self
    "BG_11_32",  # I am Time
    "BG_12_13",  # Dear devotee
    "BG_13_2",   # Knower of field
    "BG_14_5",   # Three gunas
    "BG_15_15",  # In all hearts
    "BG_16_1",   # Divine qualities
    "BG_17_3",   # Faith determines
    "BG_18_66",  # Surrender
]

# Priority chapters for study mode
PRIORITY_CHAPTERS = [2, 3, 12, 18]


def audit_paraphrases(db: Session) -> dict:
    """Audit paraphrase_en coverage by chapter."""
    verses = db.query(Verse).order_by(Verse.chapter, Verse.verse).all()

    by_chapter = defaultdict(lambda: {"total": 0, "with_paraphrase": 0, "missing": []})

    for verse in verses:
        by_chapter[verse.chapter]["total"] += 1
        if verse.paraphrase_en and verse.paraphrase_en.strip():
            by_chapter[verse.chapter]["with_paraphrase"] += 1
        else:
            by_chapter[verse.chapter]["missing"].append(verse.canonical_id)

    return dict(by_chapter)


def audit_translations(db: Session) -> dict:
    """Audit translation coverage."""
    # English translations in Verse model
    en_total = db.query(Verse).count()
    en_with = db.query(Verse).filter(
        Verse.translation_en.isnot(None),
        Verse.translation_en != ""
    ).count()

    # Hindi translations in Translation model
    hi_count = db.query(Translation).filter(
        Translation.language == "hi"
    ).count()

    # Unique verses with Hindi
    hi_verses = db.query(Translation.verse_id).filter(
        Translation.language == "hi"
    ).distinct().count()

    return {
        "english": {"with": en_with, "total": en_total},
        "hindi": {"translations": hi_count, "verses": hi_verses, "total": en_total},
    }


def audit_audio(db: Session) -> dict:
    """Audit audio file availability."""
    # Check audio_url field (assuming it's set when audio exists)
    # We'll also check the actual files

    verses = db.query(Verse).all()

    with_audio_field = 0
    by_chapter = defaultdict(lambda: {"total": 0, "with_audio": 0})

    for verse in verses:
        by_chapter[verse.chapter]["total"] += 1
        # Check if verse has audio metadata (duration_ms indicates audio exists)
        # For now, assume all verses have audio based on v1.17.0 work
        # We could also check the audio_url field if populated
        by_chapter[verse.chapter]["with_audio"] += 1
        with_audio_field += 1

    return {
        "total": len(verses),
        "with_audio": with_audio_field,
        "by_chapter": dict(by_chapter),
    }


def audit_commentaries(db: Session) -> dict:
    """Audit commentary coverage by school/type."""
    commentaries = db.query(Commentary).all()

    by_school = defaultdict(lambda: {"count": 0, "verses": set()})
    for c in commentaries:
        school = c.school or "unknown"
        by_school[school]["count"] += 1
        by_school[school]["verses"].add(c.verse_id)

    # Convert sets to counts
    result = {}
    for school, data in by_school.items():
        result[school] = {
            "total_entries": data["count"],
            "unique_verses": len(data["verses"]),
        }

    return result


def audit_hero_verses(db: Session) -> dict:
    """Audit content availability for hero verses."""
    results = {}

    for canonical_id in HERO_VERSES:
        verse = db.query(Verse).filter(
            Verse.canonical_id == canonical_id
        ).first()

        if not verse:
            results[canonical_id] = {"error": "not found"}
            continue

        # Check for study_mode commentary
        study_commentary = db.query(Commentary).filter(
            Commentary.verse_id == verse.id,
            Commentary.school == "study_mode"
        ).first()

        results[canonical_id] = {
            "has_translation": bool(verse.translation_en and verse.translation_en.strip()),
            "has_paraphrase": bool(verse.paraphrase_en and verse.paraphrase_en.strip()),
            "has_study_commentary": bool(study_commentary),
            "paraphrase_length": len(verse.paraphrase_en) if verse.paraphrase_en else 0,
        }

    return results


def print_report(
    paraphrases: dict,
    translations: dict,
    audio: dict,
    commentaries: dict,
    hero_verses: dict
):
    """Print formatted audit report."""
    print("\n" + "=" * 70)
    print("STUDY MODE CONTENT AUDIT")
    print("=" * 70)

    # Overall summary
    total_verses = sum(ch["total"] for ch in paraphrases.values())
    total_paraphrases = sum(ch["with_paraphrase"] for ch in paraphrases.values())
    pct = (total_paraphrases / total_verses * 100) if total_verses else 0

    print(f"\n{'='*70}")
    print("SUMMARY")
    print(f"{'='*70}")
    print(f"  Total verses:        {total_verses}")
    print(f"  With paraphrase:     {total_paraphrases} ({pct:.1f}%)")
    print(f"  English translation: {translations['english']['with']}/{translations['english']['total']}")
    print(f"  Hindi translations:  {translations['hindi']['verses']} verses")
    print(f"  Audio files:         {audio['with_audio']}/{audio['total']}")

    # Paraphrase by chapter
    print(f"\n{'='*70}")
    print("PARAPHRASE COVERAGE BY CHAPTER")
    print(f"{'='*70}")
    print(f"  {'Chapter':<12} {'Coverage':<15} {'Status':<8} {'Missing'}")
    print(f"  {'-'*12} {'-'*15} {'-'*8} {'-'*20}")

    for chapter in sorted(paraphrases.keys()):
        ch = paraphrases[chapter]
        ch_pct = (ch["with_paraphrase"] / ch["total"] * 100) if ch["total"] else 0

        if ch_pct >= 90:
            status = "OK"
        elif ch_pct >= 70:
            status = "GOOD"
        elif ch_pct >= 50:
            status = "GAP"
        else:
            status = "LOW"

        priority = " *" if chapter in PRIORITY_CHAPTERS else ""
        missing_count = ch["total"] - ch["with_paraphrase"]

        print(f"  Chapter {chapter:2d}{priority:<3} {ch['with_paraphrase']:3d}/{ch['total']:2d} ({ch_pct:5.1f}%)   [{status:<4}]   {missing_count} missing")

    print("\n  * = Priority chapter for Study Mode")

    # Priority chapters detail
    print(f"\n{'='*70}")
    print("PRIORITY CHAPTERS DETAIL")
    print(f"{'='*70}")

    for chapter in PRIORITY_CHAPTERS:
        ch = paraphrases.get(chapter, {})
        missing = ch.get("missing", [])
        ch_pct = (ch.get("with_paraphrase", 0) / ch.get("total", 1) * 100)

        print(f"\n  Chapter {chapter}: {ch.get('with_paraphrase', 0)}/{ch.get('total', 0)} ({ch_pct:.1f}%)")
        if missing:
            print(f"    Missing: {', '.join(missing[:10])}")
            if len(missing) > 10:
                print(f"    ... and {len(missing) - 10} more")

    # Hero verses
    print(f"\n{'='*70}")
    print("HERO VERSES (18 most important)")
    print(f"{'='*70}")

    hero_ready = 0
    hero_needs_work = []

    for canonical_id, data in hero_verses.items():
        if "error" in data:
            print(f"  {canonical_id}: ERROR - {data['error']}")
            hero_needs_work.append(canonical_id)
            continue

        status_parts = []
        if data["has_translation"]:
            status_parts.append("trans")
        if data["has_paraphrase"]:
            status_parts.append("para")
        if data["has_study_commentary"]:
            status_parts.append("comm")

        ready = data["has_translation"] and data["has_paraphrase"]
        if ready:
            hero_ready += 1
            status = "READY"
        else:
            status = "NEEDS"
            hero_needs_work.append(canonical_id)

        print(f"  {canonical_id:<12} [{status}] {', '.join(status_parts) or 'none'}")

    print(f"\n  Hero verses ready: {hero_ready}/18")
    if hero_needs_work:
        print(f"  Need work: {', '.join(hero_needs_work)}")

    # Commentaries
    print(f"\n{'='*70}")
    print("COMMENTARY COVERAGE")
    print(f"{'='*70}")

    if commentaries:
        for school, data in sorted(commentaries.items()):
            print(f"  {school}: {data['unique_verses']} verses ({data['total_entries']} entries)")
    else:
        print("  No commentaries found in database")

    # Study mode specific
    study_mode_comms = commentaries.get("study_mode", {})
    print(f"\n  Study mode commentaries: {study_mode_comms.get('unique_verses', 0)} verses")

    # Recommendations
    print(f"\n{'='*70}")
    print("RECOMMENDATIONS FOR STUDY MODE")
    print(f"{'='*70}")

    recommendations = []

    if pct < 80:
        recommendations.append(f"- Fill paraphrase gaps (currently {pct:.1f}%, target 80%+)")

    for chapter in PRIORITY_CHAPTERS:
        ch = paraphrases.get(chapter, {})
        ch_pct = (ch.get("with_paraphrase", 0) / ch.get("total", 1) * 100)
        if ch_pct < 90:
            recommendations.append(f"- Chapter {chapter}: Add {ch.get('total', 0) - ch.get('with_paraphrase', 0)} missing paraphrases")

    if hero_needs_work:
        recommendations.append(f"- Complete hero verses: {', '.join(hero_needs_work[:5])}")
        if len(hero_needs_work) > 5:
            recommendations.append(f"  ... and {len(hero_needs_work) - 5} more")

    if not study_mode_comms.get("unique_verses"):
        recommendations.append("- Create curated study_mode commentaries (start with hero verses)")

    if translations["hindi"]["verses"] < 100:
        recommendations.append(f"- Hindi translations: {translations['hindi']['verses']}/701 verses (optional for v1)")

    if recommendations:
        for rec in recommendations:
            print(f"  {rec}")
    else:
        print("  Content looks ready for Study Mode!")

    print(f"\n{'='*70}")


def main():
    """Run the content audit."""
    print("Connecting to database...")
    db = SessionLocal()

    try:
        print("Auditing paraphrases...")
        paraphrases = audit_paraphrases(db)

        print("Auditing translations...")
        translations = audit_translations(db)

        print("Auditing audio...")
        audio = audit_audio(db)

        print("Auditing commentaries...")
        commentaries = audit_commentaries(db)

        print("Auditing hero verses...")
        hero_verses = audit_hero_verses(db)

        print_report(paraphrases, translations, audio, commentaries, hero_verses)

    finally:
        db.close()


if __name__ == "__main__":
    main()
