# Changelog

All notable changes to Geetanjali are documented here.

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
