# Custom Values Feature - Operations Runbook

**Date:** April 3, 2024  
**Version:** 1.0  
**Audience:** DevOps Engineers, Backend Team  
**Status:** Ready for production operations

---

## 📋 Table of Contents

1. [Pre-Deployment Verification](#pre-deployment-verification)
2. [Deployment Execution](#deployment-execution)
3. [Post-Deployment Verification](#post-deployment-verification)
4. [Monitoring & Health Checks](#monitoring-and-health-checks)
5. [Emergency Procedures](#emergency-procedures)
6. [Rollback Procedures](#rollback-procedures)
7. [Troubleshooting Guide](#troubleshooting-guide)
8. [Data Integrity Checks](#data-integrity-checks)

---

## ✅ Pre-Deployment Verification

### Phase 1: Code Quality (T-48 hours)

**Checklist:**

```bash
#!/bin/bash
set -e

echo "=== Custom Values Pre-Deployment Code Verification ==="

# 1. Run full test suite
echo "1. Running test suite..."
npm run test:all
TEST_EXIT=$?
if [ $TEST_EXIT -ne 0 ]; then
  echo "❌ Tests failed. Abort deployment."
  exit 1
fi

# 2. Check coverage
echo "2. Verifying test coverage..."
npm run test:coverage
COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
if (( $(echo "$COVERAGE < 80" | bc -l) )); then
  echo "❌ Coverage ${COVERAGE}% below 80% threshold"
  exit 1
fi

# 3. Type checking
echo "3. Running TypeScript type checker..."
npm run type-check

# 4. Linting
echo "4. Running ESLint..."
npm run lint

# 5. Build
echo "5. Building application..."
npm run build

# 6. Security audit
echo "6. Running security audit..."
npm audit --audit-level=moderate

echo "✅ All pre-deployment checks passed"
```

### Phase 2: Environment Verification (T-24 hours)

```bash
#!/bin/bash

echo "=== Custom Values Environment Verification ==="

# Check required environment variables
REQUIRED_VARS=(
  "DATABASE_URL"
  "SESSION_SECRET"
  "CRON_SECRET"
  "CUSTOM_VALUES_CACHE_TTL"
  "CUSTOM_VALUES_TIMEOUT"
  "ENABLE_VALUE_HISTORY"
)

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing environment variable: $var"
    exit 1
  fi
  echo "✅ $var configured"
done

# Verify database connection
echo "Testing database connection..."
npm run test:db-connection || exit 1

# Verify cache configuration
echo "Testing cache configuration..."
if [ "$CACHE_STRATEGY" = "redis" ]; then
  redis-cli -u $REDIS_URL ping || exit 1
fi

# Verify feature flags
echo "Verifying feature flags..."
if [ "$ENABLE_VALUE_HISTORY" != "true" ]; then
  echo "⚠️ Warning: Value history disabled"
fi

echo "✅ All environment checks passed"
```

### Phase 3: Database Verification (T-4 hours)

```bash
#!/bin/bash

echo "=== Custom Values Database Verification ==="

# 1. Backup current database
echo "1. Creating database backup..."
BACKUP_DIR="backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p $BACKUP_DIR
pg_dump $DATABASE_URL > $BACKUP_DIR/backup.sql

# 2. Verify schema
echo "2. Verifying current schema..."
psql $DATABASE_URL -c "
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema='public'
  ORDER BY table_name;
"

# 3. Check for pending migrations
echo "3. Checking for pending migrations..."
npm run prisma:migrate status

# 4. Test migration in staging
echo "4. Testing migration in staging environment..."
STAGING_DB=$DATABASE_URL npm run prisma:migrate deploy --preview-feature

# 5. Verify no data loss
echo "5. Verifying data integrity..."
psql $DATABASE_URL -c "
  SELECT 
    'MasterCard' as table_name, COUNT(*) as count FROM MasterCard
  UNION ALL
  SELECT 'User', COUNT(*) FROM User
  UNION ALL
  SELECT 'UserCard', COUNT(*) FROM UserCard
  UNION ALL
  SELECT 'UserBenefit', COUNT(*) FROM UserBenefit;
"

echo "✅ Database verification passed"
```

---

## 🚀 Deployment Execution

### Step 1: Final Go/No-Go Decision (T-30 minutes)

**Team Lead Approval:**
```
[ ] Code review completed and approved
[ ] All tests passing (100%)
[ ] No critical security issues
[ ] Monitoring dashboards online
[ ] Team members notified
[ ] Rollback plan reviewed
[ ] Database backup verified
```

**Sign-off:**
```
Approved By: ___________________
Date/Time: ___________________
```

### Step 2: Create Deployment Tag (T-20 minutes)

```bash
#!/bin/bash

DEPLOYMENT_TAG="custom-values-prod-$(date +%Y%m%d-%H%M%S)"

echo "Creating deployment tag: $DEPLOYMENT_TAG"

git tag -a $DEPLOYMENT_TAG \
  -m "Custom Values Production Deployment
  
  - All 5 critical QA issues resolved
  - Test suite: 100% pass rate
  - Code coverage: ≥80%
  - Database migration: verified
  - Deployment: $(date)
  "

git push origin $DEPLOYMENT_TAG

echo "✅ Deployment tag created: $DEPLOYMENT_TAG"
```

### Step 3: Merge to Main Branch (T-15 minutes)

```bash
#!/bin/bash

echo "Preparing main branch for deployment..."

# Verify main is up-to-date
git checkout main
git fetch origin
git status

# Verify custom-values branch is merged
git log --oneline main | grep "custom-values\|Custom Values" | head -5

echo "✅ Main branch ready for deployment"
```

### Step 4: Trigger Production Deployment (T-10 minutes)

```bash
#!/bin/bash

echo "Triggering deployment to production..."

# Option A: Automatic deployment (push to main triggers workflow)
git push origin main

# Option B: Manual deployment via Vercel CLI
vercel deploy --prod --yes

# Monitor deployment
echo "Waiting for build to complete..."
sleep 10
vercel logs --prod --follow

echo "✅ Deployment triggered"
```

### Step 5: Wait for Deployment Completion (T+0 to T+5)

```bash
#!/bin/bash

echo "Waiting for deployment to complete..."

# Check deployment status
DEPLOY_STATUS=$(vercel deployments --prod --json | jq -r '.[0].state')
while [ "$DEPLOY_STATUS" != "READY" ]; do
  echo "Status: $DEPLOY_STATUS - waiting..."
  sleep 30
  DEPLOY_STATUS=$(vercel deployments --prod --json | jq -r '.[0].state')
done

echo "✅ Deployment completed successfully"

# Get deployment URL
DEPLOY_URL=$(vercel deployments --prod --json | jq -r '.[0].url')
echo "Deployment URL: $DEPLOY_URL"
```

---

## ✔️ Post-Deployment Verification

### Phase 1: Immediate Health Check (T+1 minute)

```bash
#!/bin/bash

echo "=== Post-Deployment Health Checks ==="

PROD_URL="https://card-benefits.vercel.app"

# 1. Health endpoint
echo "1. Checking health endpoint..."
curl -f $PROD_URL/api/health || {
  echo "❌ Health check failed"
  exit 1
}

# 2. Database connectivity
echo "2. Verifying database connection..."
curl -f $PROD_URL/api/db-health || {
  echo "❌ Database check failed"
  exit 1
}

# 3. Feature availability
echo "3. Checking custom values availability..."
curl -f $PROD_URL/api/features | grep custom-values || {
  echo "❌ Custom values feature not available"
  exit 1
}

echo "✅ Basic health checks passed"
```

### Phase 2: Smoke Testing (T+5 minutes)

```bash
#!/bin/bash

echo "=== Smoke Testing Custom Values Feature ==="

# Test 1: Edit single benefit value
echo "Test 1: Single value update..."
curl -X POST https://card-benefits.vercel.app/api/values/update \
  -H "Content-Type: application/json" \
  -d '{"benefitId":"test_123","newValue":50000}' \
  || echo "⚠️ Test 1 failed"

# Test 2: Bulk update
echo "Test 2: Bulk value update..."
curl -X POST https://card-benefits.vercel.app/api/values/bulk-update \
  -H "Content-Type: application/json" \
  -d '{"updates":[{"benefitId":"b1","value":40000}]}' \
  || echo "⚠️ Test 2 failed"

# Test 3: ROI calculation
echo "Test 3: ROI calculation..."
curl -f https://card-benefits.vercel.app/api/roi/calculate || echo "⚠️ Test 3 failed"

# Test 4: Audit trail
echo "Test 4: Value history audit trail..."
curl -f https://card-benefits.vercel.app/api/history/values || echo "⚠️ Test 4 failed"

echo "✅ Smoke tests completed"
```

### Phase 3: Performance Baseline (T+15 minutes)

```bash
#!/bin/bash

echo "=== Performance Baseline Measurement ==="

# Measure ROI calculation latency
echo "Measuring ROI calculation performance..."
npm run benchmark:roi --env=production

# Measure value update latency
echo "Measuring value update performance..."
npm run benchmark:updates --env=production

# Check cache effectiveness
echo "Checking cache hit rate..."
npm run benchmark:cache --env=production

echo "✅ Performance baseline established"
```

### Phase 4: Error Rate Monitoring (T+30 minutes)

```bash
#!/bin/bash

echo "=== Error Rate Verification ==="

# Query error logs
echo "Checking error rate in past 10 minutes..."
vercel logs --prod | grep -i error | wc -l

# Alert if error rate > 1%
ERROR_COUNT=$(vercel logs --prod | grep -i error | wc -l)
TOTAL_LOGS=$(vercel logs --prod | wc -l)

if [ $TOTAL_LOGS -gt 0 ]; then
  ERROR_RATE=$((ERROR_COUNT * 100 / TOTAL_LOGS))
  if [ $ERROR_RATE -gt 1 ]; then
    echo "⚠️ Warning: Error rate ${ERROR_RATE}% exceeds threshold"
  else
    echo "✅ Error rate ${ERROR_RATE}% within acceptable range"
  fi
fi
```

---

## 📊 Monitoring and Health Checks

### Daily Health Check (Run once daily)

```bash
#!/bin/bash

echo "=== Daily Custom Values Health Check ==="

# 1. Feature availability
echo "1. Feature availability..."
curl -f https://card-benefits.vercel.app/api/features | jq '.custom_values.enabled'

# 2. Database connectivity
echo "2. Database connection pool status..."
curl -f https://card-benefits.vercel.app/api/metrics/database | jq '.connections'

# 3. Cache effectiveness
echo "3. Cache hit rate..."
curl -f https://card-benefits.vercel.app/api/metrics/cache | jq '.hit_rate'

# 4. Error trend
echo "4. Error rate trend..."
curl -f https://card-benefits.vercel.app/api/metrics/errors | jq '.error_rate'

# 5. ROI calculation performance
echo "5. ROI calculation latency..."
curl -f https://card-benefits.vercel.app/api/metrics/roi | jq '.p99_latency'

echo "✅ Daily health check complete"
```

### Weekly Deep Dive (Run every Monday)

```bash
#!/bin/bash

echo "=== Weekly Custom Values Deep Dive ==="

# 1. Database growth
echo "1. Database size analysis..."
psql $DATABASE_URL -c "
  SELECT 
    pg_size_pretty(pg_total_relation_size('UserBenefit')) as benefit_size,
    pg_size_pretty(pg_total_relation_size('ValueHistory')) as history_size;
"

# 2. Query performance
echo "2. Slow query analysis..."
psql $DATABASE_URL -c "
  SELECT query, calls, mean_time 
  FROM pg_stat_statements 
  WHERE query LIKE '%custom%' OR query LIKE '%value%'
  ORDER BY mean_time DESC LIMIT 10;
"

# 3. User engagement
echo "3. Feature usage metrics..."
curl -f https://card-benefits.vercel.app/api/metrics/usage | jq '.daily_active_users'

# 4. Revenue impact (if applicable)
echo "4. ROI accuracy validation..."
npm run audit:roi-accuracy

echo "✅ Weekly deep dive complete"
```

---

## 🚨 Emergency Procedures

### Procedure 1: Immediate Rollback (Critical Issue)

**When to use:** Feature completely broken, >10% error rate, data integrity issue

```bash
#!/bin/bash

echo "⚠️ INITIATING EMERGENCY ROLLBACK"

# 1. Notify team
echo "Notifying team via Slack..."
curl -X POST https://hooks.slack.com/services/[WEBHOOK_URL] \
  -d '{"text":"🚨 EMERGENCY ROLLBACK INITIATED - Custom Values"}'

# 2. Trigger rollback
echo "Rolling back to previous deployment..."
vercel rollback --prod --yes

# 3. Verify rollback
sleep 30
CURRENT_VERSION=$(vercel deployments --prod --json | jq -r '.[0].url')
echo "Current version: $CURRENT_VERSION"

# 4. Run health check
curl -f https://card-benefits.vercel.app/api/health || {
  echo "❌ Health check failed after rollback"
  exit 1
}

echo "✅ Rollback completed"

# 5. Open incident
echo "Creating incident report..."
# Open GitHub issue, Jira ticket, etc.
```

### Procedure 2: Database Rollback (Migration Failure)

**When to use:** Migration failed, data corrupted, schema mismatch

```bash
#!/bin/bash

echo "⚠️ INITIATING DATABASE ROLLBACK"

# 1. Verify backup exists
BACKUP_DIR="backups/$(ls -t backups | head -1)"
if [ ! -f "$BACKUP_DIR/backup.sql" ]; then
  echo "❌ No backup found!"
  exit 1
fi

# 2. Stop application
echo "Stopping application..."
vercel deployments --prod --json | jq -r '.[0].url' | xargs curl -X POST /api/shutdown

# 3. Restore database
echo "Restoring from backup..."
psql $DATABASE_URL < $BACKUP_DIR/backup.sql

# 4. Verify restore
echo "Verifying restore..."
psql $DATABASE_URL -c "SELECT COUNT(*) FROM UserBenefit;"

# 5. Restart application
echo "Restarting application..."
vercel deploy --prod

echo "✅ Database rollback completed"
```

### Procedure 3: Circuit Breaker (Cascading Failures)

**When to use:** Multiple downstream services failing, resource exhaustion

```bash
#!/bin/bash

echo "⚠️ ACTIVATING CIRCUIT BREAKER"

# 1. Disable custom values feature
echo "Disabling custom values feature..."
vercel env add ENABLE_CUSTOM_VALUES_FEATURE --prod false

# 2. Reduce traffic
echo "Setting rollout to 0%..."
vercel env add CUSTOM_VALUES_ROLLOUT_PERCENTAGE --prod 0

# 3. Scale down calculation workers
echo "Reducing ROI calculation workers..."
vercel scale --prod --instances=1

# 4. Isolate database
echo "Setting read-only mode..."
psql $DATABASE_URL -c "ALTER DATABASE card_benefits SET default_transaction_read_only = ON;"

# 5. Alert team
echo "Circuit breaker activated - investigate root cause"

echo "✅ Circuit breaker engaged"
```

---

## 🔄 Rollback Procedures

### Standard Rollback (No Data Migration)

```bash
#!/bin/bash

echo "=== Standard Rollback Procedure ==="

# 1. Trigger rollback
echo "1. Reverting to previous deployment..."
vercel rollback --prod --yes
PREVIOUS_URL=$(vercel deployments --prod --json | jq -r '.[0].url')
echo "   Rolled back to: $PREVIOUS_URL"

# 2. Verify application
echo "2. Verifying application health..."
sleep 30
curl -f https://card-benefits.vercel.app/api/health || exit 1

# 3. Clear caches
echo "3. Clearing caches..."
redis-cli -u $REDIS_URL FLUSHDB

# 4. Run smoke tests
echo "4. Running smoke tests..."
npm run test:smoke -- --prod

# 5. Confirm completion
echo "✅ Rollback completed successfully"
```

### Rollback with Data Migration Revert

```bash
#!/bin/bash

echo "=== Rollback with Migration Revert ==="

# 1. Identify migration to revert
echo "1. Listing recent migrations..."
npx prisma migrate status

# 2. Resolve migration (mark as rolled back)
echo "2. Marking migration as rolled back..."
npx prisma migrate resolve --rolled_back custom_values_v1

# 3. Revert to backup (if needed)
echo "3. Restoring database from backup..."
BACKUP_FILE=$1
if [ -z "$BACKUP_FILE" ]; then
  echo "No backup specified - using latest"
  BACKUP_FILE=$(ls -t backups/*/backup.sql | head -1)
fi
psql $DATABASE_URL < $BACKUP_FILE

# 4. Regenerate Prisma client
echo "4. Regenerating Prisma client..."
npx prisma generate

# 5. Redeploy application
echo "5. Redeploying application..."
vercel deploy --prod

echo "✅ Rollback with migration revert completed"
```

---

## 🔍 Troubleshooting Guide

### Issue: Value Updates Failing

**Symptoms:**
- 500 errors on value update requests
- Users cannot edit benefit values
- Error logs: "updateBenefitValue failed"

**Diagnosis:**
```bash
# Check error logs
vercel logs --prod | grep -i "update.*value\|value.*failed"

# Check database connection
psql $DATABASE_URL -c "SELECT 1;"

# Check for locks
psql $DATABASE_URL -c "SELECT * FROM pg_locks WHERE NOT granted;"
```

**Solutions:**
1. Check database connection is healthy
2. Verify user has permission to update values
3. Check input validation (value format, range)
4. Review recent code changes
5. Clear cache: `redis-cli -u $REDIS_URL FLUSHDB`

### Issue: ROI Calculations Timing Out

**Symptoms:**
- ROI calculations take >1000ms
- Timeout errors in logs
- Users see loading spinner indefinitely

**Diagnosis:**
```bash
# Check calculation performance
curl -f https://card-benefits.vercel.app/api/metrics/roi | jq '.p99_latency'

# Check database query performance
psql $DATABASE_URL -c "
  SELECT query, calls, mean_time 
  FROM pg_stat_statements 
  WHERE query LIKE '%roi%' OR query LIKE '%calculate%'
  ORDER BY mean_time DESC;
"
```

**Solutions:**
1. Check database performance - optimize slow queries
2. Verify connection pool is not exhausted
3. Check if calculation is looping infinitely
4. Increase timeout: `CUSTOM_VALUES_TIMEOUT=45000`
5. Cache results: Increase `CUSTOM_VALUES_CACHE_TTL`

### Issue: Audit Trail Not Recording

**Symptoms:**
- Value history popover is empty
- `ENABLE_VALUE_HISTORY=true` but no records in database
- Users cannot see change history

**Diagnosis:**
```bash
# Check feature flag
echo $ENABLE_VALUE_HISTORY

# Check if table has data
psql $DATABASE_URL -c "SELECT COUNT(*) FROM ValueHistory;"

# Check for write errors
vercel logs --prod | grep -i "audit\|history\|write"
```

**Solutions:**
1. Verify migration ran: `npx prisma migrate status`
2. Check table exists: `psql $DATABASE_URL -c "\d ValueHistory"`
3. Verify feature flag is true
4. Check database write permissions
5. Check for database connection errors

---

## 📈 Data Integrity Checks

### Daily Data Integrity Audit

```bash
#!/bin/bash

echo "=== Data Integrity Audit ==="

# 1. Orphaned records
echo "1. Checking for orphaned records..."
psql $DATABASE_URL -c "
  SELECT COUNT(*) as orphaned_benefits
  FROM UserBenefit ub
  WHERE NOT EXISTS (
    SELECT 1 FROM UserCard uc WHERE uc.id = ub.userCardId
  );
"

# 2. Duplicate values
echo "2. Checking for duplicates..."
psql $DATABASE_URL -c "
  SELECT userCardId, name, COUNT(*) 
  FROM UserBenefit 
  GROUP BY userCardId, name 
  HAVING COUNT(*) > 1;
"

# 3. Audit trail completeness
echo "3. Verifying audit trail..."
psql $DATABASE_URL -c "
  SELECT COUNT(*) as total_changes,
    COUNT(CASE WHEN valueHistory IS NOT NULL THEN 1 END) as recorded
  FROM UserBenefit
  WHERE updatedAt > NOW() - INTERVAL '1 day';
"

# 4. Data consistency
echo "4. Checking data consistency..."
psql $DATABASE_URL -c "
  SELECT 
    COUNT(*) as total_users,
    COUNT(DISTINCT playerId) as players,
    COUNT(DISTINCT userCardId) as cards
  FROM UserBenefit;
"

echo "✅ Data integrity audit complete"
```

### Weekly Data Validation

```bash
#!/bin/bash

echo "=== Weekly Data Validation ==="

# 1. Backup integrity
echo "1. Verifying backup integrity..."
for backup in backups/*/backup.sql; do
  if ! pg_restore $backup | head -1 > /dev/null; then
    echo "❌ Backup corrupted: $backup"
  fi
done

# 2. Index effectiveness
echo "2. Checking index usage..."
psql $DATABASE_URL -c "
  SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
  FROM pg_stat_user_indexes
  WHERE idx_scan < 100
  ORDER BY idx_scan ASC;
"

# 3. Bloat detection
echo "3. Checking for table bloat..."
psql $DATABASE_URL -c "
  SELECT schemaname, tablename, 
    ROUND(100.0 * (pg_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename, 'main')) 
    / pg_relation_size(schemaname||'.'||tablename), 2) AS bloat_pct
  FROM pg_tables
  WHERE schemaname NOT IN ('pg_catalog', 'information_schema');
"

echo "✅ Weekly validation complete"
```

---

## 📞 Support & Escalation

### On-Call Rotation

**Primary:** [Name] - [Contact]  
**Secondary:** [Name] - [Contact]  
**Backup:** [Name] - [Contact]

### Escalation Path

1. **T+0-5 min:** On-call engineer investigates
2. **T+5-15 min:** If unresolved, page team lead
3. **T+15-30 min:** If unresolved, page engineering manager
4. **T+30+ min:** Critical incident - escalate to director

### Communication

- **Slack:** #incidents channel
- **Email:** engineering-on-call@company.com
- **Phone:** [On-call number]

---

## 📝 Logging Best Practices

### Log Entry Format

```json
{
  "timestamp": "2024-04-03T12:00:00Z",
  "level": "INFO|WARN|ERROR|DEBUG",
  "service": "custom-values",
  "event": "operation_name",
  "user_id": "user_123",
  "duration_ms": 45,
  "status": "success|failure",
  "error_type": "optional_error_type",
  "trace_id": "abc123def456"
}
```

### Query Logs in Vercel

```bash
# Show all custom values operations
vercel logs --prod | grep "custom-values"

# Show errors only
vercel logs --prod | grep "ERROR"

# Stream logs (follow mode)
vercel logs --prod --follow

# Export logs to file
vercel logs --prod > logs-$(date +%Y%m%d).txt
```

---

## ✅ Deployment Checklist

**To use before every deployment:**

```
PRE-DEPLOYMENT
[ ] All tests passing (npm run test:all)
[ ] Coverage ≥80% (npm run test:coverage)
[ ] Type checking passes (npm run type-check)
[ ] Build succeeds (npm run build)
[ ] Security audit clean (npm audit)
[ ] Database backup created
[ ] Migration tested
[ ] Feature flags verified
[ ] Monitoring ready
[ ] Team notified

DEPLOYMENT
[ ] Deployment tag created
[ ] Main branch merged
[ ] Deployment triggered
[ ] Build completed
[ ] Health check passed

POST-DEPLOYMENT
[ ] Smoke tests passed
[ ] Error rate normal
[ ] Performance metrics normal
[ ] Data integrity verified
[ ] Audit trail recording
[ ] Users report no issues
[ ] Incident documented (if any)

ROLLBACK READY
[ ] Rollback plan documented
[ ] Backup accessible
[ ] Team on standby
[ ] Communication channels open
```

---

**Last Updated:** April 3, 2024  
**Version:** 1.0  
**Status:** Ready for production operations
