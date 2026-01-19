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

    NOTE: This only hashes the single template file. For templates that
    extend base templates or include other files, use compute_template_tree_hash
    to capture all dependencies.

    Args:
        template_path: Path to the Jinja2 template file

    Returns:
        16-character hex string (truncated SHA256 hash)
    """
    content = template_path.read_bytes()
    full_hash = hashlib.sha256(content).hexdigest()
    return full_hash[:16]


def compute_template_tree_hash(template_paths: list[Path]) -> str:
    """
    Compute SHA256 hash of multiple template files (e.g., template + base + includes).

    This is used when a template extends or includes other templates. The hash
    captures changes to any file in the dependency tree.

    Args:
        template_paths: List of paths to all template files in dependency order.
                       E.g., [verse.html, base.html, minimal.css]

    Returns:
        16-character hex string (truncated SHA256 hash of combined content)
    """
    hasher = hashlib.sha256()
    for path in sorted(template_paths):  # Sort for consistent ordering
        # Include filename in hash to detect renamed files
        hasher.update(path.name.encode("utf-8"))
        hasher.update(path.read_bytes())
    return hasher.hexdigest()[:16]


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
