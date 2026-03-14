---
layout: default
title: About
description: Vision, principles, frequently asked questions, and accessibility statement for Geetanjali.
---

# About Geetanjali

Why we built this and how we think about it.

## Vision

Leaders face ethical dilemmas with no clear answers. Traditional advice is generic or disconnected from enduring wisdom. Geetanjali bridges this gap by grounding AI-powered guidance in the Bhagavad Gita.

**What we aim to be:**
- A trusted resource for ethical decision-making
- Accessible to anyone, regardless of technical or spiritual background
- Honest about limitations—AI can inform, not decide

**What we won't do:**
- Replace human judgment or professional advice
- Make definitive moral pronouncements
- Collect or sell user data

## Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Grounded, not hallucinated** | Every recommendation cites actual verses via RAG |
| **Local-first** | Runs entirely on your machine with Ollama |
| **Privacy by default** | No account required; anonymous usage supported |
| **Open source** | MIT licensed; inspect, modify, self-host |
| **Honest uncertainty** | Low-confidence responses flagged for review |

---

## FAQ

### General

**Who is this for?**
Anyone facing ethical decisions—managers, founders, professionals, students. You don't need prior knowledge of the Bhagavad Gita.

**Is this religious instruction?**
No. We treat the Geeta as philosophical literature offering ethical frameworks. The focus is practical wisdom, not doctrine.

**How is this different from ChatGPT?**
Geetanjali is specialized. Instead of general knowledge, it retrieves specific verses relevant to your dilemma and cites them. No hallucinated quotes.

### Privacy

**What data do you collect?**
- **Anonymous users**: Cases stored locally in browser, no server-side tracking
- **Registered users**: Email, cases, and preferences synced to server
- **No third-party analytics or advertising trackers**

**Can I delete my data?**
Yes. Account deletion removes all associated cases, outputs, and preferences. For anonymous usage, clear browser storage.

**Where does processing happen?**
- **Self-hosted**: Everything runs on your machine
- **Cloud**: LLM calls go to Ollama (local) or Anthropic (API); case data stays in your PostgreSQL instance

### Usage

**Can I use this for my team/organization?**
Yes. Self-host for full control, or use the public instance for individual use.

**What languages are supported?**
English. Sanskrit verses include transliteration and translation.

**Are the recommendations prescriptive?**
No. We present options with tradeoffs. The choice remains yours.

**What if the guidance seems wrong?**
Use the feedback mechanism to flag unhelpful responses. Low-confidence outputs are automatically flagged for review.

### Technical

**Why Ollama instead of a cloud LLM?**
Privacy, cost, and latency. Local inference keeps your ethical dilemmas on your machine.

**Can I use Anthropic Claude instead?**
Yes. Set `LLM_PROVIDER=anthropic` and provide your API key. Ollama remains the fallback.

**How accurate is the verse retrieval?**
We use semantic search (sentence-transformers) with confidence scoring. Results below 0.7 confidence are flagged.

**What's the uptime guarantee?**
None for the public instance. Self-host for reliability requirements.

---

## Accessibility

We design for everyone. Accessibility is a feature, not an afterthought.

### Current Status

| Feature | Status |
|---------|--------|
| Keyboard navigation | Full support across all interactive elements |
| Screen reader compatibility | ARIA labels, landmarks, live regions |
| Color contrast | Designed for WCAG 2.1 AA (4.5:1 minimum) |
| Focus indicators | Visible focus rings on all interactive elements |
| Reduced motion | Respects `prefers-reduced-motion` |
| Text scaling | Supports browser zoom and responsive sizing |
| Dark mode | Full theme support with system preference detection |
| Skip link | Keyboard users can skip to main content |
| Focus trapping | Modal dialogs trap focus appropriately |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Navigate forward through interactive elements |
| `Shift+Tab` | Navigate backward |
| `Enter/Space` | Activate buttons and links |
| `Escape` | Close modals and dropdowns |
| `←/→` | Navigate between verses in Reading Mode |
| `J/K` | Vim-style navigation (next/previous verse) |
| `Space` | Toggle translation in Reading Mode |

### Known Limitations

- **Verse images**: Generated share images have alt text, but embedded Sanskrit may not be fully accessible
- **PDF export**: Not tagged for accessibility; use Markdown export for screen readers
- **Mobile gestures**: Swipe navigation in reading mode may conflict with screen reader gestures

### Reporting Issues

If you encounter accessibility barriers:
1. [Open an issue](https://github.com/geetanjaliapp/geetanjali/issues) with label `accessibility`
2. Include device, browser, and assistive technology used
3. Describe expected vs. actual behavior

---

## Contact

- **Issues**: [GitHub Issues](https://github.com/geetanjaliapp/geetanjali/issues)
- **Security**: See [Security Policy](security.md)
- **General**: Contact form at `/contact` on the running application

---

## See Also

- [Architecture](architecture.md) — How the system works
- [Setup Guide](setup.md) — Run your own instance
- [Data Sources](data.md) — Geeta content and licensing
