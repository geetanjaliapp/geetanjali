---
layout: default
title: Geetanjali Docs
description: Documentation for Geetanjali - ethical leadership guidance grounded in the Bhagavad Geeta.
---

# Geetanjali

Ethical leadership guidance from the Bhagavad Geeta.

Geetanjali helps you think through tough decisions by connecting your dilemmas to wisdom from 701 verses of the Bhagavad Geeta. It also lets you explore the scripture at your own pace — browse, search, or read cover to cover.

Free. Open source. Private by default.

**[Try it live →](https://geetanjaliapp.com)**

---

## Two Ways to Use Geetanjali

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│          FACING A DILEMMA?            WANT TO LEARN?                │
│                 │                            │                      │
│                 ▼                            ▼                      │
│   ┌─────────────────────────┐  ┌─────────────────────────┐          │
│   │     CONSULTATION        │  │      DISCOVERY          │          │
│   │                         │  │                         │          │
│   │  Describe your          │  │  Browse 701 verses      │          │
│   │  situation              │  │  across 18 chapters     │          │
│   │         ↓               │  │         ↓               │          │
│   │  AI retrieves relevant  │  │  Read sequentially or   │          │
│   │  verses from scripture  │  │  search by meaning      │          │
│   │         ↓               │  │         ↓               │          │
│   │  Get structured options │  │  Sanskrit + translation │          │
│   │  with verse citations   │  │  + modern insights      │          │
│   │         ↓               │  │         ↓               │          │
│   │  Ask follow-ups to      │  │  Save favorites, track  │          │
│   │  refine guidance        │  │  reading progress       │          │
│   │                         │  │                         │          │
│   └─────────────────────────┘  └─────────────────────────┘          │
│                                                                     │
│        No hallucinated quotes — every recommendation cites          │
│        actual verses. Runs locally. Works offline.                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Consultation** — You have a tough decision. Layoffs? Whistleblowing? Conflicting loyalties? Describe it, get three options with tradeoffs, each grounded in specific verses. Continue the conversation until you're clear.

**Discovery** — You want to understand the Geeta. Browse by chapter, search by concept, or read cover to cover in Reading Mode. Sanskrit text with transliteration, multiple translations, and plain-language insights.

Both paths. Same 701 verses. Your pace, your privacy.

---

## Quick Start

Run Geetanjali locally in under 5 minutes:

```bash
git clone https://github.com/geetanjaliapp/geetanjali.git
cd geetanjali
docker compose up -d
docker exec geetanjali-ollama ollama pull qwen2.5:3b
```

Open http://localhost to start exploring.

For development setup, see the [Setup Guide](setup.md).

---

## Deep Dive

**[Building Geetanjali](building-geetanjali.md)** — The full story. How we built a RAG system that grounds ethical guidance in scripture. Two user journeys, architecture decisions, and why local-first matters.

---

## How It Works

Understand what users experience:

- **[Consultation Journey](consultation.md)** — Submit a dilemma, get structured guidance with verse citations
- **[Discovery Journey](discovery.md)** — Browse verses, read chapters, explore at your pace
- **[Search](search.md)** — Find verses by reference, Sanskrit text, keywords, or meaning
- **[Audio Recitations](audio.md)** — AI-generated Sanskrit verse recitations

---

## Design & Architecture

How we built it:

- **[Architecture](architecture.md)** — System components, RAG pipeline, data flow
- **[Design](design.md)** — Frontend design language, colors, typography, responsive patterns
- **[Theming](theming.md)** — CSS token architecture, theme customization, adding new themes
- **[Operations](operations-overview.md)** — Consultation flow, processing states, async handling
- **[Content Moderation](content-moderation.md)** — Multi-layer filtering, keeping focus on real dilemmas

---

## Running It

For operators and contributors:

- **[Setup Guide](setup.md)** — Local development, environment variables, common commands
- **[Deployment](deployment.md)** — Docker Compose, deployment modes, container orchestration
- **[Content Management](content-management.md)** — Scripts, data files, audio generation, admin API
- **[Security](security.md)** — Container hardening, secrets management, incident response
- **[Observability](observability.md)** — Prometheus metrics, Grafana dashboards, alerting
- **[Troubleshooting](troubleshooting.md)** — Common issues and quick fixes
- **[Accessibility QA](accessibility-qa.md)** — Manual testing checklist for screen readers and keyboard

---

## Reference

- **[API Reference](api.md)** — REST API endpoints, authentication, rate limits, examples
- **[Reference](reference.md)** — Environment variables, error codes, glossary, scripts
- **[Data Sources](data.md)** — Bhagavad Geeta content, licensing, ingestion pipeline
- **[SEO](seo.md)** — Search engine setup and why we skipped prerendering

---

## About

- **[About Geetanjali](about.md)** — Vision, principles, FAQ, and accessibility statement

---

**Live:** [geetanjaliapp.com](https://geetanjaliapp.com) · **Source:** [GitHub](https://github.com/geetanjaliapp/geetanjali)
