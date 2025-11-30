# Data Management - Verse Ingestion & Validation

## Overview

This document describes the process of ingesting, validating, and managing Bhagavad Gita verse data in Geetanjali.

## Data Sources

See [DATA_SOURCES.md](DATA_SOURCES.md) for detailed information about data sources and licensing.

**Primary Sources:**
- `gita/gita` repository (Unlicense) - Core verse structure
- `vedicscriptures` API (MIT License) - Translations and commentaries

## Verse Data Schema

### JSON Structure

```json
{
  "canonical_id": "BG_2_47",
  "chapter": 2,
  "verse": 47,
  "sanskrit": {
    "iast": "karmaṇy-evādhikāras te, mā phaleṣu kadācana",
    "source": "Ancient public domain text",
    "license": "Public Domain"
  },
  "paraphrase": {
    "en": "Act focused on duty, not fruits.",
    "word_count": 6
  },
  "consulting_principles": [
    "duty_focused_action",
    "non_attachment_to_outcomes"
  ],
  "metadata": {
    "created_at": "2025-11-30T00:00:00Z",
    "verified": true,
    "priority": "high"
  }
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `canonical_id` | string | Yes | Format: `BG_{chapter}_{verse}` |
| `chapter` | integer | Yes | Chapter number (1-18) |
| `verse` | integer | Yes | Verse number (≥ 1) |
| `sanskrit.iast` | string | Yes | Sanskrit in IAST transliteration |
| `sanskrit.source` | string | Yes | Data source identifier |
| `sanskrit.license` | string | Yes | License type |
| `paraphrase.en` | string | Yes | English paraphrase (≤ 25 words) |
| `paraphrase.word_count` | integer | Yes | Actual word count |
| `consulting_principles` | array | Yes | Array of principle tags |
| `metadata.created_at` | string | Yes | ISO 8601 timestamp |
| `metadata.verified` | boolean | Yes | Verification status |

## Validation Rules

### 1. Canonical ID Format
- Must match pattern: `BG_{chapter}_{verse}`
- Example: `BG_2_47` for Chapter 2, Verse 47
- Must be unique across all verses

### 2. Chapter Range
- Must be integer between 1 and 18 (inclusive)
- Bhagavad Gita has exactly 18 chapters

### 3. Verse Number
- Must be positive integer (≥ 1)
- Varies by chapter (Chapter 1 has 47 verses, Chapter 2 has 72, etc.)

### 4. Paraphrase Length
- **Recommended:** ≤ 25 words
- Word count must match declared count
- Should be concise and capture essence

### 5. Data Integrity
- No duplicate canonical IDs
- All required fields present
- Correct data types for all fields

## Verse Validation

### Running Validation

```bash
# Validate seed verses
python scripts/validate_verses.py

# Expected output:
# 🔍 Validating: data/verses/seed-verses.json
#
# ✅ All validations passed!
```

### Validation Script

Location: `/scripts/validate_verses.py`

**What it checks:**
- JSON structure validity
- Required fields presence
- Field type correctness
- Canonical ID format
- Chapter/verse number ranges
- Paraphrase word count
- Duplicate detection

**Exit codes:**
- `0` - All validations passed
- `1` - Validation failed

## Database Ingestion

### Initial Setup

```bash
# 1. Initialize database with schema and seed data
python scripts/init_db.py

# Output:
# 🚀 Initializing Geetanjali database...
# 📍 Database: sqlite:///./geetanjali.db
# 📊 Creating database schema...
#   ✅ Schema created
# 📖 Loading seed verses...
#   ✅ Loaded BG_2_47
#   ✅ Loaded BG_3_19
#   ... (8 verses)
#   ✅ Loaded 8 verses
# 👤 Creating test user...
#   ✅ Created test user: dev@geetanjali.local
# ✅ Database initialization complete!
```

### Using Alembic Migrations

```bash
# Check current migration version
alembic current

# View migration history
alembic history

