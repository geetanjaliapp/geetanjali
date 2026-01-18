---
layout: default
title: SEO
description: Search engine optimization through bot-served static HTML.
---

# SEO & Discoverability

Bot-served static HTML for search engines while preserving SPA experience for users.

## Approach

Geetanjali uses **User-Agent detection** to serve different content to bots vs users:

```
Request → Nginx → User-Agent check
                       │
         ┌─────────────┴─────────────┐
         │                           │
         ▼                           ▼
       Bot?                       Human?
         │                           │
         ▼                           ▼
   /seo/*.html                 /index.html
   (semantic HTML)              (React SPA)
```

**Why this approach:**
- No prerendering complexity or SSR infrastructure
- Build-time generation (fast, no runtime overhead)
- Complete separation of bot and user experiences
- Zero impact on SPA performance

## What Gets Generated

Post-deploy generation creates ~750+ static pages:

| Content | Pages | Priority |
|---------|-------|----------|
| Homepage | 1 | 1.0 |
| About | 1 | 0.8 |
| Verse index | 1 | 0.9 |
| Chapter pages | 18 | 0.8 |
| Verse detail | 701 | 0.6 |
| Topic pages | 16 | 0.7 |
| Topics index | 1 | 0.8 |
| Featured verses | 1 | 0.7 |
| Daily verse | 1 | 0.7 |
| 404 error | 1 | — |
| sitemap.xml | 1 | — |

Each page includes:
- Semantic HTML5 structure
- Open Graph and Twitter Card meta tags
- Schema.org JSON-LD structured data
- Full verse content (Sanskrit, transliteration, translations)
- Internal links using SPA routes (bot clicks → user gets SPA)

## Implementation

### Post-Deploy Generation

SEO pages are generated **after deployment** via the backend service:

```bash
# Triggered automatically via GitHub Actions after deploy
curl -X POST https://geetanjaliapp.com/api/v1/seo/generate \
  -H "Authorization: Bearer $API_KEY"
```

The `SeoGeneratorService` uses:
- **PostgreSQL advisory locks** for concurrency protection
- **Hash-based change detection** to only regenerate modified pages
- **Atomic file writes** (temp file + rename) to prevent partial content
- **Gzip pre-compression** for nginx gzip_static

### Code Location

```
backend/services/seo/
├── __init__.py        # Service exports
├── generator.py       # Main SeoGeneratorService
└── hash_utils.py      # Hash computation utilities
```

### Nginx Routing

```nginx
# Bot detection map
map $http_user_agent $is_bot {
    default 0;
    ~*googlebot 1;
    ~*bingbot 1;
    # ... 15+ bot patterns
}

# Verse pages - bots get SEO HTML
location ~ ^/verses/(BG_\d+_\d+)$ {
    if ($is_bot) {
        rewrite ^/verses/(BG_\d+_\d+)$ /seo/verses/$1.html break;
    }
    try_files $uri /index.html;
}
```

### Content Source

JSON files in `frontend/src/content/` serve as single source of truth for both React components and SEO templates:

```
frontend/src/content/
├── meta.json    # Site-wide SEO, navigation
├── home.json    # Homepage content
└── about.json   # About page content
```

## Bot Infrastructure

### robots.txt

```
User-agent: *
Allow: /
Allow: /about
Allow: /verses
Allow: /read
Disallow: /api/
Disallow: /cases/
Disallow: /login
...
Sitemap: https://geetanjaliapp.com/sitemap.xml
```

### Sitemap

Generated at build time with ~725 URLs:
- Static pages (/, /about, /verses, /read)
- 18 chapter pages (/verses/chapter/1-18)
- 701 verse pages (/verses/BG_*_*)

Includes lastmod, changefreq, and priority for each URL.

### 404 Handling

Bots get `/seo/404.html` for missing pages. Users get SPA (React router handles display).

## Search Engine Registration

| Engine | Status | Method |
|--------|--------|--------|
| Google Search Console | Verified | DNS |
| Bing Webmaster Tools | Verified | Imported from GSC |

## Files

| File | Purpose |
|------|---------|
| `backend/services/seo/generator.py` | Post-deploy page generator |
| `backend/services/seo/hash_utils.py` | Hash computation for change detection |
| `backend/templates/seo/*.html` | Jinja2 templates |
| `backend/utils/metrics_seo.py` | Prometheus metrics |
| `frontend/nginx.conf` | Bot detection and routing |
| `frontend/public/robots.txt` | Crawler directives |
| `frontend/public/og-image.png` | Social share image |
| `monitoring/grafana/dashboards/geetanjali-seo.json` | Grafana dashboard |

## Quick Verification

```bash
# Bot sees semantic HTML
curl -H "User-Agent: Googlebot" https://geetanjaliapp.com/verses/BG_2_47

# User sees SPA
curl https://geetanjaliapp.com/verses/BG_2_47

# Topics page (bot)
curl -H "User-Agent: Googlebot" https://geetanjaliapp.com/topics/dharma

# Daily verse (bot)
curl -H "User-Agent: Googlebot" https://geetanjaliapp.com/daily
```

