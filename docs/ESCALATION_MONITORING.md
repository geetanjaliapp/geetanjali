# Escalation Feature Monitoring & Runbook (Phase 8)

**Feature:** Intelligent Escalation with Field-Aware Confidence (v1.34.0)
**Metrics Framework:** Prometheus + Grafana
**Update Frequency:** Real-time (scraped every 15s)

---

## Quick Reference

| Metric | Type | Purpose | Threshold |
|--------|------|---------|-----------|
| `escalation_reasons_total` | Counter | Why escalations occurred | - |
| `escalation_reasons{reason}` | Counter by reason | Detailed escalation causes | - |
| `confidence_post_repair` | Histogram | Quality of confidence after repair | p50, p95, p99 |
| `repair_success_total` | Counter | Field-level repair success | - |
| `geetanjali_gemini_escalations_rate` | Gauge | Escalation rate (%) | <5% target |

---

## Prometheus Metrics

### 1. Escalation Triggered Counter

```
geetanjali_escalation_reasons_total{
  reason="missing_critical_field_options",
  provider="gemini"
}
```

**Labels:**
- `reason`: Why escalation occurred
  - `missing_critical_field_options`
  - `missing_critical_field_recommended_action`
  - `missing_critical_field_executive_summary`
  - `low_confidence_post_repair`
  - `multiple_repairs_required`

