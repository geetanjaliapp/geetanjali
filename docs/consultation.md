---
layout: default
title: Consultation Journey
description: How users receive ethical guidance through the case analysis and follow-up conversation flow.
---

# Consultation Journey

How users receive personalized ethical guidance from the Bhagavad Geeta.

## Overview

The consultation journey transforms ethical dilemmas into actionable guidance grounded in scripture.

```mermaid
flowchart LR
    A[Dilemma] -->|Submit| B[Case]
    B -->|RAG| C[Analysis]
    C -->|Clarify| D[Follow-up]
    D -->|Iterate| C
```

| Stage | User Action | System Response |
|-------|-------------|-----------------|
| **Submit** | Describe ethical dilemma | Case created, queued for analysis |
| **Analyze** | Wait (~30s) | RAG pipeline generates structured guidance |
| **Review** | Read options, citations | Display formatted output with verse links |
| **Follow-up** | Ask clarifying questions | Conversational refinement |

## Case Submission

Users start by describing their ethical dilemma.

```
┌────────────────────────────────────────────────────────────────┐
│  /case/new                                                     │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Describe Your Situation                                       │
│  ──────────────────────────                                    │
│                                                                │
│   ┌────────────────────────────────────────────────────────┐   │
│   │                                                        │   │
│   │  I'm a team lead facing a decision about whether to   │   │
│   │  report a colleague's minor expense violations...     │   │
│   │                                                        │   │
│   │                                                        │   │
│   └────────────────────────────────────────────────────────┘   │
│                                                                │
│   [Example Questions ▼]                                        │
│                                                                │
│   ┌─ Personalize (Optional) ───────────────────────────────┐   │
│   │                                                        │   │
│   │  Role: [Team Lead ▼]                                   │   │
│   │                                                        │   │
│   │  Stakeholders: [◉ Team] [◉ Organization] [○ Family]   │   │
│   │                                                        │   │
│   └────────────────────────────────────────────────────────┘   │
│                                                                │
│                                        [ Get Guidance ]        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Form Features:**
- Free-form text input (no templates)
- Example questions for inspiration
- Optional personalization (role, stakeholders)
- Single CTA with clear action

**Example Questions:**
Clicking reveals curated prompts users can adapt:
- "How do I handle a conflict between loyalty and honesty?"
- "What guidance does the Geeta offer on difficult decisions?"
- "How should I approach a situation where doing right may hurt someone?"

## Analysis Flow

```mermaid
flowchart TD
    A[Submit Case] -->|POST /cases| B[Create Case]
    B -->|POST /cases/:id/analyze| C[Queue Job]
    C -->|RQ Worker| D[RAG Pipeline]
    D --> E{Confidence?}
    E -->|High| F[Return Output]
    E -->|Low| G[Flag for Review]
    F --> H[Display Results]
    G --> H
```

**Processing States:**

| State | UI Display | Duration |
|-------|------------|----------|
| `created` | Form submitted | Instant |
| `pending` | "Analyzing..." spinner | ~1s |
| `processing` | Progress indicator | ~30s |
| `completed` | Full output | — |
| `failed` | Error message + retry | — |

**RAG Pipeline:**
1. Embed user query using sentence-transformers
2. Vector search against 701 verses in ChromaDB
3. Retrieve top-k relevant verses with confidence scores
4. Generate structured output via LLM (Ollama/Claude)
5. Parse and validate JSON response
6. Store output linked to case

## Analysis Output

Structured guidance with multiple perspectives.

```
┌────────────────────────────────────────────────────────────────┐
│  /case/:id                                                     │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Your Situation                                                │
│  ───────────────                                               │
│  I'm a team lead facing a decision about whether to report    │
│  a colleague's minor expense violations...                    │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Guidance                                                      │
│  ────────                                                      │
│                                                                │
│   ┌─ Summary ──────────────────────────────────────────────┐   │
│   │                                                        │   │
│   │  The Geeta emphasizes dharma (righteous duty) while   │   │
│   │  also recognizing the complexity of interpersonal     │   │
│   │  relationships and organizational loyalty...          │   │
│   │                                                        │   │
│   └────────────────────────────────────────────────────────┘   │
│                                                                │
│  Options                                                       │
│  ───────                                                       │
│                                                                │
│   ┌─ Option 1: Direct conversation first ──────────────────┐   │
│   │                                                        │   │
│   │  Approach your colleague privately before escalating. │   │
│   │  This honors both truth (satya) and compassion (daya).│   │
│   │                                                        │   │
│   │  + Preserves relationship                              │   │
│   │  + Gives opportunity to self-correct                   │   │
│   │  - May not resolve if behavior continues               │   │
│   │                                                        │   │
│   └────────────────────────────────────────────────────────┘   │
│                                                                │
│   ┌─ Option 2: Report through proper channels ─────────────┐   │
│   │  ...                                                   │   │
│   └────────────────────────────────────────────────────────┘   │
│                                                                │
│  Relevant Verses                                               │
│  ───────────────                                               │
│                                                                │
│   ┌────────────────────────────────────────────────────────┐   │
│   │  BG 2.47 — कर्मण्येवाधिकारस्ते मा फलेषु कदाचन          │   │
│   │                                                        │   │
│   │  "You have the right to work only, but never to its   │   │
│   │  fruits. Let not the fruits of action be your motive" │   │
│   │                                                        │   │
│   │  Relevance: Focus on right action, not outcomes       │   │
│   │                                       [View Verse →]  │   │
│   └────────────────────────────────────────────────────────┘   │
│                                                                │
│   ┌─ Ask a Follow-up Question ─────────────────────────────┐   │
│   │                                                        │   │
│   │  [Type your question here...                      ] ↵  │   │
│   │                                                        │   │
│   └────────────────────────────────────────────────────────┘   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Output Components:**