# Apply all pending migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# Create new migration (after model changes)
alembic revision --autogenerate -m "Description of changes"
```

## Seed Data

### Current Seed Verses

Location: `/data/verses/seed-verses.json`

**Included verses (8 total):**
1. BG 2.47 - Duty-focused action
2. BG 3.19 - Consistent duty performance
3. BG 18.16 - Knowledge and self-control
4. BG 18.63 - Informed decision-making
5. BG 4.13 - Role-fit for leaders
6. BG 12.15 - Compassionate equilibrium
7. BG 6.5 - Self-responsibility
8. BG 16.1 - Divine character traits

### Adding New Verses

1. **Create JSON entry**
   ```json
   {
     "canonical_id": "BG_X_Y",
     "chapter": X,
     "verse": Y,
     ...
   }
   ```

2. **Validate**
   ```bash
   python scripts/validate_verses.py
   ```

3. **Load into database**
   ```bash
   python scripts/init_db.py
   # Or manually with Python:
   # from scripts.init_db import load_seed_verses
   ```

## Consulting Principles

### Principle Tags

Consulting principles are original work of the Geetanjali project, mapping verses to leadership concepts.

**Current principles:**
- `duty_focused_action` - Focus on duty, not outcomes
- `non_attachment_to_outcomes` - Detachment from results
- `ethical_duty_weighting` - Ethical considerations in decisions
- `consistent_duty_performance` - Consistency in execution
- `process_over_impulsive_gains` - Long-term thinking
- `leader_self_control` - Self-regulation for leaders
- `clarity_in_decision_making` - Clear-minded decisions
- `integrity` - Moral uprightness
- `informed_decision_making` - Knowledge-based choices
- `autonomous_choice` - Independent decision-making
- `role_fit_for_leaders` - Matching roles to capabilities
- `compassion_as_leadership_value` - Empathy in leadership
- `harm_minimization` - Reducing negative impact
- `self_responsibility` - Personal accountability
- `example_setting_by_leaders` - Leading by example
- `ethical_character_traits` - Virtuous qualities
- `filter_actions_by_virtue` - Ethical screening

### Adding New Principles

1. Define in verse JSON: `"consulting_principles": ["new_principle"]`
2. Document in this file
3. Use in RAG pipeline for retrieval

## Data Enrichment (Future)

### Phase 2: Full Verse Set

```bash
# Script to import all 700 verses from gita/gita
python scripts/import_full_gita.py

# Source: https://github.com/gita/gita
# License: Unlicense
```

### Phase 3: Translations

```bash
# Script to fetch translations from VedicScriptures API
python scripts/import_translations.py --verses BG_2_47 BG_3_19

# Source: https://vedicscriptures.github.io/
# License: MIT (attribution required)
```

### Phase 4: Commentaries

```bash
# Script to fetch commentaries
python scripts/import_commentaries.py --scholars "Shankaracharya,Ramanuja"
```

## Database Schema

### Verses Table

```sql
CREATE TABLE verses (
    id TEXT PRIMARY KEY,
    canonical_id TEXT UNIQUE NOT NULL,
    chapter INTEGER NOT NULL CHECK (chapter >= 1 AND chapter <= 18),
    verse INTEGER NOT NULL CHECK (verse >= 1),
    sanskrit_iast TEXT,
    sanskrit_devanagari TEXT,
    paraphrase_en TEXT,
    consulting_principles JSON,
    source TEXT,
    license TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
```

### Related Tables

- `commentaries` - Scholarly interpretations (1:N with verses)
- `translations` - Multiple translations (1:N with verses)

See [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) for complete schema.

## Quality Assurance

### Verification Checklist

Before loading new verses:

- [ ] JSON structure valid
- [ ] All required fields present
- [ ] Canonical ID format correct
- [ ] Chapter in range (1-18)
- [ ] Verse number positive
- [ ] Paraphrase ≤ 25 words
- [ ] Word count accurate
- [ ] No duplicates
- [ ] Source documented
- [ ] License specified
- [ ] Consulting principles defined
- [ ] Validation script passes

### Data Quality Metrics

Track in `/data/quality_metrics.json`:

```json
{
  "total_verses": 8,
  "verified_verses": 8,
  "avg_paraphrase_length": 5.8,
  "last_validated": "2025-11-30T00:00:00Z",
  "sources": {
    "gita/gita": 8,
    "vedicscriptures": 0
  }
}
```

## Troubleshooting

### Common Issues

**1. Validation fails with "Missing required field"**
```bash
# Check JSON structure matches schema
cat data/verses/seed-verses.json | jq '.[0]'
```

**2. Database initialization fails**
```bash
# Check if database file is locked
rm geetanjali.db
python scripts/init_db.py
```

**3. Duplicate canonical_id error**
```bash
# Find duplicates
cat data/verses/seed-verses.json | jq '.[].canonical_id' | sort | uniq -d
```

**4. Word count mismatch**
```bash
# Count words in paraphrase
echo "Act focused on duty, not fruits." | wc -w
# Should match paraphrase.word_count
```

## Best Practices

1. **Always validate before loading**
   ```bash
   python scripts/validate_verses.py && python scripts/init_db.py
   ```

2. **Use version control for data**
   - Commit verse JSON files to git
   - Document changes in commit messages
   - Track data lineage

3. **Document data sources**
   - Update DATA_SOURCES.md
   - Include license information
   - Note any modifications

4. **Test with seed data first**
   - Verify pipeline with 8 seed verses
   - Scale to full dataset after validation

5. **Backup before bulk operations**
   ```bash
   cp geetanjali.db geetanjali.db.backup
   ```

## References

- [DATA_SOURCES.md](DATA_SOURCES.md) - Data source documentation
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Database schema
- [ADR-003](ADR/ADR-003-data-sources-selection.md) - Data sources decision
- Validation script: `/scripts/validate_verses.py`
- Initialization script: `/scripts/init_db.py`
