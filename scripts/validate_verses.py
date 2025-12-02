#!/usr/bin/env python3
"""Validate verse data structure and content."""

import json
import sys
from pathlib import Path
from typing import Dict, List, Any


class VerseValidator:
    """Validator for Bhagavad Geeta verse data."""

    REQUIRED_FIELDS = {
        "canonical_id": str,
        "chapter": int,
        "verse": int,
        "sanskrit": dict,
        "paraphrase": dict,
        "consulting_principles": list,
        "metadata": dict,
    }

    REQUIRED_SANSKRIT_FIELDS = {"iast": str, "source": str, "license": str}

    REQUIRED_PARAPHRASE_FIELDS = {"en": str, "word_count": int}

    REQUIRED_METADATA_FIELDS = {"created_at": str, "verified": bool}

    def __init__(self):
        self.errors = []
        self.warnings = []

    def validate_canonical_id(self, verse: Dict[str, Any]) -> bool:
        """Validate canonical ID format (BG_chapter_verse)."""
        canonical_id = verse.get("canonical_id", "")
        chapter = verse.get("chapter")
        verse_num = verse.get("verse")

        expected = f"BG_{chapter}_{verse_num}"
        if canonical_id != expected:
            self.errors.append(
                f"Invalid canonical_id: {canonical_id}, expected: {expected}"
            )
            return False
        return True

    def validate_chapter_range(self, verse: Dict[str, Any]) -> bool:
        """Validate chapter is between 1 and 18."""
        chapter = verse.get("chapter")
        if not isinstance(chapter, int) or chapter < 1 or chapter > 18:
            self.errors.append(f"Invalid chapter: {chapter}, must be 1-18")
            return False
        return True

    def validate_verse_number(self, verse: Dict[str, Any]) -> bool:
        """Validate verse number is positive."""
        verse_num = verse.get("verse")
        if not isinstance(verse_num, int) or verse_num < 1:
            self.errors.append(f"Invalid verse number: {verse_num}, must be >= 1")
            return False
        return True

    def validate_paraphrase_length(self, verse: Dict[str, Any]) -> bool:
        """Validate paraphrase is <= 25 words."""
        paraphrase = verse.get("paraphrase", {}).get("en", "")
        word_count = len(paraphrase.split())

        declared_count = verse.get("paraphrase", {}).get("word_count")

        if word_count != declared_count:
            self.warnings.append(
                f"{verse.get('canonical_id')}: word_count mismatch - "
                f"declared {declared_count}, actual {word_count}"
            )

        if word_count > 25:
            self.warnings.append(
                f"{verse.get('canonical_id')}: paraphrase too long - "
                f"{word_count} words (recommended ≤ 25)"
            )
            return False
        return True

    def validate_structure(self, verse: Dict[str, Any], index: int) -> bool:
        """Validate verse has required fields and types."""
        verse_id = verse.get("canonical_id", f"verse {index}")

        # Check required top-level fields
        for field, expected_type in self.REQUIRED_FIELDS.items():
            if field not in verse:
                self.errors.append(f"{verse_id}: Missing required field '{field}'")
                return False

            if not isinstance(verse[field], expected_type):
                self.errors.append(
                    f"{verse_id}: Field '{field}' should be {expected_type.__name__}, "
                    f"got {type(verse[field]).__name__}"
                )
                return False

        # Validate sanskrit fields
        sanskrit = verse.get("sanskrit", {})
        for field, expected_type in self.REQUIRED_SANSKRIT_FIELDS.items():
            if field not in sanskrit:
                self.errors.append(
                    f"{verse_id}: Missing sanskrit field '{field}'"
                )
                return False
            if not isinstance(sanskrit[field], expected_type):
                self.errors.append(
                    f"{verse_id}: sanskrit.{field} should be {expected_type.__name__}"
                )
                return False

        # Validate paraphrase fields
        paraphrase = verse.get("paraphrase", {})
        for field, expected_type in self.REQUIRED_PARAPHRASE_FIELDS.items():
            if field not in paraphrase:
                self.errors.append(
                    f"{verse_id}: Missing paraphrase field '{field}'"
                )
                return False
            if not isinstance(paraphrase[field], expected_type):
                self.errors.append(
                    f"{verse_id}: paraphrase.{field} should be {expected_type.__name__}"
                )
                return False

        # Validate metadata fields
        metadata = verse.get("metadata", {})
        for field, expected_type in self.REQUIRED_METADATA_FIELDS.items():
            if field not in metadata:
                self.errors.append(
                    f"{verse_id}: Missing metadata field '{field}'"
                )
                return False
            if not isinstance(metadata[field], expected_type):
                self.errors.append(
                    f"{verse_id}: metadata.{field} should be {expected_type.__name__}"
                )
                return False

        return True

    def validate_verse(self, verse: Dict[str, Any], index: int) -> bool:
        """Run all validations on a single verse."""
        valid = True

        valid &= self.validate_structure(verse, index)
        if not valid:
            return False  # Skip other validations if structure is invalid

        valid &= self.validate_canonical_id(verse)
        valid &= self.validate_chapter_range(verse)
        valid &= self.validate_verse_number(verse)
        valid &= self.validate_paraphrase_length(verse)

        return valid

    def validate_file(self, file_path: Path) -> bool:
        """Validate a verse JSON file."""
        print(f"🔍 Validating: {file_path}")
        print()

        try:
            with open(file_path, "r") as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            self.errors.append(f"Invalid JSON: {e}")
            return False
        except FileNotFoundError:
            self.errors.append(f"File not found: {file_path}")
            return False

        if not isinstance(data, list):
            self.errors.append("Root element must be an array of verses")
            return False

        if len(data) == 0:
            self.warnings.append("File contains no verses")
            return True

        all_valid = True
        canonical_ids = set()

        for i, verse in enumerate(data):
            if not self.validate_verse(verse, i):
                all_valid = False

            # Check for duplicate canonical IDs
            canonical_id = verse.get("canonical_id")
            if canonical_id in canonical_ids:
                self.errors.append(f"Duplicate canonical_id: {canonical_id}")
                all_valid = False
            canonical_ids.add(canonical_id)

        return all_valid

    def print_report(self):
        """Print validation report."""
        print()
        if self.errors:
            print("❌ ERRORS:")
            for error in self.errors:
                print(f"  - {error}")
            print()

        if self.warnings:
            print("⚠️  WARNINGS:")
            for warning in self.warnings:
                print(f"  - {warning}")
            print()

        if not self.errors and not self.warnings:
            print("✅ All validations passed!")
        elif not self.errors:
            print("✅ Validation passed with warnings")
        else:
            print(f"❌ Validation failed with {len(self.errors)} error(s)")

        return len(self.errors) == 0


def main():
    """Main validation function."""
    # Find seed verses file
    seed_file = Path(__file__).parent.parent / "data" / "verses" / "seed-verses.json"

    if not seed_file.exists():
        print(f"❌ Seed file not found: {seed_file}")
        return 1

    validator = VerseValidator()
    valid = validator.validate_file(seed_file)
    success = validator.print_report()

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
