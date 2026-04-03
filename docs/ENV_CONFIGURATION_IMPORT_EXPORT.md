# Environment Configuration - Import/Export Feature

**Document Version:** 1.0  
**Created:** April 3, 2024  
**Scope:** All environment-specific configuration for import/export functionality

---

## 📋 Configuration Overview

This document specifies all environment variables required for the import/export feature across development, staging, and production environments.

### Environment Matrix

| Variable | Dev | Staging | Production | Required |
|----------|-----|---------|------------|----------|
| `IMPORT_MAX_FILE_SIZE_MB` | 10 | 50 | 50 | YES |
| `IMPORT_MAX_ROWS` | 1000 | 10000 | 10000 | YES |
| `IMPORT_PARSE_TIMEOUT_MS` | 30000 | 60000 | 60000 | YES |
| `IMPORT_VALIDATE_TIMEOUT_MS` | 60000 | 120000 | 120000 | YES |
| `IMPORT_COMMIT_TIMEOUT_MS` | 120000 | 300000 | 300000 | YES |
| `FEATURE_FLAG_IMPORT_ENABLED` | true | true | true | YES |
| `FEATURE_FLAG_EXPORT_ENABLED` | true | true | true | YES |
| `DATABASE_TRANSACTION_TIMEOUT_MS` | 60000 | 120000 | 120000 | YES |

---

## 🔧 Environment Variables Reference

### File Upload Configuration

#### IMPORT_MAX_FILE_SIZE_MB
**Type:** Integer  
**Units:** Megabytes  
**Default:** 50  
**Range:** 1 - 1000  

Limits the maximum size of a single import file.

**Configuration by Environment:**
```bash
# Development - Allow larger files for testing
IMPORT_MAX_FILE_SIZE_MB=100

# Staging - Production-like limits
IMPORT_MAX_FILE_SIZE_MB=50

# Production - Conservative limit
IMPORT_MAX_FILE_SIZE_MB=50
```

**Recommendations:**
- Set based on available temporary disk space
- Consider: `IMPORT_MAX_FILE_SIZE_MB * expected_concurrent_uploads * 2`
- Example: If 3 concurrent uploads expected, 50MB limit needs 300MB temp space

**Error Message When Exceeded:**
```
File size exceeds maximum allowed (50 MB). Please split your file into smaller parts.
```

---

#### IMPORT_MAX_ROWS
**Type:** Integer  
**Units:** Number of records  
**Default:** 10000  
**Range:** 100 - 100000  

Maximum number of import records (cards + benefits) in a single file.

**Configuration by Environment:**
```bash
# Development - Smaller limit for testing
IMPORT_MAX_ROWS=1000

# Staging - Production-like
IMPORT_MAX_ROWS=10000

# Production - Based on capacity
IMPORT_MAX_ROWS=10000
```

**Recommendations:**
- Set based on database transaction capacity
- Rule of thumb: 100-200 records per second acceptable
- 10,000 records → ~50-100 second import time

**Impact on Performance:**
- 1,000 records: ~15-20 seconds
- 5,000 records: ~30-40 seconds
- 10,000 records: ~60-100 seconds

**Error Message When Exceeded:**
```
File contains too many records (11,000 > 10,000). Please split into smaller files.
```

---

### Processing Timeout Configuration

#### IMPORT_PARSE_TIMEOUT_MS
**Type:** Integer  
**Units:** Milliseconds  
**Default:** 60000  
**Range:** 5000 - 300000  

Timeout for parsing CSV/XLSX file and extracting records.

**Configuration by Environment:**
```bash
# Development - Long timeout for debugging
IMPORT_PARSE_TIMEOUT_MS=300000  # 5 minutes

# Staging - Realistic timeout
IMPORT_PARSE_TIMEOUT_MS=60000   # 1 minute

# Production - Matched to expected performance
IMPORT_PARSE_TIMEOUT_MS=60000   # 1 minute
```

**Performance Targets:**
- CSV parsing: ~100ms per 1000 records
- XLSX parsing: ~500ms per 1000 records
- Typical 10,000 record file: <10 seconds

**Error Handling:**
If timeout exceeded:
1. Database transaction automatically rolls back
2. ImportJob marked as `Failed`
3. User sees: "File parsing took too long. Please try a smaller file."

---

#### IMPORT_VALIDATE_TIMEOUT_MS
**Type:** Integer  
**Units:** Milliseconds  
**Default:** 120000  
**Range:** 10000 - 600000  

Timeout for validating all parsed records against schema and business rules.

