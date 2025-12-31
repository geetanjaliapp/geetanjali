#!/usr/bin/env python3
"""
Automated QA for generated audio files.

Detection methods:
1. Duration analysis - compare audio length vs text length (syllables)
2. Truncation detection - flag suspiciously short audio
3. Outlier detection - flag audio that deviates from expected duration

Usage:
    python backend/scripts/qa_audio_files.py --chapter 2
    python backend/scripts/qa_audio_files.py --chapter 2 --verbose
"""

import argparse
import json
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from mutagen.mp3 import MP3
except ImportError:
    print("Error: Install mutagen for audio analysis: pip install mutagen")
    sys.exit(1)


# Verse counts per chapter
VERSE_COUNTS = {
    1: 47,
    2: 72,
    3: 43,
    4: 42,
    5: 29,
    6: 47,
    7: 30,
    8: 28,
    9: 34,
    10: 42,
    11: 55,
    12: 20,
    13: 35,
    14: 27,
    15: 20,
    16: 24,
    17: 28,
    18: 78,
}

# Expected syllables per second for Sanskrit recitation (moderate pace)
# Typical range: 2-4 syllables/second for clear recitation
SYLLABLES_PER_SECOND_MIN = 1.5  # Very slow
SYLLABLES_PER_SECOND_MAX = 5.0  # Too fast (likely truncated)

# Minimum expected duration in seconds
MIN_DURATION_SECONDS = 3.0


def count_syllables(text: str) -> int:
    """
    Estimate syllable count for Devanagari text.

    Simple heuristic: count vowel matras and standalone vowels.
    Each consonant cluster + vowel = 1 syllable.
    """
    if not text:
        return 0

    # Devanagari vowel signs (matras)
    matras = "ा ि ी ु ू ृ ॄ ॅ ॆ े ै ॉ ॊ ो ौ ं ः ँ".split()

    # Standalone vowels
    vowels = "अ आ इ ई उ ऊ ऋ ॠ ऌ ॡ ए ऐ ओ औ".split()

    # Consonants (each typically carries inherent 'a' if no matra)
    consonant_range = range(0x0915, 0x093A)  # क to ह

    syllable_count = 0
    prev_was_consonant = False

    for char in text:
        if char in matras:
            syllable_count += 1
            prev_was_consonant = False
        elif char in vowels:
            syllable_count += 1
            prev_was_consonant = False
        elif ord(char) in consonant_range:
            if prev_was_consonant:
                # Consonant cluster, inherent 'a' from previous
                syllable_count += 1
            prev_was_consonant = True
        elif char == "्":  # Virama (halant) - suppresses inherent vowel
            prev_was_consonant = False
        else:
            if prev_was_consonant:
                syllable_count += 1
            prev_was_consonant = False

    # Count final consonant if any
    if prev_was_consonant:
        syllable_count += 1

    return max(1, syllable_count)


def get_audio_duration(audio_path: Path) -> float | None:
    """Get duration of MP3 file in seconds."""
    try:
        audio = MP3(str(audio_path))
        if audio.info is None:
            return None
        return float(audio.info.length)
    except Exception:
        return None


def analyze_verse(
    canonical_id: str, text: str, audio_path: Path, verbose: bool = False
) -> dict[str, object]:
    """Analyze a single verse audio file."""

    issues_list: list[str] = []
    result: dict[str, object] = {
        "canonical_id": canonical_id,
        "status": "ok",
        "issues": issues_list,
        "duration": None,
        "syllables": None,
        "syllables_per_sec": None,
    }

    # Check if audio file exists
    if not audio_path.exists():
        result["status"] = "missing"
        issues_list.append("Audio file not found")
        return result

    # Get duration
    duration = get_audio_duration(audio_path)
    if duration is None:
        result["status"] = "error"
        issues_list.append("Could not read audio file")
        return result

    result["duration"] = round(duration, 2)

    # Count syllables
    syllables = count_syllables(text)
    result["syllables"] = syllables

    # Calculate rate
    if duration > 0:
        rate = syllables / duration
        result["syllables_per_sec"] = round(rate, 2)
    else:
        rate = 999.0
        result["syllables_per_sec"] = None

    # Check for issues
    issues = []

    # Too short (likely truncated)
    if duration < MIN_DURATION_SECONDS:
        issues.append(f"Very short duration: {duration:.1f}s")

    # Rate too high (speaking too fast = likely missing content)
    if rate > SYLLABLES_PER_SECOND_MAX:
        issues.append(f"High syllable rate: {rate:.1f}/s (likely truncated)")

    # Rate too low (speaking too slow = likely extra content)
    if rate < SYLLABLES_PER_SECOND_MIN and duration > 5:
        issues.append(f"Low syllable rate: {rate:.1f}/s (possibly extra content)")

    if issues:
        result["status"] = "flagged"
        result["issues"] = issues
        issues_list.clear()
        issues_list.extend(issues)

    return result


