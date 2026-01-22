# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [v1.34.1] - 2026-01-22

### Added

- **Provider-Specific Configuration Framework:** Auto-tuned defaults for each LLM provider without feature flags
  - ProviderConfig pattern centralizes provider-specific behavior in `services/provider_configs.py`
  - Automatic provider selection: Gemini uses explicit JSON schema, Ollama uses simplified prompts, Anthropic native
  - Per-provider temperature defaults: Ollama/Gemini at 0.3 (deterministic), Anthropic at 0.7 (balanced)
  - Provider extension pattern: Adding new providers requires only ProviderConfig subclass + registration

### Changed

- LLM service: Refactored to use ProviderConfig for generation parameters and response parsing
- RAG pipeline: Provider-aware prompt customization applied via configs (Ollama gets simplified prompts)
- Architecture: Centralized provider logic removes ~50 lines of duplicate code across generation methods

### Technical

- New file: `backend/services/provider_configs.py` (450+ lines) with base class and 4 concrete implementations
- Tests: `backend/tests/test_provider_configs.py` (400+ lines) with 30+ unit tests
- Backward compatible: All existing tests pass unchanged, zero API signature changes

## [v1.34.0] - 2026-01-22

### Added

- **Intelligent Escalation with Field-Aware Confidence:** Multi-layer quality assurance for LLM responses
  - Structural health check detects missing critical fields (options, recommended_action, executive_summary)
  - Pre-repair escalation: missing CRITICAL fields trigger immediate escalation to higher-quality provider
  - Graduated confidence penalties: CRITICAL field repair (-0.30), IMPORTANT field repair (-0.15), OPTIONAL field repair (-0.05)
  - Post-repair escalation: confidence < 0.45 after repair triggers fallback to higher-quality provider
  - Transparent user communication: `confidence_reason` field explains score with 7-tier messaging strategy
  - Frontend integration: Info icon + hover tooltip shows confidence explanation (subtle, non-intrusive)

- **Escalation Metrics & Monitoring:**
  - Prometheus metrics: `escalation_reasons_total`, `confidence_post_repair`, `repair_success_total`
  - Per-field repair tracking: options, recommended_action, executive_summary, reflection_prompts, sources
  - Cost tracking: `consultation_cost_usd_total`, `consultation_tokens_total` by provider
  - Daily limit metrics: `daily_limit_exceeded_total`, request validation rejections
  - Grafana alerts: escalation rate spike (>5%), low post-escalation confidence (<0.85), high daily limit hits

- **Quality Assurance Pipeline:** Multi-gate validation before user response
  - Gate 1: Structural validation (all required fields present)
  - Gate 2: Field repair with graduated penalties
  - Gate 3: Confidence threshold check (0.45 minimum)
  - Gate 4: Transparent explanation of confidence score

- **Feature Flag Infrastructure:** Safe production rollout
  - `GEMINI_ESCALATION_ENABLED` (default: false) - disable escalation if needed
  - `ESCALATION_CONFIDENCE_THRESHOLD` (locked: 0.45) - conservative threshold
  - `ESCALATION_MAX_RATE` alert threshold (0.05) - monitor for anomalies
  - `ESCALATION_TRAFFIC_PERCENTAGE` - gradual rollout: 10% → 25% → 100%

### Changed

- RAG pipeline: Added pre-repair structural health check before validation cascade
- Confidence calculation: Replaced flat penalties with complexity-aware graduated penalties
- API response schema: Added `confidence_reason` field to Output model (JSON string)
- Frontend case view: Confidence display now includes info icon + tooltip (hover for explanation)
- Rate limits: Clarified daily limit tracking and cost guard documentation

### Fixed

- **Critical Issue #1:** Repair count tracking now accurate (was always 0)
  - Validation functions return repair metadata; pipeline collects and calculates total
- **Critical Issue #2:** Metrics emission failures now logged without crashing API
  - All 8 metric tracking functions wrapped in try-catch with error logging
- **Critical Issue #3:** Metadata validation added to API layer
  - Type validation for `_escalated`, `_repairs_count`, `_rag_injected` fields
- **Critical Issue #4:** Fallback responses now transparently flagged
  - `_post_processed` and `_repair_reason` fields added to reconstructed responses
- **High Issue #5:** Frontend tooltip now validates content before rendering
  - Empty tooltips prevented; graceful fallback when confidence_reason is null/empty

### Security

- Escalation logic preserves all input validation and content moderation
- No new injection vectors; metadata validated for type safety
- Fallback transparent: no data loss on escalation
- Cost guards maintained: escalation rate stays <5% (only structural failures)

### Documentation

- Updated `docs/consultation.md`: Added confidence transparency section + quality assurance explanation
- Updated `docs/operations-overview.md`: Added quality assurance pipeline diagram + rate limits & cost controls
- Updated `docs/observability.md`: Added escalation metrics + query examples + monitoring alerts
- Removed version-specific docs (ESCALATION_v1.34.0_RELEASE, ESCALATION_MONITORING, COST_DEFENSE)
- Consolidated content into current-state public docs (url-friendly, no version ties)

### Technical Details

- **Escalation Decision Logic:** `backend/services/rag/escalation.py` (162 lines, 28 unit tests)
- **Pipeline Integration:** Pre-repair + post-repair escalation checks in `pipeline.py`
- **Metrics Infrastructure:** 8 escalation-specific metrics in `metrics_llm.py`
- **Frontend Tooltip:** Content validation + CSS-based hover display in `OutputFeedback.tsx`
- **Test Coverage:** 70+ unit tests, 20+ integration tests, all passing
- **Backward Compatible:** Escalation feature flag default OFF; no breaking changes to existing API

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

---

[Unreleased]: https://github.com/geetanjaliapp/geetanjali/compare/v1.34.1...main
[v1.34.1]: https://github.com/geetanjaliapp/geetanjali/compare/v1.34.0...v1.34.1
[v1.34.0]: https://github.com/geetanjaliapp/geetanjali/compare/v1.32.0...v1.34.0
[v1.32.0]: https://github.com/geetanjaliapp/geetanjali/compare/v1.31.0...v1.32.0
[v1.31.0]: https://github.com/geetanjaliapp/geetanjali/compare/v1.30.0...v1.31.0
[v1.30.0]: https://github.com/geetanjaliapp/geetanjali/releases/tag/v1.30.0
