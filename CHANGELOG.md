# Changelog

All notable changes to Geetanjali are documented here.

## [1.16.0] - 2025-12-27

Tailwind CSS v4 migration with design token architecture, theme personalities, and cross-device theme sync.

### Features
- **Theme Personalities** - 4 built-in themes: Geetanjali (default), Sutra (scholarly), Serenity (contemplative), Forest (natural). Each with unique color palettes and typography.
- **Cross-Device Theme Sync** - Theme preferences sync to backend for authenticated users. Last-write-wins with timestamp-based conflict resolution.
- **Theme Selector** - Card-based theme picker in Settings with live preview. Supports light/dark mode toggle per theme.
- **WCAG 2.1 AA Compliance** - All text meets minimum contrast ratios across all themes and modes.

### Infrastructure
- **Tailwind v4 Migration** - Upgraded to Tailwind CSS v4 with native CSS-first configuration
- **Design Token System** - 3-tier CSS custom property architecture (primitives → semantic → derived)
- **UI Component Library** - New reusable components: Button, Card, Badge, Input, Modal, IconButton, Link, Skeleton
- **localStorage Consolidation** - All storage keys centralized in `STORAGE_KEYS` registry

### Technical
- Theme backend API: `GET/PUT /api/v1/preferences/theme`
- Migration `021_add_theme_preferences` for user theme columns
- 5s debounce on theme sync to reduce API calls
- Featured cases cache simplified: removed localStorage SWR, now HTTP + Redis (24h TTL)
- ThemeContext with server sync, Umami analytics integration
- 17 new tests for ThemeContext, 533 lines of theme utility tests

### Dependencies
- **Frontend**: Tailwind CSS 4.2.4, @tailwindcss/vite 4.2.4

## [1.15.1] - 2025-12-25

Patch release with critical bug fix, dependency updates, and documentation improvements.

### Fixes
- **CSRF Fix** - Add missing auth headers to `flushSync` fetch call. Native fetch on page unload was missing Authorization and X-CSRF-Token headers, causing CSRF validation failures.
- **UX** - Remove distracting auto-sync toast on login
- **Metrics** - Split into modules to prevent worker gauge duplicates
- **Dashboard** - Use `sum()` to prevent duplicate stat panels

### Features
- **Docs** - Dark mode support for Mermaid diagrams with theme-aware rendering
- **Metrics** - Standardized dual-service (backend + worker) metrics collection

### Documentation
- New API reference, environment reference, and about pages
- Redesigned "What You Can Do" section with visual journey infographic
- Technical accuracy fixes from peer review

### Dependencies
- **Frontend**: React 19.2.3, Vite 7.3.0, web-vitals 5.1.0, @types/node 25
- **Backend**: FastAPI 0.127, Sentry 2.48, SQLAlchemy 2.0.45, pytest-cov 7.0
- **CI**: actions/checkout v6, setup-python v6, codeql-action v4

## [1.15.0] - 2025-12-24

Circuit breaker resilience, comprehensive observability, and operational metrics.

### Features
- **Circuit Breakers** - Per-service circuit breakers (LLM, ChromaDB, Email) with configurable thresholds and recovery timeouts. Prevents cascade failures during outages.
- **LLM Fallback Tracking** - Metrics track fallback events with reason labels (circuit_open, retries_exhausted, error) for better debugging.
- **Vector Search Fallback** - SQL keyword search fallback when ChromaDB is unavailable, tracked via metrics.
- **Cache Metrics** - Hit/miss counters by key type (verse, search, metadata, case, rag) for cache efficiency monitoring.

### Infrastructure
- **Grafana Dashboard** - New sections: Resilience (circuit breaker states), Cache & Data Retrieval (hit rate, fallback tracking), Email Service (success rate, send duration), Worker Queue (depth, failed jobs).
- **Prometheus Alerts** - Circuit breaker state alerts with configurable thresholds for proactive incident response.
- **API Error Tracking** - `api_errors_total` counter wired to all exception handlers with normalized endpoint paths.
- **Case Views Accuracy** - Daily views now tracked via Redis counter for accurate 24h metrics.

