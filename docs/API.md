# API Documentation

## Overview

Geetanjali API provides endpoints for managing ethical leadership cases and generating consulting briefs using Bhagavad Geeta wisdom.

**Base URL:** `http://localhost:8000`
**API Version:** v1
**Prefix:** `/api/v1`

## Interactive Documentation

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

## Authentication

**Current:** Simple API key (development)
**Header:** `X-API-Key: your-api-key`

**TODO:** Implement proper JWT authentication in production.

## Endpoints

### Health Checks

#### GET /health
Basic health check.

**Response:**
```json
{
  "status": "healthy",
  "service": "Geetanjali",
  "environment": "development"
}
```

#### GET /health/ready
Readiness probe with dependency checks.

**Response:**
```json
{
  "status": "ready",
  "checks": {
    "database": true,
    "chroma": true,
    "ollama": true
  }
}
```

---

### Cases

#### POST /api/v1/cases
Create a new ethical dilemma case.

**Request Body:**
```json
{
  "title": "Proposed restructuring vs phased approach",
  "description": "We must cut costs; option A is quick layoffs; option B is phased realignment with cost overrun risk.",
  "role": "Senior Manager",
  "stakeholders": ["team", "senior leadership", "customers"],
  "constraints": ["headcount budget: -25%", "quarterly earnings pressure"],
  "horizon": "12 months",
  "sensitivity": "high"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "user_id": "user-uuid",
  "title": "Proposed restructuring vs phased approach",
  "description": "...",
  "role": "Senior Manager",
  "stakeholders": ["team", "senior leadership", "customers"],
  "constraints": ["headcount budget: -25%"],
  "horizon": "12 months",
  "sensitivity": "high",
  "created_at": "2025-11-30T18:00:00Z",
  "updated_at": "2025-11-30T18:00:00Z"
}
```

#### GET /api/v1/cases/{case_id}
Get a case by ID.

**Response:** `200 OK`
```json
{
  "id": "case-uuid",
  "title": "...",
  ...
}
```

#### GET /api/v1/cases
List cases for authenticated user.

**Query Parameters:**
- `skip` (int): Number of records to skip (default: 0)
- `limit` (int): Maximum records to return (default: 100)

**Response:** `200 OK`
```json
[
  {
    "id": "case-uuid-1",
    "title": "...",
    ...
  },
  ...
]
```

---

### Outputs (Consulting Briefs)

#### POST /api/v1/cases/{case_id}/analyze
Analyze a case using the RAG pipeline.

**Process:**
1. Retrieve case from database
2. Search for relevant Geeta verses (vector similarity)
3. Generate consulting brief with LLM
4. Validate output and set confidence score
5. Save output to database

**Response:** `201 Created`
```json
{
  "id": "output-uuid",
  "case_id": "case-uuid",
  "result_json": {
    "executive_summary": "This case involves...",
    "options": [
      {
        "title": "Option A: Immediate Restructuring",
        "description": "Execute rapid 25% headcount reduction...",
        "pros": ["Immediate cost savings", "Clear budget alignment"],
        "cons": ["High human cost", "Team morale damage"],
        "sources": ["BG_2_47"]
      },
      {
        "title": "Option B: Phased Realignment",
        "description": "Gradual role changes...",
        "pros": ["Lower human impact", "Preserves team cohesion"],
        "cons": ["Slower cost savings", "Risk of cost overrun"],
        "sources": ["BG_12_15"]
      },
      {
        "title": "Option C: Hybrid Approach",
        "description": "Targeted immediate reductions plus phased...",
        "pros": ["Balanced approach", "Some immediate relief"],
        "cons": ["Complex to execute", "Still involves layoffs"],
        "sources": ["BG_2_47", "BG_12_15", "BG_18_63"]
      }
    ],
    "recommended_action": {
      "option": 3,
      "steps": [
        "Identify 10% non-core roles for immediate exit",
        "Announce phased 15% reduction via attrition",
        "Communicate transparently with stakeholders",
        "Establish support systems for impacted employees"
      ],
      "sources": ["BG_18_63", "BG_12_15"]
    },
    "reflection_prompts": [
      "How can I minimize harm while fulfilling duty?",
      "What support systems can I create?",
      "How will I maintain trust through this transition?"
    ],
    "sources": [
      {
        "canonical_id": "BG_2_47",
        "paraphrase": "Act focused on duty, not fruits.",
        "relevance": 0.92
      },
      {
        "canonical_id": "BG_12_15",
        "paraphrase": "Compassionate equilibrium in leadership.",
        "relevance": 0.88
      }
    ],
    "confidence": 0.87,
    "scholar_flag": false
  },
  "executive_summary": "This case involves...",
  "confidence": 0.87,
  "scholar_flag": false,
  "created_at": "2025-11-30T18:05:00Z"
}
```

