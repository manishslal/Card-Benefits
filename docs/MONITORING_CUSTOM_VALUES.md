# Custom Values Feature - Monitoring & Alerting Setup

**Date:** April 3, 2024  
**Version:** 1.0  
**Scope:** Custom Benefit Values (Edit, ROI Recalculation, Audit Trail)

---

## 📊 Overview

This document specifies monitoring dashboards, metrics, alerting rules, and runbooks for the Custom Values feature in production.

---

## 🎯 Key Performance Indicators (KPIs)

### Business Metrics

| KPI | Target | Alert Threshold | Description |
|-----|--------|-----------------|-------------|
| Feature Availability | 99.9% | <99% | Percentage of time feature is operational |
| Value Update Success Rate | >99% | <98% | Percentage of successful value updates |
| User Adoption | >50% | N/A | Percentage of users using custom values |
| ROI Calculation Accuracy | 100% | <99.9% | Accuracy of ROI calculations |

### Technical Metrics

| Metric | P50 Target | P99 Target | Alert Threshold | Unit |
|--------|-----------|-----------|-----------------|------|
| ROI Calculation Latency | <100ms | <300ms | >500ms | milliseconds |
| Value Update Latency | <50ms | <100ms | >200ms | milliseconds |
| Audit Trail Write Latency | <20ms | <50ms | >100ms | milliseconds |
| Cache Hit Rate | >85% | >85% | <70% | percentage |
| Error Rate | <0.5% | <1% | >2% | percentage |
| Database Query Time | <10ms | <50ms | >100ms | milliseconds |
| Memory Usage per Request | <50MB | <100MB | >150MB | megabytes |
| CPU Utilization | <30% | <60% | >80% | percentage |

---

## 📈 Dashboards

### 1. Custom Values Overview Dashboard

**Purpose:** High-level feature health and performance

**Panels:**

```
┌─────────────────────────────────────────────────────────────┐
│ Row 1: Feature Status                                       │
├──────────────────────┬──────────────────────┬───────────────┤
│ Availability (99.9%) │ Users (1,234 active) │ Uptime (42 d) │
└──────────────────────┴──────────────────────┴───────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Row 2: Operation Rates                                      │
├──────────────────────┬──────────────────────┬───────────────┤
│ Updates/minute       │ Success Rate (99.2%) │ Errors/min    │
│ (Line chart)         │ (Gauge)              │ (Number)      │
└──────────────────────┴──────────────────────┴───────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Row 3: Performance                                          │
├──────────────────────┬──────────────────────┬───────────────┤
│ ROI Calc Latency     │ Value Update Lat.    │ Cache Hit %   │
│ (Timeseries)         │ (Timeseries)         │ (Line)        │
└──────────────────────┴──────────────────────┴───────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Row 4: Database Health                                      │
├──────────────────────┬──────────────────────┬───────────────┤
│ Query Time (p50/p99) │ Connection Pool %    │ Slow Queries  │
│ (Heatmap)            │ (Gauge)              │ (Number)      │
└──────────────────────┴──────────────────────┴───────────────┘
```

**Refresh Rate:** 1 minute (real-time)  
**Time Range:** Last 24 hours

### 2. ROI Calculation Performance Dashboard

**Purpose:** Deep dive into ROI calculation metrics

**Panels:**

```
┌─────────────────────────────────────────────────────────────┐
│ Row 1: Latency Distribution                                 │
├──────────────────────┬──────────────────────┬───────────────┤
│ Latency Heatmap      │ P50/P95/P99          │ Max Latency   │
│ (Heatmap)            │ (Gauge)              │ (Timeseries)  │
└──────────────────────┴──────────────────────┴───────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Row 2: Calculation Types                                    │
├──────────────────────┬──────────────────────┬───────────────┤
│ Single Value ROI     │ Player-Level ROI     │ Household ROI │
│ <100ms avg (Line)    │ <300ms avg (Line)    │ <500ms (Line) │
└──────────────────────┴──────────────────────┴───────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Row 3: Error Analysis                                       │
├──────────────────────┬──────────────────────┬───────────────┤
│ Calc Errors/min      │ Timeout Events       │ Retry Count   │
│ (Number)             │ (Timeseries)         │ (Timeseries)  │
└──────────────────────┴──────────────────────┴───────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Row 4: Calculation Accuracy                                 │
├──────────────────────┬──────────────────────┬───────────────┤
│ Accuracy % by Type   │ Failed Calculations  │ Audit Trail   │
│ (Gauge)              │ (Timeseries)         │ Completeness  │
└──────────────────────┴──────────────────────┴───────────────┘
```

