---
layout: default
title: Content Moderation
description: Two-layer content moderation system for handling inappropriate content while maintaining focus on genuine ethical guidance.
---

# Content Moderation

Geetanjali implements a two-layer content moderation system designed to maintain focus on genuine ethical guidance while handling inappropriate content gracefully.

## Design Principles

- **Educational, not punitive** - Violations return helpful guidance on how to rephrase
- **Minimal blocklist** - Reduce false positives; only block obvious violations
- **Privacy-first** - No user content is logged, only violation types
- **Configurable** - Each layer can be enabled/disabled independently

---

## Two-Layer Defense

```
User Input → [Layer 1: Blocklist] → Database → LLM → [Layer 2: Refusal Detection] → Response
                    ↓                                           ↓
              HTTP 422 + Message                     Policy Violation Response
```

| Layer | When | Action | User Experience |
|-------|------|--------|-----------------|
| **Layer 1** | Pre-submission | Block before DB write | Immediate educational message |
| **Layer 2** | Post-LLM | Detect LLM refusal | Policy violation response with guidance |

---

## Layer 1: Pre-submission Blocklist

Catches obvious violations before content reaches the database. Applied to:
- Case creation (`POST /cases`)
- Follow-up messages (`POST /cases/{id}/messages`)

### Violation Types

| Type | Patterns | Examples |
|------|----------|----------|
| `explicit_sexual` | Explicit sexual acts, anatomy, pornography | - |
| `explicit_violence` | Harm instructions, weapons, targeted violence | - |
| `spam_gibberish` | Repeated characters, symbol spam, link spam | `aaaaaaaaaa`, `!!!!!!!!!` |

### Response

```json
{
  "detail": "We couldn't process this submission. Geetanjali helps with genuine ethical dilemmas..."
}
```

HTTP Status: `422 Unprocessable Entity`

---

## Layer 2: LLM Refusal Detection

Detects when Claude or other LLMs refuse to process content due to their built-in safety guidelines. Runs after LLM generation, before JSON parsing.

### Detection Patterns

Matches phrases like:
- "I can't/cannot/won't assist with..."
- "This request appears to contain..."
- "I must decline/refuse..."
- "I apologize, but I can't..."

### Response

When refusal is detected, the case is marked `policy_violation` and returns an educational response:

```json
{
  "executive_summary": "We weren't able to provide guidance for this request...",
  "options": [
    {"title": "Reflect on Your Underlying Concern", "..."},
    {"title": "Rephrase Your Dilemma", "..."},
    {"title": "Explore the Bhagavad Geeta Directly", "..."}
  ],
  "recommended_action": {"option": 2, "steps": ["..."]},
  "reflection_prompts": ["What ethical tension am I truly wrestling with?", "..."],
  "confidence": 0.0,
  "policy_violation": true
}
```

---

## Configuration

Environment variables control moderation behavior:

```bash
# Master switch (disables all filtering)
CONTENT_FILTER_ENABLED=true

# Layer 1: Pre-submission blocklist
CONTENT_FILTER_BLOCKLIST_ENABLED=true

# Layer 2: LLM refusal detection
CONTENT_FILTER_LLM_REFUSAL_DETECTION=true
```

### Disable for Development

```bash
# Quick disable for testing
CONTENT_FILTER_ENABLED=false
```

### Disable Layer 1 Only

```bash
# Trust LLM safety, skip blocklist
CONTENT_FILTER_BLOCKLIST_ENABLED=false
```

---

## Frontend Handling

Policy violations are handled gracefully in the UI:

| Element | Normal Case | Policy Violation |
|---------|-------------|------------------|
| Status Badge | "Completed" (green) | "Unable to Process" (amber) |
| Completion Banner | "Analysis Complete" | "Unable to Provide Guidance" |
| Follow-up Input | Visible | Hidden |
| Share Button | Enabled | Disabled |
| Export | Normal | Includes notice |

---

## Extending Patterns

To add new blocklist patterns, edit `backend/services/content_filter.py`:

```python
# Add to appropriate list
_EXPLICIT_VIOLENCE_PATTERNS = [
    # ... existing patterns ...
    r"\bnew_pattern_here\b",
]
```

Patterns are compiled at import time for performance. Changes require container restart.

### Pattern Guidelines

1. Use word boundaries (`\b`) to avoid partial matches
2. Prefer specific patterns over broad ones
3. Test against false positives before deploying
4. Document the intent in comments

---

## Logging

Content is never logged. Only metadata:

```python
logger.warning(
    "Blocklist violation detected",
    extra={"violation_type": ViolationType.EXPLICIT_SEXUAL.value}
)
```

This enables monitoring violation rates without exposing user content.

---

## Testing

Run content filter tests:

```bash
docker compose run --rm backend python -m pytest tests/test_content_filter.py -v
```

Key test cases:
- Blocklist patterns match expected violations
- Clean content passes through
- LLM refusal detection works
- Educational responses are well-formed
- Configuration toggles work correctly

---

## Related

- [Security Guide](SECURITY.md) - Infrastructure security
- [Building Geetanjali](building-geetanjali.md) - Architecture overview
