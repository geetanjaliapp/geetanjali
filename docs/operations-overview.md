---
layout: default
title: Operations Overview
description: How Geetanjali processes ethical consultations - from initial analysis to follow-up conversations.
---

# Operations Overview

How consultations flow through the system, from submission to response.

## Consultation Modes

Geetanjali offers two modes of interaction:

| Mode | Purpose | Pipeline |
|------|---------|----------|
| **Initial Consultation** | Full analysis of an ethical dilemma | RAG (retrieval + generation) |
| **Follow-up Conversation** | Clarification and refinement | Lightweight (context-only) |

Both modes process asynchronously, allowing the system to handle long-running LLM operations without blocking.

## Initial Consultation

When a user submits an ethical dilemma, the system performs a full RAG (retrieval-augmented generation) analysis using a multi-pass refinement workflow:

```
User submits dilemma
        │
        ▼
┌──────────────────┐
│ Acceptance       │──▶ Not a dilemma? → Educational response
│ (validation)     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Vector Search    │
│ (find verses)    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Multi-Pass LLM   │
│ Draft → Critique │
│ → Refine → JSON  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Response:        │
│ - Summary        │
│ - Options        │
│ - Steps          │
│ - Citations      │
└──────────────────┘
```

The multi-pass approach (Draft → Critique → Refine → Structure) ensures the system thinks deeply before responding, catching shallow reasoning and improving verse alignment before final output.

**Quality Assurance Pipeline:**

After LLM generation, responses go through multiple quality gates:

```
Generated Response
        │
        ▼
┌──────────────────┐
│ Structural Check │──▶ Missing critical fields?
│ (field present)  │
└────────┬─────────┘
         │ No
         ▼
┌──────────────────┐
│ Validation &     │──▶ Missing 2+ important fields?
│ Repair           │
└────────┬─────────┘
         │ Low repairs
         ▼
┌──────────────────┐
│ Confidence Gate  │──▶ Confidence < 0.45?
│ (0.45 threshold) │
└────────┬─────────┘
         │ Pass
         ▼
┌──────────────────┐
│ Final Output     │
│ + Explanation    │
└──────────────────┘
```

If any gate fails, the system escalates to a higher-quality provider or returns a user-facing explanation.

**Output includes:**
- Executive summary
- Multiple options with tradeoffs
- Recommended action with steps
- Reflection prompts
- Verse citations with relevance scores
- **Confidence score (0-100%) with explanation** — Why this score? Was repair needed? Were critical fields present?

## Follow-up Conversations

After receiving guidance, users can ask follow-up questions for clarification or deeper exploration. Follow-ups use a lightweight pipeline that leverages existing context:

```
User asks follow-up
        │
        ▼
┌──────────────────┐
│ Content Filter   │
│ (validation)     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Load Context     │
│ (prior output)   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ LLM Generation   │
│ (conversational) │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Conversational   │
│ Response         │
│ (prose format)   │
└──────────────────┘
```

**Differences from initial consultation:**
- No new verse retrieval (uses prior citations)
- Conversational prose output (not structured JSON)
- Rolling conversation history for context
- Faster response times

## Processing States

Consultations progress through defined states:

```
DRAFT ──▶ PENDING ──▶ PROCESSING ──▶ COMPLETED
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
           FAILED              POLICY_VIOLATION
```

| State | Meaning |
|-------|---------|
| DRAFT | Case created, not yet submitted |
| PENDING | Submitted, waiting for processing |
| PROCESSING | Analysis in progress |
| COMPLETED | Guidance ready |
| FAILED | Processing error (can retry) |
| POLICY_VIOLATION | Content policy triggered |

## Async Processing

Both consultation modes use asynchronous processing:

1. **Submission** — User submits request, receives immediate acknowledgment
2. **Queue** — Request is queued for background processing
3. **Processing** — Worker processes the request (LLM generation)
4. **Completion** — Status updates, results available

The frontend polls for status changes until processing completes. This architecture allows the system to handle concurrent requests efficiently and provide a responsive user experience even when LLM operations take time.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| LLM timeout | Marked as FAILED, can retry |
| Invalid content | Returns educational response |
| Rate limit exceeded | Returns 429 with retry-after |
| Service unavailable | Fallback to secondary provider |

Failed consultations can be retried. The system maintains state to prevent duplicate processing.

## Rate Limits & Cost Controls

To ensure fair usage and system stability, Geetanjali implements conservative rate limits and cost guards:

### Per-Hour Rate Limits

| Operation | Limit | Rationale |
|-----------|-------|-----------|
| Initial consultation (analyze) | 3/hour | ~20 min between consultations; catches scripts |
| Follow-up questions | 5/hour | Lighter computation; allows natural Q&A |

Limits are tracked per authenticated user or per session for anonymous users.

### Daily Limits

| Metric | Limit | Rationale |
|--------|-------|-----------|
| Consultations | 20/day | ~2.5/hour average; prevents bulk; resets UTC midnight |
| Request size | 2000 tokens max | Prevents wasted LLM tokens; most questions fit |
| Deduplication | 24-hour window | Prevents accidental repeats; same question tomorrow OK |

### Rate Limit Responses

When a user hits a limit:
- **429 Too Many Requests** — Rate limit exceeded; retry after N seconds
- **422 Unprocessable Entity** — Request too large (token limit)
- **Daily limit message** — Friendly notification, not punitive blocking

Users can retry immediately after the rate limit window passes. The system prioritizes graceful degradation over harsh penalties.

### Cost Tracking

The system tracks consultation costs against LLM API usage:
- **Gemini cost** — Primary provider, cost-effective (~$0.075 per consultation average)
- **Escalation to higher-quality provider** — Only for <5% of cases (structural failures)
- **Per-IP daily cost** — Monitored for anomalies that suggest abuse

Costs are transparent in ops monitoring but not user-facing (see Observability for dashboard).

## See Also

- [Architecture](architecture.md) — System components and data flow
- [Content Moderation](content-moderation.md) — How content filtering works
- [Setup Guide](setup.md) — Configuration options
