# Card Management - Environment Configuration Guide

**Status:** PRODUCTION READY  
**Last Updated:** April 3, 2024  
**For:** DevOps Engineers, System Administrators

---

## Table of Contents

1. [Environment Variables Summary](#environment-variables-summary)
2. [Environment-Specific Configurations](#environment-specific-configurations)
3. [Secrets Management](#secrets-management)
4. [Feature Flags](#feature-flags)
5. [Performance Tuning](#performance-tuning)
6. [Configuration Validation](#configuration-validation)

---

## Environment Variables Summary

### Required Variables

All of these MUST be set before deployment:

| Variable | Type | Example | Description |
|----------|------|---------|-------------|
| `DATABASE_URL` | Secret | `postgresql://...` | Database connection string |
| `SESSION_SECRET` | Secret | `random-256-bit-hex` | Session/JWT signing key |
| `CRON_SECRET` | Secret | `random-256-bit-hex` | Cron job authorization key |
| `NODE_ENV` | Config | `production` | Environment indicator |

### Optional Variables (with defaults)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `NEXT_PUBLIC_CARDS_PAGE_SIZE` | Config | `25` | Cards per page for pagination |
| `NEXT_PUBLIC_MAX_CARDS_PER_PLAYER` | Config | `1000` | Max cards per player |
| `NEXT_PUBLIC_MAX_BULK_OPERATIONS` | Config | `100` | Max cards per bulk operation |
| `NEXT_PUBLIC_SEARCH_DEBOUNCE_MS` | Config | `300` | Search input debounce (ms) |
| `NEXT_PUBLIC_CARD_MANAGEMENT_ENABLED` | Feature Flag | `true` | Enable card CRUD operations |
| `NEXT_PUBLIC_BULK_OPERATIONS_ENABLED` | Feature Flag | `true` | Enable bulk operations |
| `NEXT_PUBLIC_SOFT_DELETE_ENABLED` | Feature Flag | `true` | Enable soft delete/archive |
| `NEXT_PUBLIC_ENABLE_CARD_METRICS` | Observability | `true` | Collect operation metrics |
| `NEXT_PUBLIC_LOG_CARD_OPERATIONS` | Observability | `false` | Log all card operations |

---

## Environment-Specific Configurations

### Development Environment (.env.local)

```env
# Database
DATABASE_URL="file:./dev.db"

# Security
NODE_ENV="development"
SESSION_SECRET="dev-secret-not-for-production"
CRON_SECRET="dev-cron-secret-not-for-production"

# Feature flags - all enabled for testing
NEXT_PUBLIC_CARD_MANAGEMENT_ENABLED="true"
NEXT_PUBLIC_BULK_OPERATIONS_ENABLED="true"
NEXT_PUBLIC_SOFT_DELETE_ENABLED="true"

# Performance - low thresholds for quick iteration
NEXT_PUBLIC_CARDS_PAGE_SIZE="10"
NEXT_PUBLIC_SEARCH_DEBOUNCE_MS="100"
NEXT_PUBLIC_MAX_BULK_OPERATIONS="50"

# Observability
NEXT_PUBLIC_ENABLE_CARD_METRICS="true"
NEXT_PUBLIC_LOG_CARD_OPERATIONS="true"  # Debug mode
```

### Testing Environment (.env.test)

```env
# Database
DATABASE_URL="file:./test.db"

# Security
NODE_ENV="test"
SESSION_SECRET="test-secret-random-key"
CRON_SECRET="test-cron-secret-random-key"

# Feature flags - all enabled
NEXT_PUBLIC_CARD_MANAGEMENT_ENABLED="true"
NEXT_PUBLIC_BULK_OPERATIONS_ENABLED="true"
NEXT_PUBLIC_SOFT_DELETE_ENABLED="true"

# Performance - realistic for testing
NEXT_PUBLIC_CARDS_PAGE_SIZE="25"
NEXT_PUBLIC_SEARCH_DEBOUNCE_MS="300"
NEXT_PUBLIC_MAX_BULK_OPERATIONS="100"

# Observability - log for verification
NEXT_PUBLIC_ENABLE_CARD_METRICS="true"
NEXT_PUBLIC_LOG_CARD_OPERATIONS="true"
```

### Staging Environment

```env
# Database - Use staging PostgreSQL instance
DATABASE_URL="postgresql://staging_user:${STAGING_DB_PASSWORD}@staging.db.internal:5432/card_benefits_staging?ssl=true"

# Security
NODE_ENV="production"
SESSION_SECRET="${STAGING_SESSION_SECRET}"
CRON_SECRET="${STAGING_CRON_SECRET}"

# Feature flags - all enabled for pre-production testing
NEXT_PUBLIC_CARD_MANAGEMENT_ENABLED="true"
NEXT_PUBLIC_BULK_OPERATIONS_ENABLED="true"
NEXT_PUBLIC_SOFT_DELETE_ENABLED="true"

# Performance - production-like settings
NEXT_PUBLIC_CARDS_PAGE_SIZE="25"
NEXT_PUBLIC_SEARCH_DEBOUNCE_MS="300"
NEXT_PUBLIC_MAX_BULK_OPERATIONS="100"

# Observability - full monitoring
NEXT_PUBLIC_ENABLE_CARD_METRICS="true"
NEXT_PUBLIC_LOG_CARD_OPERATIONS="false"  # Don't log all operations in staging

# Additional monitoring
SENTRY_DSN="${STAGING_SENTRY_DSN}"
DATADOG_API_KEY="${STAGING_DATADOG_KEY}"
```

### Production Environment

```env
# Database - Use production PostgreSQL with SSL
DATABASE_URL="postgresql://prod_user:${PROD_DB_PASSWORD}@prod.db.internal:5432/card_benefits_prod?ssl=true"

# Security
NODE_ENV="production"
SESSION_SECRET="${PROD_SESSION_SECRET}"
CRON_SECRET="${PROD_CRON_SECRET}"

# Feature flags - all enabled
NEXT_PUBLIC_CARD_MANAGEMENT_ENABLED="true"
NEXT_PUBLIC_BULK_OPERATIONS_ENABLED="true"
NEXT_PUBLIC_SOFT_DELETE_ENABLED="true"

# Performance - optimized for production load
NEXT_PUBLIC_CARDS_PAGE_SIZE="25"
NEXT_PUBLIC_SEARCH_DEBOUNCE_MS="300"
NEXT_PUBLIC_MAX_BULK_OPERATIONS="100"
NEXT_PUBLIC_MAX_CARDS_PER_PLAYER="1000"

# Observability - production monitoring only
NEXT_PUBLIC_ENABLE_CARD_METRICS="true"
NEXT_PUBLIC_LOG_CARD_OPERATIONS="false"

# Error tracking & monitoring
SENTRY_DSN="${PROD_SENTRY_DSN}"
DATADOG_API_KEY="${PROD_DATADOG_KEY}"
DATADOG_ENV="production"
NEW_RELIC_APP_NAME="card-management-prod"
NEW_RELIC_LICENSE_KEY="${PROD_NEW_RELIC_KEY}"
```

---

## Secrets Management

### Generating Secrets

#### SESSION_SECRET (Required)

Generate a cryptographically secure 256-bit random key:

```bash
# macOS/Linux
openssl rand -hex 32

# Windows PowerShell
[System.Convert]::ToBase64String([byte[]]32 | % {Get-Random -Max 256}) | % {$_.Substring(0, 43)}

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**Output Example:** `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0`

#### CRON_SECRET (Required)

Generate another unique 256-bit random key (different from SESSION_SECRET):

```bash
openssl rand -hex 32
```

### GitHub Secrets Configuration

1. Go to **Settings → Secrets and variables → Actions**
2. Create the following secrets:

```
PROD_DATABASE_URL          # production database connection
PROD_SESSION_SECRET        # production session key
PROD_CRON_SECRET          # production cron key
PROD_SENTRY_DSN           # Sentry error tracking
PROD_DATADOG_KEY          # Datadog monitoring
PROD_NEW_RELIC_KEY        # New Relic APM
STAGING_DATABASE_URL      # staging database connection
STAGING_SESSION_SECRET    # staging session key
STAGING_CRON_SECRET       # staging cron key
DEPLOY_TOKEN              # deployment authorization
```

### Using Secrets in Workflows

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        env:
          DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
          SESSION_SECRET: ${{ secrets.PROD_SESSION_SECRET }}
          CRON_SECRET: ${{ secrets.PROD_CRON_SECRET }}
        run: npm run deploy
```

### Secret Rotation Procedure

Every 90 days minimum:

```bash
#!/bin/bash
echo "🔄 Secret Rotation Procedure"

# 1. Generate new secrets
NEW_SESSION_SECRET=$(openssl rand -hex 32)
NEW_CRON_SECRET=$(openssl rand -hex 32)

echo "Old SESSION_SECRET: ${OLD_SESSION_SECRET}"
echo "New SESSION_SECRET: ${NEW_SESSION_SECRET}"

# 2. Update GitHub Secrets
# (Manual or using GitHub CLI)
gh secret set PROD_SESSION_SECRET --body "$NEW_SESSION_SECRET"
gh secret set PROD_CRON_SECRET --body "$NEW_CRON_SECRET"

# 3. Update environment variables
# (Platform-specific: Vercel, Render, etc.)

# 4. Deploy with new secrets
npm run deploy

# 5. Verify deployment succeeded
curl https://app.cardbenefits.com/api/health

# 6. Document rotation
echo "Session Secret Rotated: $(date)" >> ROTATION_LOG.txt
echo "By: $USER" >> ROTATION_LOG.txt
echo "Commit: $(git rev-parse --short HEAD)" >> ROTATION_LOG.txt
```

---

## Feature Flags

### Gradual Rollout Strategy

Feature flags allow deploying code while controlling feature availability:

```typescript
// In your application code:
if (process.env.NEXT_PUBLIC_CARD_MANAGEMENT_ENABLED === 'true') {
  // Show card management UI
} else {
  // Show placeholder or disabled state
}

// Usage in components:
export const CardManagementSection = () => {
  const isEnabled = process.env.NEXT_PUBLIC_CARD_MANAGEMENT_ENABLED === 'true';
  
  if (!isEnabled) {
    return <div>Coming soon...</div>;
  }
  
  return <CardManagement />;
};
```

### Rollout Timeline

```
Day 1: Code deployment with flag disabled
  NEXT_PUBLIC_CARD_MANAGEMENT_ENABLED="false"
  - Code is deployed but hidden from users
  - QA team can verify in staging
  - Monitor error rates (should be unchanged)

Day 2-3: Enable for 10% of users (canary deployment)
  - Use feature flag service or A/B testing
  - Monitor error rates for selected users
  - Verify performance metrics

Day 4-5: Enable for 50% of users
  - Monitor error rates and performance
  - Gather user feedback

Day 6: Enable for 100% of users
  - All users have access to card management
  - Continue monitoring
```

### Feature Flag Environment Setup

```env
# Card Management CRUD
NEXT_PUBLIC_CARD_MANAGEMENT_ENABLED="true"

# Bulk operations
NEXT_PUBLIC_BULK_OPERATIONS_ENABLED="true"

# Soft delete (archive instead of permanent delete)
NEXT_PUBLIC_SOFT_DELETE_ENABLED="true"

# Advanced search
NEXT_PUBLIC_ADVANCED_SEARCH_ENABLED="true"

# Email alerts (Phase 5)
NEXT_PUBLIC_EMAIL_ALERTS_ENABLED="false"

# Mobile optimizations
NEXT_PUBLIC_MOBILE_OPTIMIZATIONS_ENABLED="false"
```

### Disabling Features for Emergency

If an issue is discovered:

```bash
#!/bin/bash
# Quick disable procedure (no deployment needed)

# Update environment variable
export NEXT_PUBLIC_CARD_MANAGEMENT_ENABLED="false"

# Redeploy with same code but disabled flag
npm run deploy

# Verify users see disabled state
curl https://app.cardbenefits.com/api/cards
# Should return "feature disabled" or similar

# This gives time to investigate while keeping app running
```

---

## Performance Tuning

### Pagination Configuration

```env
# Default: 25 cards per page
NEXT_PUBLIC_CARDS_PAGE_SIZE="25"

# Adjustments for different scenarios:
# - Slow network: "10"      (smaller pages = faster load)
# - Desktop users: "50"     (larger pages = fewer requests)
# - API-only: "100"         (batch operations benefit)

# Memory vs. Network tradeoff:
# Larger page size = 
#   + Fewer HTTP requests
#   - More client-side memory
#   - Slower initial load
# Smaller page size =
#   + Faster initial load
#   + Less memory per page
#   - More HTTP requests
```

### Search Debouncing

```env
# Default: 300ms
NEXT_PUBLIC_SEARCH_DEBOUNCE_MS="300"

# Adjustments:
# Development: "100"     (quick feedback)
# Staging: "300"         (normal)
# Production: "500"      (reduces server load)
```

### Caching Settings

```typescript
// Set cache headers in production
res.setHeader('Cache-Control', 'private, max-age=300, must-revalidate');

// React Query cache configuration (in .env):
NEXT_PUBLIC_CARD_CACHE_TTL="300"  // 5 minutes

// Browser cache settings
// - Static assets: 1 year (long-lived)
// - API responses: 5 minutes (moderate)
// - HTML pages: 0 seconds (always fresh)
```

### Database Connection Pooling

```env
# Prisma connection pool settings
# (in prisma/schema.prisma or DATABASE_URL)

# PostgreSQL URL with connection pooling:
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require&pool_mode=transaction&max_pool_size=30"

# Connection pool size recommendations:
# Staging:     min=5, max=20
# Production:  min=10, max=50
# Peak load:   scale to min=20, max=100
```

---

## Configuration Validation

### Pre-Deployment Validation Script

```bash
#!/bin/bash
# Validate all environment configuration

set -e

echo "🔍 Configuration Validation"
echo "============================"

# 1. Check required variables
REQUIRED_VARS=(
  "DATABASE_URL"
  "SESSION_SECRET"
  "CRON_SECRET"
  "NODE_ENV"
)

echo "✓ Checking required variables..."
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing required variable: $var"
    exit 1
  fi
  echo "  ✓ $var is set"
done

# 2. Validate DATABASE_URL format
if [[ ! "$DATABASE_URL" =~ ^(postgresql|file):// ]]; then
  echo "❌ Invalid DATABASE_URL format"
  exit 1
fi
echo "✓ DATABASE_URL format valid"

# 3. Validate secret length
if [ ${#SESSION_SECRET} -lt 32 ]; then
  echo "❌ SESSION_SECRET too short (minimum 32 characters)"
  exit 1
fi
echo "✓ SESSION_SECRET length valid"

# 4. Validate environment
if [[ ! "$NODE_ENV" =~ ^(development|staging|production|test)$ ]]; then
  echo "❌ Invalid NODE_ENV: $NODE_ENV"
  exit 1
fi
echo "✓ NODE_ENV is valid"

# 5. Test database connection
echo "✓ Testing database connection..."
npx prisma db execute --stdin << 'EOF' || {
  echo "❌ Cannot connect to database"
  exit 1
}
SELECT 1;
EOF

# 6. Validate feature flags
VALID_FEATURE_FLAGS=("true" "false")
if [[ ! " ${VALID_FEATURE_FLAGS[@]} " =~ " ${NEXT_PUBLIC_CARD_MANAGEMENT_ENABLED} " ]]; then
  echo "❌ Invalid feature flag value for NEXT_PUBLIC_CARD_MANAGEMENT_ENABLED"
  exit 1
fi
echo "✓ Feature flags valid"

# 7. Check numeric configurations
if ! [[ "$NEXT_PUBLIC_CARDS_PAGE_SIZE" =~ ^[0-9]+$ ]]; then
  echo "❌ NEXT_PUBLIC_CARDS_PAGE_SIZE must be numeric"
  exit 1
fi
echo "✓ Numeric configurations valid"

echo ""
echo "✅ All configuration checks passed!"
echo ""
echo "Environment Summary:"
echo "  NODE_ENV: $NODE_ENV"
echo "  DATABASE: ${DATABASE_URL%password*}***"
echo "  Session Secret: ${SESSION_SECRET:0:8}...${SESSION_SECRET: -8}"
echo "  Cards per page: $NEXT_PUBLIC_CARDS_PAGE_SIZE"
echo "  Feature enabled: $NEXT_PUBLIC_CARD_MANAGEMENT_ENABLED"
```

### Runtime Validation

```typescript
// Add to application startup (src/lib/config.ts)

interface AppConfig {
  database: string;
  sessionSecret: string;
  cronSecret: string;
  nodeEnv: 'development' | 'staging' | 'production' | 'test';
  cardsPageSize: number;
  maxBulkOps: number;
}

function validateConfig(): AppConfig {
  const required = ['DATABASE_URL', 'SESSION_SECRET', 'CRON_SECRET'];
  
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
  
  const pageSize = parseInt(process.env.NEXT_PUBLIC_CARDS_PAGE_SIZE || '25');
  if (isNaN(pageSize) || pageSize < 1 || pageSize > 1000) {
    throw new Error('NEXT_PUBLIC_CARDS_PAGE_SIZE must be 1-1000');
  }
  
  return {
    database: process.env.DATABASE_URL!,
    sessionSecret: process.env.SESSION_SECRET!,
    cronSecret: process.env.CRON_SECRET!,
    nodeEnv: (process.env.NODE_ENV as any) || 'development',
    cardsPageSize: pageSize,
    maxBulkOps: parseInt(process.env.NEXT_PUBLIC_MAX_BULK_OPERATIONS || '100')
  };
}

// Call at startup
const config = validateConfig();
export default config;
```

---

## Quick Reference

### Environment Variables Checklist

| Variable | Dev | Staging | Prod | Format |
|----------|-----|---------|------|--------|
| `DATABASE_URL` | file:// | postgresql:// | postgresql:// | URL |
| `SESSION_SECRET` | ✓ | ✓ | ✓ | 64-char hex |
| `CRON_SECRET` | ✓ | ✓ | ✓ | 64-char hex |
| `NODE_ENV` | development | production | production | Enum |
| `NEXT_PUBLIC_CARDS_PAGE_SIZE` | 10 | 25 | 25 | Number |
| `NEXT_PUBLIC_MAX_BULK_OPERATIONS` | 50 | 100 | 100 | Number |
| `NEXT_PUBLIC_CARD_MANAGEMENT_ENABLED` | true | true | true | Boolean |
| `NEXT_PUBLIC_ENABLE_CARD_METRICS` | true | true | true | Boolean |
| `NEXT_PUBLIC_LOG_CARD_OPERATIONS` | true | false | false | Boolean |

### Common Configuration Issues

| Error | Cause | Solution |
|-------|-------|----------|
| "Cannot connect to database" | DATABASE_URL incorrect or database offline | Verify URL, check database server |
| "Authentication failed" | SESSION_SECRET not set or invalid | Generate new secret with `openssl rand -hex 32` |
| "Card page size must be numeric" | NEXT_PUBLIC_CARDS_PAGE_SIZE not a number | Set to valid number between 1-1000 |
| "Feature flag must be 'true' or 'false'" | Invalid feature flag value | Set to exactly "true" or "false" |
| "Cannot parse environment variables" | .env file syntax error | Check for missing quotes or newlines |

---

## References

- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT_GUIDE.md)
- [Operations Runbook](./OPERATIONS_RUNBOOK_CARD_MANAGEMENT.md)
- [QA Report](../.github/specs/card-management-qa-report.md)
