# Card Management - Monitoring & Alerting Setup

**Purpose:** Configure comprehensive monitoring for Card Management feature  
**Status:** APPROVED FOR PRODUCTION  
**Last Updated:** April 3, 2024

---

## Table of Contents

1. [Monitoring Architecture](#monitoring-architecture)
2. [Key Metrics](#key-metrics)
3. [Alert Configuration](#alert-configuration)
4. [Dashboard Setup](#dashboard-setup)
5. [Logging Strategy](#logging-strategy)
6. [Observability Checklist](#observability-checklist)

---

## Monitoring Architecture

### Four-Layer Monitoring Stack

```
┌─────────────────────────────────────────────────────┐
│         Alerting Layer (PagerDuty / Slack)          │
├─────────────────────────────────────────────────────┤
│       Analysis Layer (Datadog / New Relic)          │
├─────────────────────────────────────────────────────┤
│       Collection Layer (Prometheus / Telegraf)      │
├─────────────────────────────────────────────────────┤
│       Instrumentation Layer (Application Code)      │
└─────────────────────────────────────────────────────┘
```

### Instrumentation Points

```typescript
// Layer 1: Application Instrumentation
export async function updateCard(cardId: string, updates: CardUpdate) {
  const startTime = Date.now();
  
  try {
    // Record operation attempt
    metrics.counter('card.update.attempt', 1);
    
    // Perform update
    const result = await prisma.userCard.update({
      where: { id: cardId },
      data: updates
    });
    
    // Record success
    const duration = Date.now() - startTime;
    metrics.histogram('card.update.duration_ms', duration);
    metrics.counter('card.update.success', 1);
    
    return result;
  } catch (error) {
    // Record error
    metrics.counter('card.update.error', 1);
    metrics.counter(`card.update.error.${error.code}`, 1);
    
    logger.error('Card update failed', {
      cardId,
      error: error.message,
      duration: Date.now() - startTime
    });
    
    throw error;
  }
}
```

---

## Key Metrics

### 1. Card Operation Metrics

```
Metric Name: card_operations_total
Type: Counter
Labels:
  - operation: create, read, update, delete, archive, unarchive
  - status: success, error
  - error_code: validation_error, authz_denied, not_found

Examples:
card_operations_total{operation="create", status="success"} 1250
card_operations_total{operation="update", status="error", error_code="validation_error"} 12
```

**Alert Thresholds:**

```yaml
- alert: HighCardOperationErrorRate
  expr: |
    (rate(card_operations_total{status="error"}[5m]) / 
     rate(card_operations_total[5m])) > 0.01
  for: 5m
  annotations:
    summary: "Card operation error rate > 1%"
    
- alert: CardOperationSlowdown
  expr: |
    histogram_quantile(0.95, card_operation_duration_ms) > 500
  for: 10m
  annotations:
    summary: "Card operations p95 latency > 500ms"
```

### 2. Search & Filter Metrics

```
Metric Name: card_search_queries_total
Type: Counter
Labels:
  - status: success, timeout, error

Metric Name: card_search_duration_ms
Type: Histogram
Buckets: [10, 50, 100, 200, 500, 1000, 2000]

Examples:
rate(card_search_queries_total[1m]) = 45.2 searches/min
histogram_quantile(0.95, card_search_duration_ms) = 230ms
```

**Alert Thresholds:**

```yaml
- alert: SlowCardSearch
  expr: |
    histogram_quantile(0.95, card_search_duration_ms) > 1000
  for: 5m
  annotations:
    summary: "Card search p95 latency > 1 second"
```

### 3. Bulk Operation Metrics

```
Metric Name: card_bulk_operations_total
Type: Counter
Labels:
  - status: queued, processing, completed, failed
  - operation_type: update, delete, archive

Metric Name: card_bulk_operation_duration_seconds
Type: Histogram

Examples:
card_bulk_operations_total{status="completed"} = 342
rate(card_bulk_operations_total{status="failed"}[1h]) = 0.5 ops/hour
histogram_quantile(0.95, card_bulk_operation_duration_seconds) = 8.5s
```

**Alert Thresholds:**

```yaml
- alert: BulkOperationFailure
  expr: |
    rate(card_bulk_operations_total{status="failed"}[1h]) > 0.1
  annotations:
    summary: "Bulk operations failing more than 1 per hour"
```

### 4. Soft Delete Metrics

```
Metric Name: card_status_distribution
Type: Gauge
Labels:
  - status: ACTIVE, ARCHIVED, PENDING, PAUSED, DELETED
  - player_id: (optional - for player-specific tracking)

Metric Name: card_archival_duration_seconds
Type: Histogram

Examples:
card_status_distribution{status="ACTIVE"} = 4892
card_status_distribution{status="ARCHIVED"} = 312
card_status_distribution{status="DELETED"} = 30

# Integrity check: archived + active should make sense
ratio = archived / active = 312 / 4892 = 0.064 (6.4% - reasonable)
```

**Alert Thresholds:**

```yaml
- alert: AbnormalArchiveRatio
  expr: |
    (card_status_distribution{status="ARCHIVED"} / 
     card_status_distribution{status="ACTIVE"}) > 0.5
  for: 1h
  annotations:
    summary: "Archive ratio > 50% - possible data issue"

- alert: SuspiciousDeleteCount
  expr: |
    rate(card_status_distribution{status="DELETED"}[1d]) > 100
  annotations:
    summary: "High card deletion rate - manual verification needed"
```

### 5. Database Metrics

```
Metric Name: db_connection_pool_usage
Type: Gauge
Labels:
  - state: active, idle, waiting

Metric Name: db_query_duration_ms
Type: Histogram
Labels:
  - query_type: select, insert, update, delete

Metric Name: db_slow_queries_total
Type: Counter

Examples:
db_connection_pool_usage{state="active"} = 8 / 30 connections
rate(db_slow_queries_total[1m]) = 2 slow queries/min
histogram_quantile(0.99, db_query_duration_ms) = 500ms
```

**Alert Thresholds:**

```yaml
- alert: DatabaseConnectionPoolExhaustion
  expr: |
    (db_connection_pool_usage{state="active"} / 30) > 0.8
  for: 5m
  annotations:
    summary: "Database connections > 80% usage"

- alert: SlowQueries
  expr: |
    rate(db_slow_queries_total[5m]) > 5
  annotations:
    summary: "More than 5 slow queries per minute"
```

---

## Alert Configuration

### Alert Levels & Escalation

#### CRITICAL Alerts (Immediate Response)

```yaml
# Alert 1: Service Unavailable
- alert: CardManagementServiceDown
  expr: up{job="card-management"} == 0
  for: 1m
  annotations:
    severity: critical
    action: "Page on-call engineer"
    runbook: PRODUCTION_DEPLOYMENT_GUIDE.md#incident-database-unavailable

# Alert 2: Data Integrity Issue
- alert: CardDataCorruption
  expr: |
    (card_status_distribution{status="ARCHIVED"} / 
     card_status_distribution{status="ACTIVE"}) > 2
  for: 5m
  annotations:
    severity: critical
    action: "Immediate manual review, consider rollback"

# Alert 3: High Error Rate
- alert: HighErrorRateCardManagement
  expr: |
    (rate(card_operations_total{status="error"}[5m]) / 
     rate(card_operations_total[5m])) > 0.05
  for: 5m
  annotations:
    severity: critical
    action: "Page on-call, investigate logs"
```

#### HIGH Alerts (Within 15 minutes)

```yaml
- alert: SlowQueryPerformance
  expr: |
    histogram_quantile(0.95, db_query_duration_ms) > 1000
  for: 10m
  annotations:
    severity: high
    action: "Review slow queries, add indexes if needed"

- alert: MemoryLeakDetected
  expr: |
    rate(process_resident_memory_bytes[30m]) > 0
  for: 30m
  annotations:
    severity: high
    action: "Monitor, prepare for restart if exceeds 1GB"
```

#### MEDIUM Alerts (Within 1 hour)

```yaml
- alert: BackupFailure
  expr: |
    time() - backup_last_completed_timestamp_seconds > 86400
  annotations:
    severity: medium
    action: "Verify backup system, check disk space"

- alert: LowDiskSpace
  expr: |
    (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.2
  annotations:
    severity: medium
    action: "Plan cleanup or storage upgrade"
```

### Slack Integration

```yaml
# In your monitoring tool (Datadog/Prometheus Alertmanager):
global:
  slack_api_url: $SLACK_WEBHOOK_URL

route:
  receiver: 'default'
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h

receivers:
  - name: 'default'
    slack_configs:
      - channel: '#card-management-alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: |
          Severity: {{ .GroupLabels.severity }}
          Service: Card Management
          {{ range .Alerts }}
            {{ .Annotations.summary }}
          {{ end }}
        send_resolved: true
        color: '{{ if eq .Status "firing" }}danger{{ else }}good{{ end }}'
```

### PagerDuty Integration

```yaml
receivers:
  - name: 'critical'
    pagerduty_configs:
      - service_key: $PAGERDUTY_SERVICE_KEY
        description: '{{ .GroupLabels.alertname }} - {{ .GroupLabels.instance }}'
        details:
          severity: '{{ .GroupLabels.severity }}'
          alerts: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
```

---

## Dashboard Setup

### Datadog Dashboard Configuration

```python
# dashboard.py - Infrastructure as Code

DASHBOARD_JSON = {
    "title": "Card Management System",
    "description": "Real-time monitoring of card operations",
    "layout_type": "ordered",
    "widgets": [
        # Row 1: System Health
        {
            "type": "gauge",
            "title": "System Health",
            "query": "avg:http.requests.errors{service:card-management} / avg:http.requests{service:card-management}",
            "gauge": {
                "autoscale": True,
                "custom": {
                    "max": 1,
                    "min": 0
                }
            }
        },
        
        # Row 2: Card Operations
        {
            "type": "timeseries",
            "title": "Card Operations Rate",
            "queries": [
                {"query": "rate(card_operations_total{status='success'}[1m])"},
                {"query": "rate(card_operations_total{status='error'}[1m])"}
            ]
        },
        {
            "type": "gauge",
            "title": "Error Rate",
            "query": "rate(card_operations_total{status='error'}[5m]) / rate(card_operations_total[5m])"
        },
        
        # Row 3: Performance
        {
            "type": "timeseries",
            "title": "Response Time (p50, p95, p99)",
            "queries": [
                {"query": "histogram_quantile(0.50, card_operation_duration_ms)"},
                {"query": "histogram_quantile(0.95, card_operation_duration_ms)"},
                {"query": "histogram_quantile(0.99, card_operation_duration_ms)"}
            ]
        },
        
        # Row 4: Database
        {
            "type": "number",
            "title": "Total Cards",
            "query": "card_status_distribution{status='ACTIVE'}"
        },
        {
            "type": "number",
            "title": "Archived Cards",
            "query": "card_status_distribution{status='ARCHIVED'}"
        },
        {
            "type": "timeseries",
            "title": "Database Connections",
            "query": "db_connection_pool_usage{state='active'} / 30"
        }
    ]
}
```

### Grafana Dashboard Configuration

```json
{
  "dashboard": {
    "title": "Card Management Operations",
    "panels": [
      {
        "title": "Card Operation Success Rate",
        "targets": [
          {
            "expr": "rate(card_operations_total{status='success'}[5m]) / rate(card_operations_total[5m])"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "min": 0,
            "max": 1,
            "unit": "percentunit"
          }
        }
      },
      {
        "title": "Card Search Performance",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, card_search_duration_ms)"
          }
        ]
      },
      {
        "title": "Card Status Distribution",
        "type": "piechart",
        "targets": [
          {
            "expr": "card_status_distribution"
          }
        ]
      }
    ]
  }
}
```

---

## Logging Strategy

### Log Levels & Sampling

```typescript
// Log all errors and warnings
if (error.code === 'VALIDATION_ERROR') {
  logger.warn('Card validation failed', {
    cardId,
    error: error.message,
    level: 'WARN',
    sampleRate: 1.0  // Log all
  });
}

// Sample info logs (10%)
if (operation === 'READ') {
  logger.info('Card retrieved', {
    cardId,
    level: 'INFO',
    sampleRate: 0.1  // Log 10%
  });
}

// Debug logs only in development
if (process.env.NODE_ENV === 'development') {
  logger.debug('Card calculation details', {
    cardId,
    calculations: {...}
  });
}
```

### Log Structure

```json
{
  "timestamp": "2024-04-03T14:32:45.123Z",
  "level": "ERROR",
  "service": "card-management",
  "operation": "archiveCard",
  "userId": "user-123",
  "playerId": "player-456",
  "cardId": "card-789",
  "status": "ARCHIVED",
  "errorCode": "VALIDATION_ERROR",
  "errorMessage": "Invalid archive reason",
  "duration_ms": 45,
  "trace_id": "trace-abc-123",
  "span_id": "span-def-456"
}
```

### Log Retention & Cleanup

```bash
# Keep logs for 30 days
find logs/ -name "*.log" -mtime +30 -delete

# Compress old logs (> 7 days)
find logs/ -name "*.log" -mtime +7 -exec gzip {} \;

# Archive compressed logs to S3
aws s3 sync logs/ s3://backups/logs/ --exclude "*.log" --include "*.gz"
```

---

## Observability Checklist

### Pre-Deployment

- [ ] All metrics are being collected
  ```bash
  curl http://localhost:9090/metrics | grep card_
  ```

- [ ] All alert rules are configured
  ```bash
  promtool check rules alerting_rules.yml
  ```

- [ ] Dashboard is created and accessible
  - [ ] Grafana dashboard available at `/dashboard/card-management`
  - [ ] All widgets are populated with data

- [ ] Logging is working
  ```bash
  tail logs/app.log | jq . | head -20
  ```

- [ ] Log aggregation pipeline is working
  ```bash
  # Query logs in Datadog/Splunk
  service:card-management level:ERROR | stats count()
  ```

### Post-Deployment (First 24 Hours)

- [ ] Monitor error rate
  - Expected: < 0.1%
  - Actual: _______

- [ ] Monitor response times
  - Expected p95: < 500ms
  - Actual p95: _______

- [ ] Monitor database health
  - Connection pool: < 80% usage
  - Slow queries: < 5/minute
  - Size growth: Normal

- [ ] Verify alerts are triggering correctly
  ```bash
  # Test alert
  kill -9 <app-pid>
  # Verify alert fires in PagerDuty / Slack
  ```

- [ ] Verify log aggregation
  ```bash
  # Search logs for test pattern
  service:card-management "test-marker" | count
  ```

### Ongoing Monitoring

- [ ] Weekly review of metrics trends
- [ ] Monthly review of alert effectiveness
- [ ] Quarterly review of dashboard completeness
- [ ] Annual capacity planning based on growth trends

---

## Useful Queries

### Prometheus/PromQL Queries

```promql
# Card operation success rate
rate(card_operations_total{status="success"}[5m]) / rate(card_operations_total[5m])

# Top 5 slowest operations
topk(5, histogram_quantile(0.99, card_operation_duration_ms))

# Error rate by operation type
rate(card_operations_total{status="error"}[5m]) by (operation)

# Archive ratio (data integrity check)
card_status_distribution{status="ARCHIVED"} / 
  (card_status_distribution{status="ACTIVE"} + 
   card_status_distribution{status="ARCHIVED"})

# Database query performance p95
histogram_quantile(0.95, db_query_duration_ms) by (query_type)

# Memory usage trend
rate(process_resident_memory_bytes[1h])
```

### Datadog/SQL Queries

```sql
-- Card operations over time
SELECT timestamp, COUNT(*) as ops_count, 
       SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as error_count
FROM card_operations
WHERE timestamp > now() - INTERVAL '24 hours'
GROUP BY DATE(timestamp)
ORDER BY timestamp DESC

-- Search performance
SELECT AVG(duration_ms) as avg_duration,
       PERCENTILE(duration_ms, 95) as p95_duration,
       PERCENTILE(duration_ms, 99) as p99_duration
FROM card_search_queries
WHERE timestamp > now() - INTERVAL '1 hour'

-- Card status distribution
SELECT status, COUNT(*) as count
FROM user_cards
GROUP BY status
ORDER BY count DESC
```

---

## References

- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT_GUIDE.md)
- [Operations Runbook](./OPERATIONS_RUNBOOK_CARD_MANAGEMENT.md)
- [QA Report](../.github/specs/card-management-qa-report.md)
- [Monitoring Tools Setup](#)
- [Alerting Best Practices](#)
