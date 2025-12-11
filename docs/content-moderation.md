---
layout: default
title: Content Moderation
description: Multi-layer content moderation for handling inappropriate content while focusing on genuine ethical guidance.
---

# Content Moderation

Geetanjali implements multi-layer content moderation to maintain focus on genuine ethical guidance.

## Design Principles

- **Educational, not punitive** - Violations return helpful guidance
- **Minimal blocklist** - Reduce false positives; block only obvious violations
- **Privacy-first** - No user content logged, only violation types
- **Configurable** - Each layer independently toggleable
- **Contextual** - Allow profanity in context ("he said it's bullshit"), block direct abuse ("f*ck you")

---

## Defense Layers

```
User Input → [Frontend] → [Backend Blocklist] → Database → LLM → [Refusal Detection] → Response
                 ↓               ↓                                       ↓
            Instant UX       HTTP 422                        Policy Violation Response
```

| Layer | When | Purpose |
|-------|------|---------|
| **Frontend** | Client-side | Instant feedback, reduce API calls |
| **Backend Blocklist** | Pre-DB write | Authoritative validation |
| **LLM Refusal** | Post-LLM | Catch LLM safety refusals |

---

## Backend Blocklist

Catches obvious violations before content reaches the database.

**Applied to:**
- Case creation (`POST /cases`)
- Follow-up messages (`POST /cases/{id}/messages`)
- Contact form (`POST /contact`)

### Violation Types

| Type | Description | Example Blocked |
|------|-------------|-----------------|
| `explicit_sexual` | Sexual acts, anatomy, pornography | - |
| `explicit_violence` | Harm instructions, targeted violence | - |
| `profanity_abuse` | Direct abuse at reader/system | "f*ck you", "you're an idiot" |
| `spam_gibberish` | Repeated chars, no recognizable words | `aaaaaaa`, `asdf asdf asdf` |

**Note:** Contextual profanity is allowed. "My boss said this is bullshit" passes; "f*ck you" is blocked.

### Response

HTTP `422 Unprocessable Entity` with differentiated messages:

| Violation | Message |
|-----------|---------|
| Spam/Gibberish | "Please enter a clear description..." |
| Profanity/Abuse | "Please rephrase without direct offensive language..." |
| Explicit | "We couldn't process this submission..." |

---

## Frontend Validation

Client-side validation provides instant feedback before API calls. Uses the `obscenity` library for obfuscation detection (f4ck, sh1t).

**Applied to:**
- New case form
- Follow-up input
- Contact form

Frontend validation mirrors backend logic but is for UX only—backend is authoritative.

---

## LLM Refusal Detection

Detects when the LLM refuses to process content due to built-in safety guidelines. Runs after LLM generation, before JSON parsing.

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

```bash
# Master switch
CONTENT_FILTER_ENABLED=true

# Backend blocklist (explicit, spam, gibberish)
CONTENT_FILTER_BLOCKLIST_ENABLED=true

# Profanity/abuse detection (uses better-profanity library)
CONTENT_FILTER_PROFANITY_ENABLED=true

# LLM refusal detection
CONTENT_FILTER_LLM_REFUSAL_DETECTION=true
```

Disable all for testing: `CONTENT_FILTER_ENABLED=false`

---

## Policy Violation UI

When a policy violation occurs, the UI adapts:

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
    extra={
        "violation_type": "profanity_abuse",
        "input_length": 42
    }
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

- [Security Guide](security.md) - Infrastructure security
- [Building Geetanjali](building-geetanjali.md) - Architecture overview
