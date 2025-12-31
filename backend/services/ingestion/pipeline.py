"""
Pipeline orchestrator for coordinating the data ingestion flow.
"""

import logging
from pathlib import Path
from typing import Protocol

import yaml
from sqlalchemy.orm import Session

from services.ingestion.enricher import Enricher
from services.ingestion.fetcher import Fetcher
from services.ingestion.parsers.html_parser import HTMLParser
from services.ingestion.parsers.json_parser import JSONParser
from services.ingestion.persister import Persister
from services.ingestion.validator import Validator

logger = logging.getLogger(__name__)


class Parser(Protocol):
    """Protocol for parser interface."""

    def parse(self, raw_data: str, source_config: dict) -> list[dict]: ...


class IngestionPipeline:
    """
    Orchestrate the complete data ingestion flow.

    Pipeline stages:
    1. Fetch - Retrieve data from source
    2. Parse - Extract structured data
    3. Validate - Check quality and compliance
    4. Enrich - Add LLM-generated metadata
    5. Persist - Save to database and vector store
    """

    def __init__(self, db: Session, config_path: str = "./config/data_sources.yaml"):
        """
        Initialize pipeline with all services.

        Args:
            db: SQLAlchemy database session
            config_path: Path to data sources configuration
        """
        self.db = db
        self.config_path = Path(config_path)

        # Load configuration
        self.config = self._load_config()

        # Initialize services
        self.fetcher = Fetcher()
        self.parsers: dict[str, Parser] = {
            "html": HTMLParser(),
            "json": JSONParser(),
        }
        self.validator = Validator(db)
        self.enricher = Enricher()
        self.persister = Persister(db)

        logger.info("IngestionPipeline initialized")

    def _load_config(self) -> dict:
        """
        Load data sources configuration from YAML.

        Returns:
            Configuration dictionary
        """
        if not self.config_path.exists():
            logger.error(f"Config file not found: {self.config_path}")
            return {}

        try:
            with open(self.config_path, encoding="utf-8") as f:
                config = yaml.safe_load(f)
            logger.info(f"Loaded configuration from {self.config_path}")
            return dict(config) if config else {}
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            return {}

    def ingest_source(
        self,
        source_config: dict,
        force_refresh: bool = False,
        enrich: bool = True,
        dry_run: bool = False,
    ) -> dict[str, int]:
        """
        Ingest data from a single source.

        Args:
            source_config: Source configuration dictionary
            force_refresh: Bypass cache and fetch fresh data
            enrich: Whether to apply LLM enrichment
            dry_run: If True, validate only without persisting

        Returns:
            Statistics dictionary (created, updated, errors, skipped)
        """
        source_name = source_config.get("name", "unknown")
        logger.info(f"Starting ingestion from: {source_name}")

        stats = {"created": 0, "updated": 0, "errors": 0, "skipped": 0}

        try:
            # Stage 1: Fetch
            raw_data = self._fetch_stage(source_config, force_refresh)
            if not raw_data:
                logger.error(f"No data fetched from {source_name}")
                return stats

            # Stage 2: Parse
            parsed_data = self._parse_stage(raw_data, source_config)
            if not parsed_data:
                logger.warning(f"No data parsed from {source_name}")
                return stats

            logger.info(f"Parsed {len(parsed_data)} items from {source_name}")

            # Stage 3: Validate
            valid_data = self._validate_stage(parsed_data, source_config)
            logger.info(f"Validated {len(valid_data)}/{len(parsed_data)} items")

            stats["skipped"] = len(parsed_data) - len(valid_data)

            if not valid_data:
                logger.warning(f"No valid data from {source_name}")
                return stats

            # Stage 4: Enrich (optional, can be slow with LLM)
            # Skip enrichment for translation-only data (it already has human translations)
            is_translation_source = (
                source_config.get("json_type") == "gita_translations"
            )

            if is_translation_source:
                logger.info(
                    "Skipping enrichment for translation source (translations don't need LLM enrichment)"
                )
                enriched_data = valid_data
            elif enrich:
                enriched_data = self._enrich_stage(valid_data, source_config)
            else:
                logger.info("Skipping enrichment (enrich=False)")
                enriched_data = valid_data

            # Stage 5: Persist (skip in dry run)
            if dry_run:
                logger.info(
                    f"Dry run complete: {len(enriched_data)} items ready to persist"
                )
                stats["created"] = len(enriched_data)
            else:
                persist_stats = self._persist_stage(enriched_data)
                stats.update(persist_stats)

            logger.info(f"Ingestion complete for {source_name}: {stats}")
            return stats

        except Exception as e:
            logger.error(f"Ingestion failed for {source_name}: {e}", exc_info=True)
            stats["errors"] = stats.get("errors", 0) + 1
            return stats

    def _fetch_stage(self, source_config: dict, force_refresh: bool) -> str | None:
        """
        Stage 1: Fetch data from source.

        Args:
            source_config: Source configuration
            force_refresh: Bypass cache

        Returns:
            Raw data string or None
        """
        url = source_config.get("url")
        if not url:
            logger.error("No URL in source config")
            return None

        try:
            if url.startswith("http"):
                data = self.fetcher.fetch_url(url, force_refresh=force_refresh)
            else:
                data = self.fetcher.fetch_file(url)

            logger.info(f"Fetched {len(data)} bytes")
            return data

        except Exception as e:
            logger.error(f"Fetch failed: {e}")
            return None

    def _parse_stage(self, raw_data: str, source_config: dict) -> list[dict]:
        """
        Stage 2: Parse raw data into structured format.

        Args:
            raw_data: Raw data string
            source_config: Source configuration

        Returns:
            List of parsed verse dictionaries
        """
        format_type = source_config.get("format", "html")

        parser = self.parsers.get(format_type)
        if not parser:
            logger.error(f"No parser for format: {format_type}")
            return []

        try:
            parsed = list(parser.parse(raw_data, source_config))

            # If HTML parser returned empty list, check if this is an index page
            # with chapter links that need to be fetched separately
            if (
                not parsed
                and format_type == "html"
                and hasattr(parser, "get_chapter_urls")
            ):
                logger.info(
                    "No verses found in main page, checking for chapter links..."
                )
                chapter_urls = parser.get_chapter_urls(
                    raw_data, source_config.get("url", "")
                )

                if chapter_urls:
                    logger.info(f"Found {len(chapter_urls)} chapter pages to fetch")
                    all_verses = []

                    for chapter_url in chapter_urls:
                        logger.info(f"Fetching chapter from: {chapter_url}")
                        try:
                            # Create a temporary config for this chapter URL
                            chapter_config = source_config.copy()
                            chapter_config["url"] = chapter_url

                            # Fetch chapter page
                            chapter_data = self._fetch_stage(
                                chapter_config, force_refresh=False
                            )
                            if not chapter_data:
                                logger.warning(
                                    f"Failed to fetch chapter: {chapter_url}"
                                )
                                continue

                            # Parse chapter page
                            chapter_verses = list(
                                parser.parse(chapter_data, chapter_config)
                            )
                            if chapter_verses:
                                logger.info(
                                    f"Parsed {len(chapter_verses)} verses from chapter"
                                )
                                all_verses.extend(chapter_verses)
                            else:
                                logger.warning(
                                    f"No verses found in chapter: {chapter_url}"
                                )

                        except Exception as e:
                            logger.error(
                                f"Failed to process chapter {chapter_url}: {e}"
                            )
                            continue

                    logger.info(
                        f"Total verses parsed from all chapters: {len(all_verses)}"
                    )
                    return all_verses

            return parsed
        except Exception as e:
            logger.error(f"Parse failed: {e}")
            return []

    def _validate_stage(
        self, parsed_data: list[dict], source_config: dict
    ) -> list[dict]:
        """
        Stage 3: Validate parsed data.

        Args:
            parsed_data: List of parsed verse dictionaries
            source_config: Source configuration

        Returns:
            List of valid verse dictionaries
        """
        # First check source license
        if not self.validator.validate_license(source_config):
            logger.error(f"Source license invalid: {source_config.get('name')}")
            return []

        valid_items = []
        for item in parsed_data:
            is_valid, errors = self.validator.validate_verse(item)

            if is_valid:
                # Check canonical ID consistency
                if not self.validator.check_canonical_id_consistency(item):
                    logger.warning(
                        f"Canonical ID inconsistency: {item.get('canonical_id')}"
                    )

                valid_items.append(item)
            else:
                logger.warning(f"Invalid item: {errors}")

        return valid_items

    def _enrich_stage(self, valid_data: list[dict], source_config: dict) -> list[dict]:
        """
        Stage 4: Enrich data with LLM-generated metadata.

        Args:
            valid_data: List of valid verse dictionaries
            source_config: Source configuration

        Returns:
            List of enriched verse dictionaries
        """
        enrichment_config = self.config.get("enrichment", {})

        # Check if enrichment is enabled in config
        llm_enabled = enrichment_config.get("llm_tagging", {}).get("enabled", True)
        para_enabled = enrichment_config.get("paraphrasing", {}).get("enabled", True)
        trans_enabled = enrichment_config.get("transliteration", {}).get(
            "enabled", True
        )

        try:
            enriched = self.enricher.enrich_batch(
                valid_data,
                extract_principles=llm_enabled,
                generate_paraphrase=para_enabled,
                transliterate=trans_enabled,
            )
            return enriched
        except Exception as e:
            logger.error(f"Enrichment failed: {e}")
            return valid_data  # Return un-enriched on error

    def _persist_stage(self, enriched_data: list[dict]) -> dict[str, int]:
        """
        Stage 5: Persist data to database and vector store.

        Args:
            enriched_data: List of enriched verse dictionaries

        Returns:
            Statistics dictionary
        """
        try:
            stats = self.persister.persist_batch(enriched_data)
            return stats
        except Exception as e:
            logger.error(f"Persistence failed: {e}")
            return {"created": 0, "updated": 0, "errors": len(enriched_data)}

    def _get_enabled_sources(self, source_type: str) -> list[dict]:
        """
        Get enabled sources for a type, sorted by priority.

        Args:
            source_type: Source type key from config

        Returns:
            List of enabled source configs sorted by priority
        """
        sources_config = self.config.get("sources", {})
        sources = sources_config.get(source_type, [])

        if not isinstance(sources, list):
            sources = [sources]

        enabled = [s for s in sources if s.get("enabled", True)]
        enabled.sort(key=lambda x: x.get("priority", 999))
        return enabled

    def _ingest_single_source_with_stats(
        self,
        source: dict,
        force_refresh: bool,
        enrich: bool,
        dry_run: bool,
    ) -> dict[str, int]:
        """
        Ingest a single source and return stats, handling exceptions.

        Args:
            source: Source configuration
            force_refresh: Bypass cache
            enrich: Apply LLM enrichment
            dry_run: Validate only

        Returns:
            Statistics dictionary
        """
        try:
            return self.ingest_source(
                source,
                force_refresh=force_refresh,
                enrich=enrich,
                dry_run=dry_run,
            )
        except Exception as e:
            source_name = source.get("name", "unnamed")
            logger.error(
                f"Exception during ingestion from {source_name}: {e}",
                exc_info=True,
            )
            return {"created": 0, "updated": 0, "errors": 1, "skipped": 0}

    def _ingest_source_group(
        self,
        source_type: str,
        enabled_sources: list[dict],
        force_refresh: bool,
        enrich: bool,
        dry_run: bool,
        use_fallback: bool,
    ) -> dict[str, dict]:
        """
        Ingest a group of sources with fallback support.

        For translation sources with different languages, all are processed.
        For other sources, use fallback strategy (skip later sources if earlier succeeds).

        Args:
            source_type: Type of sources being ingested
            enabled_sources: List of enabled source configs
            force_refresh: Bypass cache
            enrich: Apply LLM enrichment
            dry_run: Validate only
            use_fallback: Try fallback sources on failure

        Returns:
            Dictionary mapping source names to statistics
        """
        stats = {}
        succeeded = False

        # Check if this is a translation source group with multiple languages
        is_multi_language_translation = (
            source_type == "translations"
            and len(enabled_sources) > 1
            and all(s.get("language") for s in enabled_sources)
        )

        for idx, source in enumerate(enabled_sources):
            source_name = source.get("name", "unnamed")
            is_fallback = idx > 0 and use_fallback

            if is_fallback:
                logger.info(
                    f"Trying fallback source {idx + 1}/{len(enabled_sources)}: {source_name}"
                )
            else:
                logger.info(f"Processing primary source: {source_name}")

            source_stats = self._ingest_single_source_with_stats(
                source, force_refresh, enrich, dry_run
            )
            stats[source_name] = source_stats

            total_items = source_stats.get("created", 0) + source_stats.get(
                "updated", 0
            )
            has_errors = source_stats.get("errors", 0) > 0

            if total_items > 0:
                logger.info(
                    f"Successfully ingested {total_items} items from {source_name}"
                )
                succeeded = True
                # For multi-language translations, continue processing all sources
                if not is_fallback and not is_multi_language_translation:
                    logger.info(
                        f"Primary source succeeded, skipping {len(enabled_sources) - 1} fallback sources"
                    )
                    break
            elif has_errors:
                logger.warning(f"Source {source_name} failed with errors")
                if use_fallback and idx < len(enabled_sources) - 1:
                    continue
            else:
                logger.warning(f"No data retrieved from {source_name}")

        if not succeeded:
            logger.error(f"Failed to ingest any data for source type: {source_type}")

        return stats

    def ingest_all_sources(
        self,
        source_types: list[str] | None = None,
        force_refresh: bool = False,
        enrich: bool = True,
        dry_run: bool = False,
        use_fallback: bool = True,
    ) -> dict[str, dict]:
        """
        Ingest data from all configured sources with fallback support.

        Args:
            source_types: List of source types to ingest (e.g., ['sanskrit', 'translations'])
                         If None, ingest all
            force_refresh: Bypass cache
            enrich: Whether to apply LLM enrichment
            dry_run: Validate only without persisting
            use_fallback: If True, try backup sources when primary fails

        Returns:
            Dictionary mapping source names to their statistics
        """
        if not self.config or "sources" not in self.config:
            logger.error("No sources configured")
            return {}

        all_stats: dict[str, dict] = {}
        sources_config = self.config["sources"]

        if source_types is None:
            source_types = list(sources_config.keys())

        for source_type in source_types:
            if source_type not in sources_config:
                logger.warning(f"Unknown source type: {source_type}")
                continue

            enabled_sources = self._get_enabled_sources(source_type)
            logger.info(
                f"Found {len(enabled_sources)} enabled sources for {source_type}"
            )

            if not enabled_sources:
                logger.warning(f"No enabled sources for type: {source_type}")
                continue

            group_stats = self._ingest_source_group(
                source_type,
                enabled_sources,
                force_refresh,
                enrich,
                dry_run,
                use_fallback,
            )
            all_stats.update(group_stats)

        # Summary
        total_created = sum(s.get("created", 0) for s in all_stats.values())
        total_updated = sum(s.get("updated", 0) for s in all_stats.values())
        total_errors = sum(s.get("errors", 0) for s in all_stats.values())

        logger.info(
            f"Ingestion complete. Total: {total_created} created, "
            f"{total_updated} updated, {total_errors} errors"
        )

        return all_stats

    def get_pipeline_status(self) -> dict:
        """
        Get status of all pipeline components.

        Returns:
            Status dictionary
        """
        return {
            "config_loaded": bool(self.config),
            "sources_available": len(self.config.get("sources", {})),
            "validator_stats": self.validator.get_statistics(),
            "persister_stats": self.persister.get_statistics(),
        }
