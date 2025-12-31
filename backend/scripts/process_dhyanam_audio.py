#!/usr/bin/env python3
"""
Process Geeta Dhyanam audio files from Colab export.

Extracts WAV files from zip, converts to MP3 (128kbps stereo),
organizes files, and runs automated QA.

Usage (via Docker - recommended):
    # Copy zip to backend folder (mounted as /app in container)
    cp ~/Downloads/dhyanam_wav.zip backend/

    # Run via Docker (has ffmpeg, mutagen)
    docker compose exec backend python /app/scripts/process_dhyanam_audio.py /app/dhyanam_wav.zip

    # Clean up
    rm backend/dhyanam_wav.zip

Output: public/audio/mp3/dhyanam/*.mp3
"""

import argparse
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


# =============================================================================
# Configuration
# =============================================================================

# Expected duration range for dhyanam verses (seconds)
MIN_DURATION_SECONDS = 10.0  # Dhyanam verses are longer than typical verses
MAX_DURATION_SECONDS = 120.0  # Upper bound for sanity check

# Output configuration
OUTPUT_DIR = Path("/app/public/audio/mp3/dhyanam")
MP3_BITRATE = "128k"


def check_ffmpeg():
    """Verify ffmpeg is installed."""
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def convert_wav_to_mp3(wav_path: Path, mp3_path: Path) -> bool:
    """Convert WAV to MP3 using ffmpeg."""
    try:
        cmd = [
            "ffmpeg",
            "-y",
            "-i",
            str(wav_path),
            "-codec:a",
            "libmp3lame",
            "-b:a",
            MP3_BITRATE,
            "-ar",
            "44100",  # Sample rate
            "-ac",
            "2",  # Stereo
            str(mp3_path),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result.returncode == 0
    except Exception as e:
        print(f"  ✗ Conversion error: {e}")
        return False


def qa_audio_file(mp3_path: Path) -> dict[str, object]:
    """Run QA checks on an MP3 file."""
    issues: list[str] = []

    if not HAS_MUTAGEN:
        return {"passed": True, "issues": [], "skipped": True}

    try:
        audio = MP3(str(mp3_path))
        if audio.info is None:
            return {"passed": False, "issues": ["Could not read audio info"]}

        duration = audio.info.length
        bitrate = audio.info.bitrate // 1000

        # Check duration bounds
        if duration < MIN_DURATION_SECONDS:
            issues.append(f"Too short: {duration:.1f}s < {MIN_DURATION_SECONDS}s")
        if duration > MAX_DURATION_SECONDS:
            issues.append(f"Too long: {duration:.1f}s > {MAX_DURATION_SECONDS}s")

        # Check bitrate
        if bitrate < 100:
            issues.append(f"Low bitrate: {bitrate}kbps")

        return {
            "passed": len(issues) == 0,
            "issues": issues,
            "duration": duration,
            "bitrate": bitrate,
        }

    except Exception as e:
        return {"passed": False, "issues": [f"QA error: {e}"]}


def process_zip(zip_path: Path, output_dir: Path, dry_run: bool = False):
    """Process dhyanam WAV zip file."""

    print(f"Processing: {zip_path.name}")
    print(f"Output: {output_dir}")
    print("=" * 50)

    if not zip_path.exists():
        print(f"✗ File not found: {zip_path}")
        return False

    if not check_ffmpeg():
        print("✗ ffmpeg not found. Run via Docker.")
        return False

    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)

    # Extract to temp directory
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)

        print("\nExtracting WAV files...")
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(temp_path)

        # Find all WAV files
        wav_files = list(temp_path.rglob("*.wav"))
        print(f"Found {len(wav_files)} WAV files")

        if len(wav_files) == 0:
            print("✗ No WAV files found in archive")
            return False

        success_count = 0
        failed_files: list[str] = []
        qa_issues: list[tuple[str, list[object]]] = []

        for wav_file in sorted(wav_files):
            canonical_id = wav_file.stem  # e.g., DHYANAM_01
            mp3_name = f"{canonical_id}.mp3"
            mp3_path = output_dir / mp3_name

            print(f"\n{canonical_id}:")

            if dry_run:
                print(f"  → Would convert to {mp3_path}")
                success_count += 1
                continue

            # Convert WAV to MP3
            if convert_wav_to_mp3(wav_file, mp3_path):
                print("  ✓ Converted to MP3")

                # Run QA
                qa = qa_audio_file(mp3_path)
                if qa.get("skipped"):
                    print("  ⚠ QA skipped (mutagen not available)")
                elif qa["passed"]:
                    duration = qa.get("duration", 0)
                    if isinstance(duration, (int, float)):
                        print(f"  ✓ QA passed ({duration:.1f}s)")
                    else:
                        print("  ✓ QA passed")
                else:
                    qa_issue_list = qa.get("issues", [])
                    if isinstance(qa_issue_list, list):
                        for issue in qa_issue_list:
                            print(f"  ⚠ {issue}")
                        qa_issues.append((canonical_id, qa_issue_list))

                success_count += 1
            else:
                print("  ✗ Conversion failed")
                failed_files.append(canonical_id)

    # Summary
    print("\n" + "=" * 50)
    print("SUMMARY")
    print("=" * 50)
    print(f"✓ Success: {success_count}")
    print(f"✗ Failed: {len(failed_files)}")
    print(f"⚠ QA Issues: {len(qa_issues)}")

    if failed_files:
        print("\nFailed files:")
        for f in failed_files:
            print(f"  - {f}")

    if qa_issues:
        print("\nQA Issues:")
        for cid, issues in qa_issues:
            print(f"  {cid}: {', '.join(str(i) for i in issues)}")

    print(f"\nOutput: {output_dir}")
    print(f"Files: {success_count} MP3s")

    return len(failed_files) == 0


def main():
    parser = argparse.ArgumentParser(
        description="Process Geeta Dhyanam audio files from Colab export"
    )
    parser.add_argument(
        "zip_file",
        type=Path,
        help="Path to dhyanam_wav.zip from Colab",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=OUTPUT_DIR,
        help=f"Output directory (default: {OUTPUT_DIR})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without processing",
    )
    args = parser.parse_args()

    success = process_zip(args.zip_file, args.output, args.dry_run)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
