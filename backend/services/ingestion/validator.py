"""
Validator service for ensuring data quality and compliance.
"""

import logging

from sqlalchemy.orm import Session

from models.verse import Verse
from utils.validation import validate_canonical_id_format

logger = logging.getLogger(__name__)


class Validator:
    """
    Validate ingested verse data for quality, schema compliance, and uniqueness.
    """

    ALLOWED_LICENSES = [
        "Public Domain",
        "Unlicense (Public Domain)",
        "CC-BY",
        "CC-BY-SA",
        "CC-BY-NC",
        "Educational Use",
        "Fair Use",
    ]

    def __init__(self, db: Session):
        """
        Initialize validator with database session.

        Args:
            db: SQLAlchemy database session
        """
        self.db = db
        logger.info("Validator initialized")

    def _validate_required_fields(self, data: dict) -> list[str]:
        """Validate required fields are present."""
        errors = []
        if not data.get("canonical_id"):
            errors.append("Missing required field: canonical_id")
        if not data.get("chapter"):
            errors.append("Missing required field: chapter")
        if not data.get("verse"):
            errors.append("Missing required field: verse")
        return errors

    def _validate_canonical_id_format(self, canonical_id: str | None) -> list[str]:
        """Validate canonical ID format (BG_chapter_verse)."""
        if not canonical_id:
            return []  # Empty/None handled by required field validation
        error = validate_canonical_id_format(canonical_id)
        return [error] if error else []

    def _validate_chapter(self, chapter: int | None) -> list[str]:
        """Validate chapter number is between 1-18."""
        if chapter is None:
            return []
        try:
            chapter_num = int(chapter)
            if not (1 <= chapter_num <= 18):
                return [f"Chapter must be between 1 and 18, got: {chapter_num}"]
        except (ValueError, TypeError):
            return [f"Chapter must be an integer, got: {chapter}"]
        return []

    def _validate_verse_number(self, verse: int | None) -> list[str]:
        """Validate verse number is positive."""
        if verse is None:
            return []
        try:
            verse_num = int(verse)
            if verse_num < 1:
                return [f"Verse number must be positive, got: {verse_num}"]
        except (ValueError, TypeError):
            return [f"Verse number must be an integer, got: {verse}"]
        return []

    def _validate_content(self, data: dict) -> list[str]:
        """Validate that verse has required content fields."""
        is_translation_data = data.get("_is_translation_data", False)

        if is_translation_data:
            has_content = data.get("translation_en") or data.get("translations")
            if not has_content:
                return [
                    "Translation data must have translation_en or translations array"
                ]
        else:
            has_content = any(
                [
                    data.get("sanskrit_devanagari"),
                    data.get("sanskrit_iast"),
                    data.get("translation_text"),
                    data.get("paraphrase_en"),
                ]
            )
            if not has_content:
                return [
                    "Verse must have at least one text field (sanskrit/translation/paraphrase)"
                ]
        return []

    def _check_license(self, data: dict) -> None:
        """Log warning if license is not in allowed list."""
        license_val = data.get("license")
        if license_val and license_val not in self.ALLOWED_LICENSES:
            logger.warning(
                f"License '{license_val}' not in allowed list: {self.ALLOWED_LICENSES}"
            )

    def _check_duplicate(self, canonical_id: str | None) -> None:
        """Log debug message if verse already exists."""
        if canonical_id:
            existing = self.db.query(Verse).filter_by(canonical_id=canonical_id).first()
            if existing:
                logger.debug(f"Verse {canonical_id} already exists in database")

    def validate_verse(self, data: dict) -> tuple[bool, list[str]]:
        """
        Validate verse data structure and uniqueness.

        Args:
            data: Verse dictionary to validate

        Returns:
            Tuple of (is_valid, error_messages)
        """
        errors: list[str] = []
        canonical_id = data.get("canonical_id")

        # Collect all validation errors
        errors.extend(self._validate_required_fields(data))
        errors.extend(self._validate_canonical_id_format(canonical_id))
        errors.extend(self._validate_chapter(data.get("chapter")))
        errors.extend(self._validate_verse_number(data.get("verse")))
        errors.extend(self._validate_content(data))

        # Non-error checks (logging only)
        self._check_duplicate(canonical_id)
        self._check_license(data)

        is_valid = len(errors) == 0
        if not is_valid:
            logger.warning(f"Validation failed for {canonical_id}: {errors}")

        return (is_valid, errors)

    def validate_translation(self, data: dict) -> tuple[bool, list[str]]:
        """
        Validate translation data.

        Args:
            data: Translation dictionary to validate

        Returns:
            Tuple of (is_valid, error_messages)
        """
        errors = []

        # Required fields
        if not data.get("text"):
            errors.append("Missing required field: text")

        if not data.get("verse_id"):
            errors.append("Missing required field: verse_id")

        # Year validation (if present)
        year = data.get("year")
        if year is not None:
            try:
                year_num = int(year)
                if year_num < 1700 or year_num > 2100:
                    errors.append(f"Year seems unrealistic: {year_num}")
            except (ValueError, TypeError):
                errors.append(f"Year must be an integer, got: {year}")

        is_valid = len(errors) == 0
        return (is_valid, errors)

    def validate_commentary(self, data: dict) -> tuple[bool, list[str]]:
        """
        Validate commentary data.

        Args:
            data: Commentary dictionary to validate

        Returns:
            Tuple of (is_valid, error_messages)
        """
        errors = []

        # Required fields
        if not data.get("text"):
            errors.append("Missing required field: text")

        if not data.get("verse_id"):
            errors.append("Missing required field: verse_id")

        # Author or translator should be specified
        if not data.get("author") and not data.get("translator"):
            errors.append("Commentary must have either author or translator specified")

        is_valid = len(errors) == 0
        return (is_valid, errors)

    def validate_license(self, source_config: dict) -> bool:
        """
        Validate that source has acceptable license.

        Args:
            source_config: Source configuration dictionary

        Returns:
            bool: True if license is valid
        """
        license = source_config.get("license")

        if not license:
            logger.error(
                f"Source '{source_config.get('name')}' has no license specified"
            )
            return False

        if license not in self.ALLOWED_LICENSES:
            logger.error(
                f"Source '{source_config.get('name')}' has invalid license: {license}"
            )
            return False

        return True

    def check_canonical_id_consistency(self, data: dict) -> bool:
        """
        Check if canonical_id matches chapter and verse numbers.

        Args:
            data: Verse dictionary

        Returns:
            bool: True if consistent
        """
        canonical_id = data.get("canonical_id")
        chapter = data.get("chapter")
        verse = data.get("verse")

        if not (canonical_id and chapter and verse):
            return False

        expected_id = f"BG_{chapter}_{verse}"

        if canonical_id != expected_id:
            logger.warning(
                f"Canonical ID mismatch: got {canonical_id}, expected {expected_id}"
            )
            return False

        return True

    def get_verse_by_canonical_id(self, canonical_id: str) -> Verse | None:
        """
        Retrieve existing verse by canonical ID.

        Args:
            canonical_id: Canonical verse ID (e.g., BG_2_47)

        Returns:
            Verse object or None
        """
        return self.db.query(Verse).filter_by(canonical_id=canonical_id).first()  # type: ignore[return-value]

    def get_statistics(self) -> dict:
        """
        Get validation and database statistics.

        Returns:
            Dict with statistics
        """
        total_verses = self.db.query(Verse).count()
        chapters = self.db.query(Verse.chapter).distinct().count()

        # Count verses per chapter
        chapter_counts = {}
        for i in range(1, 19):
            count = self.db.query(Verse).filter_by(chapter=i).count()
            chapter_counts[i] = count

        return {
            "total_verses": total_verses,
            "chapters_present": chapters,
            "chapter_counts": chapter_counts,
            "expected_total": 700,  # Bhagavad Geeta has 700 verses
        }