**Configuration by Environment:**
```bash
# Development - Generous for testing
IMPORT_VALIDATE_TIMEOUT_MS=300000  # 5 minutes

# Staging - Production-like
IMPORT_VALIDATE_TIMEOUT_MS=120000  # 2 minutes

# Production - Matched to expected validation time
IMPORT_VALIDATE_TIMEOUT_MS=120000  # 2 minutes
```

**Performance Targets:**
- Validation: ~5-10ms per record
- 10,000 records: ~50-100 seconds

**Error Handling:**
If timeout exceeded:
1. Current validation paused
2. Valid records validated so far kept
3. Remaining records marked as timeout
4. User can retry with subset

---

#### IMPORT_COMMIT_TIMEOUT_MS
**Type:** Integer  
**Units:** Milliseconds  
**Default:** 300000  
**Range:** 30000 - 900000  

Timeout for committing all validated records to database.

**Configuration by Environment:**
```bash
# Development - Very generous for testing
IMPORT_COMMIT_TIMEOUT_MS=600000  # 10 minutes

# Staging - Production-like
IMPORT_COMMIT_TIMEOUT_MS=300000  # 5 minutes

# Production - Conservative for reliability
IMPORT_COMMIT_TIMEOUT_MS=300000  # 5 minutes
```

**Performance Targets:**
- Commit: ~20-30ms per record
- 10,000 records: ~200-300 seconds
- Account for: Lock contention, duplicate detection, benefit cloning

**Important Note:**
This timeout must align with database `max_execution_time`. If transaction timeout too short:
- Records partially committed, partially rolled back
- Data inconsistency possible
- User sees confusing error

**Setting Database Timeout:**
```sql
-- For SQLite (uses pragma)
-- SQLite has implicit timeout, use pragmatic timeout matching IMPORT_COMMIT_TIMEOUT_MS

-- For MySQL
SET SESSION max_execution_time = 300000;  -- Matches IMPORT_COMMIT_TIMEOUT_MS

-- For PostgreSQL
SET statement_timeout = 300000;  -- Matches IMPORT_COMMIT_TIMEOUT_MS
```

---

### Feature Flag Configuration

#### FEATURE_FLAG_IMPORT_ENABLED
**Type:** Boolean (true/false)  
**Default:** true  
**Purpose:** Control availability of import feature to users

**Configuration:**
```bash
# Enable feature for all users
FEATURE_FLAG_IMPORT_ENABLED=true

# Disable feature (in case of issues)
FEATURE_FLAG_IMPORT_ENABLED=false
```

**Usage in Code:**
```typescript
if (process.env.FEATURE_FLAG_IMPORT_ENABLED !== 'true') {
  return new AppError('FEATURE_UNAVAILABLE', {
    feature: 'import'
  });
}
```

**User Experience:**
- When enabled: "Import Cards" button visible in dashboard
- When disabled: Button hidden, message: "Feature temporarily unavailable"

**Rollback Scenario:**
If critical issue discovered post-deployment:
```bash
# Disable feature immediately (doesn't delete data)
export FEATURE_FLAG_IMPORT_ENABLED=false
systemctl restart card-benefits

# Users can still see past import jobs
# Prevents new imports from being uploaded
# Safe to investigate and fix issues
```

---

#### FEATURE_FLAG_EXPORT_ENABLED
**Type:** Boolean (true/false)  
**Default:** true  
**Purpose:** Control availability of export feature to users

**Configuration:**
```bash
FEATURE_FLAG_EXPORT_ENABLED=true   # Enable export
FEATURE_FLAG_EXPORT_ENABLED=false  # Disable export
```

**Gradual Rollout Example:**
```bash
# Day 1: Enable for 10% of users
FEATURE_FLAG_EXPORT_ENABLED=true
EXPORT_GRADUAL_ROLLOUT_PCT=10

# Day 2: 25% of users
EXPORT_GRADUAL_ROLLOUT_PCT=25

# Day 3: 50% of users
EXPORT_GRADUAL_ROLLOUT_PCT=50

# Day 7: 100% of users
EXPORT_GRADUAL_ROLLOUT_PCT=100

# Or disable and investigate if issues found
EXPORT_GRADUAL_ROLLOUT_PCT=0
```

---

### Database Configuration

#### DATABASE_TRANSACTION_TIMEOUT_MS
**Type:** Integer  
**Units:** Milliseconds  
**Default:** 120000  
**Range:** 30000 - 300000  

Overall timeout for database transactions used in import/export operations.

