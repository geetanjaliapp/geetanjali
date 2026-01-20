# Cost Defense Operations Guide

## Quick Start

**Version:** v1.32.0 (deployed 2026-01-20)

Geetanjali ships with conservative cost guards to prevent abuse:
- **Rate limits:** 3/hour (cases), 5/hour (follow-ups)
- **Daily ceiling:** 20 consults/day per IP/session
- **Token limit:** 2000 tokens per request
- **Deduplication:** Rejects identical questions within 24hrs

This guide explains how to monitor and tune these guards.

---

## Daily Checklist (5 minutes)

Run every morning (ideally 6-8am UTC). Template:

### 1. Check Prometheus Dashboard

Open: http://monitoring:3000/dashboards (or your Grafana host)

**Metrics to review:**

- `geetanjali_consultation_cost_usd_total` (by provider)
  - Should increase steadily ~$2-5/day (v1.32.0 launch)
  - If spike > 10x: investigate

- `geetanjali_daily_limit_exceeded_total` (by tracking_type: ip, session)
  - If > 10 hits: might be too strict, plan to increase
  - If = 0: limit might be too loose
  - Expected: 0-5 hits/day initially

- `geetanjali_consultation_tokens_total` (by provider)
  - Should correlate with cost
  - Token count typically 200-800 per consultation

- `geetanjali_request_validation_rejected_total` (by reason: token_too_large, duplicate)
  - If token_too_large > 10: users hitting 2000-token limit
  - If duplicate > 5: deduplication working

### 2. Check Application Logs

Search logs for key events:

**Daily limit exceeded:**
```
level:warning event:daily_limit_exceeded
```

Count: How many yesterday? (expect 0-5 initially)

**Potential abuse:**
```
level:critical event:potential_abuse
```

If any: Review IP and decide if legitimate or scripting.

**Token validation:**
```
level:info event:validation_rejected reason:token_too_large
```

Count: How many yesterday? (expect < 5 initially)

**Duplicate detection:**
```
level:info event:validation_rejected reason:duplicate_question
```

Count: How many yesterday? (expect < 5 initially)

### 3. Answer These Questions

- **Any IP with > $5/day cost?**
  - No = Good. Yes = Review metrics dashboard (per-ip gauge).
  - If legitimate power user: plan to whitelist (Phase 2).
  - If looks scripted: log it, alert team.

- **Daily limit hit rate yesterday?**
  - 0-2 hits = Just right (conservative limits working).
  - 3-5 hits = Monitor (might need slight increase).
  - 10+ hits = Probably too strict. Plan increase for Friday.

- **Token validation false positives?**
  - 0-2 oversized requests = Normal (users asking detailed questions).
  - 10+ = Limit might be too low. Plan increase for Friday.

- **Any new error patterns in logs?**
  - Search `level:error` in past 24h.
  - If yes: investigate, file ticket if needed.

---

## Weekly Tuning (Every Friday)

### Process

1. **Collect data from past week:**
   - Daily limit hit count (total)
   - Per-IP cost distribution (min, avg, max)
   - Token validation rejections (count by reason)
   - User complaints (if any)

2. **Decide if tuning needed:**

   | Metric | Value | Action |
   |--------|-------|--------|
   | Daily limit hits | 0 | Keep at 20/day |
   | Daily limit hits | 1-5 | Keep at 20/day |
   | Daily limit hits | 10+ | Increase to 30/day |
   | Rate limit (cases) | 0 timeout/day | Keep at 3/hour |
   | Rate limit (cases) | 5+ timeout/day | Increase to 5/hour |
   | Token limit | 0 rejection/day | Keep at 2000 |
   | Token limit | 10+ rejection/day | Increase to 3000 |
   | Max IP cost | < $10 | Keep limits |
   | Max IP cost | > $50 | Investigate + whitelist |

3. **If tuning needed:**

   a. Update `backend/config.py`:
   ```python
   ANALYZE_RATE_LIMIT: str = "5/hour"  # Changed from 3
   FOLLOW_UP_RATE_LIMIT: str = "7/hour"  # Changed from 5
   DAILY_CONSULT_LIMIT: int = 30  # Changed from 20
   ```

   b. Redeploy to production (Friday EOD)

   c. Monitor Sat-Sun for regressions (should be smooth)

   d. Document change in git commit:
   ```
   fix(cost-defense): adjust limits based on Week 1 data

   - Daily limit: 20→30 (10+ hits indicates too strict)
   - Rate limit: 3→5/hour (users need more breathing room)

   Metrics before: [paste key numbers]
   Expected impact: [describe what should change]
   ```

---

## Incident Response

### Cost Spike (> $100/day, up 10x)

1. **Immediate (5 min):**
   - Check Prometheus `geetanjali_consultation_cost_per_ip` gauge
   - Identify top IP(s) causing spike
   - Check daily limit hit rate (is rate limit working?)

2. **Investigation (15 min):**
   - Query logs for that IP
   - Pattern: repeated identical requests? (script)
   - Pattern: varied requests? (legitimate heavy user)

