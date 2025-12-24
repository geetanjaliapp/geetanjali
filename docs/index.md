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

## What You Can Do

**Get Guidance**
- Submit an ethical dilemma, receive structured options with verse citations
- Ask follow-up questions to refine the guidance
- See example consultations from featured cases

**Explore Scripture**
- Browse 701 verses with Sanskrit, transliteration, and translations
- Read sequentially in distraction-free Reading Mode
- Search by verse reference, Sanskrit text, keywords, or meaning
- Save favorites for quick access

**Stay Connected**
- Subscribe to Daily Wisdom emails
- Sync reading progress and preferences across devices
- Share consultations publicly or via private link
- Generate verse images for social sharing

**Make It Yours**
- Dark mode throughout
- Adjustable font sizes in Reading Mode
- Works offline after first load

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

---

## Design & Architecture

How we built it:

- **[Architecture](architecture.md)** — System components, RAG pipeline, data flow
- **[Design](design.md)** — Frontend design language, colors, typography, responsive patterns
- **[Operations](operations-overview.md)** — Consultation flow, processing states, async handling
- **[Content Moderation](content-moderation.md)** — Multi-layer filtering, keeping focus on real dilemmas

---

## Running It

For operators and contributors:

- **[Setup Guide](setup.md)** — Local development, environment variables, common commands
- **[Deployment](deployment.md)** — Docker Compose, deployment modes, container orchestration
- **[Security](security.md)** — Container hardening, secrets management, incident response
- **[Observability](observability.md)** — Prometheus metrics, Grafana dashboards, alerting
- **[Troubleshooting](troubleshooting.md)** — Common issues and quick fixes

---

## Reference

- **[Data Sources](data.md)** — Bhagavad Geeta content, licensing, ingestion pipeline
- **[SEO](seo.md)** — Search engine setup and why we skipped prerendering

---

**Live:** [geetanjaliapp.com](https://geetanjaliapp.com) · **Source:** [GitHub](https://github.com/geetanjaliapp/geetanjali)
