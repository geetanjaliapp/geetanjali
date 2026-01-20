"""Tests for configuration validation and environment variable synchronization."""

import os
import re
from pathlib import Path

import pytest

from config import Settings


class TestConfigurationSync:
    """Validate Cost Defense settings are synchronized across files."""

    @pytest.fixture
    def settings(self, monkeypatch):
        """Load settings from environment with clean state."""
        # Clear stale env vars that might override .env or defaults
        # Ensures we test the actual config.py defaults or .env values
        monkeypatch.delenv("ANALYZE_RATE_LIMIT", raising=False)
        monkeypatch.delenv("FOLLOW_UP_RATE_LIMIT", raising=False)
        monkeypatch.delenv("DAILY_CONSULT_LIMIT", raising=False)
        monkeypatch.delenv("REQUEST_TOKEN_LIMIT", raising=False)
        return Settings()

    @pytest.fixture
    def env_example_path(self):
        """Path to .env.example."""
        return Path(__file__).parent.parent.parent / ".env.example"

    @pytest.fixture
    def env_path(self):
        """Path to .env."""
        return Path(__file__).parent.parent.parent / ".env"

    def _extract_env_value(self, content: str, key: str) -> str | None:
        """Extract value from env file content."""
        pattern = rf"^{key}=(.+)$"
        matches = re.findall(pattern, content, re.MULTILINE)
        return matches[0] if matches else None

    def test_rate_limit_values_defined(self, settings):
        """Cost Defense rate limit values must be defined."""
        assert hasattr(settings, "ANALYZE_RATE_LIMIT")
        assert hasattr(settings, "FOLLOW_UP_RATE_LIMIT")
        assert settings.ANALYZE_RATE_LIMIT == "3/hour"
        assert settings.FOLLOW_UP_RATE_LIMIT == "5/hour"

    def test_daily_limit_values_defined(self, settings):
        """Cost Defense daily limit values must be defined."""
        assert hasattr(settings, "DAILY_CONSULT_LIMIT")
        assert hasattr(settings, "DAILY_CONSULT_LIMIT_ENABLED")
        assert settings.DAILY_CONSULT_LIMIT == 20
        assert settings.DAILY_CONSULT_LIMIT_ENABLED is True

    def test_token_limit_configurable(self, settings):
        """Request token limit must be configurable."""
        assert hasattr(settings, "REQUEST_TOKEN_LIMIT")
        assert settings.REQUEST_TOKEN_LIMIT == 2000

    def test_env_example_contains_cost_defense_vars(self, env_example_path):
        """Cost Defense variables must be in .env.example template."""
        if not env_example_path.exists():
            pytest.skip(".env.example not found")

        content = env_example_path.read_text()
        required_vars = [
            "ANALYZE_RATE_LIMIT",
            "FOLLOW_UP_RATE_LIMIT",
            "DAILY_CONSULT_LIMIT",
            "REQUEST_TOKEN_LIMIT",
            "DAILY_CONSULT_LIMIT_ENABLED",
        ]

        for var in required_vars:
            assert var in content, f"{var} missing from .env.example"

    def test_env_has_cost_defense_values(self, env_path, settings):
        """Cost Defense variables must be in .env (or loaded from environment)."""
        if not env_path.exists():
            pytest.skip(".env not found (may be using environment variables)")

        content = env_path.read_text()

        # Check that values are set (not commented out or missing)
        assert "ANALYZE_RATE_LIMIT" in content
        assert "FOLLOW_UP_RATE_LIMIT" in content
        assert "DAILY_CONSULT_LIMIT" in content
        assert "REQUEST_TOKEN_LIMIT" in content

    def test_rate_limit_format_valid(self, settings):
        """Rate limit format must be valid (N/time_unit)."""
        # Format: "3/hour", "5/hour"
        assert "/" in settings.ANALYZE_RATE_LIMIT
        assert "/" in settings.FOLLOW_UP_RATE_LIMIT

        parts_analyze = settings.ANALYZE_RATE_LIMIT.split("/")
        parts_followup = settings.FOLLOW_UP_RATE_LIMIT.split("/")

        assert len(parts_analyze) == 2
        assert len(parts_followup) == 2
        assert parts_analyze[0].isdigit()
        assert parts_followup[0].isdigit()

    def test_daily_limit_positive(self, settings):
        """Daily limit must be positive integer."""
        assert settings.DAILY_CONSULT_LIMIT > 0
        assert isinstance(settings.DAILY_CONSULT_LIMIT, int)

    def test_token_limit_reasonable(self, settings):
        """Token limit must be reasonable (100-10000 tokens)."""
        assert 100 <= settings.REQUEST_TOKEN_LIMIT <= 10000

    def test_cost_defense_enabled_in_production(self, settings):
        """Cost defense must be enabled (can only be disabled via env var for testing)."""
        # Verify that the feature flag exists and can be controlled
        assert hasattr(settings, "DAILY_CONSULT_LIMIT_ENABLED")
        # In production, should always be True (unless explicitly set to False)
        if settings.APP_ENV == "production":
            assert settings.DAILY_CONSULT_LIMIT_ENABLED is True

    def test_version_matches_release(self, settings):
        """APP_VERSION must match expected release version."""
        # v1.32.0 or later
        version_parts = settings.APP_VERSION.split(".")
        assert len(version_parts) >= 2, f"Invalid version format: {settings.APP_VERSION}"
        major = int(version_parts[0])
        minor = int(version_parts[1])
        assert (
            major > 1 or (major == 1 and minor >= 32)
        ), f"Version {settings.APP_VERSION} is older than v1.32.0"

    def test_logging_configured(self, settings):
        """Logging must be configured for cost defense monitoring."""
        assert settings.LOG_LEVEL in ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        # Info or higher recommended for production
        if settings.APP_ENV == "production":
            valid_levels = ["INFO", "WARNING", "ERROR", "CRITICAL"]
            assert (
                settings.LOG_LEVEL in valid_levels
            ), "Production should not use DEBUG log level"
