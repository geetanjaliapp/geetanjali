"""SEO page generation service.

This module provides services for generating static HTML pages for search
engine crawlers. It uses hash-based change detection to enable incremental
regeneration - only pages whose source data or templates have changed are
regenerated.

Key features:
- PostgreSQL advisory locks for concurrency protection
- Hash-based change detection (source data + template)
- Atomic file writes to prevent partial content serving
- Gzip pre-compression for nginx gzip_static

Usage:
    from services.seo import SeoGeneratorService, GenerationInProgressError

    # In a route or service with DB session
    service = SeoGeneratorService(db)

    try:
        result = service.generate_all(force=False)
        print(f"Generated {result.generated} pages")
    except GenerationInProgressError:
        print("Generation already in progress")

    # Get status
    status = service.get_status()
"""

from .generator import (
    GenerationInProgressError,
    SeoGenerationResult,
    SeoGeneratorService,
)
from .hash_utils import (
    compute_source_hash,
    compute_template_hash,
    compute_template_tree_hash,
)

__all__ = [
    "SeoGeneratorService",
    "SeoGenerationResult",
    "GenerationInProgressError",
    "compute_source_hash",
    "compute_template_hash",
    "compute_template_tree_hash",
]