#### GET /api/v1/outputs/{output_id}
Get an output by ID.

**Response:** `200 OK`
```json
{
  "id": "output-uuid",
  "case_id": "case-uuid",
  "result_json": {...},
  ...
}
```

#### GET /api/v1/cases/{case_id}/outputs
List all outputs for a case.

**Response:** `200 OK`
```json
[
  {
    "id": "output-uuid-1",
    "case_id": "case-uuid",
    ...
  },
  ...
]
```

#### POST /api/v1/outputs/{output_id}/scholar-review
Submit scholar review for an output.

**Request Body:**
```json
{
  "approved": true
}
```

**Response:** `200 OK`
```json
{
  "id": "output-uuid",
  "scholar_flag": false,
  "reviewed_by": "scholar-uuid",
  "reviewed_at": "2025-11-30T18:10:00Z",
  ...
}
```

---

### Verses

#### GET /api/v1/verses
Search and filter verses.

**Query Parameters:**
- `q` (string): Search by canonical ID or principle
- `chapter` (int): Filter by chapter (1-18)
- `principles` (string): Comma-separated principle tags
- `skip` (int): Pagination offset
- `limit` (int): Maximum results

**Examples:**
```
GET /api/v1/verses?chapter=2
GET /api/v1/verses?q=BG_2_47
GET /api/v1/verses?principles=duty_focused_action,compassion
```

**Response:** `200 OK`
```json
[
  {
    "id": "verse-uuid",
    "canonical_id": "BG_2_47",
    "chapter": 2,
    "verse": 47,
    "sanskrit_iast": "karmaṇy-evādhikāras te...",
    "paraphrase_en": "Act focused on duty, not fruits.",
    "consulting_principles": ["duty_focused_action", "non_attachment_to_outcomes"],
    "source": "gita/gita",
    "license": "Unlicense",
    "created_at": "2025-11-30T00:00:00Z"
  },
  ...
]
```

#### GET /api/v1/verses/{canonical_id}
Get a verse by canonical ID.

**Response:** `200 OK`
```json
{
  "id": "verse-uuid",
  "canonical_id": "BG_2_47",
  ...
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "BadRequest",
  "message": "Invalid request parameters"
}
```

### 404 Not Found
```json
{
  "error": "NotFound",
  "message": "Case abc123 not found"
}
```

### 422 Validation Error
```json
{
  "error": "ValidationError",
  "message": "Request validation failed",
  "details": [
    {
      "loc": ["body", "title"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

### 500 Internal Server Error
```json
{
  "error": "InternalServerError",
  "message": "An unexpected error occurred",
  "path": "/api/v1/cases/123/analyze"
}
```

### 503 Service Unavailable
```json
{
  "error": "LLMError",
  "message": "LLM request timed out"
}
```

---

## Rate Limiting

**Current:** None (development)
**TODO:** Implement rate limiting for production (e.g., 100 requests/hour per user)

---

## Example Workflow

### Complete Flow: Create Case → Analyze → Review

```bash
# 1. Create a case
curl -X POST http://localhost:8000/api/v1/cases \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Ethical hiring decision",
    "description": "Should we hire a highly skilled candidate with questionable ethics?",
    "role": "HR Manager",
    "sensitivity": "high"
  }'
# Returns: {"id": "case-123", ...}

# 2. Analyze the case
curl -X POST http://localhost:8000/api/v1/cases/case-123/analyze
# Returns: {"id": "output-456", "confidence": 0.85, ...}

# 3. Get the output
curl http://localhost:8000/api/v1/outputs/output-456
# Returns: Full consulting brief with options and recommendations

# 4. Submit scholar review (if needed)
curl -X POST http://localhost:8000/api/v1/outputs/output-456/scholar-review \
  -H "Content-Type: application/json" \
  -d '{"approved": true}'
# Returns: Updated output with scholar approval
```

---

## Performance Notes

- **Analyze endpoint:** May take 5-15 seconds (depends on LLM inference)
- **Vector search:** < 100ms for top-5 retrieval
- **Database queries:** < 50ms average

---

## Future Enhancements

- [ ] JWT authentication
- [ ] Rate limiting per user
- [ ] Webhook notifications for analysis completion
- [ ] Batch analysis endpoint
- [ ] Export to PDF/Word
- [ ] Audit logging for all operations