### Technical
- Abstract `CircuitBreaker` base class with state transitions and metrics integration
- Per-provider LLM circuit breakers (Anthropic, Ollama) with independent failure tracking
- Cache TTL jitter prevents stampede during high-traffic periods
- Retry-before-circuit pattern: retries exhaust before recording circuit failure
- 24+ new tests for cache operations and circuit breaker behavior

### Improvements
- Email retry decorator with metrics integration for all email types
- Failed jobs metric for RQ worker queue monitoring
- Endpoint path normalization prevents Prometheus cardinality explosion
- Config constant for daily counter TTL (timezone-safe 48h window)

## [1.14.0] - 2025-12-23

Deployment resilience, improved email verification UX, and test coverage.

### Features
- **Chunk Loading Recovery** - Automatic retry and page reload when users encounter stale chunks after deployment. Prevents "failed to load" errors during navigation.
- **Email Verification UX** - Dismissible reminder banner (7-day localStorage expiry), resend link in Settings page, shared hook for code reuse.
- **Enhanced Error Boundary** - Friendly "Update Available" UI for chunk errors with one-click refresh.

### Infrastructure
- **Version Check** - Proactive cache invalidation for long-running sessions via `/version.json`
- **Service Worker** - Auto-generated cache version per build prevents stale assets
- **Defense in Depth** - Primary (lazyWithRetry) + supplementary (versionCheck) chunk error handling

### Technical
- 29 new tests for chunk loading retry logic covering browser-specific error patterns
- Centralized storage key management via `STORAGE_KEYS` registry
- Atomic check-and-set prevents reload loops (30s cooldown)
- Bundle size optimization: removed static Sentry import (~80KB savings)

### Fixes
- Race condition in chunk reload marking (atomic tryMarkReloadAttempt)
- Service Worker uses `event.waitUntil()` for cache operations
- Error handling around user refresh in verification hook

## [1.13.0] - 2025-12-23

Email verification, performance optimizations, and newsletter improvements.

### Features
- **Email Verification** - New accounts receive verification email. Soft enforcement with UI reminders (banner and Settings status). Password reset also verifies email ownership.
- **Composable Email Templates** - "Quiet Library" design system for all emails with warm amber headers, reusable components, and optimized logo.
- **Newsletter Metrics** - Dashboard metrics for subscriber engagement, open rates, and delivery stats.
- **Cron Automation** - Setup scripts for newsletter delivery and maintenance jobs.

### Performance
- **Response Compression** - Gzip/Brotli compression for API responses
- **Code Splitting** - Improved chunking strategy for frontend bundles
- **Trigram Indexes** - PostgreSQL trigram indexes for faster text search
- **Batch Verse API** - New endpoint for fetching multiple verses in single request
- **Virtual Scrolling** - Replaced react-virtuoso with @tanstack/react-virtual for better performance

### Improvements
- **Newsletter Email Redesign** - Email template matches app design language with amber/orange branding
- **Verse Filter Reorder** - Featured → For You → Favorites → All (most useful first)
- **Rate Limiting** - Robust rate limiting for admin enrichment scripts

### Fixes
- Email logo uses PNG for better client compatibility
- Metrics use correct field names (Feedback.rating, Subscriber.last_verse_sent_at)
- RAG handles string sources in validation
- Favorites callback references stabilized to prevent re-renders

### Documentation
- Added cron setup and newsletter operational docs
- Updated feature documentation

### Technical
- Email verification database schema with indexed tokens
- Typed API responses for email verification endpoints
- Account reactivation clears old verification tokens
- Security: is_active check prevents verification of deleted accounts

## [1.12.0] - 2025-12-22

Cross-device sync, Featured Cases, and account management.

### Features
- **Cross-device Sync** - Favorites, reading position, learning goals, and newsletter subscription sync across devices for logged-in users. Local data merges on login with conflict resolution.
- **Featured Cases** - Curated example consultations appear on homepage. Background job selects high-quality completed cases based on confidence and feedback.
- **Sharing Modes** - Cases can be private (default), unlisted (link-only), or public (discoverable). View counts tracked for shared cases.
- **Account Deletion** - Users can delete accounts from Settings. Implements soft delete with data recovery option.
- **Verse Sharing** - Generate shareable images with Sanskrit text and translation. Canvas-based rendering for social media.
- **Newsletter Preferences** - Manage Daily Wisdom email subscription from Settings. Syncs across devices.
- **Settings Redesign** - Compact layout with hash anchor IDs for direct linking to sections.
- **Font Size Controls** - Adjustable font sizes in verse detail header, not just Reading Mode.
- **Draft Auto-save** - Case form saves draft to localStorage. Resume where you left off.

