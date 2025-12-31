#!/usr/bin/env python3
"""
Extract audio durations from MP3 files and update the database.

This script:
1. Scans all verse audio files (701 MP3s)
2. Uses ffprobe to extract duration
3. Updates verse_audio_metadata.audio_duration_ms in the database

Usage:
    # Via Docker (recommended - has ffprobe and DB access)
    docker compose exec backend python /app/scripts/extract_audio_durations.py

    # Dry run (just report, don't update DB)
    docker compose exec backend python /app/scripts/extract_audio_durations.py --dry-run

Output: Updates audio_duration_ms for all verses in verse_audio_metadata table
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from config import settings


def get_audio_duration_ms(file_path: Path) -> int | None:
    """
    Extract audio duration in milliseconds using ffprobe.

    Args:
        file_path: Path to MP3 file

    Returns:
        Duration in milliseconds, or None if extraction fails
    """
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "quiet",
                "-show_entries",
                "format=duration",
                "-of",
                "json",
                str(file_path),
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )

        if result.returncode != 0:
            return None

        data = json.loads(result.stdout)
        duration_seconds = float(data["format"]["duration"])
        return int(duration_seconds * 1000)  # Convert to milliseconds

    except (subprocess.TimeoutExpired, json.JSONDecodeError, KeyError, ValueError) as e:
        print(f"  Error extracting duration from {file_path.name}: {e}")
        return None


def get_audio_directory() -> Path:
    """Get the audio files directory path."""
    audio_dir = Path(settings.AUDIO_FILES_PATH)
    if not audio_dir.is_absolute():
        backend_dir = Path(__file__).parent.parent
        audio_dir = (backend_dir / audio_dir).resolve()
    return audio_dir


def scan_audio_files(audio_dir: Path) -> dict[str, tuple[Path, int]]:
    """
    Scan all verse audio files and extract durations.

    Args:
        audio_dir: Root audio directory

    Returns:
        Dict mapping canonical_id to (file_path, duration_ms)
    """
    mp3_dir = audio_dir / "mp3"
    if not mp3_dir.exists():
        print(f"Error: MP3 directory not found: {mp3_dir}")
        return {}

    results = {}
    total_files = 0
    success_count = 0

    # Scan chapters 01-18
    for chapter_num in range(1, 19):
        chapter_dir = mp3_dir / f"{chapter_num:02d}"
        if not chapter_dir.exists():
            print(f"  Chapter {chapter_num:02d} directory not found, skipping")
            continue

        mp3_files = list(chapter_dir.glob("BG_*.mp3"))
        print(f"  Chapter {chapter_num:02d}: {len(mp3_files)} files")

        for mp3_file in mp3_files:
            total_files += 1
            canonical_id = mp3_file.stem  # e.g., BG_2_47

            duration_ms = get_audio_duration_ms(mp3_file)
            if duration_ms:
                results[canonical_id] = (mp3_file, duration_ms)
                success_count += 1
            else:
                print(f"    Failed: {mp3_file.name}")

    print(f"\nExtracted {success_count}/{total_files} durations")
    return results


def update_database(durations: dict[str, tuple[Path, int]], dry_run: bool = False):
    """
    Update verse_audio_metadata table with durations.

    Args:
        durations: Dict mapping canonical_id to (file_path, duration_ms)
        dry_run: If True, only report what would be updated
    """
    engine = create_engine(settings.DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        updated = 0
        inserted = 0
        skipped = 0

        for canonical_id, (file_path, duration_ms) in durations.items():
            # Check if record exists
            result = session.execute(
                text(
                    "SELECT id, audio_duration_ms FROM verse_audio_metadata WHERE canonical_id = :cid"
                ),
                {"cid": canonical_id},
            ).fetchone()

            if result:
                existing_id, existing_duration = result
                if existing_duration != duration_ms:
                    if not dry_run:
                        session.execute(
                            text("""
                                UPDATE verse_audio_metadata
                                SET audio_duration_ms = :duration,
                                    audio_file_path = :path
                                WHERE canonical_id = :cid
                            """),
                            {
                                "duration": duration_ms,
                                "path": str(
                                    file_path.relative_to(
                                        file_path.parent.parent.parent
                                    )
                                ),
                                "cid": canonical_id,
                            },
                        )
                    updated += 1
                else:
                    skipped += 1
            else:
                # Need to get verse_id first
                verse_result = session.execute(
                    text("SELECT id FROM verses WHERE canonical_id = :cid"),
                    {"cid": canonical_id},
                ).fetchone()

                if verse_result:
                    verse_id = verse_result[0]
                    if not dry_run:
                        session.execute(
                            text("""
                                INSERT INTO verse_audio_metadata
                                (id, verse_id, canonical_id, audio_duration_ms, audio_file_path,
                                 speaker, addressee, discourse_type, emotional_tone, intensity,
                                 pacing, theological_weight, created_at, updated_at)
                                VALUES (
                                    :id, :verse_id, :cid, :duration, :path,
                                    'krishna', 'arjuna', 'teaching', 'neutral', 'moderate',
                                    'moderate', 'standard', NOW(), NOW()
                                )
                            """),
                            {
                                "id": str(__import__("uuid").uuid4()),
                                "verse_id": verse_id,
                                "cid": canonical_id,
                                "duration": duration_ms,
                                "path": str(
                                    file_path.relative_to(
                                        file_path.parent.parent.parent
                                    )
                                ),
                            },
                        )
                    inserted += 1
                else:
                    print(f"  Warning: Verse not found for {canonical_id}")

        if not dry_run:
            session.commit()

        action = "Would update" if dry_run else "Updated"
        print(f"\n{action}:")
        print(f"  Updated: {updated}")
        print(f"  Inserted: {inserted}")
        print(f"  Skipped (no change): {skipped}")

    finally:
        session.close()


def print_summary(durations: dict[str, tuple[Path, int]]):
    """Print summary statistics."""
    if not durations:
        return

    total_ms = sum(d for _, d in durations.values())
    total_seconds = total_ms / 1000
    total_minutes = total_seconds / 60

    print("\nSummary:")
    print(f"  Total verses: {len(durations)}")
    print(
        f"  Total duration: {total_minutes:.1f} minutes ({total_seconds:.0f} seconds)"
    )
    print(f"  Average per verse: {total_ms / len(durations) / 1000:.1f} seconds")

    # Min/max
    min_id = min(durations, key=lambda k: durations[k][1])
    max_id = max(durations, key=lambda k: durations[k][1])
    print(f"  Shortest: {min_id} ({durations[min_id][1] / 1000:.1f}s)")
    print(f"  Longest: {max_id} ({durations[max_id][1] / 1000:.1f}s)")


def main():
    parser = argparse.ArgumentParser(
        description="Extract audio durations and update database"
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Report only, don't update DB"
    )
    args = parser.parse_args()

    print("=" * 60)
    print("Audio Duration Extraction")
    print("=" * 60)

    audio_dir = get_audio_directory()
    print(f"\nAudio directory: {audio_dir}")

    print("\nScanning audio files...")
    durations = scan_audio_files(audio_dir)

    if not durations:
        print("No audio files found!")
        sys.exit(1)

    print_summary(durations)

    print("\nUpdating database...")
    update_database(durations, dry_run=args.dry_run)

    print("\nDone!")


if __name__ == "__main__":
    main()