**Configuration:**
```bash
# Development
DATABASE_TRANSACTION_TIMEOUT_MS=300000  # 5 minutes

# Staging
DATABASE_TRANSACTION_TIMEOUT_MS=120000  # 2 minutes

# Production
DATABASE_TRANSACTION_TIMEOUT_MS=120000  # 2 minutes
```

**Implementation:**
```typescript
// In Prisma client initialization
const result = await prisma.$transaction(
  async (tx) => {
    // All operations happen here
  },
  {
    maxWait: 60000,        // Wait 1 minute for transaction to start
    timeout: 120000,       // Kill if running >2 minutes
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  }
);
```

---

### Database Connection Pool Configuration

#### DATABASE_CONNECTION_POOL_MIN
**Type:** Integer  
**Default:** 5  
**Range:** 2 - 20  

Minimum number of database connections to keep open.

**Configuration by Environment:**
```bash
# Development - Minimal resource use
DATABASE_CONNECTION_POOL_MIN=2

# Staging - Production-like
DATABASE_CONNECTION_POOL_MIN=5

# Production - Based on expected concurrency
DATABASE_CONNECTION_POOL_MIN=10
```

---

#### DATABASE_CONNECTION_POOL_MAX
**Type:** Integer  
**Default:** 20  
**Range:** 10 - 100  

Maximum number of database connections allowed.

**Configuration by Environment:**
```bash
# Development
DATABASE_CONNECTION_POOL_MAX=10

# Staging
DATABASE_CONNECTION_POOL_MAX=20

# Production - Conservative (avoid connection storms)
DATABASE_CONNECTION_POOL_MAX=30
```

**Sizing Formula:**
```
MAX_POOL = (Expected Concurrent Users × Queries Per User) + 20% buffer
Example: 100 users × 2 queries each = 200, but use 50-100 max (connections are heavy)
Typical production: 20-50 connections for web application
```

**Configuration Implementation:**
```typescript
// In .env
DATABASE_URL="postgresql://user:pass@localhost/db?connection_limit=20"
// OR in Prisma client
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?connection_limit=20'
    }
  }
});
```

---

## 📝 Sample Environment Files

### Development (.env.development)
```bash
# File Upload
IMPORT_MAX_FILE_SIZE_MB=100
IMPORT_MAX_ROWS=1000
IMPORT_TEMP_DIR=/tmp/card-benefits-dev

# Processing Timeouts
IMPORT_PARSE_TIMEOUT_MS=300000
IMPORT_VALIDATE_TIMEOUT_MS=300000
IMPORT_COMMIT_TIMEOUT_MS=600000

# Feature Flags
FEATURE_FLAG_IMPORT_ENABLED=true
FEATURE_FLAG_EXPORT_ENABLED=true

# Database
DATABASE_URL="file:./data/cards-dev.db"
DATABASE_TRANSACTION_TIMEOUT_MS=300000
DATABASE_CONNECTION_POOL_MIN=2
DATABASE_CONNECTION_POOL_MAX=10

# Monitoring
MONITORING_IMPORT_METRICS_ENABLED=false
MONITORING_EXPORT_METRICS_ENABLED=false

# Logging
LOG_LEVEL=debug
```

### Staging (.env.staging)
```bash
# File Upload
IMPORT_MAX_FILE_SIZE_MB=50
IMPORT_MAX_ROWS=10000
IMPORT_TEMP_DIR=/mnt/temp/card-benefits-staging

# Processing Timeouts
IMPORT_PARSE_TIMEOUT_MS=60000
IMPORT_VALIDATE_TIMEOUT_MS=120000
IMPORT_COMMIT_TIMEOUT_MS=300000

# Feature Flags
FEATURE_FLAG_IMPORT_ENABLED=true
FEATURE_FLAG_EXPORT_ENABLED=true
IMPORT_EXPORT_GRADUAL_ROLLOUT_PCT=100

# Database
DATABASE_URL="postgresql://staging_user:${STAGING_DB_PASS}@staging-db.example.com:5432/card_benefits"
DATABASE_TRANSACTION_TIMEOUT_MS=120000
DATABASE_CONNECTION_POOL_MIN=5
DATABASE_CONNECTION_POOL_MAX=20

# Monitoring
MONITORING_IMPORT_METRICS_ENABLED=true
MONITORING_EXPORT_METRICS_ENABLED=true
DATADOG_API_KEY=${STAGING_DATADOG_KEY}

# Logging
LOG_LEVEL=info
```