### Improvements
- **Filter UI** - Icons and responsive design in verse browser filters
- **Dark Mode** - Focus ring offset variants for accessibility
- **Navigation** - Brand name linked to home in footer, simplified "About" label
- **Confirmations** - Text confirmation for destructive actions (delete account, delete case)
- **Storage Keys** - Centralized localStorage key management

### Fixes
- Fixed infinite re-render loop in Reading Mode
- Fixed race condition in favorites sync with atomic update
- Fixed timezone and validation issues in preferences API
- Fixed cascading re-renders with useMemo
- Fixed reading mode URL format to use query params
- Fixed goal icon sizing and overflow in newsletter component

### Documentation
- Refreshed docs with feature coverage for v1.11.3+ changes
- Added Favorites, Sharing, and Featured Cases sections
- Updated API endpoint documentation

### Technical
- UserPreferences model with preferences API (GET/PUT)
- Featured cases curation worker with test coverage
- View deduplication per session for shared cases
- Consolidated Phase 3/4 database migrations
- Storage key constants in centralized module

## [1.11.3] - 2025-12-17

Bug fixes and resilience improvements for RAG pipeline and content validation.

### Features
- **RAG Verse Injection** - When LLM returns fewer than 3 source citations (or uses wrong format), system now injects relevant RAG-retrieved verses as fallback. Applies confidence penalty (-0.03 per injected verse) rather than hard failure.

### Fixes
- **JSON Parsing** - Fixed `extract_json_from_text()` returning string instead of dict, causing "'str' object has no attribute 'get'" errors.
- **Legacy Data Handling** - Schema now handles legacy outputs with string sources (`['BG_2_47']`) and empty options arrays gracefully via model validator.
- **Gibberish Detection** - Expanded common words list and relaxed thresholds (20%→12% ratio, 2→1 distinct words). Valid queries like "Do personal obligations ever justify bending professional standards?" no longer rejected.
- **Source Validation** - Fixed bug where invalid option sources (e.g., "Verse 1" instead of "BG_2_47") weren't filtered when root sources array was empty.
- **Follow-up Validation UX** - Validation errors now display inline near the input field, not just at page top.

### Technical
- Added `forgot-password` and `reset-password` to CSRF-exempt paths (pre-auth flows)
- Disabled Redis caching in tests (`REDIS_ENABLED=false`) for isolation
- Skip vector store tests by default (`SKIP_VECTOR_TESTS=true`)

## [1.11.2] - 2025-12-17

UX improvements for verse discovery and consultation quality.

### Features
- **Verse Reference Auto-Linking** - Verse references in guidance text (BG 2.47, BG_3_35) are now clickable. Click to see a popover with the leadership insight and option to view full verse. Supports multiple formats.
- **Raw LLM Storage for Policy Violations** - Backend now stores raw LLM response when content is flagged, enabling debugging and refinement of refusal detection.

### Improvements
- **Concise Guidance** - Updated prompts for crisper responses: initial guidance now 100-150 words (was 150-250), follow-ups 50-100 words (was 2-4 paragraphs).
- **Verse Citation Constraints** - Prompts now explicitly instruct LLM to only cite verses provided in context, preventing hallucinated verse references.
- **Refusal Detection** - Three-strategy fix reduces false positives: JSON-first check, position-based matching (first 500 chars), and quote-aware pattern detection. Valid guidance containing phrases like "I can't help" in suggested dialogue is no longer incorrectly flagged.
- **Unified Thinking Indicators** - Consolidated thinking/loading indicators into reusable ThinkingIndicator component.
- **Navigation** - Verse links from case view now properly return to case context.

### Fixes
- Aligned follow-up response format with main guidance style (paragraph structure, headers)
- Prevented duplicate thinking indicators during follow-up processing

## [1.11.1] - 2025-12-16

Polish release focusing on typography, readability, and case view improvements.

### Features
- **Executive Summary Formatting** - Post-processing for LLM responses adds paragraph breaks around section headers (**Wisdom from the Geeta**, **Closing**), improving readability without relying on LLM formatting consistency.

