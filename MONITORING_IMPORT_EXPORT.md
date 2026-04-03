# Monitoring & Alerting Setup - Import/Export Feature

**Document Version:** 1.0  
**Created:** April 3, 2024  
**Purpose:** Real-time monitoring, dashboards, and alerts for import/export operations

---

## 📊 Metrics Architecture

### Metrics Collection Points

```
Import/Export Operations
    ↓
Application Metrics (Node.js)
    ↓
Time-Series Database (Prometheus/InfluxDB)
    ↓
Visualization (Grafana/Datadog)
    ↓
Alerting (PagerDuty/Slack)
```

---

## 📈 Key Metrics to Monitor

### 1. Import Job Metrics

#### Import Job Count
```
Metric: import_jobs_total
Type: Counter
Labels: status (success, failed, processing)
Query: rate(import_jobs_total[5m])
Target: >0 successful imports per 5 minutes during business hours

Threshold:
  - Success rate target: >95%
  - Alert if: <90% success rate for 10 minutes
```

#### Job Duration
```
Metric: import_job_duration_seconds
Type: Histogram
Labels: action (parse, validate, commit)
Percentiles: p50, p95, p99

Targets:
  - Parse: p95 <5s (10k records)
  - Validate: p95 <120s (10k records)
  - Commit: p95 <300s (10k records)

Alert if:
  - Parse p95 >10s for 5 minutes
  - Validate p95 >300s for 5 minutes
  - Commit p95 >600s for 5 minutes
```

#### Records Processed
```
Metric: import_records_total
Type: Counter
Labels: status (valid, invalid, skipped, duplicate)

Query Examples:
  - Total records: sum(import_records_total)
  - Invalid rate: import_records_total{status="invalid"} / import_records_total
  - Duplicate rate: import_records_total{status="duplicate"} / import_records_total

Alert if:
  - Invalid rate >10% for 15 minutes
  - Duplicate rate >50% (indicates data quality issues)
```

### 2. Parser Performance Metrics

#### Parser Latency
```
Metric: parser_duration_milliseconds
Type: Histogram
Labels: format (csv, xlsx)
Percentiles: p50, p95, p99

Target Performance:
  - CSV: <50ms per 100 records
  - XLSX: <100ms per 100 records (due to ZIP extraction)

Alert if:
  - CSV p95 >1000ms for 5 minutes
  - XLSX p95 >2000ms for 5 minutes
```

#### File Size Distribution
```
Metric: import_file_size_bytes
Type: Histogram
Labels: format (csv, xlsx)

Track:
  - Average file size
  - Max file size
  - File size distribution (p50, p95, p99)

Insight: If avg file size increasing, may need to increase timeouts
```

### 3. Validation Metrics

#### Validation Errors
```
Metric: validation_errors_total
Type: Counter
Labels: error_type (required_field, invalid_format, duplicate, constraint_violation)

Alert if:
  - Required field errors >10% of records
  - Constraint violations indicating schema misalignment
  - Unexpected error types appearing
```

#### Validation Duration
```
Metric: validation_duration_seconds
Type: Histogram
Percentiles: p50, p95, p99

Target: <120 seconds for 10,000 records
Alert if: p95 >300 seconds
```

### 4. Duplicate Detection Metrics

#### Duplicate Detection Results
```
Metric: duplicates_detected_total
Type: Counter
Labels: type (within_batch, database, resolved)

Track:
  - Duplicate rate: duplicates_detected / total_records
  - Resolution method: skip, update, merge
  - Unresolved duplicates: duplicates waiting for user decision

Alert if:
  - Duplicate rate >50% (data quality issue)
  - Unresolved duplicates >100 (user interaction needed)
  - Detection errors >1% (algorithm issues)
```

### 5. Database Transaction Metrics

#### Transaction Performance
```
Metric: transaction_duration_seconds
Type: Histogram
Labels: type (import_commit, export_stream)
Percentiles: p50, p95, p99

Target: p95 <300s
Alert if: p95 >600s or p99 >900s
```