### Production (.env.production)
```bash
# File Upload
IMPORT_MAX_FILE_SIZE_MB=50
IMPORT_MAX_ROWS=10000
IMPORT_TEMP_DIR=/mnt/fast-ssd/card-benefits-imports

# Processing Timeouts
IMPORT_PARSE_TIMEOUT_MS=60000
IMPORT_VALIDATE_TIMEOUT_MS=120000
IMPORT_COMMIT_TIMEOUT_MS=300000

# Feature Flags
FEATURE_FLAG_IMPORT_ENABLED=true
FEATURE_FLAG_EXPORT_ENABLED=true
IMPORT_EXPORT_GRADUAL_ROLLOUT_PCT=100

# Database
DATABASE_URL="postgresql://prod_user:${PROD_DB_PASS}@prod-db-primary.example.com:5432/card_benefits"
DATABASE_TRANSACTION_TIMEOUT_MS=120000
DATABASE_CONNECTION_POOL_MIN=10
DATABASE_CONNECTION_POOL_MAX=30

# Monitoring
MONITORING_IMPORT_METRICS_ENABLED=true
MONITORING_EXPORT_METRICS_ENABLED=true
DATADOG_API_KEY=${PROD_DATADOG_KEY}

# Logging
LOG_LEVEL=warn
```

---

## 🔐 Secrets Management

### GitHub Secrets (for CI/CD)

Add these to GitHub repository secrets (Settings → Secrets and variables):

```
PROD_DB_PASS              - Production database password
STAGING_DB_PASS           - Staging database password
PROD_DATADOG_KEY          - Production Datadog API key
STAGING_DATADOG_KEY       - Staging Datadog API key
SENTRY_DSN_PROD           - Sentry DSN for error tracking
SENTRY_DSN_STAGING        - Sentry DSN for staging
SLACK_WEBHOOK_URL         - Slack notifications
PAGERDUTY_API_KEY         - PagerDuty integration
```

### Environment Secret Configuration

**In CI/CD Pipeline (.github/workflows/deploy.yml):**
```yaml
env:
  DATABASE_URL: ${{ secrets.PROD_DB_URL }}
  DATADOG_API_KEY: ${{ secrets.PROD_DATADOG_KEY }}
  FEATURE_FLAG_IMPORT_ENABLED: 'true'
  IMPORT_MAX_FILE_SIZE_MB: '50'
```

**In Production Server:**
```bash
# /etc/card-benefits/.env.production (chmod 600)
IMPORT_MAX_FILE_SIZE_MB=50
DATABASE_URL="postgresql://user:${DB_PASSWORD}@host/db"

# DB_PASSWORD loaded from:
export DB_PASSWORD=$(aws secretsmanager get-secret-value --secret-id db-prod-password --query SecretString)
```

---

## ✅ Configuration Validation

### Validation Checklist

Run before deployment:

```bash
# 1. Check all required variables set
required_vars=(
  "IMPORT_MAX_FILE_SIZE_MB"
  "IMPORT_MAX_ROWS"
  "IMPORT_PARSE_TIMEOUT_MS"
  "IMPORT_VALIDATE_TIMEOUT_MS"
  "IMPORT_COMMIT_TIMEOUT_MS"
  "FEATURE_FLAG_IMPORT_ENABLED"
  "FEATURE_FLAG_EXPORT_ENABLED"
  "DATABASE_TRANSACTION_TIMEOUT_MS"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing: $var"
  else
    echo "✅ Set: $var=${!var}"
  fi
done

# 2. Validate numeric values are in range
if [ "$IMPORT_MAX_FILE_SIZE_MB" -lt 1 ] || [ "$IMPORT_MAX_FILE_SIZE_MB" -gt 1000 ]; then
  echo "❌ IMPORT_MAX_FILE_SIZE_MB out of range: $IMPORT_MAX_FILE_SIZE_MB"
fi

# 3. Validate boolean values
for var in FEATURE_FLAG_IMPORT_ENABLED FEATURE_FLAG_EXPORT_ENABLED; do
  if [ "${!var}" != "true" ] && [ "${!var}" != "false" ]; then
    echo "❌ Invalid boolean for $var: ${!var}"
  fi
done

# 4. Test database connection
npm run type-check  # Validates Prisma schema
npx prisma studio  # Interactive check (requires manual verification)

# 5. Verify temp directory exists and is writable
if [ ! -w "$IMPORT_TEMP_DIR" ]; then
  echo "❌ Cannot write to IMPORT_TEMP_DIR: $IMPORT_TEMP_DIR"
  mkdir -p "$IMPORT_TEMP_DIR"
  chmod 755 "$IMPORT_TEMP_DIR"
fi
```

