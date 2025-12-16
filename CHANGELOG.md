# Changelog

All notable changes to Geetanjali are documented here.

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
