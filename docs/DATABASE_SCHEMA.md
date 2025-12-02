# Database Schema Design

## Overview

Geetanjali uses a relational database (SQLite for development, PostgreSQL for production) to store cases, outputs, verses, and user data.

## Entity Relationship Diagram

```
┌─────────────┐       ┌──────────────┐       ┌─────────────┐
│    users    │───────│    cases     │───────│   outputs   │
└─────────────┘  1:N  └──────────────┘  1:N  └─────────────┘
                              │
                              │ N:M
                              ▼
                       ┌──────────────┐
                       │    verses    │
                       └──────────────┘
                              │ 1:N
                              ▼
                       ┌──────────────┐
                       │ commentaries │
                       └──────────────┘
```

## Tables

### users
Stores user information for authentication and case ownership.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100),  -- e.g., 'Senior Manager', 'HR Lead'
    org_id VARCHAR(100),
    api_key VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_api_key ON users(api_key);
```

**Fields:**
- `id`: Unique identifier (UUID)
- `email`: User email (unique, for login)
- `name`: Full name
- `role`: Job role (optional)
- `org_id`: Organization identifier (optional)
- `api_key`: API key for authentication
- `created_at`: Account creation timestamp
- `updated_at`: Last update timestamp

---

### cases
Stores ethical dilemma cases submitted by users.

```sql
CREATE TABLE cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    role VARCHAR(100),
    stakeholders JSONB,  -- Array of stakeholder names
    constraints JSONB,   -- Array of constraint descriptions
    horizon VARCHAR(50), -- 'short', 'medium', 'long'
    sensitivity VARCHAR(50) DEFAULT 'low', -- 'low', 'medium', 'high'
    attachments JSONB,   -- Optional URLs or text blobs
    locale VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cases_user_id ON cases(user_id);
CREATE INDEX idx_cases_created_at ON cases(created_at DESC);
CREATE INDEX idx_cases_sensitivity ON cases(sensitivity);
```

**Fields:**
- `id`: Unique identifier (UUID)
- `user_id`: Foreign key to users table
- `title`: Short problem title
- `description`: Detailed problem statement
- `role`: Requester's role
- `stakeholders`: JSON array of affected parties
- `constraints`: JSON array of hard constraints
- `horizon`: Time horizon (short/medium/long)
- `sensitivity`: Sensitivity level
- `attachments`: Optional supporting documents
- `locale`: Language/locale preference
- `created_at`: Case creation timestamp
- `updated_at`: Last update timestamp

---

### outputs
Stores generated consulting briefs (RAG pipeline outputs).

```sql
CREATE TABLE outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    result_json JSONB NOT NULL,  -- Full output structure
    executive_summary TEXT,
    confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
    scholar_flag BOOLEAN DEFAULT FALSE,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_outputs_case_id ON outputs(case_id);
CREATE INDEX idx_outputs_scholar_flag ON outputs(scholar_flag);
CREATE INDEX idx_outputs_confidence ON outputs(confidence);
```

**Fields:**
- `id`: Unique identifier (UUID)
- `case_id`: Foreign key to cases table
- `result_json`: Complete output (executive summary, options, recommendations, sources)
- `executive_summary`: Extracted for quick display
- `confidence`: Confidence score (0.0 - 1.0)
- `scholar_flag`: Requires scholar review if true
- `reviewed_by`: User ID of reviewer (if applicable)
- `reviewed_at`: Review timestamp
- `created_at`: Output generation timestamp

**result_json Structure:**
```json
{
  "executive_summary": "...",
  "options": [
    {
      "title": "Option 1",
      "description": "...",
      "pros": ["..."],
      "cons": ["..."],
      "sources": ["BG_2_47", "BG_3_19"]
    }
  ],
  "recommended_action": {
    "option": 1,
    "steps": ["Step 1", "Step 2"],
    "sources": ["BG_18_63"]
  },
  "reflection_prompts": ["Prompt 1", "Prompt 2"],
  "sources": [
    {
      "canonical_id": "BG_2_47",
      "paraphrase": "...",
      "relevance": 0.95
    }
  ],
  "confidence": 0.85,
  "scholar_flag": false
}
```

---

### verses
Stores Bhagavad Geeta verses with Sanskrit text and metadata.

```sql
CREATE TABLE verses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_id VARCHAR(20) UNIQUE NOT NULL,  -- e.g., 'BG_2_47'
    chapter INTEGER NOT NULL CHECK (chapter >= 1 AND chapter <= 18),
    verse INTEGER NOT NULL CHECK (verse >= 1),
    sanskrit_iast TEXT,
    sanskrit_devanagari TEXT,
    paraphrase_en TEXT,
    consulting_principles JSONB,  -- Array of principle tags
    source VARCHAR(255),
    license VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chapter, verse)
);

