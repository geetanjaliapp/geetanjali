# Escalation Feature Staging Validation (Phase 7)

**Feature:** Intelligent Escalation with Field-Aware Confidence (v1.34.0)
**Status:** Ready for Staging Validation
**Test Suite:** `backend/tests/test_escalation_staging_validation.py` (20+ tests)

---

## Pre-Staging Checklist (Before Deploying)

- [ ] All backend tests passing: `make test`
- [ ] Frontend TypeScript compiling: `npm run typecheck` (frontend/)
- [ ] Frontend linting passing: `npm run lint` (frontend/)
- [ ] Code review approved
- [ ] Commit hash documented: ________
- [ ] Feature flag infrastructure tested locally

---

## Staging Validation Phases

### Phase 1: Baseline Collection (Feature Flag OFF)

**Goal:** Establish baseline metrics without escalation enabled.

**Setup:**
```bash
# Environment
GEMINI_ESCALATION_ENABLED=false
LLM_FALLBACK_ENABLED=false
```

**Duration:** 24 hours

**Collect:**
- Total consultations: ________
- Error rate: ________%
- Average response time: ________ms
- Confidence distribution (mean/median): ________

**Success Criteria:**
- All baseline metrics documented
- No errors with escalation disabled
- Response times normal

**Sign-off:** __________ Date: __________

---

### Phase 2: Canary Deployment (Feature Flag 10%)

**Goal:** Validate escalation logic with small traffic sample.

**Setup:**
```bash
# Environment
GEMINI_ESCALATION_ENABLED=true
LLM_FALLBACK_ENABLED=true
ESCALATION_TRAFFIC_PERCENTAGE=10  # 10% of traffic
```

**Duration:** 48 hours

**Monitoring:**
- [ ] Escalation triggering correctly (watch logs for `escalation_triggered`)
- [ ] Anthropic fallback working (check `/metrics` for escalation_reasons)
- [ ] Response times acceptable (compare to baseline)
- [ ] No increase in error rate
- [ ] Confidence_reason field present in API responses

**Collect:**
- Total consultations: ________
- Escalations triggered: ________ (target: <5%)
- Escalation rate: ________%
- Post-escalation confidence (mean): ________ (target: >0.85)
- Error rate: ________%
- Average response time: ________ms

**Metrics Command:**
```bash
# Terminal 1: Watch escalation metrics
curl -s http://localhost:8000/metrics | grep escalation

# Terminal 2: Search logs for escalation events
docker logs -f geetanjali-backend | grep -i escalation
```

**Success Criteria:**
- Escalation rate < 5% ✓
- Post-escalation confidence > 0.85 ✓
- Response times < baseline + 50% ✓
- No errors introduced ✓
- confidence_reason populated ✓

**Decision:** [ ] Continue to Phase 3  [ ] Rollback  [ ] Investigate Issues

**Notes:** __________________________________________________________________

**Sign-off:** __________ Date: __________

---

### Phase 3: Gradual Rollout (Feature Flag 25%)

**Goal:** Monitor metrics with increased traffic sample.

**Setup:**
```bash
# Environment
GEMINI_ESCALATION_ENABLED=true
LLM_FALLBACK_ENABLED=true
ESCALATION_TRAFFIC_PERCENTAGE=25  # 25% of traffic
```

**Duration:** 72 hours

**Daily Data Collection:**

**Day 1:**
- Total consultations: ________
- Escalations triggered: ________
- Escalation rate: ________%
- Post-escalation confidence (mean): ________

**Day 2:**
- Total consultations: ________
- Escalations triggered: ________
- Escalation rate: ________%
- Post-escalation confidence (mean): ________

**Day 3:**
- Total consultations: ________
- Escalations triggered: ________
- Escalation rate: ________%
- Post-escalation confidence (mean): ________

**Aggregate Metrics:**
- Total consultations: ________
- Total escalations: ________
- Average escalation rate: ________%
- Average post-escalation confidence: ________

**Frontend Validation:**
- [ ] Confidence_reason tooltips displaying correctly
- [ ] No JavaScript errors in console
- [ ] Tooltip positioning works on mobile/desktop
- [ ] Graceful fallback when confidence_reason is null

**Success Criteria:**
- Escalation rate < 5% ✓
- Post-escalation confidence > 0.85 ✓
- No increase in support tickets ✓
- Frontend working smoothly ✓
- Trends consistent across 3 days ✓

**Decision:** [ ] Proceed to Phase 4 (100%)  [ ] Extend Phase 3  [ ] Rollback

**Notes:** __________________________________________________________________

**Sign-off:** __________ Date: __________

---

### Phase 4: Production Deployment (Feature Flag 100%)

**Goal:** Enable escalation for all traffic.

**Setup:**
```bash
# Environment
GEMINI_ESCALATION_ENABLED=true
LLM_FALLBACK_ENABLED=true
ESCALATION_TRAFFIC_PERCENTAGE=100  # All traffic
```

