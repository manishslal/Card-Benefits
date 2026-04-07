# Phase 2B Monitoring & Observability Setup

**Version:** 1.0.0  
**Purpose:** Production monitoring for Phase 2B advanced features  
**Platforms:** Sentry, Railway Dashboard, Structured Logging  

---

## Table of Contents

1. [Monitoring Architecture](#monitoring-architecture)
2. [Error Tracking (Sentry)](#error-tracking-sentry)
3. [Application Logging](#application-logging)
4. [Performance Monitoring](#performance-monitoring)
5. [Database Monitoring](#database-monitoring)
6. [Custom Metrics](#custom-metrics)
7. [Alerting Strategy](#alerting-strategy)
8. [Dashboards](#dashboards)

---

## Monitoring Architecture

```
Application
    ↓
┌─────────────────────────────┐
│  Structured JSON Logging    │
│  (stdout/stderr)            │
└─────────────────────────────┘
    ↓
┌─────────────────────────────┐
│  Railway Dashboard          │
│  - Logs aggregation         │
│  - Metrics visualization    │
│  - Health checks            │
└─────────────────────────────┘
    ↓
┌─────────────────────────────┐
│  Error Tracking             │
│  - Sentry for exceptions    │
│  - Stack traces             │
│  - Session replay           │
└─────────────────────────────┘
    ↓
┌─────────────────────────────┐
│  Alerting System            │
│  - Slack notifications      │
│  - Critical alerts          │
│  - Escalation rules         │
└─────────────────────────────┘
```

---

## Error Tracking (Sentry)

### Configuration

**File:** `src/lib/sentry.ts` (Optional - Add if using Sentry)

```typescript
import * as Sentry from "@sentry/nextjs";

// Initialize Sentry (called in app initialization)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: 0.01,
    
    // Capture breadcrumbs for context
    beforeBreadcrumb: (breadcrumb) => {
      // Filter out sensitive breadcrumbs
      if (breadcrumb.data?.url?.includes('api/auth')) {
        breadcrumb.data = { ...breadcrumb.data, url: '[REDACTED]' };
      }
      return breadcrumb;
    },
    
    // Filter out sensitive data in events
    beforeSend: (event) => {
      // Remove PII
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
      }
      return event;
    },
    
    // Ignore expected errors
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      // Random plugins/extensions
      'chrome://extensions',
      // Network timeouts
      'NetworkError',
    ],
  });
}
```

### Environment Variables

```bash
# Set in production environment
SENTRY_DSN=https://[key]@[org].ingest.sentry.io/[project-id]

# Optional: Set release version
SENTRY_RELEASE=phase2b-1.0.0

# Optional: Sentry auth token for source maps
SENTRY_AUTH_TOKEN=[token]
```

### Sentry Features to Enable

1. **Performance Monitoring**
   - Track transaction duration
   - Database query timing
   - API endpoint latency

2. **Session Replay**
   - Record user sessions on errors
   - Redact sensitive information
   - Analyze user actions leading to error

3. **Release Tracking**
   - Link errors to specific releases
   - Track issue resolution
   - Compare error rates across versions

4. **Alerts**
   - New issue detection
   - Error rate spike
   - Performance degradation

---

## Application Logging

### Structured Logging Format

All logs output as JSON for aggregation:

```json
{
  "level": "error",
  "timestamp": "2026-04-07T12:34:56.789Z",
  "message": "Failed to generate recommendation",
  "context": {
    "userId": "[REDACTED]",
    "cardId": "card123",
    "durationMs": 145
  },
  "error": "Database connection timeout",
  "stack": "Error at generateRecommendation..."
}
```

### Logger Usage

```typescript
import { logger } from '@/lib/logger';

// Info: Normal operations
logger.info('User logged in', { userId: user.id });

// Warn: Unusual but handled situations
logger.warn('Slow query detected', { queryTime: 2500 });

// Error: Something went wrong
logger.error('Database error', error, { query: 'SELECT ...' });

// Debug: Development information
logger.debug('Feature flag state', { phase2b: true, recommendations: true });

// Performance: Track operation timing
logger.performance('Recommendation generation', duration, { cardId: '123' });

// API: Track API calls
logger.api('POST /api/benefits/usage', 201, responseTime, { userId: '123' });
```

### Log Levels

| Level | Usage | Examples |
|-------|-------|----------|
| **error** | Errors that need attention | Exceptions, database errors, API failures |
| **warn** | Unexpected but handled | Slow queries, rate limiting, missing data |
| **info** | Normal operations | User actions, deployments, feature usage |
| **debug** | Development information | Variable values, control flow, feature flags |

### Log Aggregation

Logs are collected by Railway and available in:
- **Railway Dashboard** → Logs tab
- **Query:** Filter by level, service, time range
- **Export:** Download as CSV for analysis

---

## Performance Monitoring

### Key Performance Indicators (KPIs)

| KPI | Target | Warning | Critical |
|-----|--------|---------|----------|
| API Response Time (p95) | <200ms | >500ms | >1000ms |
| Database Query Time (p95) | <100ms | >300ms | >500ms |
| Error Rate | <0.1% | >1% | >5% |
| Server Uptime | 99.9% | <99.5% | <99% |
| CPU Usage | <60% | >80% | >90% |
| Memory Usage | <70% | >85% | >95% |

### Tracking API Performance

```typescript
import { logger } from '@/lib/logger';
import { metrics } from '@/lib/metrics';

// In API route middleware
export async function middleware(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const response = await next();
    
    // Record metrics
    const duration = Date.now() - startTime;
    metrics.apiLatency.record(duration);
    metrics.api(request.method, response.status, duration);
    
    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    metrics.apiErrors.increment();
    logger.error('API error', error as Error, {
      method: request.method,
      path: request.nextUrl.pathname,
      duration,
    });
    throw error;
  }
}
```

### Database Query Monitoring

```typescript
import { logger } from '@/lib/logger';
import { metrics } from '@/lib/metrics';

// Monitor Prisma queries
prisma.$on('query', (e) => {
  metrics.databaseQueryLatency.record(e.duration);
  
  if (e.duration > 500) {
    logger.warn('Slow database query detected', {
      query: e.query.substring(0, 100),
      duration: e.duration,
    });
  }
});
```

---

## Database Monitoring

### Connection Pool Monitoring

```typescript
// Monitor Prisma connection pool
const client = prisma.$disconnect;

// Check connection state
const poolStatus = () => {
  const stats = prisma.$raw`SELECT count(*) FROM pg_stat_activity`;
  return stats;
};

// Alert if too many connections
if (activeConnections > 50) {
  logger.warn('Database connection pool high', {
    activeConnections,
    threshold: 50,
  });
}
```

### Slow Query Detection

Set in `prisma.yml` or environment:

```bash
# Log queries slower than 100ms
DATABASE_SLOW_QUERY_LOG_THRESHOLD=100
```

### Query Performance Analysis

```typescript
// Example: Track recommendation generation performance
const startTime = Date.now();

const recommendation = await prisma.benefitRecommendation.create({
  data: {
    userId: user.id,
    cardId: card.id,
    benefit: selectedBenefit,
  },
});

const duration = Date.now() - startTime;
metrics.databaseQueryLatency.record(duration);
metrics.recommendationsGenerated.increment();
```

---

## Custom Metrics

### Business Metrics

```typescript
import { metrics } from '@/lib/metrics';

// Track benefits usage
export async function recordUsage(userId: string, cardId: string) {
  const record = await prisma.benefitUsageRecord.create({
    data: { userId, cardId, usedAmount: 1 },
  });
  
  metrics.usageRecorded.increment();
  logger.info('Usage recorded', { userId, cardId });
  
  return record;
}

// Track recommendations
export async function generateRecommendation(userId: string) {
  const rec = await prisma.benefitRecommendation.create({
    data: { userId, benefit: 'cashback' },
  });
  
  metrics.recommendationsGenerated.increment();
  logger.info('Recommendation generated', { userId });
  
  return rec;
}
```

### Getting Metrics Summary

```typescript
// Get current metrics snapshot
import { metrics } from '@/lib/metrics';

const summary = metrics.getSummary();
console.log(summary);

// Output:
// {
//   "timestamp": "2026-04-07T12:34:56.789Z",
//   "phase2b": {
//     "benefitsCreated": 1250,
//     "usageRecorded": 5420,
//     "recommendationsGenerated": 3180,
//     "activeUsers": 245
//   },
//   "performance": {
//     "apiLatency": { "avg": 145, "p95": 280, "p99": 450, "max": 1200 },
//     "databaseQuery": { "avg": 45, "p95": 120, "p99": 250, "max": 890 }
//   },
//   "errors": { "apiErrors": 12, "databaseErrors": 2, "authFailures": 3 }
// }
```

---

## Alerting Strategy

### Alert Configuration

**Slack Integration for Critical Alerts:**

```bash
# Set in environment
SLACK_WEBHOOK=https://hooks.slack.com/services/T.../...
```

### Alert Rules

**HIGH PRIORITY ALERTS:**

```
Error Rate >5%:
  Action: Page on-call engineer
  Escalation: 5 minutes
  Response: Check logs immediately

API Latency >1s:
  Action: Slack #engineering-support
  Escalation: 10 minutes
  Response: Check database performance

Database Connection Error:
  Action: Page DevOps engineer
  Escalation: Immediate
  Response: Verify database is running
```

**MEDIUM PRIORITY ALERTS:**

```
Error Rate 1-5%:
  Action: Slack #engineering-support
  Investigation: Check error pattern

API Latency 500-1000ms:
  Action: Slack #engineering-support
  Investigation: Check slow queries

CPU >80%:
  Action: Slack #engineering-support
  Response: Consider scaling
```

**LOW PRIORITY ALERTS:**

```
Error Rate <1%:
  Action: Log to monitoring dashboard
  Investigation: Next business day

API Latency 200-500ms:
  Action: Log metric
  Investigation: Monitor trend

Memory >85%:
  Action: Slack #engineering-support
  Response: Monitor, may need optimization
```

### Slack Notifications

Messages posted to `#deployments` and `#engineering-support`:

```
🔴 CRITICAL ALERT

Service: card-benefits-prod
Time: 2026-04-07 12:34:56 UTC
Alert: Error rate >5%

📊 Details:
- Error rate: 7.2% (threshold: 5%)
- Affected users: ~145
- Duration: 8 minutes
- Last deployed: 2 hours ago

🔍 Quick Actions:
1. Check production logs
2. Determine if rollback needed
3. Contact on-call engineer

👤 On-Call: @devops-engineer
📞 Page: /on-call
```

---

## Dashboards

### Railway Dashboard

**Access:** https://railway.app/project/[PROJECT-ID]

**Tabs:**
- **Logs:** Real-time application logs
- **Metrics:** CPU, memory, network usage
- **Health:** Service status, deployment status
- **Deployments:** Version history, release notes

### Custom Metrics Dashboard

**Create in Railway:**

1. Go to Metrics tab
2. Add custom panels for:
   - Benefits created (count over time)
   - Recommendations generated
   - API response time (p95, p99)
   - Error rate
   - Active users

### Example Dashboard Queries

```
# API Response Time (last 24 hours)
SELECT timestamp, response_time FROM api_metrics WHERE timestamp > now() - interval '24 hours'

# Error Rate (hourly)
SELECT timestamp, error_rate FROM error_metrics GROUP BY timestamp_hour

# Active Users (last 7 days)
SELECT date_trunc('day', timestamp), count(DISTINCT user_id) FROM events GROUP BY date_trunc('day', timestamp)

# Database Performance (last 24 hours)
SELECT timestamp, query_time FROM database_metrics WHERE timestamp > now() - interval '24 hours'
```

---

## Monitoring Checklist

### Daily Monitoring

- [ ] Check error rate (should be <1%)
- [ ] Review API latency (should be <200ms p95)
- [ ] Check database connections (should be <50)
- [ ] Review application logs for warnings
- [ ] Verify health check endpoint responding

### Weekly Monitoring

- [ ] Analyze performance trends
- [ ] Review error patterns
- [ ] Check for slow queries
- [ ] Verify backup status
- [ ] Review resource usage trends

### Monthly Review

- [ ] Performance baseline comparison
- [ ] Optimization opportunities
- [ ] Alert threshold adjustments
- [ ] Capacity planning
- [ ] Security audit of logs

---

## Production Monitoring Runbook

**First On-Site with Alert:**

1. **Take Alert** (0 seconds)
   - Note time and severity
   - Page on-call if critical
   - Join incident channel in Slack

2. **Triage** (0-2 minutes)
   - Check error logs
   - Determine scope (# users affected)
   - Is it Phase 2B or Phase 1?

3. **Investigate** (2-10 minutes)
   - Check most recent logs
   - Look for error pattern
   - Check if recent deployment
   - Check if database issue

4. **Communicate** (Ongoing)
   - Post status update to Slack
   - Tag relevant team members
   - Keep stakeholders informed

5. **Act** (Based on severity)
   - For <1% errors: Monitor
   - For 1-5% errors: Investigate, may rollback
   - For >5% errors: Rollback immediately
   - For database errors: Rollback immediately

6. **Resolve** (After fix)
   - Update status in Slack
   - Create incident report
   - Schedule post-mortem (if needed)

---

**Monitoring is continuous. Alert thresholds are reviewed quarterly.**  
**For alert questions, contact the DevOps team.**