CREATE INDEX idx_verses_canonical_id ON verses(canonical_id);
CREATE INDEX idx_verses_chapter ON verses(chapter);
CREATE INDEX idx_verses_consulting_principles ON verses USING GIN (consulting_principles);
```

**Fields:**
- `id`: Unique identifier (UUID)
- `canonical_id`: Canonical verse ID (e.g., BG_2_47)
- `chapter`: Chapter number (1-18)
- `verse`: Verse number within chapter
- `sanskrit_iast`: Sanskrit in IAST transliteration
- `sanskrit_devanagari`: Sanskrit in Devanagari script
- `paraphrase_en`: Short English paraphrase (≤25 words)
- `consulting_principles`: JSON array of principle tags
- `source`: Data source identifier
- `license`: License information
- `created_at`: Creation timestamp

---

### commentaries
Stores scholarly commentaries on verses.

```sql
CREATE TABLE commentaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verse_id UUID REFERENCES verses(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    author VARCHAR(255),
    school VARCHAR(100),  -- e.g., 'Advaita Vedanta', 'Vishishtadvaita'
    translator VARCHAR(255),
    source VARCHAR(255),
    license VARCHAR(100),
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_commentaries_verse_id ON commentaries(verse_id);
CREATE INDEX idx_commentaries_author ON commentaries(author);
CREATE INDEX idx_commentaries_school ON commentaries(school);
```

**Fields:**
- `id`: Unique identifier (UUID)
- `verse_id`: Foreign key to verses table
- `text`: Commentary text
- `author`: Original author (e.g., Shankaracharya)
- `school`: Philosophical school
- `translator`: Translator name (if applicable)
- `source`: Data source identifier
- `license`: License information
- `language`: Language code
- `created_at`: Creation timestamp

---

### translations
Stores multiple translations of verses.

```sql
CREATE TABLE translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verse_id UUID REFERENCES verses(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    translator VARCHAR(255),
    school VARCHAR(100),
    source VARCHAR(255),
    license VARCHAR(100),
    year INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_translations_verse_id ON translations(verse_id);
CREATE INDEX idx_translations_translator ON translations(translator);
CREATE INDEX idx_translations_language ON translations(language);
```

**Fields:**
- `id`: Unique identifier (UUID)
- `verse_id`: Foreign key to verses table
- `text`: Full translation text
- `language`: Language code (ISO 639-1)
- `translator`: Translator name
- `school`: Philosophical school
- `source`: Data source identifier
- `license`: License information
- `year`: Publication year (if known)
- `created_at`: Creation timestamp

---

## Junction Tables

### case_verses (Many-to-Many)
Links cases to verses retrieved by RAG pipeline.

```sql
CREATE TABLE case_verses (
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    verse_id UUID REFERENCES verses(id) ON DELETE CASCADE,
    relevance_score FLOAT CHECK (relevance_score >= 0 AND relevance_score <= 1),
    retrieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (case_id, verse_id)
);

CREATE INDEX idx_case_verses_relevance ON case_verses(relevance_score DESC);
```

---

## Views

### case_summary
Convenient view combining case and output data.

```sql
CREATE VIEW case_summary AS
SELECT
    c.id AS case_id,
    c.title,
    c.description,
    c.sensitivity,
    c.created_at AS case_created,
    o.id AS output_id,
    o.executive_summary,
    o.confidence,
    o.scholar_flag,
    o.created_at AS output_created,
    u.name AS user_name,
    u.role AS user_role
FROM cases c
LEFT JOIN outputs o ON c.id = o.case_id
LEFT JOIN users u ON c.user_id = u.id;
```

---

## Data Types

### SQLite (Development)
- `UUID` → `TEXT` (store as string)
- `JSONB` → `TEXT` (store as JSON string)
- `TIMESTAMP` → `TEXT` (ISO 8601 format)
- `gen_random_uuid()` → Generate in application code

### PostgreSQL (Production)
- Native `UUID` type with `gen_random_uuid()`
- Native `JSONB` type with indexing support
- Native `TIMESTAMP WITH TIME ZONE`
- GIN indexes for JSONB columns

---

## Migrations Strategy

Using **Alembic** for schema migrations:

```bash
# Initialize Alembic
alembic init alembic

# Create new migration
alembic revision --autogenerate -m "Add users and cases tables"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1
```

---

## Seed Data

Initial seed data (8 core verses) located in:
- `/data/verses/seed-verses.json`

Load with:
```bash
python scripts/load_seed_data.py
```

---

## Indexes Summary

**Performance-critical indexes:**
- `users.email` (login lookups)
- `users.api_key` (API authentication)
- `cases.user_id` (user's cases)
- `outputs.case_id` (case outputs)
- `verses.canonical_id` (verse lookups)
- `verses.consulting_principles` (GIN for JSONB search)
- `commentaries.verse_id` (verse commentaries)

---

## Data Integrity

**Constraints:**
- `ON DELETE CASCADE` for dependent records
- `UNIQUE` constraints on email, api_key, canonical_id
- `CHECK` constraints for valid ranges (confidence, chapter, verse)
- Foreign key constraints for referential integrity

---

## Backup Strategy (Production)

```bash
# PostgreSQL backup
pg_dump geetanjali > backup_$(date +%Y%m%d).sql

# Restore
psql geetanjali < backup_20251130.sql
```

---

## Performance Considerations

- Use connection pooling (SQLAlchemy default: 5-10 connections)
- Index JSONB columns for frequently queried fields
- Partition `outputs` table if volume grows (by created_at)
- Use materialized views for complex aggregations
- Regular `VACUUM` and `ANALYZE` on PostgreSQL

---

## Security

- No plain-text passwords (use hashed API keys)
- Parameterized queries (SQLAlchemy ORM prevents SQL injection)
- Row-level security for multi-tenant scenarios (future)
- Encrypted connections in production (SSL/TLS)