- `provider`: Primary provider that triggered escalation
  - `gemini`
  - `anthropic` (should not occur - fallback doesn't re-escalate)
  - `ollama`

**Query Examples:**
```promql
# Total escalations
increase(geetanjali_escalation_reasons_total[5m])

# Escalation rate (%)
(increase(geetanjali_escalation_reasons_total[5m]) /
 increase(geetanjali_consultation_total[5m])) * 100

# By escalation reason
sum by(reason) (rate(geetanjali_escalation_reasons_total[5m]))

# Escalations per provider
sum by(provider) (rate(geetanjali_escalation_reasons_total[5m]))
```

---

### 2. Confidence Distribution Post-Repair

```
geetanjali_confidence_post_repair_seconds_bucket{
  provider="gemini",
  le="0.85"
}

geetanjali_confidence_post_repair_seconds{
  provider="gemini",
  quantile="0.95"
}
```

**Labels:**
- `provider`: LLM provider that produced response
  - `gemini`: Original Gemini response
  - `anthropic`: Escalated to Anthropic

**Quantiles (Histogram Buckets):**
- `0.2`, `0.3`, `0.4`, `0.5`, `0.6`, `0.7`, `0.8`, `0.9`, `1.0`

**Query Examples:**
```promql
# Average confidence after repair (Gemini only)
geetanjali_confidence_post_repair_seconds{provider="gemini"} and quantile="0.5"

# P95 confidence (95% of responses better than this)
geetanjali_confidence_post_repair_seconds{quantile="0.95"}

# Escalated response quality (Anthropic)
geetanjali_confidence_post_repair_seconds{provider="anthropic"}

# Confidence distribution (histogram)
histogram_quantile(0.95, sum(rate(geetanjali_confidence_post_repair_seconds_bucket[5m])) by(le))
```

---

### 3. Repair Success by Field

```
geetanjali_repair_success_total{
  field="options",
  status="success",
  provider="gemini"
}
```

**Labels:**
- `field`: Field that required repair
  - `options`
  - `recommended_action`
  - `executive_summary`
  - `reflection_prompts`
  - `sources`
  - `scholar_flag`

- `status`: Repair outcome
  - `success`: Repair completed successfully
  - `failed`: Repair could not be completed

- `provider`: Provider that generated response needing repair

**Query Examples:**
```promql
# Field repair success rate
(increase(geetanjali_repair_success_total{status="success"}[1h]) /
 increase(geetanjali_repair_success_total[1h])) * 100

# Which fields fail most often
sum by(field) (rate(geetanjali_repair_success_total{status="failed"}[5m]))

# Repair volume by field
sum by(field) (rate(geetanjali_repair_success_total[5m]))
```

---

## Dashboard Panels

### Panel 1: Escalation Rate Over Time

**Type:** Line Chart
**Query:**
```promql
(increase(geetanjali_escalation_reasons_total[5m]) /
 increase(geetanjali_consultation_total[5m])) * 100
```

**Alert Threshold:** >5%
**Visualization:** Red line at 5% target

---

### Panel 2: Escalation Reasons Breakdown

**Type:** Stacked Bar Chart
**Query:**
```promql
sum by(reason) (rate(geetanjali_escalation_reasons_total[5m]))
```

**Expected:**
- Most escalations: missing critical fields (normal)
- Few escalations: low_confidence_post_repair (indicates robust repair)

---

### Panel 3: Confidence Distribution (Box Plot)

**Type:** Heatmap or Box Plot
**Query:**
```promql
# For each provider, show confidence distribution
histogram_quantile(0.99, sum(rate(geetanjali_confidence_post_repair_seconds_bucket[5m])) by(le, provider))
histogram_quantile(0.95, sum(rate(geetanjali_confidence_post_repair_seconds_bucket[5m])) by(le, provider))
histogram_quantile(0.5, sum(rate(geetanjali_confidence_post_repair_seconds_bucket[5m])) by(le, provider))
```

**Target:**
- Gemini p50: ~0.80 (half high quality)
- Anthropic (escalated) p50: >0.85 (most escalated are high quality)

---

### Panel 4: Repair Success Rate by Field

**Type:** Gauge
**Query:**
```promql
(increase(geetanjali_repair_success_total{status="success", field="options"}[1h]) /
 increase(geetanjali_repair_success_total{field="options"}[1h])) * 100
```

**Replicate for each field:**
- Options success rate
- Recommended action success rate
- Executive summary success rate
- etc.

---

## Daily Monitoring Checklist

### 8:00 AM Check (Start of business day)

- [ ] Escalation rate < 5% (24h window)
  ```bash
  curl -s http://localhost:9090/api/v1/query?query='(increase(geetanjali_escalation_reasons_total[24h])/increase(geetanjali_consultation_total[24h]))*100'
  ```

- [ ] Post-escalation confidence p95 > 0.85
  ```bash
  curl -s http://localhost:9090/api/v1/query?query='histogram_quantile(0.95,geetanjali_confidence_post_repair_seconds_bucket{provider="anthropic"})'
  ```

- [ ] No escalation reason spikes
  - Check top 3 escalation reasons
  - Compare to yesterday

- [ ] Error rate unchanged
  - Escalation should not increase errors

---

### 2:00 PM Check (Mid-day)

- [ ] Escalation rate stable (compare 1h vs 24h averages)
- [ ] Response times acceptable
  - No p95 response time increase >50%
- [ ] Gemini confidence distribution normal
  - p50 ~0.80, p95 ~0.90

---

### 4:30 PM Check (End of business day)

- [ ] Summary metrics collected for daily report
- [ ] Any unusual spikes investigated
- [ ] Alert config verified (no missing alerts)

---

## Alert Configuration

### Alert 1: Escalation Rate Spike

**Condition:** Escalation rate > 5% for 5 minutes
**Severity:** Warning

```yaml
- alert: EscalationRateSpike
  expr: |
    (increase(geetanjali_escalation_reasons_total[5m]) /
     increase(geetanjali_consultation_total[5m])) * 100 > 5
  for: 5m
  annotations:
    summary: "Escalation rate exceeds 5% target"
    description: "Current escalation rate: {{ $value }}%"
```

**Action:**
1. Check Gemini output quality
2. Review recent prompt changes
3. Check input validation

---

### Alert 2: Low Post-Escalation Confidence

**Condition:** Anthropic p95 confidence < 0.85 for 10 minutes
**Severity:** Warning

```yaml
- alert: LowEscalatedConfidence
  expr: |
    histogram_quantile(0.95, sum(rate(geetanjali_confidence_post_repair_seconds_bucket{provider="anthropic"}[10m])) by(le)) < 0.85
  for: 10m
  annotations:
    summary: "Escalated response confidence below target"
    description: "P95 confidence: {{ $value }}"
```

**Action:**
1. Verify Anthropic API working
2. Check fallback prompts
3. Review escalated case quality

---

### Alert 3: High Repair Failure Rate

**Condition:** Options repair success < 80% for 1 hour
**Severity:** Info

```yaml
- alert: HighRepairFailureRate
  expr: |
    (increase(geetanjali_repair_success_total{status="success", field="options"}[1h]) /
     increase(geetanjali_repair_success_total{field="options"}[1h])) * 100 < 80
  for: 1h
  annotations:
    summary: "Options repair success rate low"
    description: "Success rate: {{ $value }}%"
```

**Action:**
1. Review repair logic for options field
2. Check input data quality
3. Consider prompt tuning

---

## Troubleshooting

### Scenario: Escalation Rate Spiked to 12%

**Investigation Steps:**

1. **What's being escalated?**
   ```promql
   sum by(reason) (increase(geetanjali_escalation_reasons_total[1h]))
   ```
   - If `missing_critical_field_options` is high → Gemini output degraded
   - If `low_confidence_post_repair` is high → Repair logic issue

2. **When did it start?**
   - Correlate with Gemini API status updates
   - Check for prompt changes in last 24h
   - Review user input patterns

3. **What's Anthropic confidence?**
   ```promql
   histogram_quantile(0.95, geetanjali_confidence_post_repair_seconds_bucket{provider="anthropic"})
   ```
   - If >0.85: Escalation working correctly, just high volume
   - If <0.85: Fallback also having issues

4. **Decision:**
   - Continue monitoring (expected variance)
   - Investigate Gemini output quality
   - Adjust escalation threshold if needed
   - Rollback if unhealthy

---

### Scenario: Response Time Increase >50%

**Investigation Steps:**

1. **Is it escalation-related?**
   - Check escalation rate
   - If rate unchanged: not related
   - If rate increased: escalation adds latency (expected ~700ms for Anthropic)

2. **Anthropic latency normal?**
   ```promql
   geetanjali_llm_inference_duration_seconds{provider="anthropic", quantile="0.95"}
   ```
   - Typical: 1-2 seconds
   - High: >3 seconds (API degradation)

3. **Is Gemini also slow?**
   ```promql
   geetanjali_llm_inference_duration_seconds{provider="gemini", quantile="0.95"}
   ```
   - If both slow: Network/infrastructure issue
   - If only Anthropic slow: Provider issue

4. **Action:**
   - Monitor Anthropic status page
   - Check database query performance
   - Verify network connectivity

---

### Scenario: Confidence Distribution Bimodal (Two Peaks)

**Interpretation:**
- Peak 1: Low confidence responses (0.3-0.5)
- Peak 2: High confidence responses (0.8-0.95)

**Expected:** Normal - indicates repair is working correctly
- Responses that need repair drop in confidence
- Responses that don't need repair stay high

**If unexpected:**
- Review confidence penalty logic
- Check repair success rates
- Verify escalation threshold

---

## Weekly Report Template

**Week of:** ________

### Escalation Metrics
- Total consultations: ________
- Total escalations: ________ (target: <5%)
- Escalation rate: ________%
- Most common reason: ________________

### Confidence Quality
- Gemini average confidence: ________
- Anthropic average confidence: ________ (target: >0.85)
- Repair success rate: ________%

### Operational
- Alerts triggered: ________
- Incidents: ________
- User complaints: ________

### Recommendations
- [ ] Continue monitoring
- [ ] Adjust thresholds
- [ ] Investigate issues: __________________
- [ ] Next steps: ______________________

**Prepared by:** __________ **Date:** __________

---

## Grafana Dashboard JSON

Pre-configured dashboard available at:
```
monitoring/escalation-dashboard.json
```

**To import:**
1. Grafana → Dashboards → Import
2. Upload `escalation-dashboard.json`
3. Select Prometheus data source
4. Save

**Includes:**
- Escalation rate over time
- Escalation reasons breakdown
- Confidence distribution (Gemini vs Anthropic)
- Repair success by field
- Response time impact
- Alert status

---

## Production Readiness Checklist

- [ ] Prometheus scrape interval configured (15s)
- [ ] Retention policy set (30 days minimum)
- [ ] Alerts configured and tested
- [ ] Grafana dashboard imported
- [ ] Team trained on monitoring
- [ ] Runbook shared with on-call
- [ ] Escalation procedures documented
- [ ] Rollback procedure tested
- [ ] Post-mortem template prepared
- [ ] Success metrics baselined

---

**Document Status:** Production Ready
**Last Updated:** 2026-01-22
**Next Review:** After Phase 4 (Production)
