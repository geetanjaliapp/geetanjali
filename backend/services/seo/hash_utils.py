"""Hash utility functions for SEO page change detection.

This module provides hash computation utilities for detecting changes in
source data and templates, enabling incremental regeneration of SEO pages.
"""

import hashlib
import json
from pathlib import Path
from typing import Any


def compute_source_hash(data: Any) -> str:
    """
    Compute SHA256 hash of source data.

    Args:
        data: Any JSON-serializable data structure

    Returns:
        64-character hex string (SHA256 hash)
    """
    # Serialize to JSON with sorted keys for consistent hashing
    json_str = json.dumps(data, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(json_str.encode("utf-8")).hexdigest()


def compute_template_hash(template_path: Path) -> str:
    """
    Compute SHA256 hash of a template file.

    Returns first 16 characters of the hash for storage efficiency.
    Template changes are infrequent, so shorter hash is acceptable.

    Args:
        template_path: Path to the Jinja2 template file

    Returns:
        16-character hex string (truncated SHA256 hash)
    """
    content = template_path.read_bytes()
    full_hash = hashlib.sha256(content).hexdigest()
    return full_hash[:16]


def compute_combined_hash(source_hash: str, template_hash: str) -> str:
    """
    Compute a combined hash from source and template hashes.

    This is used for aggregate change detection across multiple pages.

    Args:
        source_hash: Hash of source data
        template_hash: Hash of template file

    Returns:
        64-character hex string combining both hashes
    """
    combined = f"{source_hash}:{template_hash}"
    return hashlib.sha256(combined.encode("utf-8")).hexdigest()