def run_qa(chapter: int, audio_dir: Path, verbose: bool = False) -> dict[str, object]:
    """Run QA on all verses in a chapter."""

    # Import here to avoid issues when running standalone
    from db.connection import SessionLocal
    from models.verse import Verse

    # Get verses from database
    verses: dict[str, str] = {}
    with SessionLocal() as db:
        for cid, text in (
            db.query(Verse.canonical_id, Verse.sanskrit_devanagari)
            .filter(Verse.chapter == chapter)
            .all()
        ):
            if text:
                verses[cid] = text

    # Chapter audio directory
    chapter_dir = audio_dir / "mp3" / f"{chapter:02d}"

    verses_list: list[dict[str, object]] = []
    total = 0
    ok_count = 0
    flagged_count = 0
    missing_count = 0
    error_count = 0

    for verse_num in range(1, VERSE_COUNTS.get(chapter, 0) + 1):
        canonical_id = f"BG_{chapter}_{verse_num}"
        text = verses.get(canonical_id, "")
        audio_path = chapter_dir / f"{canonical_id}.mp3"

        analysis = analyze_verse(canonical_id, text, audio_path, verbose)
        verses_list.append(analysis)
        total += 1
        status = str(analysis.get("status", ""))
        if status == "ok":
            ok_count += 1
        elif status == "flagged":
            flagged_count += 1
        elif status == "missing":
            missing_count += 1
        elif status == "error":
            error_count += 1

    return {
        "chapter": chapter,
        "total": total,
        "ok": ok_count,
        "flagged": flagged_count,
        "missing": missing_count,
        "error": error_count,
        "verses": verses_list,
    }


def print_report(results: dict, verbose: bool = False):
    """Print QA report."""

    print(f"\n{'='*60}")
    print(f"Audio QA Report - Chapter {results['chapter']}")
    print(f"{'='*60}")
    print(f"Total verses: {results['total']}")
    print(f"  ✅ OK:      {results['ok']}")
    print(f"  ⚠️  Flagged: {results['flagged']}")
    print(f"  ❌ Missing: {results['missing']}")
    print(f"  💥 Error:   {results['error']}")

    # Show flagged verses
    flagged = [v for v in results["verses"] if v["status"] == "flagged"]
    if flagged:
        print(f"\n{'─'*60}")
        print("FLAGGED VERSES (need review):")
        print(f"{'─'*60}")
        for v in flagged:
            print(f"\n{v['canonical_id']}:")
            print(
                f"  Duration: {v['duration']}s | Syllables: {v['syllables']} | Rate: {v['syllables_per_sec']}/s"
            )
            for issue in v["issues"]:
                print(f"  ⚠️  {issue}")

    # Show missing verses
    missing = [v for v in results["verses"] if v["status"] == "missing"]
    if missing:
        print(f"\n{'─'*60}")
        print("MISSING AUDIO FILES:")
        print(f"{'─'*60}")
        for v in missing:
            print(f"  {v['canonical_id']}")

    if verbose:
        print(f"\n{'─'*60}")
        print("ALL VERSES:")
        print(f"{'─'*60}")
        for v in results["verses"]:
            status_icon = {
                "ok": "✅",
                "flagged": "⚠️",
                "missing": "❌",
                "error": "💥",
            }.get(v["status"], "?")
            duration = f"{v['duration']:.1f}s" if v["duration"] else "N/A"
            print(f"  {status_icon} {v['canonical_id']}: {duration}")

    # Summary of verses to regenerate
    needs_regen = [
        v["canonical_id"]
        for v in results["verses"]
        if v["status"] in ("flagged", "missing")
    ]
    if needs_regen:
        print(f"\n{'─'*60}")
        print(f"REGENERATION LIST ({len(needs_regen)} verses):")
        print(f"{'─'*60}")
        print(json.dumps(needs_regen, indent=2))


def main():
    parser = argparse.ArgumentParser(description="QA audio files for TTS quality")
    parser.add_argument(
        "--chapter", type=int, required=True, help="Chapter number (1-18)"
    )
    parser.add_argument(
        "--audio-dir", type=Path, default=Path("public/audio"), help="Audio directory"
    )
    parser.add_argument("--verbose", "-v", action="store_true", help="Show all verses")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    results = run_qa(args.chapter, args.audio_dir, args.verbose)

    if args.json:
        print(json.dumps(results, indent=2, ensure_ascii=False))
    else:
        print_report(results, args.verbose)


if __name__ == "__main__":
    main()
