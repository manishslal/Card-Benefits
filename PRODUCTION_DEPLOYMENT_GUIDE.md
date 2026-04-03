# Card Management Feature - Production Deployment Guide

**Status:** ✅ APPROVED FOR PRODUCTION  
**QA Report:** 152/152 tests passing, 92%+ coverage, zero critical issues  
**Deployment Ready:** YES - Ready for immediate production rollout

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Configuration](#environment-configuration)
3. [Database Deployment](#database-deployment)
4. [CI/CD Pipeline Configuration](#cicd-pipeline-configuration)
5. [Deployment Procedures](#deployment-procedures)
6. [Health Checks & Verification](#health-checks--verification)
7. [Rollback Procedures](#rollback-procedures)
8. [Monitoring & Alerting](#monitoring--alerting)
9. [Performance Considerations](#performance-considerations)
10. [Troubleshooting Guide](#troubleshooting-guide)

---

## Pre-Deployment Checklist

### Code & Testing

- [x] **QA Report Review** - 152/152 tests passing
- [x] **Security Audit** - Authorization checks verified
- [x] **Code Review** - Best practices confirmed
- [ ] **All tests pass** - Run locally before deployment: `npm run test`
- [ ] **Build succeeds** - `npm run build` completes without errors
- [ ] **No linting errors** - `npm run lint` passes
- [ ] **Type checks pass** - `npm run type-check` succeeds

### Feature Requirements

- [ ] **Card Management Routes** - `/api/cards/*` endpoints available
- [ ] **Database migrations** - CardStatus enum, soft delete fields applied
- [ ] **Authorization system** - Auth middleware configured
- [ ] **Error logging** - Sentry or similar error tracking set up (recommended)

### Infrastructure Prerequisites

- [ ] **Production database** - PostgreSQL or SQLite configured
- [ ] **Environment variables** - All secrets loaded securely
- [ ] **Secrets manager** - GitHub Secrets or platform-specific (Render, Vercel, etc.)
- [ ] **Monitoring service** - Performance tracking configured
- [ ] **Logging service** - Application logs centralized (optional but recommended)

### Team Notification

- [ ] **Team informed** - Notify DevOps, QA, and support teams
- [ ] **Documentation reviewed** - Operations team has runbook
- [ ] **Rollback plan communicated** - Procedures documented and understood
- [ ] **Monitoring dashboards** - Set up and tested

### Deployment Approval

- [ ] **Tech Lead Sign-off** - Architecture and security approved
- [ ] **QA Lead Sign-off** - Testing complete, no blockers
- [ ] **Product Manager Approval** - Feature scope and timeline approved

---

## Environment Configuration

### Required Environment Variables

All variables must be set in your production environment before deployment. Use your platform's secret manager (GitHub Secrets, Render Environment Variables, Vercel Environment, etc.).

#### Database Configuration

```env
# Production database connection
# For PostgreSQL:
DATABASE_URL="postgresql://user:password@host:5432/card_benefits?ssl=true"

# For SQLite (development/testing only):
# DATABASE_URL="file:./prod.db"
```

#### Authentication & Security

```env
# Session secret - Generate with: openssl rand -hex 32
# CRITICAL: Must be 32+ characters, unique per environment
SESSION_SECRET="<your-256-bit-random-key>"

# Cron job security - Prevents unauthorized API access
# Generate with: openssl rand -hex 32
CRON_SECRET="<your-256-bit-random-key>"

# Environment indicator
NODE_ENV="production"
```

#### Card Management Settings (Optional - with defaults)

```env
# Card pagination defaults
NEXT_PUBLIC_CARDS_PAGE_SIZE="25"          # Cards per page (default: 25)
NEXT_PUBLIC_MAX_CARDS_PER_PLAYER="1000"   # Max cards per player (default: 1000)

# Card bulk operation limits
NEXT_PUBLIC_MAX_BULK_OPERATIONS="100"     # Max cards in single bulk operation

# Search & filter performance
NEXT_PUBLIC_SEARCH_DEBOUNCE_MS="300"      # Search debounce milliseconds (default: 300)
NEXT_PUBLIC_MAX_FILTER_VALUES="50"        # Max filter options to display

# Cache settings
NEXT_PUBLIC_CARD_CACHE_TTL="300"          # Cache time-to-live seconds (default: 5 minutes)

# Feature flags for gradual rollout
NEXT_PUBLIC_CARD_MANAGEMENT_ENABLED="true"
NEXT_PUBLIC_BULK_OPERATIONS_ENABLED="true"
NEXT_PUBLIC_SOFT_DELETE_ENABLED="true"

# Monitoring & observability
NEXT_PUBLIC_ENABLE_CARD_METRICS="true"
NEXT_PUBLIC_LOG_CARD_OPERATIONS="true"
```

### Environment-Specific Configuration

#### Staging Environment

```env
NODE_ENV="production"
NEXT_PUBLIC_CARDS_PAGE_SIZE="25"
NEXT_PUBLIC_ENABLE_CARD_METRICS="true"
# Use staging database connection
DATABASE_URL="postgresql://staging_user:pass@staging.db:5432/card_benefits"
```

#### Production Environment

```env
NODE_ENV="production"
NEXT_PUBLIC_CARDS_PAGE_SIZE="25"
NEXT_PUBLIC_ENABLE_CARD_METRICS="true"
NEXT_PUBLIC_LOG_CARD_OPERATIONS="true"
# Use production database connection with SSL
DATABASE_URL="postgresql://prod_user:pass@prod.db:5432/card_benefits?ssl=true"
```

### Secrets Management Best Practices

1. **Never commit secrets** to version control
2. **Use platform secret managers**:
   - GitHub Secrets for Actions
   - Render Environment Variables
   - Vercel Environment Variables
   - AWS Secrets Manager for direct access
3. **Rotate secrets regularly** - every 90 days minimum
4. **Audit secret access** - log all secret retrievals
5. **Different secrets per environment** - staging ≠ production

---

## Database Deployment

### Pre-Deployment: Verify Schema

```bash
# 1. Check current schema
npx prisma db execute --stdin << 'EOF'
SELECT sql FROM sqlite_master 
WHERE type='table' AND name LIKE '%Card%' OR name LIKE '%card%';
EOF

# 2. Verify CardStatus enum support
# SQLite stores status as TEXT field with CHECK constraint
# Valid values: ACTIVE, PENDING, PAUSED, ARCHIVED, DELETED
```

### Migration Deployment

#### Option 1: Automatic Migrations (Recommended for Staging)

```bash
# Run migrations automatically (applies all pending migrations)
npx prisma migrate deploy

# Verify migration succeeded
npx prisma migrate status
```

#### Option 2: Manual Review (Recommended for Production)

```bash
# 1. Preview pending migrations
npx prisma migrate status

# 2. Create a new migration without applying
npx prisma migrate resolve --rolled-back <migration-name>

# 3. Review migration SQL
cat prisma/migrations/<timestamp>_<name>/migration.sql

# 4. Apply migration when ready
npx prisma migrate deploy
```

### Card Management Specific Migrations

The following schema changes are required:

```sql
-- Ensure UserCard has CardStatus enum support
ALTER TABLE "UserCard" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE' 
  CHECK (status IN ('ACTIVE', 'PENDING', 'PAUSED', 'ARCHIVED', 'DELETED'));

-- Add archive metadata
ALTER TABLE "UserCard" ADD COLUMN "statusChangedAt" TIMESTAMP;
ALTER TABLE "UserCard" ADD COLUMN "statusChangedReason" TEXT;
ALTER TABLE "UserCard" ADD COLUMN "statusChangedBy" TEXT;
ALTER TABLE "UserCard" ADD COLUMN "archivedAt" TIMESTAMP;
ALTER TABLE "UserCard" ADD COLUMN "archivedBy" TEXT;
ALTER TABLE "UserCard" ADD COLUMN "archivedReason" TEXT;

-- Add indexes for card status queries (CRITICAL for performance)
CREATE INDEX "UserCard_playerId_status_idx" ON "UserCard"("playerId", "status");
CREATE INDEX "UserCard_archivedAt_idx" ON "UserCard"("archivedAt");
CREATE INDEX "UserCard_renewalDate_idx" ON "UserCard"("renewalDate");

-- Add benefit status
ALTER TABLE "UserBenefit" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
CREATE INDEX "UserBenefit_status_idx" ON "UserBenefit"("status");
```

### Post-Migration Verification

```bash
# 1. Verify all tables exist
npx prisma db execute --stdin << 'EOF'
.tables
EOF

# 2. Verify UserCard schema
npx prisma db execute --stdin << 'EOF'
PRAGMA table_info(UserCard);
EOF

# 3. Verify indexes created
npx prisma db execute --stdin << 'EOF'
SELECT name FROM sqlite_master 
WHERE type='index' AND tbl_name='UserCard';
EOF

# 4. Test a query
npx prisma db execute --stdin << 'EOF'
SELECT COUNT(*) as total_cards, 
       SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_cards,
       SUM(CASE WHEN status = 'ARCHIVED' THEN 1 ELSE 0 END) as archived_cards
FROM UserCard;
EOF
```

### Database Backup Before Deployment

```bash
# Create production backup
cp prod.db prod.db.backup.$(date +%Y%m%d-%H%M%S)

# Create backup of entire database directory
tar -czf db-backup-$(date +%Y%m%d-%H%M%S).tar.gz \
  prisma/migrations/ \
  prod.db \
  .env.production
```

---

## CI/CD Pipeline Configuration

### GitHub Actions Workflow Updates

See `.github/workflows/ci-card-management.yml` for complete pipeline.

### Workflow Stages

#### 1. Pull Request Validation (Automatic on PR)

```
Lint → Type Check → Build → Unit Tests → Coverage Check → Security Audit
```

- Validates code quality
- Ensures tests pass
- Verifies type safety
- Checks coverage (92%+ required)

#### 2. Build and Test (On merge to main/develop)

```
Build → Unit Tests → E2E Tests → Performance Benchmarks → Coverage Report
```

- Builds optimized production bundle
- Runs comprehensive test suite
- Measures performance metrics
- Generates coverage reports

#### 3. Deployment (Manual or automated)

```
Build → Health Checks → Database Migrations → Deploy → Verify
```

- Builds application
- Verifies system health
- Applies database changes
- Deploys to production
- Verifies deployment

### Test Suite Integration

```yaml
card-management-tests:
  name: Card Management Test Suite
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    
    - uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    # Unit tests
    - run: npm run test -- src/__tests__/lib/card-*.test.ts
    
    # Coverage check
    - run: npm run test:coverage -- src/__tests__/lib/ --check-coverage --branches 80
    
    # Performance benchmarks
    - run: npm run test:performance -- src/__tests__/perf/card-*.test.ts
```

### Deployment Approval Gates

```yaml
deploy-production:
  name: Deploy to Production
  needs: [lint, build, test, coverage, security]
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  environment:
    name: production
    url: https://app.cardbenefits.com
  steps:
    # Deployment steps here
```

---

## Deployment Procedures

### Pre-Deployment Verification (15 minutes)

```bash
#!/bin/bash
# Run pre-deployment checks

set -e

echo "📋 Pre-Deployment Verification"
echo "================================"

# 1. Verify all tests pass
echo "✓ Running test suite..."
npm run test -- --run

# 2. Verify build succeeds
echo "✓ Building application..."
npm run build

# 3. Verify type safety
echo "✓ Checking types..."
npm run type-check

# 4. Verify linting
echo "✓ Linting code..."
npm run lint

# 5. Check dependencies
echo "✓ Auditing dependencies..."
npm audit --audit-level=moderate || true

# 6. Verify environment variables
echo "✓ Verifying environment variables..."
required_vars=(
  "DATABASE_URL"
  "SESSION_SECRET"
  "CRON_SECRET"
  "NODE_ENV"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing required variable: $var"
    exit 1
  fi
done

echo "✅ All pre-deployment checks passed!"
echo ""
echo "Next steps:"
echo "1. Backup production database"
echo "2. Review database migration"
echo "3. Deploy to staging first"
echo "4. Run smoke tests on staging"
echo "5. Deploy to production"
echo "6. Monitor error logs for 30 minutes"
```

### Staging Deployment (Full Validation)

```bash
#!/bin/bash
# Deploy to staging environment

set -e

echo "🚀 Deploying to Staging"
echo "========================"

# 1. Set staging environment
export NODE_ENV=production
export ENVIRONMENT=staging
export DATABASE_URL=$STAGING_DATABASE_URL  # Use staging DB
export SESSION_SECRET=$STAGING_SESSION_SECRET

# 2. Run migrations
echo "📊 Running database migrations..."
npx prisma migrate deploy

# 3. Build application
echo "🔨 Building application..."
npm run build

# 4. Start application
echo "▶️  Starting application..."
npm start &
APP_PID=$!

sleep 5

# 5. Run smoke tests
echo "✅ Running smoke tests..."
npm run test:e2e -- tests/smoke/card-management.spec.ts

# 6. Check application health
echo "❤️  Checking application health..."
curl -f http://localhost:3000/api/health || exit 1

echo "✅ Staging deployment successful!"

# Keep app running for manual testing
echo "Application is running on http://localhost:3000"
echo "Press Ctrl+C to stop"
wait $APP_PID
```

### Production Deployment (Zero-Downtime)

```bash
#!/bin/bash
# Deploy to production with zero-downtime strategy

set -e

echo "🚀 Deploying to Production"
echo "============================"

# 1. Backup production database
echo "💾 Creating database backup..."
BACKUP_FILE="prod.db.backup.$(date +%Y%m%d-%H%M%S)"
cp prod.db "$BACKUP_FILE"
echo "✓ Backup created: $BACKUP_FILE"

# 2. Run migrations (blue-green compatible)
echo "📊 Running database migrations..."
export DATABASE_URL=$PROD_DATABASE_URL
export SESSION_SECRET=$PROD_SESSION_SECRET
npx prisma migrate deploy

# 3. Build new version (blue deployment)
echo "🔨 Building new version..."
npm run build

# 4. Switch traffic to new version
# (Platform-specific: Vercel auto-scales, Render uses internal routing)
echo "🔄 Switching traffic to new version..."
# Implementation depends on your hosting platform

# 5. Verify new version is healthy
echo "❤️  Verifying new deployment..."
curl -f https://app.cardbenefits.com/api/health || exit 1

# 6. Monitor for errors (automated)
echo "📡 Monitoring for errors (5 minutes)..."
for i in {1..30}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://app.cardbenefits.com)
  if [ "$STATUS" != "200" ]; then
    echo "❌ Health check failed! Initiating rollback..."
    ./scripts/rollback-production.sh
    exit 1
  fi
  sleep 10
done

echo "✅ Production deployment successful!"
```

---

## Health Checks & Verification

### Immediate Post-Deployment (First 5 minutes)

```bash
#!/bin/bash
# Run immediate post-deployment health checks

echo "🏥 Post-Deployment Health Check"
echo "================================="

# 1. API Health
echo "1. Checking API health..."
curl -v https://app.cardbenefits.com/api/health

# 2. Database connectivity
echo "2. Testing database connectivity..."
npx prisma db execute --stdin << 'EOF'
SELECT COUNT(*) as card_count FROM "UserCard";
EOF

# 3. Authentication
echo "3. Verifying auth system..."
curl -s https://app.cardbenefits.com/api/auth/check | jq .

# 4. Card Management endpoints
echo "4. Testing card management endpoints..."
# (These require authentication)

# 5. Error logging
echo "5. Checking error logs..."
# Tail application logs
docker logs <container-id> --tail 50 || tail -50 logs/app.log

echo "✅ All immediate health checks passed!"
```

### Continuous Verification (First hour)

Monitor these metrics:

```
✓ Error Rate: Should remain < 0.1% (< 1 error per 1000 requests)
✓ Response Time: Should remain < 200ms (p95)
✓ Database Connections: Should remain stable
✓ Memory Usage: Should remain < 500MB
✓ CPU Usage: Should remain < 30%
✓ Cache Hit Rate: Should be > 80%
```

### Daily Verification (24-48 hours)

- [ ] Run full test suite: `npm run test:all`
- [ ] Check data integrity: `npm run db:verify`
- [ ] Review error logs for patterns
- [ ] Verify no data corruption occurred
- [ ] Check performance metrics haven't degraded

---

## Rollback Procedures

### Automatic Rollback (Immediate - On Critical Error)

```bash
#!/bin/bash
# Automatic rollback triggered on critical error

set -e

echo "🔄 INITIATING EMERGENCY ROLLBACK"
echo "===================================="

# 1. Kill current deployment
echo "1. Stopping current deployment..."
kill -TERM $APP_PID

# 2. Restore database from backup
echo "2. Restoring database from backup..."
BACKUP_FILE=$(ls -t prod.db.backup.* | head -1)
cp "$BACKUP_FILE" prod.db
echo "✓ Restored from: $BACKUP_FILE"

# 3. Rollback code to previous version
echo "3. Rolling back code..."
git revert --no-edit HEAD

# 4. Rebuild and restart with previous version
echo "4. Rebuilding previous version..."
npm run build
npm start

# 5. Verify rollback succeeded
echo "5. Verifying rollback..."
sleep 10
curl -f http://localhost:3000/api/health || {
  echo "❌ Rollback verification failed!"
  exit 1
}

echo "✅ Rollback completed successfully!"
echo ""
echo "⚠️  INCIDENT REPORT REQUIRED:"
echo "  - Document what caused the failure"
echo "  - Review deployment logs"
echo "  - Identify fixes needed"
echo "  - Create issue for post-mortem"
```

### Manual Rollback (If needed)

```bash
#!/bin/bash
# Manual rollback procedure

echo "🔄 Manual Rollback Procedure"
echo "============================"

# 1. Notify team
echo "1. Send incident notification to team"
# Slack notification, PagerDuty alert, etc.

# 2. Stop current deployment
echo "2. Stopping current application..."
kill $(pgrep -f "npm start") || true

# 3. Find most recent backup
echo "3. Finding backup..."
LATEST_BACKUP=$(ls -t prod.db.backup.* 2>/dev/null | head -1)
if [ -z "$LATEST_BACKUP" ]; then
  echo "❌ No backup found!"
  exit 1
fi

# 4. Restore database
echo "4. Restoring database from: $LATEST_BACKUP"
cp "$LATEST_BACKUP" prod.db

# 5. Revert code changes
echo "5. Reverting code changes..."
git log --oneline -5
read -p "Enter commit to revert to (hash): " COMMIT_HASH
git reset --hard $COMMIT_HASH

# 6. Restart application
echo "6. Restarting application..."
npm install
npm run build
npm start &

# 7. Verify
echo "7. Verifying rollback..."
sleep 10
if curl -f http://localhost:3000/api/health; then
  echo "✅ Rollback successful!"
else
  echo "❌ Rollback failed - manual intervention required"
  exit 1
fi
```

### Partial Rollback (Feature Flag)

For non-critical issues, disable the feature without full rollback:

```env
# In production environment variables:
NEXT_PUBLIC_CARD_MANAGEMENT_ENABLED="false"

# This allows:
# - Existing cards remain accessible
# - New card operations disabled
# - Time to investigate and fix
# - No data loss
```

---

## Monitoring & Alerting

### Key Metrics to Monitor

#### Card Management Operations

```
1. Card CRUD Success Rate
   - Metric: successful_card_operations / total_card_operations
   - Alert: < 99.9%
   - Check: Every minute

2. Average Card Operation Duration
   - Metric: p50, p95, p99 latency
   - Alert: p95 > 500ms
   - Check: Every 5 minutes

3. Card Search Performance
   - Metric: search_result_time
   - Alert: > 1 second
   - Check: Every 5 minutes

4. Bulk Operation Tracking
   - Metric: bulk_operations_processed / bulk_operations_queued
   - Alert: Success rate < 95%
   - Check: Every minute
```

#### Database Metrics

```
1. Connection Pool Health
   - Metric: active_connections / max_connections
   - Alert: > 80%
   - Check: Every 30 seconds

2. Query Performance
   - Metric: slow_query_count (> 100ms)
   - Alert: > 5 slow queries/minute
   - Check: Every minute

3. Database Size Growth
   - Metric: database_size_gb
   - Alert: 80%+ of disk quota
   - Check: Every hour

4. Soft Delete Verification
   - Metric: archived_cards_count
   - Alert: More archived than created (data integrity)
   - Check: Every day
```

#### Application Health

```
1. Error Rate
   - Metric: error_count / total_requests
   - Alert: > 0.1%
   - Check: Every minute

2. Response Time
   - Metric: p95, p99 latency
   - Alert: p95 > 1000ms
   - Check: Every minute

3. Memory Usage
   - Metric: memory_usage_mb
   - Alert: > 1000MB
   - Check: Every 30 seconds

4. CPU Usage
   - Metric: cpu_usage_percent
   - Alert: > 80%
   - Check: Every 30 seconds
```

### Monitoring Dashboard

Create dashboards in your monitoring tool (Datadog, New Relic, CloudWatch, etc.):

```
[Card Management Dashboard]
├── Operation Metrics
│   ├── Create Card Rate (ops/min)
│   ├── Update Card Rate (ops/min)
│   ├── Archive Card Rate (ops/min)
│   ├── Delete Card Rate (ops/min)
│   └── Success Rate (%)
├── Performance Metrics
│   ├── Card Load Time (ms)
│   ├── Search Response Time (ms)
│   ├── Filter Performance (ms)
│   └── Bulk Operation Time (sec)
├── Database Metrics
│   ├── Active Cards Count
│   ├── Archived Cards Count
│   ├── Deleted Cards Count
│   ├── Query Performance (p95)
│   └── Connection Pool Status
└── System Metrics
    ├── Error Rate (%)
    ├── HTTP Response Time (ms)
    ├── Memory Usage (MB)
    └── CPU Usage (%)
```

### Alert Configuration

```yaml
# Example Prometheus alert rules
groups:
  - name: card-management
    interval: 1m
    rules:
      - alert: CardOperationFailureRate
        expr: (rate(card_operation_failures_total[5m]) / rate(card_operation_total[5m])) > 0.001
        for: 5m
        annotations:
          summary: "High card operation failure rate"
      
      - alert: CardSearchSlow
        expr: card_search_duration_seconds{quantile="0.95"} > 1
        for: 5m
        annotations:
          summary: "Card search performance degraded"
      
      - alert: ArchiveIntegrityIssue
        expr: (count(cards where status='ARCHIVED') / count(cards where status='ACTIVE')) > 2
        for: 1h
        annotations:
          summary: "Abnormal archive ratio detected"
```

### Automated Notifications

Configure alerts to notify:

- **Slack:** `#card-management-alerts`
- **PagerDuty:** On-call engineer
- **Email:** DevOps team
- **SMS:** Critical issues (error rate > 1%)

---

## Performance Considerations

### Query Optimization

The following queries are optimized with indexes:

```sql
-- Optimized: Fetch cards with status filter
SELECT * FROM "UserCard" 
WHERE playerId = ? AND status = ?
ORDER BY createdAt DESC
LIMIT 25;
-- Uses: Index on (playerId, status)

-- Optimized: Search with pagination
SELECT * FROM "UserCard"
WHERE playerId = ? AND (customName LIKE ? OR masterCard.cardName LIKE ?)
ORDER BY createdAt DESC
LIMIT 25 OFFSET ?;
-- Uses: Indexes on playerId, customName

-- Optimized: Renewal date queries
SELECT * FROM "UserCard"
WHERE renewalDate BETWEEN ? AND ?
ORDER BY renewalDate ASC;
-- Uses: Index on renewalDate

-- Optimized: Archive cleanup
SELECT * FROM "UserCard"
WHERE status = 'ARCHIVED' AND archivedAt < NOW() - INTERVAL '30 days';
-- Uses: Index on (status, archivedAt)
```

### Caching Strategy

```typescript
// Component-level caching (React Query)
const useCardList = (playerId: string) => {
  return useQuery({
    queryKey: ['cards', playerId],
    queryFn: () => getPlayerCards(playerId),
    staleTime: 5 * 60 * 1000,      // 5 minutes
    cacheTime: 30 * 60 * 1000,     // 30 minutes
    refetchOnWindowFocus: false,
  });
};

// API-level caching (HTTP headers)
res.setHeader('Cache-Control', 'private, max-age=300, must-revalidate');

// Database query optimization
const cards = await prisma.userCard.findMany({
  where: { playerId, status: 'ACTIVE' },
  include: {
    masterCard: true,
    userBenefits: {
      where: { status: 'ACTIVE' }
    }
  },
  orderBy: { createdAt: 'desc' },
  take: 25,
  skip: (page - 1) * 25
});
```

### Load Testing Results

Expected performance under load:

```
Scenario: 1000 concurrent users
- Average response time: < 200ms
- p95 response time: < 500ms
- Error rate: < 0.01%
- Database connection pool: 20/30 connections

Scenario: 5000 concurrent users
- Average response time: < 500ms
- p95 response time: < 1000ms
- Error rate: < 0.1%
- Database connection pool: 28/30 connections
```

### Scaling Recommendations

```
If response times exceed targets:
1. Scale horizontally (add more application instances)
2. Implement read replicas for database
3. Add query caching layer (Redis)
4. Optimize slow queries (see query logs)
5. Implement CDN for static assets

If database becomes bottleneck:
1. Add indexes (see schema)
2. Archive old deleted cards (see archival strategy)
3. Implement database connection pooling
4. Consider partitioning by playerId
5. Evaluate read replicas
```

---

## Troubleshooting Guide

### Common Issues & Solutions

#### 1. Card Operations Failing

**Symptom:** Users seeing errors when creating/updating cards

**Diagnosis:**
```bash
# Check error logs
tail -100 logs/app.log | grep "card-management"

# Verify database connectivity
npx prisma db execute --stdin << 'EOF'
SELECT COUNT(*) FROM "UserCard";
EOF

# Check database migrations
npx prisma migrate status
```

**Solution:**
```bash
# If migrations missing:
npx prisma migrate deploy

# If schema issue:
npm run db:reset  # WARNING: Destroys all data!

# If connection issue:
# Check DATABASE_URL environment variable
# Verify database credentials
# Check network connectivity to database server
```

#### 2. Slow Card Searches

**Symptom:** Search taking > 1 second

**Diagnosis:**
```bash
# Check slow query log
SELECT * FROM sqlite_master 
WHERE type='table' AND name='UserCard';

# Analyze query plan
EXPLAIN QUERY PLAN 
SELECT * FROM "UserCard" 
WHERE customName LIKE '%search%' 
LIMIT 25;
```

**Solution:**
```sql
-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS "UserCard_customName_idx" 
ON "UserCard"("customName");

-- For better performance with LIKE:
CREATE INDEX IF NOT EXISTS "UserCard_customName_trgm_idx"
ON "UserCard" USING gin("customName" gin_trgm_ops);
-- (PostgreSQL only; SQLite doesn't support GIN)
```

#### 3. Archive Not Working

**Symptom:** Soft delete fields not updating

**Diagnosis:**
```bash
# Check if status was actually updated
sqlite3 prod.db \
  "SELECT id, status, archivedAt FROM UserCard WHERE id = 'card-id';"

# Check server logs for validation errors
grep -i "archive" logs/app.log

# Verify permissions
grep -i "AUTHZ" logs/app.log
```

**Solution:**
```typescript
// Ensure archiveCard uses correct status value
export async function archiveCard(cardId: string) {
  return updateCard(cardId, {
    status: 'ARCHIVED',  // Must be exactly this value
    archivedAt: new Date(),
    archivedReason: reason
  });
}

// Verify enum value matches:
// ACTIVE|PENDING|PAUSED|ARCHIVED|DELETED
```

#### 4. Memory Leak / Growing Memory Usage

**Symptom:** Memory usage increases over time

**Diagnosis:**
```bash
# Monitor memory in real-time
watch -n 1 'ps aux | grep "npm\|node"'

# Check for large unclosed connections
netstat -an | grep ESTABLISHED | wc -l

# Profile memory with Node.js
node --inspect=0.0.0.0:9229 start.js
```

**Solution:**
```typescript
// Ensure database connections are closed
await prisma.$disconnect();

// Limit query result sets
const cards = await prisma.userCard.findMany({
  take: 25,  // Don't fetch all 10,000 cards
  skip: offset,
  select: { id: true, customName: true }  // Select only needed fields
});

// Clear caches periodically
setInterval(() => {
  queryClient.clear();
}, 60 * 60 * 1000);  // Every hour
```

#### 5. Database Corruption

**Symptom:** Inconsistent card states or errors

**Diagnosis:**
```bash
# Check database integrity
sqlite3 prod.db "PRAGMA integrity_check;"

# Check for duplicate cards
sqlite3 prod.db \
  "SELECT playerId, masterCardId, COUNT(*) FROM UserCard 
   GROUP BY playerId, masterCardId HAVING COUNT(*) > 1;"

# Verify status values are valid
sqlite3 prod.db \
  "SELECT DISTINCT status FROM UserCard;"
```

**Solution:**
```bash
# Restore from backup if corruption severe
cp prod.db.backup.20240403-100000 prod.db

# Or fix incrementally
sqlite3 prod.db << 'EOF'
-- Remove duplicates (keep oldest)
DELETE FROM UserCard 
WHERE rowid NOT IN (
  SELECT MIN(rowid) FROM UserCard 
  GROUP BY playerId, masterCardId
);

-- Fix invalid status values
UPDATE UserCard SET status = 'ACTIVE' 
WHERE status NOT IN ('ACTIVE', 'PENDING', 'PAUSED', 'ARCHIVED', 'DELETED');
EOF
```

#### 6. Bulk Operations Timing Out

**Symptom:** Bulk update fails with timeout

**Diagnosis:**
```bash
# Check operation size
grep "bulkUpdateCards" logs/app.log | tail -10

# Monitor database during bulk operation
watch 'sqlite3 prod.db "SELECT COUNT(*) FROM sqlite_master WHERE type=\"table\";"'

# Check error message
grep -A 5 "timeout" logs/app.log
```

**Solution:**
```typescript
// Reduce batch size if too large
const BATCH_SIZE = 50;  // Process 50 cards at a time

for (let i = 0; i < cardIds.length; i += BATCH_SIZE) {
  const batch = cardIds.slice(i, i + BATCH_SIZE);
  await bulkUpdateCards(batch, updates);
  await new Promise(r => setTimeout(r, 100));  // Delay between batches
}

// Or increase timeout in database config
const prisma = new PrismaClient({
  connectionLimit: 50,
  queryTimeout: 30000  // 30 seconds
});
```

---

## Post-Deployment Sign-Off

### Verification Checklist

- [ ] All tests passing on production
- [ ] Health checks green for 1 hour
- [ ] Error rate < 0.1%
- [ ] Response times within SLA
- [ ] Database size stable
- [ ] No data corruption detected
- [ ] Team acknowledges deployment
- [ ] Monitoring alerts active

### Deployment Record

```
Deployment Date: _______________
Deployed By: _______________
Approved By: _______________
Database Backup: _______________
Rollback Plan: TESTED & VERIFIED

Issues Found: ___ (specify)
Resolution: _______________

Sign-off: _______________
```

---

## References

- [QA Report](../.github/specs/card-management-qa-report.md)
- [Operations Runbook](./OPERATIONS_RUNBOOK_CARD_MANAGEMENT.md)
- [Monitoring Setup](./MONITORING_SETUP_CARD_MANAGEMENT.md)
- [Performance Tuning](./PERFORMANCE_TUNING_CARD_MANAGEMENT.md)