#### Transaction Rollback Rate
```
Metric: transaction_rollbacks_total
Type: Counter
Labels: reason (validation_error, constraint_violation, timeout, user_cancel)

Alert if:
  - Rollback rate >5% of transactions
  - Specific reason rate >2% (indicates systematic issue)

Example Alert Query:
  rate(transaction_rollbacks_total[5m]) / rate(import_jobs_total[5m]) > 0.05
```

#### Connection Pool Metrics
```
Metric: db_connection_pool
Type: Gauge
Labels: status (idle, active)

Target:
  - Idle connections: 2-5
  - Active connections: <20 (max 30)
  - Utilization: <80%

Alert if:
  - Active connections >25 for 5 minutes
  - Pool exhausted (active == max)
  - Connection acquisition timeout
```

### 6. File Upload Metrics

#### Upload Success Rate
```
Metric: file_upload_total
Type: Counter
Labels: status (success, failed), reason (size_exceeded, invalid_format, storage_error)

Alert if:
  - Failure rate >5% for 10 minutes
  - Size exceeded errors indicate limit too low
  - Storage errors indicate disk space issues
```

#### Disk Space
```
Metric: import_temp_dir_free_bytes
Type: Gauge

Alert if:
  - Free space <1 GB
  - Free space decreasing rapidly (orphaned files?)

Action:
  - Clean up temp directory
  - Investigate why old imports not being cleaned
```

### 7. Export Metrics

#### Export Job Metrics
```
Metric: export_jobs_total
Type: Counter
Labels: status (success, failed), format (csv, xlsx)

Query: rate(export_jobs_total{status="success"}[5m])
Target: Track usage by format
Alert if: Error rate >5%
```

#### Export Performance
```
Metric: export_duration_seconds
Type: Histogram
Labels: format (csv, xlsx), record_count (bucket: 100, 1000, 10000)

Target: <10s for 10,000 records
Alert if: p95 >20s
```

---

## 📊 Dashboard Configurations

### Dashboard 1: Overview (Real-Time Monitoring)

**URL:** `/dashboards/import-export-overview`  
**Refresh:** 10 seconds  
**Purpose:** Quick health check during business hours

**Panels:**

1. **Import Success Rate (Last 1 Hour)**
   ```
   Query: rate(import_jobs_total{status="success"}[5m])
   Type: Gauge
   Target: >95%
   Color Coding: Green >95%, Yellow 90-95%, Red <90%
   ```

2. **Active Import Jobs**
   ```
   Query: count(import_jobs{status="Processing"})
   Type: Stat
   Target: 0-5 (high indicates queuing)
   ```

3. **Average Parse Time (Last 24h)**
   ```
   Query: histogram_quantile(0.95, rate(parser_duration_milliseconds_bucket[5m]))
   Type: Gauge
   Units: Milliseconds
   Target: <5000ms
   ```

4. **Database Transaction Errors (Last 1h)**
   ```
   Query: rate(transaction_rollbacks_total[5m])
   Type: Graph
   Alert: If trend increases
   ```

5. **Recent Imports (Last 10)**
   ```
   Query: topk(10, sort_desc(import_jobs))
   Type: Table
   Show: Job ID, Status, Records, Duration, Time
   ```

### Dashboard 2: Performance Analysis

**URL:** `/dashboards/import-export-performance`  
**Refresh:** 1 minute  
**Purpose:** Performance tracking and optimization

**Panels:**

1. **Parser Performance by Format**
   ```
   Query: histogram_quantile(0.95, rate(parser_duration_milliseconds_bucket[5m])) by (format)
   Type: Graph
   Separate lines for CSV and XLSX
   ```

2. **Validation Duration Distribution**
   ```
   Query: histogram_quantile(0.95, rate(validation_duration_seconds_bucket[5m]))
   Type: Gauge
   Alert threshold: >300s
   ```

