#!/usr/bin/env python3
"""
Process TTS audio files from Colab export.

Extracts WAV files from zip, converts to MP3 (128kbps stereo),
organizes files, and runs automated QA.

Usage (via Docker - recommended):
    # Copy zip to backend folder (mounted as /app in container)
    cp ~/Downloads/chapter_02_wav.zip backend/

    # Run via Docker (has ffmpeg, mutagen, and DB access)
    docker compose exec backend python /app/scripts/process_tts_audio.py /app/chapter_02_wav.zip -o /app/public/audio

    # Clean up
    rm backend/chapter_02_wav.zip

Output: public/audio/mp3/02/*.mp3
"""

import argparse
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

# Try to import QA dependencies
try:
    from mutagen.mp3 import MP3

    HAS_MUTAGEN = True
except ImportError:
    HAS_MUTAGEN = False


def check_ffmpeg():
    """Verify ffmpeg is installed."""
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def extract_chapter_from_zip(zip_path: Path) -> int:
    """Extract chapter number from zip filename (e.g., chapter_02_wav.zip -> 2)."""
    name = zip_path.stem  # chapter_02_wav
    parts = name.split("_")
    if len(parts) >= 2:
        try:
            return int(parts[1])
        except ValueError:
            pass
    raise ValueError(f"Cannot determine chapter from filename: {zip_path.name}")


# =============================================================================
# QA Functions (integrated from qa_audio_files.py)
# =============================================================================

# Expected syllables per second for Sanskrit recitation
SYLLABLES_PER_SECOND_MIN = 1.5  # Very slow
SYLLABLES_PER_SECOND_MAX = 5.0  # Too fast (likely truncated)
MIN_DURATION_SECONDS = 3.0


def count_syllables(text: str) -> int:
    """Estimate syllable count for Devanagari text."""
    if not text:
        return 0

    matras = "ा ि ी ु ू ृ ॄ ॅ ॆ े ै ॉ ॊ ो ौ ं ः ँ".split()
    vowels = "अ आ इ ई उ ऊ ऋ ॠ ऌ ॡ ए ऐ ओ औ".split()
    consonant_range = range(0x0915, 0x093A)

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
                syllable_count += 1
            prev_was_consonant = True
        elif char == "्":
            prev_was_consonant = False
        else:
            if prev_was_consonant:
                syllable_count += 1
            prev_was_consonant = False

    if prev_was_consonant:
        syllable_count += 1

    return max(1, syllable_count)


def get_audio_duration(audio_path: Path) -> float | None:
    """Get duration of MP3 file in seconds."""
    if not HAS_MUTAGEN:
        return None
    try:
        audio = MP3(str(audio_path))
        if audio.info is None:
            return None
        return float(audio.info.length)
    except Exception:
        return None


def run_qa_check(
    chapter: int, mp3_dir: Path, verses: dict[str, str]
) -> dict[str, list[str | dict[str, object]]]:
    """Run QA on processed audio files."""
    results: dict[str, list[str | dict[str, object]]] = {
        "ok": [],
        "flagged": [],
        "missing": [],
    }

    for canonical_id, text in verses.items():
        mp3_path = mp3_dir / f"{canonical_id}.mp3"

        if not mp3_path.exists():
            results["missing"].append(canonical_id)
            continue

        duration = get_audio_duration(mp3_path)
        if duration is None:
            continue

        syllables = count_syllables(text)
        rate = syllables / duration if duration > 0 else 999

        issues = []
        if duration < MIN_DURATION_SECONDS:
            issues.append(f"short ({duration:.1f}s)")
        if rate > SYLLABLES_PER_SECOND_MAX:
            issues.append(f"truncated ({rate:.1f} syl/s)")
        if rate < SYLLABLES_PER_SECOND_MIN and duration > 5:
            issues.append(f"extra content ({rate:.1f} syl/s)")

        if issues:
            results["flagged"].append(
                {
                    "id": canonical_id,
                    "duration": round(duration, 2),
                    "syllables": syllables,
                    "rate": round(rate, 2),
                    "issues": issues,
                }
            )
        else:
            results["ok"].append(canonical_id)

    return results


def print_qa_report(results: dict):
    """Print QA summary."""
    print()
    print("=" * 50)
    print("QA REPORT")
    print("=" * 50)
    print(f"✅ Passed: {len(results['ok'])}")
    print(f"⚠️  Flagged: {len(results['flagged'])}")
    print(f"❌ Missing: {len(results['missing'])}")

    if results["flagged"]:
        print()
        print("FLAGGED (likely need regeneration):")
        for v in results["flagged"]:
            print(
                f"  {v['id']}: {v['duration']}s, {v['syllables']} syl, {v['rate']} syl/s"
            )
            for issue in v["issues"]:
                print(f"    ⚠️  {issue}")

    if results["missing"]:
        print()
        print("MISSING:")
        for vid in results["missing"]:
            print(f"  {vid}")