**Post-Deployment Monitoring (First Week):**

| Metric | Target | Day 1 | Day 2 | Day 3 | Day 4 | Day 5 | Status |
|--------|--------|-------|-------|-------|-------|-------|--------|
| Escalation rate | <5% | ___% | ___% | ___% | ___% | ___% | ✓/✗ |
| Post-escalation conf. | >0.85 | ___ | ___ | ___ | ___ | ___ | ✓/✗ |
| Error rate | Unchanged | ___% | ___% | ___% | ___% | ___% | ✓/✗ |
| Response time | ±10% | ___ms | ___ms | ___ms | ___ms | ___ms | ✓/✗ |
| Support tickets | Baseline | ___ | ___ | ___ | ___ | ___ | ✓/✗ |

**Success Criteria:**
- All metrics within targets ✓
- No unusual spikes ✓
- User feedback positive ✓
- Zero escalation-related incidents ✓

**Sign-off:** __________ Date: __________

---

## Incident Response Protocol

If metrics fall outside acceptable ranges during any phase:

### Escalation Rate Spike (>5%)

**1. Immediate Investigation:**
```bash
# Check escalation reasons
docker logs geetanjali-backend | grep "escalation_triggered" | tail -20

# Check Gemini success rate
curl -s http://localhost:8000/metrics | grep gemini.*success
```

**2. Possible Causes:**
- Gemini API quality degradation
- Prompt formatting issue
- Input validation regression
- Change in user queries

**3. Resolution:**
- [ ] Revert feature flag
- [ ] Investigate Gemini output
- [ ] Review recent prompt changes
- [ ] Check input validation
- [ ] Re-test with Phase 1 setup

---

### Post-Escalation Confidence Below 0.85

**1. Investigation:**
```bash
# Check Anthropic response quality
docker logs geetanjali-backend | grep "anthropic" | grep confidence
```

**2. Possible Causes:**
- Anthropic model change
- Fallback prompt issue
- Complex escalation cases

**3. Resolution:**
- Adjust fallback prompts
- Review confidence calculation
- Check Anthropic API status

---

### Response Time Increase >50%

**1. Investigation:**
```bash
# Check API response times
curl -s http://localhost:8000/metrics | grep duration
```

**2. Possible Causes:**
- Anthropic API latency
- Additional validation overhead
- Database query performance

**3. Resolution:**
- Check Anthropic service status
- Profile validation pipeline
- Review database queries

---

## Rollback Procedure

If Phase must be rolled back:

```bash
# Disable escalation
GEMINI_ESCALATION_ENABLED=false

# Verify disable
curl -s http://localhost:8000/metrics | grep escalation

# Monitor for stabilization (5-10 minutes)
# Verify error rate returns to baseline
# Check user reports

# Document incident:
# - When rollback occurred
# - Why rollback was necessary
# - What was changed
# - Resolution plan
```

---

## Success Metrics Summary

| Phase | Duration | Escalation Rate | Post-Escalation Conf. | Response Time Impact | Status |
|-------|----------|-----------------|----------------------|----------------------|--------|
| 1 (Baseline) | 24h | N/A | N/A | Baseline | ✓ |
| 2 (10%) | 48h | <5% | >0.85 | <50% ↑ | ✓/✗ |
| 3 (25%) | 72h | <5% | >0.85 | <50% ↑ | ✓/✗ |
| 4 (100%) | Ongoing | <5% | >0.85 | <50% ↑ | ✓/✗ |

---

## Post-Staging Analysis

After Phase 4 stabilizes (7 days):

1. **Repair Success Rate by Field:**
   - Options repair success: ________%
   - Reflection prompts repair success: ________%
   - Sources repair success: ________%

2. **Confidence Distribution:**
   - High (≥0.85): ________%
   - Moderate (0.65-0.85): ________%
   - Low (0.45-0.65): ________%
   - Very Low (<0.45): ________%

3. **Fallback Quality:**
   - Escalations to Anthropic: ________
   - Post-escalation failures: ________
   - Recovery rate: ________%

4. **User Impact:**
   - Support tickets mentioning confidence: ________
   - Sentiment (positive/neutral/negative): ____/____/____
   - Feature flag disable requests: ________

5. **Recommendations for Future:**
   - Prompt tuning needed: [ ] Yes [ ] No
   - Threshold adjustment: [ ] Yes [ ] No
   - Extended escalation: [ ] Yes [ ] No
   - Ready for v1.35.0: [ ] Yes [ ] No

---

## Related Documentation

- Implementation Plan: `backend/services/rag/escalation.py`
- Frontend Changes: `frontend/src/components/case/OutputFeedback.tsx`
- Metrics Reference: `backend/utils/metrics_llm.py`
- Configuration: `backend/config.py`

---

**Document Status:** Ready for Staging
**Last Updated:** 2026-01-22
**Next Review:** Post-Phase 4 (Production)