3. **Records Per Second**
   ```
   Query: rate(import_records_total[5m])
   Type: Graph
   Target: Stable rate over time
   ```

4. **Processing Time Breakdown (Pie Chart)**
   ```
   Sum by step:
     - Parse time (p95)
     - Validation time (p95)
     - Commit time (p95)
   ```

### Dashboard 3: Error Analysis

**URL:** `/dashboards/import-export-errors`  
**Refresh:** 30 seconds (during incidents)  
**Purpose:** Troubleshooting and root cause analysis

**Panels:**

1. **Error Rate by Type**
   ```
   Query: rate(validation_errors_total[5m]) by (error_type)
   Type: Graph
   Breakdown: required_field, invalid_format, duplicate, constraint
   ```

2. **Recent Errors (Last 100)**
   ```
   Query: topk(100, sort_desc(validation_errors_total))
   Type: Table
   Show: Error type, Count, Percentage, Last occurrence
   ```

3. **Rollback Frequency**
   ```
   Query: rate(transaction_rollbacks_total[5m]) by (reason)
   Type: Graph
   Breakdown: validation_error, constraint_violation, timeout, user_cancel
   ```

4. **Failed Import Jobs**
   ```
   Query: import_jobs{status="Failed"}
   Type: Table
   Show: Job ID, Reason, Records, Error message
   ```

### Dashboard 4: Database Health

**URL:** `/dashboards/import-export-database`  
**Refresh:** 30 seconds  
**Purpose:** Database performance and resource monitoring

**Panels:**

1. **Connection Pool Status**
   ```
   Query: db_connection_pool by (status)
   Type: Graph
   Targets: Idle (green), Active (yellow), Max (red line)
   ```

2. **Transaction Duration Distribution**
   ```
   Query: histogram_quantile(0.95, rate(transaction_duration_seconds_bucket[5m]))
   Type: Gauge
   Target: <300s
   ```

3. **Query Performance (Slow Queries)**
   ```
   Query: topk(10, rate(db_slow_query_total[5m]))
   Type: Table
   Show: Query, Count, Average duration
   ```

4. **Lock Contention**
   ```
   Query: rate(db_lock_wait_total[5m])
   Type: Graph
   Alert if: Increasing trend
   ```

### Dashboard 5: Capacity Planning

**URL:** `/dashboards/import-export-capacity`  
**Refresh:** 1 hour  
**Purpose:** Long-term trend analysis and capacity planning

**Panels:**

1. **Daily Import Volume (Last 30 Days)**
   ```
   Query: sum(increase(import_jobs_total[1d]))
   Type: Bar chart
   Trend: Growing? Stable?
   ```

2. **Average Records per Import**
   ```
   Query: increase(import_records_total[1d]) / increase(import_jobs_total[1d])
   Type: Graph
   Insight: Larger imports need larger timeouts
   ```

3. **Parser Performance Trend**
   ```
   Query: histogram_quantile(0.95, rate(parser_duration_milliseconds_bucket[5m]))
   Type: Graph
   Time range: 30 days
   Insight: Degradation indicates schema or data growth
   ```

4. **Resource Utilization Trend**
   ```
   Panels:
     - CPU usage trend (30d)
     - Memory usage trend (30d)
     - Disk usage trend (30d)
   Type: Graph
   Insight: Forecast capacity needs
   ```

---

## 🚨 Alert Rules

### Critical Alerts (Page On-Call Immediately)

#### Alert 1: Import Success Rate Drops Below 90%
```yaml
alert: ImportSuccessRateCritical
expr: |
  rate(import_jobs_total{status="success"}[5m]) / 
  rate(import_jobs_total[5m]) < 0.90
for: 5m
severity: critical
annotations:
  summary: "Import success rate dropped to {{ $value | humanizePercentage }}"
  description: "Import feature is failing. Check error logs immediately."
  runbook: "DEPLOYMENT_GUIDE_IMPORT_EXPORT.md#troubleshooting"
```