| Section | Purpose |
|---------|---------|
| Summary | Executive overview of guidance |
| Options | 2-3 actionable paths with tradeoffs |
| Recommendation | Suggested approach (when confident) |
| Implementation | Concrete next steps |
| Reflection | Prompts for deeper contemplation |
| Verses | Supporting citations with links |

**Verse Citations:**
- Clickable links to verse detail pages
- Shows Sanskrit, translation snippet, relevance
- Confidence score (hidden from UI, used for flagging)

## Follow-up Conversations

Users can ask clarifying questions after initial analysis.

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant W as Worker

    U->>F: Type follow-up question
    F->>B: POST /cases/:id/follow-up
    B->>B: Create user message
    B->>W: Queue response job
    B-->>F: 202 Accepted
    F->>F: Show user message
    F->>B: Poll case status
    W->>W: Generate response
    W->>B: Save assistant message
    B-->>F: completed + messages
    F->>F: Show assistant response
```

**Conversation Flow:**
```
┌────────────────────────────────────────────────────────────────┐
│  Conversation                                                  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   ┌─ You ──────────────────────────────────────────────────┐   │
│   │                                                        │   │
│   │  What if my colleague refuses to acknowledge the      │   │
│   │  issue when I bring it up?                            │   │
│   │                                                        │   │
│   └────────────────────────────────────────────────────────┘   │
│                                                                │
│   ┌─ Geetanjali ───────────────────────────────────────────┐   │
│   │                                                        │   │
│   │  If direct conversation doesn't resolve the           │   │
│   │  situation, the Geeta's teaching on nishkama karma    │   │
│   │  (desireless action) suggests focusing on your        │   │
│   │  dharma rather than the outcome. You've fulfilled     │   │
│   │  your duty by giving them the opportunity to          │   │
│   │  self-correct...                                      │   │
│   │                                                        │   │
│   └────────────────────────────────────────────────────────┘   │
│                                                                │
│   ┌─ You ──────────────────────────────────────────────────┐   │
│   │  How do I know when it's time to escalate?            │   │
│   └────────────────────────────────────────────────────────┘   │
│                                                                │
│   ┌─ Geetanjali ───────────────────────────────────────────┐   │
│   │  ● ● ●                                                 │   │
│   └────────────────────────────────────────────────────────┘   │
│                                                                │
│   ┌────────────────────────────────────────────────────────┐   │
│   │  [Ask another question...                         ] ↵  │   │
│   └────────────────────────────────────────────────────────┘   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Follow-up Features:**
- Async processing (non-blocking)
- Context-aware (uses prior consultation)
- No full RAG regeneration (lighter processing)
- Rate limited (30/hour vs 10/hour for analysis)

## User Flow Summary

```mermaid
flowchart TB
    subgraph Consultation["Consultation Journey"]
        H[Homepage] -->|"Get Guidance"| N[New Case Form]
        N -->|Submit| C[Case View]
        C -->|Processing| A[Analysis Output]
        A -->|Question| F[Follow-up Thread]
        F -->|More| F
        A -->|Verse link| V[Verse Detail]
        V -->|Back| A
    end
```

**Entry Points:**
- Homepage hero CTA → New Case Form
- Navbar "Get Guidance" → New Case Form
- Direct URL `/case/new` → New Case Form

**Exit Points:**
- Verse links → Discovery Journey (verse detail)
- "Browse Verses" → Discovery Journey (grid)
- Share link → External

## Technical Notes

**API Endpoints:**
```
POST /api/v1/cases                    # Create case
POST /api/v1/cases/{id}/analyze       # Queue analysis
GET  /api/v1/cases/{id}               # Get case + status
GET  /api/v1/cases/{id}/output        # Get analysis output
POST /api/v1/cases/{id}/follow-up     # Submit follow-up
GET  /api/v1/cases/{id}/messages      # Get conversation
POST /api/v1/outputs/{id}/feedback    # Submit feedback
```

**Processing:**
- Analysis jobs run via RQ (Redis Queue)
- Typical processing time: 20-40 seconds
- Frontend polls every 2 seconds during processing
- Timeout after 5 minutes with retry option

**Content Moderation:**
- Input validated for harmful content
- Output checked before display
- Low-confidence responses flagged
- See [Content Moderation](content-moderation.md) for details

**Accessibility:**
- Form labels and ARIA attributes
- Loading state announcements
- Keyboard navigation throughout
- Focus management on state changes
