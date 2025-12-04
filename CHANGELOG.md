# Changelog

All notable changes to Geetanjali are documented here.

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
- Docker Compose deployment with 8 services
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