## Post-Deploy Verification Checklist

After deploying SEO changes, verify the following:

### 1. Generation Success

```bash
# Check generation status via API
curl https://geetanjaliapp.com/api/v1/seo/status

# Expected response includes:
# - pages_by_type: counts for each page type
# - total_pages: ~750+
# - last_generated_at: recent timestamp
```

### 2. Prometheus Metrics

Check the `/metrics` endpoint for SEO metrics:

```
# Generation health
geetanjali_seo_generation_last_success_timestamp
geetanjali_seo_generation_last_duration_seconds
geetanjali_seo_generation_pages_errors

# Page counts by type
geetanjali_seo_pages_total{page_type="verse"}
geetanjali_seo_pages_total{page_type="chapter"}
geetanjali_seo_pages_total{page_type="topic"}
```

### 3. Grafana Dashboard

Open `Geetanjali SEO Monitoring` dashboard to verify:
- Total page count is ~750+
- No errors in last generation
- Generation duration is reasonable (<5 minutes)

### 4. Google Rich Results Test

Test key pages for structured data validity:

| Page Type | Test URL |
|-----------|----------|
| Verse | [BG 2.47](https://search.google.com/test/rich-results?url=https://geetanjaliapp.com/verses/BG_2_47) |
| Chapter | [Chapter 2](https://search.google.com/test/rich-results?url=https://geetanjaliapp.com/verses/chapter/2) |
| Topic | [Dharma](https://search.google.com/test/rich-results?url=https://geetanjaliapp.com/topics/dharma) |
| Featured | [Featured](https://search.google.com/test/rich-results?url=https://geetanjaliapp.com/featured) |
| Daily | [Daily](https://search.google.com/test/rich-results?url=https://geetanjaliapp.com/daily) |

Expected results:
- ✓ Valid JSON-LD detected
- ✓ No errors or warnings
- ✓ Schema type matches page (Article, WebPage, CollectionPage, etc.)

### 5. Google Search Console

After deployment, monitor in GSC:

1. **Coverage Report** — Check for crawl errors
2. **Sitemaps** — Verify sitemap is current
3. **Rich Results** — Monitor for structured data issues
4. **URL Inspection** — Test individual URLs if issues arise

### 6. Bot Response Verification

Verify bot routing for all page types:

```bash
# Verses
curl -s -o /dev/null -w "%{http_code}" \
  -H "User-Agent: Googlebot" \
  https://geetanjaliapp.com/verses/BG_2_47
# Expected: 200

# Topics
curl -s -o /dev/null -w "%{http_code}" \
  -H "User-Agent: Googlebot" \
  https://geetanjaliapp.com/topics/dharma
# Expected: 200

# Featured
curl -s -o /dev/null -w "%{http_code}" \
  -H "User-Agent: Googlebot" \
  https://geetanjaliapp.com/featured
# Expected: 200

# Daily
curl -s -o /dev/null -w "%{http_code}" \
  -H "User-Agent: Googlebot" \
  https://geetanjaliapp.com/daily
# Expected: 200
```

## Monitoring

### Prometheus Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `geetanjali_seo_generation_duration_seconds` | Histogram | Per-page generation time |
| `geetanjali_seo_pages_total` | Gauge | Pages by type |
| `geetanjali_seo_generation_total` | Counter | Generation events |
| `geetanjali_seo_generation_pages_generated` | Gauge | Pages generated in last run |
| `geetanjali_seo_generation_pages_skipped` | Gauge | Pages skipped (unchanged) |
| `geetanjali_seo_generation_pages_errors` | Gauge | Errors in last run |
| `geetanjali_seo_generation_last_duration_seconds` | Gauge | Last run duration |
| `geetanjali_seo_generation_last_success_timestamp` | Gauge | Last success time |

### Alert Suggestions

Consider alerting on:
- `geetanjali_seo_generation_pages_errors > 0` — Any generation errors
- `time() - geetanjali_seo_generation_last_success_timestamp > 86400` — No success in 24h
- `geetanjali_seo_generation_last_duration_seconds > 600` — Generation taking >10min

## Troubleshooting

### Generation Fails

1. Check backend logs for errors
2. Verify database connectivity
3. Check advisory lock isn't stuck (rare)

### Pages Not Serving

1. Verify nginx config includes bot routing
2. Check `/seo-output/` volume is mounted
3. Verify files exist: `ls /app/seo-output/verses/`

### Structured Data Errors

1. Use Rich Results Test to identify specific errors
2. Check template for malformed JSON-LD
3. Verify data escaping for special characters

## See Also

- [Architecture](architecture.md) — System components
- [Deployment](deployment.md) — Docker build process
- [Observability](observability.md) — Monitoring setup
