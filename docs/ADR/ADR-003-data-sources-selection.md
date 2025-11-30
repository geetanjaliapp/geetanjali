# ADR-003: Data Sources Selection for Bhagavad Gita Content

**Status:** Accepted
**Date:** 2025-11-30
**Decision Makers:** Engineering Lead
**Tags:** data, licensing, content

## Context

Geetanjali requires authoritative Bhagavad Gita verse data including:
- Sanskrit text (Devanagari and/or IAST transliteration)
- Short English paraphrases (≤25 words)
- Translations from multiple scholars
- Traditional commentaries
- Canonical verse IDs (chapter.verse format)

We need sources that are:
1. Legally usable in an open-source MIT-licensed project
2. Accurate and from reputable sources
3. Structured/machine-readable (JSON preferred)
4. Commercially usable without restrictions
5. Complete (all 700 verses, 18 chapters)

## Decision

We will use a **dual-source strategy**:

### Primary Source: gita/gita Repository
- **License:** The Unlicense (public domain)
- **Usage:** Core verse data structure and canonical IDs
- **URL:** https://github.com/gita/gita

### Secondary Source: VedicScriptures API
- **License:** MIT License
- **Usage:** Translations, commentaries, enrichment
- **URL:** https://github.com/vedicscriptures/bhagavad-gita-api

## Rationale

### Why gita/gita as Primary?
✅ **Unlicense = Maximum Freedom**
- No restrictions whatsoever
- No attribution required (though we provide it)
- Can modify, distribute, commercialize freely
- No copyleft obligations

✅ **JSON Format**
- Ready for direct integration
- Well-structured data
- Easy parsing and validation

✅ **Maintained Repository**
- Active project
- Associated with bhagavadgita.io
- Community-verified

### Why VedicScriptures as Secondary?
✅ **Rich Content**
- 20+ English translations
- Multiple traditional commentaries
- Sanskrit with IAST transliteration
- Scholar attribution and metadata

✅ **MIT License**
- Permissive, commercially usable
- Simple attribution requirement
- Compatible with our MIT license

✅ **API Access**
- RESTful API for programmatic access
- Well-documented
- Free tier available

### Why NOT Other Sources?

**BhagavadGita.io**
❌ Proprietary license
❌ "Cannot charge for content" restriction
❌ Incompatible with open-source

**DharmicData (ODbL-1.0)**
❌ Share-alike copyleft license
❌ Would force our project to use ODbL
❌ Complicates future licensing

**GPL-3.0 Datasets**
❌ Copyleft would require GPL for derivatives
❌ Incompatible with MIT license choice

**CC BY-NC-ND Sources**
❌ Non-commercial restriction
❌ No derivatives allowed
❌ Not suitable for development project

## Implementation Strategy

### Phase 1: Seed Data (Week 1)
1. Clone gita/gita repository
2. Extract 8 core verses from project-description.md:
   - BG 2.47, 3.19, 18.16, 18.63, 4.13, 12.15, 6.5, 16.1-3
3. Create `data/verses/seed-verses.json`
4. Add consulting_principles mappings (original work)

### Phase 2: Full Dataset (Week 2)
1. Import all 700 verses from gita/gita
2. Create database schema
3. Run Alembic migrations
4. Validate completeness

### Phase 3: Enrichment (Week 3)
1. Integrate VedicScriptures API
2. Fetch translations for seed verses
3. Add commentaries from multiple scholars
4. Store with proper attribution

### Phase 4: Validation (Week 4)
1. Cross-reference with DharmicData (reference only)
2. Verify Sanskrit text accuracy
3. Validate canonical IDs
4. Quality assurance audit

## Data Schema

```json
{
  "canonical_id": "BG_2_47",
  "chapter": 2,
  "verse": 47,
  "sanskrit": {
    "devanagari": "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन",
    "iast": "karmaṇy-evādhikāras te, mā phaleṣu kadācana",
    "source": "gita/gita",
    "license": "Unlicense"
  },
  "paraphrase": {
    "en": "Act focused on duty, not fruits.",
    "word_count": 6
  },
  "translations": [
    {
      "language": "en",
      "text": "You have a right to perform your prescribed duty...",
      "translator": "Swami Sivananda",
      "school": "Vedanta",
      "source": "vedicscriptures",
      "license": "MIT"
    }
  ],
  "commentaries": [
    {
      "text": "This verse emphasizes the importance of duty...",
      "author": "Adi Shankaracharya",
      "school": "Advaita Vedanta",
      "source": "vedicscriptures",
      "license": "MIT"
    }
  ],
  "consulting_principles": [
    "duty_focused_action",
    "non_attachment_to_outcomes",
    "ethical_duty_weighting"
  ],
  "metadata": {
    "created_at": "2025-11-30T00:00:00Z",
    "verified": true
  }
}
```

## Consequences

### Positive
✅ Maximum legal freedom (Unlicense primary source)
✅ MIT-compatible enrichment (VedicScriptures)
✅ No licensing conflicts
✅ Commercial use allowed
✅ Rich scholarly content available
✅ Structured JSON data ready to use

### Negative
❌ Need to integrate two sources (more work)
❌ MIT requires attribution tracking
❌ API dependency for enrichment (can cache)

### Neutral
- Ancient Sanskrit is public domain (no issues)
- Consulting principles are original work (our IP)

## Attribution Requirements

### In Code Comments
```python
"""
Bhagavad Gita verse data:
- Core structure: gita/gita (Unlicense)
- Translations: VedicScriptures (MIT License)
See /docs/DATA_SOURCES.md for details
"""
```

### In Documentation
- `/docs/DATA_SOURCES.md` - Full attribution
- `/data/sources.json` - Machine-readable metadata
- README.md - Brief acknowledgment

### In Application UI
- Provenance panel shows source and license per verse
- Footer: "Sanskrit texts are public domain; translations used under MIT License"

## Legal Review

### Ancient Text Copyright Status
- Bhagavad Gita verses (5th c. BCE - 2nd c. CE) = Public domain worldwide
- No copyright can exist on ancient religious texts
- Translations/commentaries may have copyright

### License Compatibility Matrix
| Our License | Source License | Compatible? | Notes |
|-------------|---------------|-------------|-------|
| MIT | Unlicense | ✅ Yes | Perfect compatibility |
| MIT | MIT | ✅ Yes | Same license |
| MIT | ODbL | ❌ No | Copyleft conflict |
| MIT | GPL-3.0 | ❌ No | Copyleft conflict |
| MIT | CC BY-NC | ❌ No | Non-commercial restriction |

## Compliance Checklist

- [x] Primary source identified (gita/gita)
- [x] License verified (Unlicense)
- [x] Secondary source identified (VedicScriptures)
- [x] License verified (MIT)
- [x] Attribution plan created
- [x] Data schema designed
- [ ] LICENSE file includes attribution
- [ ] DATA_SOURCES.md created
- [ ] sources.json metadata created
- [ ] Import scripts include license headers

## Review Schedule

- **Next Review:** After Phase 2 (full dataset imported)
- **Trigger:** If licensing questions arise
- **Legal Review:** Before v1.0 release

## References

- gita/gita: https://github.com/gita/gita
- VedicScriptures: https://github.com/vedicscriptures/bhagavad-gita-api
- The Unlicense: https://unlicense.org/
- MIT License: https://opensource.org/licenses/MIT
- Copyright status of ancient texts: US Copyright Office Circular 33