### 3. Audit Trail & Data Integrity Dashboard

**Purpose:** Monitor value history and audit trail completeness

**Panels:**

```
┌─────────────────────────────────────────────────────────────┐
│ Row 1: Audit Trail Health                                   │
├──────────────────────┬──────────────────────┬───────────────┤
│ Records Created/min  │ Write Success Rate   │ Write Latency │
│ (Line)               │ (Gauge)              │ (Heatmap)     │
└──────────────────────┴──────────────────────┴───────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Row 2: Data Integrity                                       │
├──────────────────────┬──────────────────────┬───────────────┤
│ Total Value Changes  │ History Records      │ Verification  │
│ (Gauge)              │ (Gauge)              │ Status        │
└──────────────────────┴──────────────────────┴───────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Row 3: Error Types                                          │
├──────────────────────┬──────────────────────┬───────────────┤
│ Validation Errors    │ Database Errors      │ Parse Errors  │
│ (Pie chart)          │ (Pie chart)          │ (Pie chart)   │
└──────────────────────┴──────────────────────┴───────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Row 4: Recent Changes                                       │
├──────────────────────────────────────────────────────────────┤
│ User | Card | Value | Old Val | New Val | Timestamp | Status │
│ (Table - last 50 changes)                                     │
└──────────────────────────────────────────────────────────────┘
```

### 4. Database & Cache Health Dashboard

**Purpose:** Monitor database and cache performance

**Panels:**

```
┌─────────────────────────────────────────────────────────────┐
│ Row 1: Connection Pool                                      │
├──────────────────────┬──────────────────────┬───────────────┤
│ Active Connections   │ Idle Connections     │ Pool Usage %  │
│ (Gauge)              │ (Gauge)              │ (Gauge)       │
└──────────────────────┴──────────────────────┴───────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Row 2: Query Performance                                    │
├──────────────────────┬──────────────────────┬───────────────┤
│ Query Time P99       │ Slow Queries (>100ms)│ Query Count   │
│ (Timeseries)         │ (Timeseries)         │ (Timeseries)  │
└──────────────────────┴──────────────────────┴───────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Row 3: Cache Performance                                    │
├──────────────────────┬──────────────────────┬───────────────┤
│ Cache Hit Rate       │ Cache Miss Rate      │ Eviction Rate │
│ (Line)               │ (Line)               │ (Line)        │
└──────────────────────┴──────────────────────┴───────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Row 4: Storage                                              │
├──────────────────────┬──────────────────────┬───────────────┤
│ Database Size        │ Disk Usage %         │ Table Sizes   │
│ (Gauge)              │ (Gauge)              │ (Table)       │
└──────────────────────┴──────────────────────┴───────────────┘
```

---

## 🚨 Alerting Rules

### Critical Alerts (Page Immediately)

#### 1. Feature Availability Critical

**Alert:** `CUSTOM_VALUES_FEATURE_DOWN`

```
Trigger: Feature status = DOWN for >5 minutes
Condition: Availability < 95%
Severity: CRITICAL
Response Time: Immediate page
```