### Improvements
- **Typography** - Custom prose styling with amber-800 bold text and Spectral serif italics. Increased font sizes in Guidance Summary sections for better readability.
- **Case View** - Unified status handling shows user question consistently across draft, pending, processing, and failed states. Draft cases now display "Get Guidance" button.
- **Reading Mode** - Improved contrast with gray text, larger font size step increments for noticeable difference.
- **Search** - Auto-focus on search input, cleaner spotlight card without redundant labels.
- **New Case** - Inspiration verse displayed inline with reference link.
- **Home** - Reduced hero tagline font size on mobile for better balance.
- **Waiting State** - Fixed quote layout shift, reduced shimmer prominence.
- **Prompts** - Enriched executive_summary with structured "Wisdom from the Geeta" section.

### Technical
- Centralized curated verses in single location (`curatedVerses.ts`)
- Markdown rendering added to PublicCaseView (was showing raw `**` markers)
- Post-processing is idempotent - safe if LLM returns well-formatted text

## [1.11.0] - 2025-12-16

Search, Reading Mode, and Design System release.

### Features
- **Search** - Multi-strategy hybrid search across 701 verses. Canonical lookup (2.47), Sanskrit text (कर्म, karmaṇy), keyword search with OR logic, principle filtering, and semantic fallback. Match transparency shows why each result was found.
- **Reading Mode** - Immersive scripture reading at `/read`. Swipe navigation, tap-to-reveal translations, chapter intros, progress tracking, font size controls, keyboard shortcuts (J/K/←/→).
- **Design System** - Mobile-first responsive patterns. Warm amber surfaces, orange-600 primary, Spectral headings, Source Sans body. Consistent spacing and component patterns.

### Improvements
- **Navigation** - Search in navbar and hamburger menu. Context-aware back navigation from verse detail. ⌘K keyboard shortcut.
- **Search UX** - Recent searches dropdown, topic pills for browsing, featured verse spotlight, consultation suggestion for situational queries, infinite scroll with load more.
- **Content Filtering** - Search-specific moderation (stricter than consultation). Frontend mirrors backend rules for instant feedback.
- **Docs Site** - Aligned typography and colors with main app. Spectral + Source Sans fonts, warm amber palette.

### Documentation
- Rewrote search.md with architecture diagrams and hybrid OR search explanation
- Added design.md covering frontend design language and patterns
- Rewrote backend and frontend READMEs based on code analysis
- Reorganized docs index for public presentation

### Technical
- Hybrid OR search ranks by keyword match count (more matches = higher rank)
- Five search strategies: canonical, Sanskrit, keyword, principle, semantic
- PostgreSQL JSONB for principle filtering, ChromaDB for semantic search
- Skip PostgreSQL-only tests on SQLite in CI

## [1.10.0] - 2025-12-11

Quality and security improvements from comprehensive code review.

### Security
- **CSP Hardening** - Removed `unsafe-inline` from Content-Security-Policy, changed default-src to `'none'`, added `frame-ancestors 'none'`
- **Rate Limiting** - Added rate limits to message endpoints (GET: 60/min, POST: 10/min)

### Reliability
- **Stale Processing Timeout** - Cases stuck in PROCESSING for >5 minutes are automatically failed when polled, preventing indefinite hangs
- **Silent Handler Logging** - Added logging to previously silent exception handlers in follow-up background processing

### Improvements
- **Content Filter Alignment** - Aligned frontend gibberish detection thresholds with backend for consistent validation
- **Prompt Truncation Logging** - Added logging when follow-up prompts are truncated (>500 chars)
- **Cache Invalidation** - Public case caches (outputs, messages) are now invalidated when new content is created
- **Contact Form Validation** - Refactored to use centralized `validate_submission_content` for consistent content filtering

### Technical
- Consolidated frontend content filter constants with backend values
- Added `STALE_PROCESSING_TIMEOUT` config setting (300s default)
- Improved CSP headers with explicit directives for API responses

## [1.9.0] - 2025-12-10

Follow-up conversations and quality improvements.

