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

At build time, `generate_seo.py` creates ~725 static pages:

| Content | Pages | Priority |
|---------|-------|----------|
| Homepage | 1 | 1.0 |
| About | 1 | 0.8 |
| Verse index | 1 | 0.9 |
| Chapter pages | 18 | 0.8 |
| Verse detail | 701 | 0.6 |
| 404 error | 1 | — |
| sitemap.xml | 1 | — |

Each page includes:
- Semantic HTML5 structure
- Open Graph and Twitter Card meta tags
- Schema.org JSON-LD structured data
- Full verse content (Sanskrit, transliteration, translations)
- Internal links using SPA routes (bot clicks → user gets SPA)

## Implementation

### Build-Time Generation

```bash
# During Docker build
python generate_seo.py --output /seo --api-url $API_URL --content-dir ./content
```

Generator fetches all verses from API, renders Jinja2 templates, outputs HTML + sitemap.

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
| `backend/scripts/generate_seo.py` | Build-time page generator |
| `backend/templates/seo/*.html` | Jinja2 templates |
| `frontend/src/content/*.json` | Content source of truth |
| `frontend/nginx.conf` | Bot detection and routing |
| `frontend/public/robots.txt` | Crawler directives |
| `frontend/public/og-image.png` | Social share image |

## Verification

```bash
# Bot sees semantic HTML
curl -H "User-Agent: Googlebot" https://geetanjaliapp.com/verses/BG_2_47

# User sees SPA
curl https://geetanjaliapp.com/verses/BG_2_47
```

## See Also

- [Architecture](architecture.md) — System components
- [Deployment](deployment.md) — Docker build process