#### Alert 2: Database Transaction Timeout
```yaml
alert: TransactionTimeout
expr: rate(transaction_rollbacks_total{reason="timeout"}[5m]) > 0.01
for: 3m
severity: critical
annotations:
  summary: "{{ $value | humanize }}% of transactions timing out"
  description: "Database transactions exceed timeout. Increase IMPORT_COMMIT_TIMEOUT_MS."
  action: "SSH to prod, check DATABASE_TRANSACTION_TIMEOUT_MS setting"
```

#### Alert 3: Connection Pool Exhausted
```yaml
alert: ConnectionPoolExhausted
expr: db_connection_pool{status="active"} >= db_connection_pool_max
for: 2m
severity: critical
annotations:
  summary: "Database connection pool exhausted"
  description: "No available connections for new imports. Service will hang."
  action: "Increase DATABASE_CONNECTION_POOL_MAX or investigate connection leaks"
```

#### Alert 4: Disk Space Critical
```yaml
alert: ImportDiskSpaceCritical
expr: import_temp_dir_free_bytes < 1000000000  # 1GB
for: 5m
severity: critical
annotations:
  summary: "Less than 1GB free in import temp directory"
  description: "Imports will fail when temp space runs out"
  action: "SSH to prod: du -sh /mnt/temp/card-benefits-imports && rm -rf old files"
```

### High Alerts (Daily Digest + Dashboard Warning)

#### Alert 5: High Rollback Rate
```yaml
alert: HighRollbackRate
expr: |
  rate(transaction_rollbacks_total[5m]) / 
  rate(import_jobs_total[5m]) > 0.05
for: 10m
severity: high
annotations:
  summary: "{{ $value | humanizePercentage }} of imports rolling back"
  description: "More than 5% of imports experiencing errors"
  action: "Review error logs, check data quality, verify schema"
```

#### Alert 6: Parser Performance Degradation
```yaml
alert: ParserSlowdown
expr: |
  histogram_quantile(0.95, rate(parser_duration_milliseconds_bucket[5m])) > 10000
for: 15m
severity: high
annotations:
  summary: "CSV parser taking {{ $value }}ms (p95)"
  description: "Parsing performance degraded. Check file sizes and CPU."
  action: "Review parser metrics, check for large files, consider increasing timeout"
```

#### Alert 7: Duplicate Detection Accuracy
```yaml
alert: DuplicateDetectionIssue
expr: |
  duplicates_detected_total{status="unresolved"} > 100
for: 1h
severity: high
annotations:
  summary: "{{ $value }} unresolved duplicate detections"
  description: "Many imports waiting for user duplicate resolution"
  action: "Check UI for users stuck on duplicate resolution step"
```

#### Alert 8: Validation Error Rate Spike
```yaml
alert: ValidationErrorSpike
expr: |
  rate(validation_errors_total[5m]) / 
  rate(import_records_total[5m]) > 0.10
for: 10m
severity: high
annotations:
  summary: "{{ $value | humanizePercentage }} of records failing validation"
  description: "Data quality issue or schema mismatch"
  action: "Check recent imports for data quality, review error log"
```

### Medium Alerts (Email + Metrics Dashboard)

#### Alert 9: File Upload Rate Anomaly
```yaml
alert: FileUploadAnomalies
expr: |
  rate(file_upload_total{status="failed"}[5m]) > 0.01
for: 30m
severity: medium
annotations:
  summary: "{{ $value | humanizePercentage }} of file uploads failing"
  description: "Check for valid format, size limit, or storage issues"
```

#### Alert 10: Slow Query Detection
```yaml
alert: SlowImportQueries
expr: histogram_quantile(0.99, rate(db_query_duration_seconds_bucket[5m])) > 5
for: 15m
severity: medium
annotations:
  summary: "Database queries taking {{ $value }}s (p99)"
  description: "Slow queries detected. Consider index optimization."
  action: "Review slow query log, consider adding indexes"
```