3. **Action:**
   - **If scripted:**
     - Document IP pattern
     - File security incident
     - Consider IP-level blocking (future feature)

   - **If legitimate:**
     - Congratulations, you have power users!
     - Plan whitelisting for Phase 2
     - Notify team of positive sign

4. **Post-incident:**
   - Update limits if needed
   - Improve detection for similar patterns
   - Celebrate if legitimate growth

### Daily Limit False Positives (> 20% hit rate)

1. **Immediate:**
   - Check daily limit hit count from Prometheus
   - If > 4 hits yesterday: limits too strict

2. **Same day:**
   - Increase daily limit: 20 → 25 (small bump)
   - Redeploy
   - Monitor for improvement

3. **Next day:**
   - Check hit rate again
   - If still high: increase further (25 → 30)
   - If normalized: keep new limit

### Metrics Not Flowing

1. **Check /metrics endpoint:**
   ```bash
   curl http://localhost:8000/metrics | head -20
   ```
   - Should show `geetanjali_*` metrics
   - If not: check Prometheus scrape config

2. **Check logs:**
   - Are tracking calls being hit?
   - Any errors in metrics library?

3. **Fallback:**
   - Metrics are optional (app works without them)
   - Re-check infrastructure, don't block monitoring

---

## Limits Reference

### Current (v1.32.0)

| Limit | Value | Rationale |
|-------|-------|-----------|
| Rate limit (cases) | 3/hour | 1 consult every 20 min; catches scripts |
| Rate limit (follow-ups) | 5/hour | Lighter computation; allows natural Q&A |
| Daily limit | 20/day | ~2.5/hour avg; prevents bulk; resets UTC midnight |
| Token max | 2000 | Prevents wasted LLM tokens; most questions fit |
| Dedup window | 24 hours | Prevents accidental repeats; same question next day OK |

### Tuning History

| Date | Change | Reason | Result |
|------|--------|--------|--------|
| 2026-01-20 | Launch v1.32.0 | Initial deployment | — |
| — | — | — | — |

(Record tuning decisions here for future reference)

---

## Monitoring Dashboard (TODO - Grafana)

Create Grafana dashboard with these panels:

1. **Cost Over Time** (line chart)
   - `geetanjali_consultation_cost_usd_total` (by provider)
   - Shows: Daily cost trending

2. **Cost Per IP** (top-N table)
   - `geetanjali_consultation_cost_per_ip` (last value)
   - Shows: Which IPs are most expensive

3. **Daily Limit Hits** (counter)
   - `geetanjali_daily_limit_exceeded_total`
   - Shows: How many times limit was hit

4. **Validation Rejections** (pie chart)
   - `geetanjali_request_validation_rejected_total` (by reason)
   - Shows: Token vs dedup rejections

5. **Alerts:**
   - If daily cost > $100: page on-call
   - If daily limit hit rate > 20%: warning
   - If cost per IP > $10 in 1 hour: investigate

---

## Contacts & Escalation

| Issue | Owner | Escalate If |
|-------|-------|-------------|
| Daily monitoring | [You] | Suspicious patterns daily checklist |
| Weekly tuning | [You] | Unclear if limit change needed |
| Incident (cost spike) | [You] | > $200/day or evident abuse pattern |
| System issue (metrics down) | Devops | Prometheus/infra problem |

---

## FAQ

**Q: A legitimate user hit the daily limit. What do I do?**

A: It's rare but possible. Reach out to them (if you have their email):
- Explain the limit exists to prevent abuse
- Apologize for inconvenience
- Ask about their use case
- If researcher/student: whitelist for Phase 2
- If edge case: increase limit (Friday tuning)

**Q: Cost suddenly spiked. Is it the limits' fault?**

A: Unlikely. Cost is tied to tokens used. Check:
1. Did user count increase? (more users = more consultations)
2. Are queries more complex now? (more tokens per consultation)
3. Is an IP hammering the API? (check per-IP gauge)

**Q: Should I make the limits tighter?**

A: No. Start conservative, only increase based on data.
- Tighter = more false positives = user frustration
- We can always tighten later if abuse detected
- For now: monitor, gather data, tune weekly

**Q: Can I disable the limits temporarily?**

A: Yes. For testing/debugging:
```python
# In config.py
DAILY_CONSULT_LIMIT_ENABLED = False  # Disables all checks
```
**Don't forget to re-enable before shipping to prod.**

---

## Timeline

| When | What | Owner |
|------|------|-------|
| 2026-01-20 | Deploy v1.32.0 | You |
| 2026-01-21 to 26 | Daily 5-min monitoring | You |
| 2026-01-24 (Fri) | Weekly tuning + adjust limits | You |
| 2026-01-27+ | Weekly checks (Fridays) | Rotating |

---

## Success Criteria for Week 1

- Ops checked metrics daily (7 days)
- No legitimate user complaints about limits
- No cost spike unexplained
- Confidence in monitoring setup
- Ready for Phase 2 features

---

**Version:** 1.0
**Last Updated:** 2026-01-20
