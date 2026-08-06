# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [v1.40.0] - 2026-08-06

Restore what silently broke, then make silence structurally impossible.

### Fixed

- **Six client-side capabilities restored.** `d8c34a5` (2026-03-28) shipped a CSP that disabled TTS
  playback, the share-card preview, Umami analytics, Web Vitals reporting, Sentry ingest and the
  inline theme script. Every one degraded gracefully, so the site stayed at HTTP 200 and server
  metrics stayed green for four months. `media-src` was absent entirely and fell back to
  `default-src 'self'`, which does not match `blob:`
- **Umami event host:** events POST to `gateway.umami.is`, not the `cloud.umami.is` the script loads
  from. Allowing only the script host loads analytics and silently drops every event
- **Service worker:** `caches.match('/') || fallback` never reached the fallback — a Promise is
  always truthy — so the offline shell resolved to `undefined`; rethrowing on cache miss produced
  dead FetchEvents with no status for callers; audio preload built URLs from relative paths with no
  base, so every preload threw
- **TTS store:** concurrent requests for the same text shared one temp path, allowing a partial clip
  to be renamed into place and then served forever as content-addressed and immutable
- **Telemetry:** unauthenticated `detail` was logged unescaped, permitting log injection

### Added

- **Out-of-band degradation telemetry:** `POST /api/v1/telemetry/degraded` →
  `client_degradation_total{path}`. Replaces `umami.track`, which reported TTS fallbacks through the
  channel the same CSP header had blocked — signal and failure shared a failure domain. Closed enum
  with unknown values bucketed, so an unauthenticated endpoint cannot mint Prometheus labels
- **User-visible degradation indicator:** the speak control names the degraded browser voice in its
  accessible label and aria-live announcement, so a robotic voice reads as a fault rather than as
  the product
- **Weekly synthetic browser check** (`scripts/synthetic/`, GitHub Actions): asserts zero CSP
  violations, that Umami loaded, that TTS played generated audio rather than calling
  `speechSynthesis`, and that the share card actually decodes. Runs off-box so it survives the
  droplet being down
- **CI CSP contract test:** asserts required directives and recomputes the inline-script hash from
  `index.html`, so drift fails review rather than production

### Changed

- **TTS delivery is same-origin.** Generated audio is stored content-addressed on disk and served
  from `/api/v1/tts/audio/<key>.mp3` instead of a `blob:` URL. Brings HTTP caching, service-worker
  caching and Range-based seeking, and removes the CSP exception rather than permitting it
- **TTS audio is generated once, not daily.** The cache key was already a content hash but lived
  under a 24h Redis TTL, regenerating byte-identical audio for narration text that is identical
  across every user. LRU size cap bounds consultation audio, which is unbounded
- **TTS generation sits behind a provider seam** — `edge_tts` is confined to one module, enforced by
  test, so changing provider is a module plus config rather than a rewrite
- **Redis no longer stores audio,** freeing memory on a 1.9GB host
- **FastAPI hold lifted:** 0.135.2 → 0.141.1 with `prometheus-fastapi-instrumentator` 7.1.0 → 8.1.0.
  These must move together — 7.1.0 breaks on FastAPI ≥ 0.136, and 8.1.0 needs `starlette>=1.0.0`,
  which only newer FastAPI provides. Held since 854d742
- **Deps:** Dependabot queue 10 → 2. TypeScript 5.9 → 6.0.3 (7 blocked upstream by
  `typescript-eslint`, which peers `<6.1.0`), node 20 → 25-alpine, web-vitals 6, three `actions/*`
  v7, npm-minor (23) and python-minor (11) groups
- **Dependabot `ignore` rules** for chromadb, bcrypt majors and typescript ≥7 — the `python-minor`
  group globbed `*` and re-bumped deliberate pins weekly, training us to ignore the group

### Removed

- Unused `jsdom` devDependency — the test environment is `happy-dom` with no per-file overrides
- Deprecated `baseUrl` from `tsconfig.app.json` (`TS5101` under TS 6, non-functional in TS 7)

## [v1.39.0] - 2026-06-23

### Added

- **Verse-consultation bridge:** ReflectPrompt on VerseDetail (collapsible, 500 characters), anchor
  verse injection into the RAG pipeline at position 0 with dedup, `?verse=BG_X_Y` banner and
  read-only reflection preview on NewCase, verse pill on anchored consultations, and an "Anchor
  verse" label on the source card in CaseView