### Features
- **Follow-up Conversations** - Lightweight conversational follow-ups after initial consultation without full RAG regeneration. Async processing via RQ worker with rate limiting (30/hour).
- **Refine Guidance CTA** - Low-confidence outputs now show a "Refine Guidance" call-to-action prompting users to provide more context.
- **Few-Shot Example Toggle** - Configurable few-shot examples in RAG pipeline for improved output consistency.

### Improvements
- Accessibility: Added `lang="sa"` attribute for Sanskrit text, ARIA labels for interactive elements
- Follow-up input changed from single-line to textarea with Enter key submission

### Technical
- Async follow-up processing: HTTP 202 Accepted, background worker processes LLM, frontend polls for completion
- Rate limiting on follow-up endpoint (30/hour, 3x analyze rate)
- Dedicated error context for follow-up errors with user-friendly messages
- Empty LLM response validation before persisting messages
- Pruned low-value frontend tests to reduce CI time

### Fixes
- Fixed error message context using correct `followUp` handler instead of `caseAnalyze`

## [1.1.0] - 2025-12-07

Post-launch improvements focusing on UX, performance, and robustness.

### Features
- **Mobile-First Redesign** - Responsive navigation with hamburger menu, floating action button
- **Enhanced Verse Browser** - Custom chapter dropdown, infinite scroll, Back to Top button
- **Hindi Translations** - Added Hindi translations from gita/gita repository
- **Load More Pagination** - Replaced infinite scroll with explicit Load More for consultations
- **LLM Robustness** - Three-layer defense architecture for handling incomplete LLM responses
- **Async Follow-ups** - Background processing with inline thinking indicator
- **Guidance Export** - Markdown export with Guidance Summary header

### Improvements
- Redesigned homepage with enhanced feature cards
- Sticky navbar on scroll
- Sanskrit verse formatting with proper danda marks
- Verse detail page with spotlight layout
- Featured verse component for homepage

### Technical
- Rate limiting on analysis endpoint (10/hour)
- Correlation ID logging for request tracing
- Connection pooling for Ollama HTTP client
- Centralized embedding in ChromaDB
- Consolidated database migrations

### Fixes
- Favicon redirect (favicon.ico → favicon.svg)
- Prevent horizontal scrolling on mobile
- Fix N+1 query in verse retrieval
- Suppress 401 errors for anonymous users
- Proper null guards for TypeScript types

### Documentation
- Updated docs for accuracy and consistency
- Fixed Node.js version (18+ → 20+)
- Corrected ingestion command paths

## [1.0.0] - 2025-12-04

First production release of Geetanjali - ethical leadership guidance from the Bhagavad Geeta.

### Features
- **Case Analysis** - Submit ethical dilemmas, receive structured recommendations grounded in Geeta teachings
- **Verse Browser** - Explore 701 verses across 18 chapters with Sanskrit, translations, and commentary
- **RAG Pipeline** - Retrieval-augmented generation ensures responses cite actual scripture
- **User Authentication** - JWT-based auth with session migration for anonymous users
- **Public Sharing** - Share consultations via public links with caching
- **Feedback System** - Thumbs up/down with optional text feedback on responses
- **Contact Form** - Email integration via Resend for user feedback

### Technical
- FastAPI backend with PostgreSQL, Redis, and ChromaDB
- React + TypeScript + Tailwind frontend
- Docker Compose deployment with 7 services
- 65 tests with 52% code coverage
- Configurable LLM providers (Ollama, Anthropic Claude)
- Two-layer caching (Redis + HTTP Cache-Control)

### Security
- CORS with environment-based origins
- CSRF double-submit protection
- Rate limiting on auth endpoints
- Input validation on all API endpoints
- Pre-commit hooks for secret detection
- Soft delete for data recovery

## [0.1.0] - 2025-12-03

### Added
- Core ethical decision support workflow
- Session-based anonymous case creation
- Verse browsing with chapter/verse navigation
- RAG pipeline integration with Ollama LLM
- User authentication with JWT tokens
- Case analysis with Geeta verse recommendations
- Docker Compose deployment configuration

### Security
- CORS configuration with environment-based origins
- Pre-commit hook for secret detection
- Input validation on all API endpoints
- Session-based access control for anonymous users

### Testing
- 65 tests with 52% code coverage
- Tests for auth, cases, messages, outputs, dependencies
- Pytest with coverage reporting

### Documentation
- Setup guide for local development
- Architecture and data source documentation
