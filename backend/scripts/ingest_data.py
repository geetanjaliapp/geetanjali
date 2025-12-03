#!/usr/bin/env python3
"""
CLI script for manual data ingestion.

This script fetches and stores verse data from configured sources.
LLM enrichment is now a separate step - use the /api/v1/admin/enrich endpoint
or call enrichment manually after ingestion.

Usage:
    python scripts/ingest_data.py --all                    # Ingest all sources
    python scripts/ingest_data.py --type sanskrit          # Ingest specific type
    python scripts/ingest_data.py --dry-run                # Validate only
    python scripts/ingest_data.py --force-refresh          # Bypass cache
    python scripts/ingest_data.py --status                 # Show pipeline status

Note: --no-enrich flag is deprecated. Enrichment is now always separate.
"""

import argparse
import logging
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from db.connection import SessionLocal
from services.ingestion.pipeline import IngestionPipeline

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('ingestion.log')
    ]
)

logger = logging.getLogger(__name__)


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest Bhagavad Geeta verses from configured sources"
    )

    parser.add_argument(
        "--all",
        action="store_true",
        help="Ingest from all enabled sources"
    )

    parser.add_argument(
        "--type",
        choices=["sanskrit", "translations", "commentaries"],
        help="Ingest specific source type only"
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate data without persisting to database"
    )

    parser.add_argument(
        "--no-enrich",
        action="store_true",
        help="[DEPRECATED] Enrichment is now always separate. This flag is ignored."
    )

    parser.add_argument(
        "--force-refresh",
        action="store_true",
        help="Bypass cache and fetch fresh data from sources"
    )

    parser.add_argument(
        "--status",
        action="store_true",
        help="Show pipeline status and exit"
    )

    parser.add_argument(
        "--config",
        default="./config/data_sources.yaml",
        help="Path to data sources configuration file"
    )

    args = parser.parse_args()

    # Create database session
    db = SessionLocal()

    try:
        # Initialize pipeline
        logger.info("Initializing ingestion pipeline...")
        pipeline = IngestionPipeline(db, config_path=args.config)

        # Show status and exit if requested
        if args.status:
            show_status(pipeline)
            return 0

        # Determine what to ingest
        if not args.all and not args.type:
            logger.error("Must specify either --all or --type")
            parser.print_help()
            return 1

        source_types = None
        if args.type:
            source_types = [args.type]

        # Run ingestion
        logger.info("=" * 80)
        logger.info("STARTING DATA INGESTION")
        logger.info("=" * 80)
        logger.info(f"Source types: {source_types or 'all'}")
        logger.info(f"Dry run: {args.dry_run}")
        logger.info(f"Force refresh: {args.force_refresh}")
        logger.info("Note: LLM enrichment is separate - use /api/v1/admin/enrich after ingestion")
        logger.info("=" * 80)

        if args.no_enrich:
            logger.warning("--no-enrich flag is deprecated and ignored. Enrichment is always separate.")

        all_stats = pipeline.ingest_all_sources(
            source_types=source_types,
            force_refresh=args.force_refresh,
            enrich=False,  # Always false - enrichment is now separate
            dry_run=args.dry_run
        )

        # Print results
        print_results(all_stats, args.dry_run)

        # Final status
        logger.info("=" * 80)
        logger.info("FINAL STATUS")
        logger.info("=" * 80)
        show_status(pipeline)

        return 0

    except KeyboardInterrupt:
        logger.info("Ingestion interrupted by user")
        return 130

    except Exception as e:
        logger.error(f"Ingestion failed: {e}", exc_info=True)
        return 1

    finally:
        db.close()


def show_status(pipeline: IngestionPipeline):
    """
    Display pipeline status.

    Args:
        pipeline: IngestionPipeline instance
    """
    status = pipeline.get_pipeline_status()

    print("\n" + "=" * 80)
    print("PIPELINE STATUS")
    print("=" * 80)
    print(f"Configuration loaded: {status['config_loaded']}")
    print(f"Sources available: {status['sources_available']}")
    print()

    print("DATABASE STATISTICS:")
    validator_stats = status.get("validator_stats", {})
    print(f"  Total verses: {validator_stats.get('total_verses', 0)}")
    print(f"  Chapters present: {validator_stats.get('chapters_present', 0)}/18")
    print(f"  Expected total: {validator_stats.get('expected_total', 700)}")
    print()

    print("PERSISTENCE STATISTICS:")
    persister_stats = status.get("persister_stats", {})
    print(f"  Database verses: {persister_stats.get('database_verses', 0)}")
    print(f"  Vector store verses: {persister_stats.get('vector_store_verses', 0)}")
    print(f"  Sync status: {persister_stats.get('sync_status', 'UNKNOWN')}")
    print()

    # Chapter breakdown
    chapter_counts = validator_stats.get("chapter_counts", {})
    if chapter_counts:
        print("VERSES PER CHAPTER:")
        for i in range(1, 19):
            count = chapter_counts.get(i, 0)
            bar = "█" * min(count, 50)
            print(f"  Chapter {i:2d}: {count:3d} {bar}")
        print()

    print("=" * 80)


def print_results(all_stats: dict, dry_run: bool):
    """
    Print ingestion results.

    Args:
        all_stats: Statistics dictionary from pipeline
        dry_run: Whether this was a dry run
    """
    print("\n" + "=" * 80)
    print("INGESTION RESULTS")
    print("=" * 80)

    if not all_stats:
        print("No sources processed")
        return

    for source_name, stats in all_stats.items():
        print(f"\n{source_name}:")
        if dry_run:
            print(f"  Would create: {stats.get('created', 0)}")
        else:
            print(f"  Created: {stats.get('created', 0)}")
            print(f"  Updated: {stats.get('updated', 0)}")
        print(f"  Skipped: {stats.get('skipped', 0)}")
        print(f"  Errors: {stats.get('errors', 0)}")

    # Totals
    total_created = sum(s.get("created", 0) for s in all_stats.values())
    total_updated = sum(s.get("updated", 0) for s in all_stats.values())
    total_skipped = sum(s.get("skipped", 0) for s in all_stats.values())
    total_errors = sum(s.get("errors", 0) for s in all_stats.values())

    print(f"\nTOTAL:")
    if dry_run:
        print(f"  Would create: {total_created}")
    else:
        print(f"  Created: {total_created}")
        print(f"  Updated: {total_updated}")
    print(f"  Skipped: {total_skipped}")
    print(f"  Errors: {total_errors}")

    print("=" * 80)


if __name__ == "__main__":
    sys.exit(main())