def get_verse_texts(chapter: int) -> dict:
    """Get verse texts from database for QA."""
    try:
        # Add backend to path for imports
        backend_dir = Path(__file__).parent.parent
        sys.path.insert(0, str(backend_dir))

        from db.connection import SessionLocal
        from models.verse import Verse

        verses = {}
        with SessionLocal() as db:
            for cid, text in (
                db.query(Verse.canonical_id, Verse.sanskrit_devanagari)
                .filter(Verse.chapter == chapter)
                .all()
            ):
                if text:
                    verses[cid] = text
        return verses
    except Exception as e:
        print(f"Warning: Could not load verse texts for QA: {e}")
        return {}


def process_audio(
    zip_path: Path, output_dir: Path, keep_wav: bool = False, skip_qa: bool = False
):
    """Extract and convert audio files."""

    chapter = extract_chapter_from_zip(zip_path)
    chapter_str = f"{chapter:02d}"

    # Output directories
    mp3_dir = output_dir / "mp3" / chapter_str
    wav_dir = output_dir / "wav" / chapter_str if keep_wav else None

    mp3_dir.mkdir(parents=True, exist_ok=True)
    if wav_dir:
        wav_dir.mkdir(parents=True, exist_ok=True)

    print(f"Processing Chapter {chapter}")
    print(f"  Input: {zip_path}")
    print(f"  Output: {mp3_dir}")
    print()

    # Extract to temp directory
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)

        print("Extracting ZIP...")
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(tmp_path)

        # Find all WAV files
        wav_files = list(tmp_path.rglob("*.wav"))
        if not wav_files:
            print("No WAV files found in ZIP!")
            return

        print(f"Found {len(wav_files)} WAV files")
        print()

        # Process each file
        success = 0
        failed = []

        for i, wav_file in enumerate(sorted(wav_files), 1):
            mp3_file = mp3_dir / f"{wav_file.stem}.mp3"

            # Convert to MP3
            result = subprocess.run(
                [
                    "ffmpeg",
                    "-i",
                    str(wav_file),
                    "-codec:a",
                    "libmp3lame",
                    "-b:a",
                    "128k",
                    str(mp3_file),
                    "-y",
                    "-loglevel",
                    "error",
                ],
                capture_output=True,
            )

            if result.returncode == 0:
                success += 1
                status = "ok"
            else:
                failed.append(wav_file.stem)
                status = "FAILED"

            print(f"  [{i}/{len(wav_files)}] {wav_file.stem} ... {status}")

            # Copy WAV if keeping
            if wav_dir and result.returncode == 0:
                shutil.copy2(wav_file, wav_dir / wav_file.name)

        print()
        print("=" * 50)
        print(f"Success: {success}/{len(wav_files)}")
        if failed:
            print(f"Failed: {', '.join(failed)}")

        # Show sizes
        mp3_size = sum(f.stat().st_size for f in mp3_dir.glob("*.mp3")) / 1024 / 1024
        print(f"MP3 size: {mp3_size:.1f} MB")

        if wav_dir:
            wav_size = (
                sum(f.stat().st_size for f in wav_dir.glob("*.wav")) / 1024 / 1024
            )
            print(f"WAV size: {wav_size:.1f} MB")

    # Run QA if not skipped
    if not skip_qa:
        if not HAS_MUTAGEN:
            print("\nWarning: mutagen not installed, skipping QA (pip install mutagen)")
        else:
            verses = get_verse_texts(chapter)
            if verses:
                qa_results = run_qa_check(chapter, mp3_dir, verses)
                print_qa_report(qa_results)


def main():
    parser = argparse.ArgumentParser(description="Process TTS audio from Colab export")
    parser.add_argument(
        "zip_file",
        type=Path,
        help="Path to WAV zip file (e.g., ~/Downloads/chapter_02_wav.zip)",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        default=Path("public/audio"),
        help="Output directory (default: public/audio)",
    )
    parser.add_argument(
        "--keep-wav", action="store_true", help="Keep WAV files (in addition to MP3)"
    )
    parser.add_argument(
        "--skip-qa", action="store_true", help="Skip automated QA check"
    )

    args = parser.parse_args()

    # Validate inputs
    zip_path = args.zip_file.expanduser()
    if not zip_path.exists():
        print(f"Error: File not found: {zip_path}")
        sys.exit(1)

    if not check_ffmpeg():
        print("Error: ffmpeg not found. Install with: brew install ffmpeg")
        sys.exit(1)

    process_audio(zip_path, args.output, args.keep_wav, args.skip_qa)


if __name__ == "__main__":
    main()
