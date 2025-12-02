# Data Sources - Bhagavad Geeta Content

## Primary Sources

### 1. gita/gita Repository (PRIMARY)
- **URL:** https://github.com/gita/gita
- **License:** The Unlicense (Public Domain)
- **Usage:** Core verse data structure
- **Content:** Complete Bhagavad Geeta (700 verses, 18 chapters)
- **Format:** JSON
- **Attribution:** Not required (Unlicense), but provided for transparency

### 2. VedicScriptures API (SECONDARY)
- **URL:** https://github.com/vedicscriptures/bhagavad-gita-api
- **API:** https://vedicscriptures.github.io/
- **License:** MIT License
- **Usage:** Translations, commentaries, and enrichment
- **Content:**
  - Sanskrit (Devanagari + IAST transliteration)
  - 20+ English translations
  - Traditional commentaries (Shankaracharya, Ramanuja, etc.)
- **Attribution Required:** Yes (MIT License)

## Ancient Sanskrit Text

The original Bhagavad Geeta verses (700 shlokas) are ancient public domain texts dating from approximately 5th century BCE to 2nd century CE. These are freely usable worldwide without copyright restrictions.

## Attribution

### Code/Data Structure
```
Verse data structure: gita/gita repository (Unlicense)
https://github.com/gita/gita
```

### Translations & Commentaries
```
English translations and commentaries: VedicScriptures
https://github.com/vedicscriptures/bhagavad-gita-api
Licensed under MIT License
```

## License Compliance

### The Unlicense (gita/gita)
- No restrictions
- No attribution required
- Public domain equivalent
- Complete freedom to use, modify, distribute

### MIT License (VedicScriptures)
- Permissive license
- Attribution required
- Commercial use allowed
- Modification allowed
- Must include license text

## Data Quality Assurance

### Verification Sources (Reference Only)
- **DharmicData:** https://github.com/bhavykhatri/DharmicData (ODbL-1.0)
- **Sanskrit Documents:** https://sanskritdocuments.org/
- Cross-referenced for accuracy; not used as primary source due to licensing

## Consulting Principles Mapping

Consulting principles extracted from verses are original work of the Geetanjali project, based on scholarly interpretation of the teachings. These mappings are:
- Original to this project
- Licensed under project's MIT License
- Based on public domain source material

## File Locations

- Seed data: `/data/verses/seed-verses.json`
- Full verse database: Stored in PostgreSQL
- Vector embeddings: Stored in ChromaDB
- Source metadata: `/data/sources.json`