**Runbook:** [Runbook: Feature Down](#runbook-feature-down)

#### 2. Value Update Failure Rate High

**Alert:** `CUSTOM_VALUES_FAILURE_RATE_CRITICAL`

```
Trigger: Value update failure rate > 5% for >5 minutes
Query: SELECT COUNT(*) WHERE status='FAILED' / COUNT(*) * 100
Severity: CRITICAL
Response Time: <5 minutes
```

**Runbook:** [Runbook: High Failure Rate](#runbook-high-failure-rate)

#### 3. Audit Trail Missing Records

**Alert:** `AUDIT_TRAIL_MISSING_RECORDS`

```
Trigger: Expected records < actual records by >10 for >1 minute
Query: SELECT COUNT(*) FROM ValueHistory WHERE createdAt > now() - 5m
Severity: CRITICAL
Response Time: Immediate
```

**Runbook:** [Runbook: Audit Trail Failure](#runbook-audit-trail-failure)

#### 4. ROI Calculation Timeout

**Alert:** `ROI_CALCULATION_TIMEOUT_CRITICAL`

```
Trigger: ROI calculation latency > 1000ms for >10 minutes (p99)
Threshold: p99(roi_calculation_duration) > 1000ms
Severity: CRITICAL
Response Time: <10 minutes
```

**Runbook:** [Runbook: Performance Degradation](#runbook-performance-degradation)

#### 5. Database Connection Pool Exhausted

**Alert:** `DATABASE_CONNECTION_POOL_EXHAUSTED`

```
Trigger: Available connections = 0 for >30 seconds
Condition: (max_connections - active_connections) = 0
Severity: CRITICAL
Response Time: Immediate
```

**Runbook:** [Runbook: Database Connection Pool](#runbook-db-connection-pool)

---

### Warning Alerts (Slack/Email)

#### 1. ROI Calculation Performance Degradation

**Alert:** `ROI_CALCULATION_SLOW`

```
Trigger: ROI calculation latency > 500ms (p99) for >5 minutes
Threshold: p99(roi_calculation_duration) > 500ms
Severity: WARNING
Notification: Slack #incidents
```

#### 2. Value Update Failure Rate Elevated

**Alert:** `VALUE_UPDATE_FAILURE_RATE_WARNING`

```
Trigger: Value update failure rate > 2% for >5 minutes
Threshold: failures / total > 0.02
Severity: WARNING
Notification: Slack #incidents
```

#### 3. Cache Hit Rate Low

**Alert:** `CACHE_HIT_RATE_LOW`

```
Trigger: Cache hit rate < 70% for >10 minutes
Threshold: cache_hits / (cache_hits + cache_misses) < 0.70
Severity: WARNING
Notification: Slack #incidents
```

#### 4. Database Query Performance Degradation

**Alert:** `DATABASE_QUERY_SLOW`

```
Trigger: Query time > 100ms (p99) for >5 minutes
Threshold: p99(query_duration) > 100ms
Severity: WARNING
Notification: Slack #incidents
```

#### 5. Error Rate Elevated

**Alert:** `ERROR_RATE_ELEVATED`

```
Trigger: Error rate > 1% for >5 minutes
Threshold: errors / total_requests > 0.01
Severity: WARNING
Notification: Slack #incidents
```

#### 6. Memory Usage High

**Alert:** `MEMORY_USAGE_HIGH`

```
Trigger: Memory usage > 100MB per request for >5 minutes
Threshold: avg(memory_usage) > 100MB
Severity: WARNING
Notification: Slack #incidents
```

---

## 📋 Metrics Definition

### Latency Metrics

```
roi_calculation_duration
├── Type: Histogram
├── Unit: milliseconds
├── Labels: calculation_type (single|player|household)
├── P50/P95/P99 targets:
│   ├── single: <100ms / <150ms / <200ms
│   ├── player: <200ms / <250ms / <300ms
│   └── household: <300ms / <400ms / <500ms
└── Example: {type="player"} histogram_quantile(0.99, ...)

value_update_duration
├── Type: Histogram
├── Unit: milliseconds
├── Labels: operation_type (single|bulk)
├── P50/P95/P99 targets: <50ms / <75ms / <100ms
└── Example: {type="bulk"} histogram_quantile(0.99, ...)

audit_trail_write_duration
├── Type: Histogram
├── Unit: milliseconds
├── Labels: none
├── P50/P95/P99 targets: <20ms / <30ms / <50ms
└── Example: histogram_quantile(0.99, audit_trail_write_duration)

query_duration
├── Type: Histogram
├── Unit: milliseconds
├── Labels: query_type (select|insert|update|delete)
├── P50/P95/P99 targets: <10ms / <30ms / <50ms
└── Example: {query="select"} histogram_quantile(0.99, ...)
```

### Rate Metrics

```
value_updates_total
├── Type: Counter
├── Unit: operations per minute
├── Labels: status (success|failure), operation (single|bulk)
├── Example: rate(value_updates_total[1m])

roi_calculations_total
├── Type: Counter
├── Unit: operations per minute
├── Labels: status (success|failure), type (single|player|household)

audit_trail_records_total
├── Type: Counter
├── Unit: records per minute
├── Labels: status (written|failed)

errors_total
├── Type: Counter
├── Unit: errors per minute
├── Labels: error_type (validation|database|timeout|etc)
```

### Cache Metrics

```
cache_hits_total
├── Type: Counter
├── Unit: hits per minute
├── Labels: cache_type (benefit_values|roi_calculations)

cache_misses_total
├── Type: Counter
├── Unit: misses per minute
├── Labels: cache_type

cache_hit_rate
├── Type: Gauge
├── Unit: percentage
├── Calculation: cache_hits / (cache_hits + cache_misses) * 100
├── Targets: >85%

cache_evictions_total
├── Type: Counter
├── Unit: evictions per minute
├── Labels: reason (ttl_expired|memory_pressure)
```

### Resource Metrics

```
memory_usage_bytes
├── Type: Gauge
├── Unit: bytes
├── Labels: source (nodejs|cache|database)
├── Alert: >150MB

cpu_usage_percent
├── Type: Gauge
├── Unit: percentage
├── Alert: >80%

database_connections_active
├── Type: Gauge
├── Unit: count
├── Alert: =0 (available)

disk_usage_percent
├── Type: Gauge
├── Unit: percentage
├── Alert: >90%
```

---

## 🔧 Monitoring Setup

### 1. DataDog Setup (Recommended)

**Step 1: Install DataDog Agent**
```bash
# Via npm
npm install dd-trace

# Add to next.js startup
import tracer from 'dd-trace'
tracer.init()
```

**Step 2: Create Dashboard**
```bash
# Use dashboard JSON (see appendix)
# Or create via UI: Dashboards → New Dashboard → Custom
```

**Step 3: Configure Monitors**
```bash
# Via DataDog API
curl -X POST https://api.datadoghq.com/api/v1/monitor \
  -H "DD-API-KEY: $DD_API_KEY" \
  -H "DD-APPLICATION-KEY: $DD_APP_KEY" \
  -d @monitor-config.json
```

### 2. Sentry Setup (Error Tracking)

**Installation:**
```bash
npm install @sentry/nextjs @sentry/tracing
```

**Configuration:**
```typescript
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

### 3. Custom Metrics Implementation

**Add metrics to server actions:**
```typescript
// src/actions/custom-values.ts
import { recordMetric } from '@/lib/monitoring'

export async function updateBenefitValue(data) {
  const startTime = Date.now()
  
  try {
    // ... update logic
    
    recordMetric('value_update_success', {
      duration: Date.now() - startTime,
      operation: 'single'
    })
  } catch (error) {
    recordMetric('value_update_failure', {
      duration: Date.now() - startTime,
      error_type: error.type
    })
    throw error
  }
}
```

---

## 📖 Runbooks

### Runbook: Feature Down

**Alert:** `CUSTOM_VALUES_FEATURE_DOWN`

**Diagnosis:**
```bash
# Check deployment status
vercel deployments --prod

# Check server logs
vercel logs --prod | grep -i "custom-values"

# Check database connection
curl https://api.vercel.com/deployments/[id]/logs

# Check error rate
# Navigate to monitoring dashboard
# Query: SELECT COUNT(*) FROM events WHERE type='ERROR'
```

**Resolution Steps:**
1. Check error logs for root cause
2. Verify database connection is healthy
3. Check if recent deployment caused issue
4. If deployment issue: `vercel rollback --prod`
5. If database issue: Check connection pool, queries
6. Notify team via #incidents

**Prevention:**
- Add pre-deployment integration tests
- Monitor health check endpoint continuously
- Set up automatic rollback on health check failure

---

### Runbook: High Failure Rate

**Alert:** `CUSTOM_VALUES_FAILURE_RATE_CRITICAL`

**Diagnosis:**
```sql
-- Find error pattern
SELECT error_type, COUNT(*) as count
FROM value_updates
WHERE status = 'FAILED'
  AND createdAt > now() - 10m
GROUP BY error_type
ORDER BY count DESC;

-- Find affected users
SELECT DISTINCT user_id, COUNT(*) as failures
FROM value_updates
WHERE status = 'FAILED'
  AND createdAt > now() - 10m
GROUP BY user_id
ORDER BY failures DESC LIMIT 20;
```

**Possible Causes:**
1. **Validation failures** - Check input validation rules
2. **ROI calculation errors** - Check calculation logic
3. **Database errors** - Check connection pool, query performance
4. **Timeout errors** - Check timeout configuration

**Resolution:**
- For validation errors: Review validation rules, check recent changes
- For ROI errors: Check calculation logic, test with sample data
- For DB errors: Scale connection pool, optimize slow queries
- For timeouts: Increase `CUSTOM_VALUES_TIMEOUT`, optimize processing

---

### Runbook: Audit Trail Failure

**Alert:** `AUDIT_TRAIL_MISSING_RECORDS`

**Diagnosis:**
```bash
# Check if feature flag is enabled
echo $ENABLE_VALUE_HISTORY

# Check table exists
SELECT COUNT(*) FROM ValueHistory;

# Check for write errors
vercel logs --prod | grep -i "audit\|history"

# Verify migration ran
npm run prisma:migrate status
```

**Resolution:**
1. Verify `ENABLE_VALUE_HISTORY=true` in production
2. Run migration if not completed: `npm run prisma:migrate deploy`
3. Check for write permission errors in database
4. Verify audit trail write process is not blocked
5. Re-enable audit trail recording

---

### Runbook: Performance Degradation

**Alert:** `ROI_CALCULATION_TIMEOUT_CRITICAL`

**Diagnosis:**
```bash
# Check current latency
# Query monitoring dashboard: p99(roi_calculation_duration)

# Check database performance
vercel logs --prod | grep "duration:"

# Check cache hit rate
# Query: cache_hit_rate gauge

# Check resource utilization
# Memory, CPU, connections in dashboard
```

**Causes & Solutions:**

**High Database Load:**
```bash
# Check slow queries
SELECT query, COUNT(*) as count, AVG(duration) as avg_duration
FROM slow_queries
WHERE duration > 100
GROUP BY query
ORDER BY count DESC;

# Solution: Add indexes, optimize queries, scale database
```

**Low Cache Hit Rate:**
```bash
# Check cache configuration
echo $CUSTOM_VALUES_CACHE_TTL

# Solution: Increase TTL if appropriate
export CUSTOM_VALUES_CACHE_TTL=600
```

**Resource Constraints:**
```bash
# Check memory usage
# Check CPU usage
# Check connection pool

# Solution: Scale application, increase resources
```

---

### Runbook: Database Connection Pool Exhausted

**Alert:** `DATABASE_CONNECTION_POOL_EXHAUSTED`

**Diagnosis:**
```sql
-- Check connection pool status
SELECT count(*) as active_connections
FROM pg_stat_activity
WHERE datname = 'card_benefits';

-- Check long-running queries
SELECT pid, usename, application_name, state, query, query_start
FROM pg_stat_activity
WHERE query_start < now() - interval '1 minute'
ORDER BY query_start;
```

**Resolution:**
1. Identify long-running queries and kill if safe: `SELECT pg_terminate_backend(pid);`
2. Check application logs for blocked connections
3. Increase pool size: `DATABASE_POOL_MAX=30`
4. Optimize slow queries
5. Scale database resources

---

## 📱 Notification Channels

### Slack Integration

**Critical Alerts:**
- Channel: `#incidents`
- Mentions: `@devops-oncall`
- Format: [CRITICAL] Feature name - Issue description

**Warning Alerts:**
- Channel: `#incidents`
- Format: [WARNING] Feature name - Issue description

**Example Message:**
```
[CRITICAL] Custom Values: ROI calculation timeout
- Latency p99: 1245ms (threshold: 1000ms)
- Affected: 234 users in last 5min
- Action: Page devops-oncall
- Dashboard: [link]
- Runbook: [link]
```

### Email Alerts

**Distribution List:** `engineering-on-call@company.com`

**Alert Types:**
- Critical issues requiring immediate action
- Daily digest of warning-level events

### PagerDuty Integration

**Escalation Policy:**
```
Level 1: On-call DevOps engineer (immediate)
Level 2: Backend team lead (5 min if unresolved)
Level 3: Engineering manager (15 min if unresolved)
```

---

## 🔍 Log Aggregation

### Structured Logging

Log custom values operations with structured format:

```javascript
// Example log entries
{
  "timestamp": "2024-04-03T12:00:00Z",
  "level": "INFO",
  "service": "custom-values",
  "event": "value_update_success",
  "user_id": "user_123",
  "benefit_id": "benefit_456",
  "duration_ms": 45,
  "old_value": 30000,
  "new_value": 50000,
  "trace_id": "abc123def456"
}
```

### Log Retention

- **Development:** 7 days
- **Staging:** 30 days
- **Production:** 90 days

### Searchable Fields

```
- timestamp
- level (DEBUG, INFO, WARN, ERROR)
- service (custom-values)
- event (value_update_*, roi_calculation_*, audit_trail_*)
- user_id
- benefit_id
- duration_ms
- error_type
- status (success, failure)
- trace_id
```

---

## 📊 SLA & Performance Targets

| Service Level | Target | Measurement |
|---------------|--------|-------------|
| Availability | 99.9% | Uptime per month |
| Error Rate | <1% | Errors per total requests |
| P99 Latency | <500ms | ROI calculations |
| Cache Hit Rate | >85% | Cache hits per total requests |

**Calculation:**
- **Availability:** (uptime minutes / total minutes) * 100
- **Error Rate:** (failed requests / total requests) * 100
- **Latency:** histogram_quantile(0.99, duration)

---

## 🔄 Monitoring Review Schedule

- **Weekly:** Dashboard review, alert tuning
- **Monthly:** Performance trend analysis, capacity planning
- **Quarterly:** SLA review, alerting strategy update
- **Yearly:** Monitoring infrastructure audit

---

## 📖 Related Documentation

- **Deployment Guide:** [DEPLOYMENT_GUIDE_CUSTOM_VALUES.md](DEPLOYMENT_GUIDE_CUSTOM_VALUES.md)
- **Environment Configuration:** [ENV_CONFIGURATION_CUSTOM_VALUES.md](ENV_CONFIGURATION_CUSTOM_VALUES.md)
- **Operations Runbook:** [OPERATIONS_RUNBOOK_CUSTOM_VALUES.md](OPERATIONS_RUNBOOK_CUSTOM_VALUES.md)
- **Troubleshooting:** [TROUBLESHOOTING_CUSTOM_VALUES.md](TROUBLESHOOTING_CUSTOM_VALUES.md)

---

**Last Updated:** April 3, 2024  
**Version:** 1.0  
**Status:** Ready for use after QA fixes