---

## 📞 Alert Routing

### PagerDuty Integration

```yaml
Routing Rules:
  1. Critical Alerts → Page on-call engineer immediately
     - Success rate <90%
     - Connection pool exhausted
     - Disk space critical
     - Transaction timeout rate >1%
  
  2. High Alerts → Daily digest + Slack notification
     - High rollback rate
     - Parser slowdown
     - Duplicate resolution backlog
     - Validation error spike
  
  3. Medium Alerts → Email + metrics dashboard only
     - File upload anomalies
     - Slow query detection
     - Minor performance degradation
```

### Slack Channel Integration

```
#import-export-alerts
├── Critical (red) → @here mention
├── High (yellow) → Regular notification
└── Medium (blue) → Summary once/hour
```

---

## 🔍 Custom Metrics Implementation

### Add to src/lib/monitoring/metrics.ts

```typescript
import { Counter, Histogram, Gauge } from 'prom-client';

// Import metrics
export const importJobsTotal = new Counter({
  name: 'import_jobs_total',
  help: 'Total import jobs processed',
  labelNames: ['status'], // success, failed, processing
});

export const importJobDuration = new Histogram({
  name: 'import_job_duration_seconds',
  help: 'Import job duration in seconds',
  labelNames: ['action'], // parse, validate, commit
  buckets: [1, 5, 10, 30, 60, 120, 300, 600], // seconds
});

export const importRecordsTotal = new Counter({
  name: 'import_records_total',
  help: 'Total records processed',
  labelNames: ['status'], // valid, invalid, duplicate, skipped
});

export const parserDuration = new Histogram({
  name: 'parser_duration_milliseconds',
  help: 'CSV/XLSX parsing duration',
  labelNames: ['format'], // csv, xlsx
  buckets: [10, 50, 100, 500, 1000, 5000], // milliseconds
});

export const validationErrors = new Counter({
  name: 'validation_errors_total',
  help: 'Validation errors',
  labelNames: ['error_type'],
});

export const duplicatesDetected = new Counter({
  name: 'duplicates_detected_total',
  help: 'Duplicates detected',
  labelNames: ['type'], // within_batch, database, resolved
});

export const transactionDuration = new Histogram({
  name: 'transaction_duration_seconds',
  help: 'Database transaction duration',
  labelNames: ['type'], // import_commit, export_stream
  buckets: [1, 5, 10, 30, 60, 120, 300, 600], // seconds
});

export const transactionRollbacks = new Counter({
  name: 'transaction_rollbacks_total',
  help: 'Transaction rollbacks',
  labelNames: ['reason'], // validation_error, constraint, timeout, user_cancel
});

// Usage in import actions:
importJobsTotal.inc({ status: 'success' });
importJobDuration.observe({ action: 'parse' }, parseTimeMs / 1000);
parserDuration.observe({ format: 'csv' }, parseTimeMs);
```

---

## 📋 Monitoring Checklist (Daily)

**Every morning:**
- [ ] Check import success rate (target: >95%)
- [ ] Review failed imports (any patterns?)
- [ ] Check parser performance (p95 <5s?)
- [ ] Verify database health
- [ ] Check disk space in temp directory
- [ ] Review error logs for new patterns

**Weekly:**
- [ ] Analyze import volume trends
- [ ] Review performance trends
- [ ] Check for new error types
- [ ] Capacity planning review
- [ ] Update runbooks if needed

**Monthly:**
- [ ] Performance optimization review
- [ ] Alert threshold tuning
- [ ] Backup and disaster recovery test
- [ ] Update monitoring documentation

---

**Version:** 1.0  
**Last Updated:** April 3, 2024  
**Review Schedule:** Monthly or as needed