### Configuration Health Check Script

```bash
#!/bin/bash
# scripts/check-import-export-config.sh

set -e

echo "🔍 Checking Import/Export Configuration..."

# Check environment variables
echo ""
echo "📋 Environment Variables:"
echo "IMPORT_MAX_FILE_SIZE_MB: ${IMPORT_MAX_FILE_SIZE_MB:?Not set}"
echo "IMPORT_MAX_ROWS: ${IMPORT_MAX_ROWS:?Not set}"
echo "FEATURE_FLAG_IMPORT_ENABLED: ${FEATURE_FLAG_IMPORT_ENABLED:?Not set}"

# Check database
echo ""
echo "💾 Database:"
npx prisma introspect > /dev/null && echo "✅ Database connection OK" || echo "❌ Database error"

# Check imports directory
echo ""
echo "📂 Import Directory:"
if [ -w "${IMPORT_TEMP_DIR:-.}" ]; then
  echo "✅ Temp directory writable: ${IMPORT_TEMP_DIR:-.}"
else
  echo "❌ Cannot write to: ${IMPORT_TEMP_DIR:-.}"
fi

# Check file size limits
echo ""
echo "📏 File Limits:"
echo "Max file size: ${IMPORT_MAX_FILE_SIZE_MB} MB"
echo "Max rows: ${IMPORT_MAX_ROWS}"

# Check timeouts
echo ""
echo "⏱️ Timeouts:"
echo "Parse: ${IMPORT_PARSE_TIMEOUT_MS}ms"
echo "Validate: ${IMPORT_VALIDATE_TIMEOUT_MS}ms"
echo "Commit: ${IMPORT_COMMIT_TIMEOUT_MS}ms"

echo ""
echo "✨ Configuration check complete!"
```

---

## 🔄 Configuration Updates

### Process for Changing Configuration

1. **Test Locally:**
   ```bash
   export NEW_VAR_NAME=new_value
   npm run dev
   # Test import/export functionality
   ```

2. **Update Staging:**
   ```bash
   # SSH to staging server
   ssh deploy@staging.example.com
   
   # Update .env
   vi /etc/card-benefits/.env.staging
   
   # Restart service
   systemctl restart card-benefits
   
   # Verify change
   curl http://staging-api/api/config/import-limits
   ```

3. **Deploy to Production:**
   ```bash
   # Only after verification in staging
   ssh deploy@prod.example.com
   vi /etc/card-benefits/.env.production
   systemctl restart card-benefits
   
   # Monitor dashboard for side effects
   ```

4. **Document Change:**
   - Add to this file
   - Create git commit: `chore: update import timeout configuration`
   - Notify team in #devops channel

---

## 📊 Performance Tuning

### Adjusting for Your System

If import/export operations are slow:

**Step 1: Identify bottleneck**
```bash
# Check parse time
grep "parseTimeMs" logs/app.log | tail -20

# Check validation time
grep "validationTimeMs" logs/app.log | tail -20

# Check commit time
grep "commitTimeMs" logs/app.log | tail -20
```

**Step 2: Increase timeout if hitting limit**
```bash
# If parsing is slow (>30s for normal files)
export IMPORT_PARSE_TIMEOUT_MS=90000  # 1.5 minutes

# Restart and retest
systemctl restart card-benefits
```

**Step 3: Increase max rows if needed**
```bash
# If hitting row limits
export IMPORT_MAX_ROWS=20000  # Double the limit

# Only if database can handle it
# Check: Expected commit time = IMPORT_MAX_ROWS * 30ms = 600s = 10 minutes
# If exceeds available timeout, increase IMPORT_COMMIT_TIMEOUT_MS accordingly
```

**Step 4: Check database indexes**
```sql
-- Verify indexes exist for ImportJob and ImportRecord
PRAGMA index_list(ImportJob);
PRAGMA index_list(ImportRecord);

-- If missing, run migration again:
npx prisma migrate resolve --rolled-back 20260403042633_add_import_export_tables
npm run prisma:migrate
```

---

## 📞 Configuration Support

**Questions about configuration?**
- Check this document first
- Review environment files in samples section
- Contact DevOps team: #devops Slack channel
- See deployment guide for troubleshooting

**Configuration Issues During Deployment:**
1. Stop deployment
2. Review .env file for typos
3. Re-run validation script
4. Restart service
5. Monitor logs for errors

---

**Version:** 1.0  
**Last Updated:** April 3, 2024  
**Next Review:** April 10, 2024
