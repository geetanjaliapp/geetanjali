---
layout: default
title: API Reference
description: REST API endpoints, authentication, rate limits, and examples for Geetanjali.
---

# API Reference

RESTful API at `/api/v1/`. Full OpenAPI docs at `/docs` when running.

## Authentication

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API
    C->>A: POST /auth/login {email, password}
    A->>C: {access_token} + refresh cookie
    C->>A: GET /cases (Authorization: Bearer token)
    A->>C: 200 OK
    Note over C,A: Token expires (15 min default)
    C->>A: POST /auth/refresh (cookie)
    A->>C: {access_token} (new)
```

**Token Types:**
- **Access Token:** Short-lived JWT (15 min), sent in `Authorization: Bearer` header
- **Refresh Token:** Long-lived (90 days), stored in HTTP-only cookie

**Anonymous Access:**
- Cases, verses, search work without authentication
- User-specific features (history, favorites) require login

**Admin Access:**
- `/admin/*` endpoints require `X-API-Key` header

---

## Rate Limits

| Guard | Limit | Scope | Purpose |
|-------|-------|-------|---------|
| Case analysis (rate) | 3/hour | Per user/IP | 1 consultation every 20 minutes |
| Follow-up questions (rate) | 5/hour | Per user/IP | Natural Q&A conversation pace |
| Daily consultation limit | 20/day | Per user/IP | Cost defense (v1.32.0+) |
| Request token limit | 2000 tokens | Per request | Early rejection of oversized input |
| Question deduplication | 24-hour window | Per case | Prevents accidental repeated questions |

Response codes for rate/limit exceeded:
- **429 Too Many Requests** - Rate limit or daily limit exceeded
- **422 Unprocessable Entity** - Token validation failed, duplicate question, or content policy violation

Response headers include `X-RateLimit-*` when approaching rate limits (not daily limits).

### Cost Defense Examples

**Hourly rate limit exceeded (429):**
```bash
# After 3 analyses in the last hour
curl -X POST http://localhost:8000/api/v1/cases/abc123/analyze/async \
  -H "Authorization: Bearer token"

# Response: 429 Too Many Requests
{
  "detail": "Rate limit exceeded. You can analyze 1 more case at 2024-01-20T15:42:00Z."
}
```

**Daily limit exceeded (429):**
```bash
# After 20 consultations today (UTC)
curl -X POST http://localhost:8000/api/v1/cases \
  -H "Content-Type: application/json" \
  -d '{"title": "Another case", "description": "..."}'

# Response: 429 Too Many Requests
{
  "detail": "Daily reflection pause. You've had 20 consultations today. Rest and reflect—resume tomorrow at 2024-01-21T00:00:00Z."
}
```

**Request token limit exceeded (422):**
```bash
# Description exceeds 2000 tokens (~8000 characters)
curl -X POST http://localhost:8000/api/v1/cases \
  -H "Content-Type: application/json" \
  -d '{"title": "Case", "description": "[very long text >8000 chars]"}'

# Response: 422 Unprocessable Entity
{
  "detail": "Your question is too detailed (2847 tokens). Please simplify to under 2000 tokens."
}
```

**Duplicate question (422):**
```bash
# Asked exact same follow-up within 24 hours
curl -X POST http://localhost:8000/api/v1/cases/abc123/follow-up \
  -H "Authorization: Bearer token" \
  -d '{"content": "What should I do?"}'

# Response: 422 Unprocessable Entity
{
  "detail": "You've already asked this question in this conversation. Try rephrasing your question or explore a different angle."
}
```

### Session Tracking

When using the API without authentication, rate limits are scoped to IP address. For authenticated requests, limits are scoped to the authenticated user. For anonymous consultations, use the `X-Session-ID` header to maintain per-session limits:

```bash
curl -X POST http://localhost:8000/api/v1/cases \
  -H "Content-Type: application/json" \
  -H "X-Session-ID: my-session-12345" \
  -d '{"title": "Case", "description": "..."}'
```

---

## Endpoints

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/signup` | Create account |
| POST | `/auth/login` | Login, get tokens |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Invalidate refresh token |
| POST | `/auth/forgot-password` | Request reset email |
| POST | `/auth/reset-password` | Reset with token |
| GET | `/auth/me` | Get current user |
| DELETE | `/auth/account` | Delete account |
| POST | `/auth/verify-email/{token}` | Verify email address |
| POST | `/auth/resend-verification` | Resend verification email |

**Signup Example:**
```bash
curl -X POST http://localhost:8000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "yourpassword", "name": "Your Name"}'
```

### Cases

| Method | Path | Description |
|--------|------|-------------|
| GET | `/cases` | List user's cases |
| POST | `/cases` | Create new case |
| GET | `/cases/{id}` | Get case details |
| PATCH | `/cases/{id}` | Update case |
| DELETE | `/cases/{id}` | Delete case |
| POST | `/cases/{id}/analyze/async` | Start analysis (async) |
| POST | `/cases/{id}/follow-up` | Ask follow-up question |

**Create Case:**
```bash
curl -X POST http://localhost:8000/api/v1/cases \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Layoff Decision",
    "description": "Should I lay off 20% of staff to save the company?"
  }'
```

**Analyze Case (Async):**
```bash
# Start analysis - returns 202 Accepted
curl -X POST http://localhost:8000/api/v1/cases/{id}/analyze/async

# Poll for completion
curl http://localhost:8000/api/v1/cases/{id}
# status: "completed" when done
```

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Create case
    DRAFT --> PENDING: Submit for analysis
    PENDING --> PROCESSING: Worker picks up
    PROCESSING --> COMPLETED: Success
    PROCESSING --> FAILED: Error
    PROCESSING --> POLICY_VIOLATION: Content blocked
    FAILED --> DRAFT: Retry
    COMPLETED --> [*]
```

### Verses

| Method | Path | Description |
|--------|------|-------------|
| GET | `/verses` | List verses (paginated) |
| GET | `/verses/{ref}` | Get single verse (e.g., BG_2_47) |
| GET | `/verses/daily` | Today's verse |
| GET | `/verses/random` | Random verse |
| GET | `/verses/count` | Total verse count |
| GET | `/verses/batch` | Batch get verses by IDs |

**Query Parameters:**
- `chapter`: Filter by chapter (1-18)
- `featured`: Only featured verses
- `skip`, `limit`: Pagination

**Get Verse:**
```bash
curl http://localhost:8000/api/v1/verses/BG_2_47
```

### Search

| Method | Path | Description |
|--------|------|-------------|
| GET | `/search` | Search verses |
| GET | `/search/principles` | List searchable principles |

**Search Parameters:**
- `q`: Query text (required)
- `chapter`: Filter by chapter
- `principle`: Filter by principle category
- `limit`: Results per page (default 20)

```bash
curl "http://localhost:8000/api/v1/search?q=karma&chapter=2"
```

### Outputs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/outputs/{id}` | Get analysis output |
| POST | `/outputs/{id}/feedback` | Submit feedback |
| GET | `/outputs/{id}/export/{format}` | Export (pdf, md, json) |

### Messages

| Method | Path | Description |
|--------|------|-------------|
| GET | `/cases/{id}/messages` | Get conversation history |

### Newsletter

| Method | Path | Description |
|--------|------|-------------|
| POST | `/newsletter/subscribe` | Subscribe to daily verse |
| POST | `/newsletter/verify/{token}` | Verify subscription |
| POST | `/newsletter/unsubscribe` | Unsubscribe |
| GET | `/newsletter/status` | Check subscription status |
| GET | `/newsletter/preferences` | Get preferences |
| PUT | `/newsletter/preferences` | Update preferences |

### User Preferences

| Method | Path | Description |
|--------|------|-------------|
| GET | `/preferences` | Get reading progress, favorites, settings |
| PUT | `/preferences` | Update preferences |
| POST | `/preferences/merge` | Merge local and server preferences |

### Reading Metadata

| Method | Path | Description |
|--------|------|-------------|
| GET | `/reading/book` | Get book metadata |
| GET | `/reading/chapters` | Get all chapter metadata |
| GET | `/reading/chapters/{n}` | Get specific chapter metadata |

### Text-to-Speech (TTS)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/tts` | Generate audio from text |
| GET | `/tts/voices` | Get available voices |

**Generate Audio:**
```bash
curl -X POST http://localhost:8000/api/v1/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन",
    "lang": "hi",
    "rate": "+0%",
    "pitch": "+0Hz"
  }' \
  --output audio.mp3
```

**Parameters:**
- `text` (required): Text to speak (max 5000 chars)
- `lang`: Language code (`en` or `hi`, default: `en`)
- `rate`: Speech rate (`-50%` to `+100%`, default: `+0%`)
- `pitch`: Voice pitch (`-50Hz` to `+50Hz`, default: `+0Hz`)

**Response:** MP3 audio stream with headers:
- `Content-Type: audio/mpeg`
- `X-Cache: HIT` or `MISS`

**Rate Limit:** 30 requests/minute

### Admin (Requires X-API-Key)

> **Note**: Sync endpoints are rarely needed—startup sync handles everything automatically.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/status` | System health status |
| POST | `/admin/ingest` | Trigger data ingestion |
| POST | `/admin/sync-featured` | Sync featured verses |
| POST | `/admin/sync-metadata` | Sync book/chapter metadata |
| POST | `/admin/sync-dhyanam` | Sync Geeta Dhyanam verses |
| POST | `/admin/sync-audio-metadata` | Sync verse audio metadata |
| POST | `/admin/enrich` | Enrich verse metadata |
| GET | `/admin/seo/status` | SEO generation status |
| POST | `/admin/seo/generate` | Trigger SEO page generation |
| POST | `/admin/seo/generate/async` | Queue SEO generation (background) |

```bash
curl -H "X-API-Key: your-api-key" \
  http://localhost:8000/api/v1/admin/status
```

### Public Endpoints

These endpoints are at the root level (not under `/api/v1/`):

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/sitemap.xml` | XML sitemap |
| GET | `/feed.xml` | RSS feed |
| POST | `/api/v1/contact` | Contact form |

---

## Response Format

**Success:**
```json
{
  "id": "uuid",
  "title": "Case Title",
  "status": "completed",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Error:**
```json
{
  "detail": "Case not found"
}
```

**Paginated:**
```json
{
  "items": [...],
  "total": 100,
  "skip": 0,
  "limit": 20
}
```

---

## Webhooks

Currently no webhooks. Use polling for async operations:

1. POST `/cases/{id}/analyze/async` → 202 Accepted
2. Poll GET `/cases/{id}` until `status` is `completed` or `failed`

---

## See Also

- [Architecture](architecture.md) — System design and data flow
- [Reference](reference.md) — Environment variables and error codes
- OpenAPI docs at `/docs` when running