- 13 tests across pipeline, unit, integration and frontend

## [v1.38.0] - 2026-06-22

### Changed

- **Security:** python-multipart 0.0.22→0.0.32 (high DoS), requests 2.32.5→2.34.2 (moderate temp file)
- Frontend audit gate: `npm audit` restored as advisory check (--audit-level=high), breaking dependency gate removed
- **Deps:** 40+ bumps across python-minor (20), npm-minor (18), audit fixes (4)
- anthropic 0.86→0.109, uvicorn 0.42→0.49, sqlalchemy 2.0.48→2.0.51, chromadb 1.5.5→1.5.9, sentry-sdk 2.55→2.62, react-router 7.8→7.17, react-hooks 7.1 warn override
- FastAPI held at 0.135.2 — `prometheus-fastapi-instrumentator` incompatible with 0.137+

## [v1.37.2] - 2026-03-28

### Added

- **Privacy & Terms pages:** JSON-driven legal content (/privacy, /terms)
- **AI disclosure:** Audio recitations labeled AI-generated (AI4Bharat Indic Parler-TTS)
- **Umami analytics:** Privacy-aware page visit tracking, disclosed in privacy policy

### Changed

- **Security:** nginx security headers centralized via shared .inc file
- **a11y:** aria-hidden on decorative SVGs, HCM focus indicators, main landmarks on all pages, ARIA form validation
- **UX:** FAB overlap fix, tap target sizing, counter label clarity, SEO duplicate title fix
- **Copy scrub:** System error messages → user-facing tone, factual corrections (verse count, terminology, AI provider names)
- FRONTEND_URL centralized via Jinja2 globals for SEO templates
- Anthropic primary, Gemini fallback (swapped from Gemini-primary)

### Fixed

- Worker OOM: memory increased to 256MB, ChromaDB capped at 96MB
- Redis health check fixed, cron-maintenance.sh symlink drift resolved

## [v1.37.1] - 2026-03-14

### Changed

- eslint 10 migration with react-hooks peer dep override
- "Geeta"→"Gita" normalization (`book_key="bhagavad_geeta"` preserved as internal DB key)
- ttsPreprocess keeps both spellings for input tolerance

### Fixed

- Docker build cache pruned (17GB freed), cache filter extended to 168h
- Worker OOM resolved (idle ~155MB, RQ fork spike mitigation)

## [v1.37.0] - 2026-01-29

### Changed

- **Centralized embeddings:** Worker delegates vector search to backend (~400MB savings)
- Backend 640MB, Worker 256MB, ChromaDB 96MB budget deployment

### Added

- Internal vector search API for worker communication
- HuggingFace model cache persisted across Docker restarts
- Comprehensive DB maintenance script (scripts/maintenance.sh)

## [v1.35.0] - 2026-01-23

### Changed

- Budget deployment infrastructure: DEPLOY_COMPOSE_FILES support
- Debian setup hardened (security-first provisioning)

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

[Unreleased]: https://github.com/geetanjaliapp/geetanjali/compare/v1.40.0...main
[v1.40.0]: https://github.com/geetanjaliapp/geetanjali/compare/v1.39.0...v1.40.0
[v1.39.0]: https://github.com/geetanjaliapp/geetanjali/compare/v1.38.0...v1.39.0
[v1.38.0]: https://github.com/geetanjaliapp/geetanjali/compare/v1.37.2...v1.38.0
[v1.37.2]: https://github.com/geetanjaliapp/geetanjali/compare/v1.37.1...v1.37.2
[v1.37.1]: https://github.com/geetanjaliapp/geetanjali/compare/v1.37.0...v1.37.1
[v1.37.0]: https://github.com/geetanjaliapp/geetanjali/compare/v1.35.0...v1.37.0
[v1.35.0]: https://github.com/geetanjaliapp/geetanjali/compare/v1.34.1...v1.35.0
[v1.34.1]: https://github.com/geetanjaliapp/geetanjali/compare/v1.34.0...v1.34.1
[v1.34.0]: https://github.com/geetanjaliapp/geetanjali/compare/v1.32.0...v1.34.0
[v1.32.0]: https://github.com/geetanjaliapp/geetanjali/compare/v1.31.0...v1.32.0
[v1.31.0]: https://github.com/geetanjaliapp/geetanjali/compare/v1.30.0...v1.31.0
[v1.30.0]: https://github.com/geetanjaliapp/geetanjali/releases/tag/v1.30.0
