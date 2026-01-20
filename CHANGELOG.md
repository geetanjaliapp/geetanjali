# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [v1.32.0] - 2026-01-20

### Added

- **Cost Defense:** Conservative cost guard system to prevent LLM API abuse
  - Daily consultation limits per session/IP (20 consults/day)
  - Request token validation with early rejection of oversized inputs (2000 token limit)
  - SHA256-based deduplication for follow-up questions (24-hour window)
  - Rate limiting: 3/hour for analyze, 5/hour for follow-up
  - Prometheus metrics for cost tracking and anomaly detection (per IP/user)
  - Graceful user messaging aligned with app philosophy ("daily pause" framing)
  - Configuration via environment variables with sensible defaults

- **Token Counting Utility:** Conservative token estimation algorithm
  - 4 chars/token estimation (conservative approach)
  - Accurate byte-count fallback for edge cases
  - Support for different LLM models (Gemini, Anthropic, Ollama)

- **Request Validation:** Multi-layer validation architecture
  - SafeText max_length increased to 10,000 characters
  - Token validation runs before content filter and database operations
  - Clear error messages for oversized requests

- **Prometheus Metrics:** Cost Defense tracking
  - `geetanjali_validation_rejections_total` - rejections by reason (token_too_large, duplicate_question, etc.)
  - `geetanjali_daily_limit_hits_total` - daily limit exceeded events by tracking type
  - `geetanjali_consultation_token_estimate` - estimated tokens per request

### Changed

- SafeText schema constraint increased from 5,000 to 10,000 characters
- Token validation now primary guard (2000 token limit)
- Daily limit defaults: 20 consultations/day per session/IP
- Schema description updated for case description field

### Fixed

- Environment variable configuration sync (.env, .env.example, .env.enc via SOPS)
- Pydantic BaseSettings override mechanism verified working correctly
- Import organization in test fixtures

### Technical Details

- 4 phases, 14 commits, 484 unit + 8 integration tests
- No breaking changes, no schema migrations required
- Rollback via `DAILY_CONSULT_LIMIT_ENABLED=false` environment variable
- Comprehensive documentation in docs/COST_DEFENSE.md
- Week 1 monitoring plan with daily data-driven tuning

## [v1.31.0] - 2026-01-16

### Added

- Initial Gemini LLM provider integration
- Multi-provider support (Gemini primary, Anthropic fallback, Ollama local)
- Circuit breaker pattern for LLM provider reliability

### Changed

- Default LLM provider from Anthropic to Gemini (cost optimization)
- Single-pass processing for external LLMs

## [v1.30.0] - 2026-01-10

### Added

- TTS reliability improvements
- Follow-up conversation pipeline

## Previous Versions

See git history for earlier version details.
