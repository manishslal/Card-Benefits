# Custom Values Feature - Environment Configuration Guide

**Date:** April 3, 2024  
**Version:** 1.0  
**Scope:** Custom Benefit Values (Edit, ROI Recalculation, Audit Trail)

---

## 📋 Overview

This document specifies all environment variables, secrets, and configuration required for the Custom Values feature to operate correctly in development, staging, and production environments.

### Environment Levels

| Environment | Database | Cache | Performance Targets | Updates |
|-------------|----------|-------|-------------------|---------|
| Development | SQLite (local) | In-memory | N/A | Any time |
| Staging | SQLite (file) | Redis | <300ms ROI calc | Before production |
| Production | PostgreSQL | Redis | <300ms ROI calc | Scheduled maintenance windows |

---

## 🔑 Environment Variables

### Core Configuration

#### `NODE_ENV`
- **Type:** Enum: `development` | `staging` | `production`
- **Default:** `development`
- **Description:** Runtime environment that controls logging, error handling, and performance monitoring
- **Development:** `development`
- **Staging:** `staging`
- **Production:** `production`

#### `DATABASE_URL`
- **Type:** String (connection string)
- **Default:** `file:./prisma/dev.db`
- **Required:** Yes
- **Description:** Database connection string for Prisma
- **Development:** `file:./prisma/dev.db` (SQLite)
- **Staging:** `file:./prisma/staging.db` (SQLite) or PostgreSQL URL
- **Production:** `postgresql://user:password@host:5432/card_benefits` (PostgreSQL)

**PostgreSQL Format:**
```
postgresql://[user[:password]@][netloc][:port][/dbname][?param1=value1&...]
```

**Example (Production):**
```
postgresql://card_user:$(PROD_DB_PASSWORD)@prod-db.vercel-postgres.com:5432/card_benefits?sslmode=require&connection_limit=20
```

**Security:** ⚠️ **CRITICAL**: Store password in Vercel Secrets, not in code.

#### `PRISMA_DATABASE_URL`
- **Type:** String
- **Optional:** Yes
- **Description:** Alternative database URL if different from `DATABASE_URL`
- **Use Case:** Shadow database for migrations (staging/production)

---

### Custom Values Feature Configuration

#### `CUSTOM_VALUES_CACHE_TTL`
- **Type:** Integer (seconds)
- **Default:** `300` (5 minutes)
- **Development:** `300` (5 min)
- **Staging:** `300` (5 min)
- **Production:** `300` (5 min)
- **Description:** Time-to-live for cached benefit values before cache invalidation
- **Impact:** Higher = better performance, lower = fresher data
- **Min:** `60` (1 minute)
- **Max:** `3600` (1 hour)

**Example:**
```env
CUSTOM_VALUES_CACHE_TTL=300
```

#### `CUSTOM_VALUES_TIMEOUT`
- **Type:** Integer (milliseconds)
- **Default:** `30000` (30 seconds)
- **Development:** `30000` (30 sec)
- **Staging:** `30000` (30 sec)
- **Production:** `30000` (30 sec)
- **Description:** Maximum duration for custom value update operations
- **Min:** `5000` (5 seconds)
- **Max:** `60000` (60 seconds)

**Example:**
```env
CUSTOM_VALUES_TIMEOUT=30000
```

#### `ROI_CALCULATION_MAX_RETRIES`
- **Type:** Integer
- **Default:** `3`
- **Development:** `3`
- **Staging:** `3`
- **Production:** `3`
- **Description:** Maximum retry attempts for ROI calculation on failure
- **Min:** `1`
- **Max:** `5`

**Example:**
```env
ROI_CALCULATION_MAX_RETRIES=3
```

#### `ENABLE_VALUE_HISTORY`
- **Type:** Boolean (string: "true" | "false")
- **Default:** `true`
- **Development:** `true`
- **Staging:** `true`
- **Production:** `true`
- **Description:** Enable/disable value history audit trail tracking
- **⚠️ CRITICAL:** Must be `true` for production; disabling will prevent audit trail recording

**Example:**
```env
ENABLE_VALUE_HISTORY=true
```

#### `ENABLE_BULK_UPDATES`
- **Type:** Boolean (string: "true" | "false")
- **Default:** `true`
- **Development:** `true`
- **Staging:** `true`
- **Production:** `true`
- **Description:** Enable/disable bulk value update operations

**Example:**
```env
ENABLE_BULK_UPDATES=true
```

#### `BULK_UPDATE_BATCH_SIZE`
- **Type:** Integer
- **Default:** `50`
- **Development:** `50`
- **Staging:** `50`
- **Production:** `100`
- **Description:** Maximum records per bulk update batch
- **Min:** `10`
- **Max:** `500`

**Example:**
```env
BULK_UPDATE_BATCH_SIZE=100
```

---

### Cache Configuration

#### `REDIS_URL`
- **Type:** String (connection string)
- **Default:** None (development uses in-memory cache)
- **Required:** For production/staging
- **Description:** Redis connection string for distributed caching
- **Format:** `redis://[user:password@][host]:[port][/database]`

**Development:**
```env
# Uses in-memory cache, no Redis needed
```

**Staging/Production:**
```env
REDIS_URL=redis://default:$(REDIS_PASSWORD)@redis-host:6379
```

**Example (Vercel Redis):**
```env
REDIS_URL=redis://default:abc123def456@us1-brave-hedgehog-12345.upstash.io:6379
```

**Security:** ⚠️ **CRITICAL**: Store password in Vercel Secrets.

#### `CACHE_STRATEGY`
- **Type:** Enum: `memory` | `redis` | `hybrid`
- **Default:** `memory` (development), `redis` (production)
- **Description:** Caching strategy selection
  - `memory`: In-memory cache (development only)
  - `redis`: Redis-backed distributed cache (production)
  - `hybrid`: Both memory + Redis fallback (staging)

**Example:**
```env
CACHE_STRATEGY=redis
```

---

### Database Connection Pooling

#### `DATABASE_POOL_MIN`
- **Type:** Integer
- **Default:** `2`
- **Development:** `2`
- **Staging:** `5`
- **Production:** `10`
- **Description:** Minimum connections in pool

**Example:**
```env
DATABASE_POOL_MIN=10
```

#### `DATABASE_POOL_MAX`
- **Type:** Integer
- **Default:** `10`
- **Development:** `10`
- **Staging:** `20`
- **Production:** `20`
- **Description:** Maximum connections in pool
- **⚠️ NOTE:** May be limited by hosting platform (e.g., Vercel PostgreSQL limits)

**Example:**
```env
DATABASE_POOL_MAX=20
```

#### `DATABASE_QUERY_TIMEOUT`
- **Type:** Integer (seconds)
- **Default:** `30`
- **Development:** `30`
- **Staging:** `30`
- **Production:** `30`
- **Description:** Maximum query execution time before timeout

**Example:**
```env
DATABASE_QUERY_TIMEOUT=30
```

---

### Authentication & Session

#### `SESSION_SECRET`
- **Type:** String (base64, 32 bytes)
- **Required:** Yes
- **Description:** Secret key for JWT signing and session management
- **⚠️ CRITICAL:** Must be generated securely, rotated regularly

**Generate:**
```bash
# macOS/Linux
openssl rand -hex 32

# Windows PowerShell
[System.Convert]::ToBase64String([byte[]]@(Get-Random -Minimum 0 -Maximum 256) * 32)
```

**Example:**
```env
SESSION_SECRET="6d3f7e8c2b9a1d4f5e6c7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c"
```

**Security:** ⚠️ **CRITICAL**: Store in Vercel Secrets only. Never commit to repository.

#### `CRON_SECRET`
- **Type:** String (random, at least 32 characters)
- **Required:** Yes
- **Description:** Secret key for cron job authentication
- **⚠️ CRITICAL:** Must be different from `SESSION_SECRET`

**Example:**
```env
CRON_SECRET="9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a"
```

**Security:** ⚠️ **CRITICAL**: Store in Vercel Secrets only.

---

### Monitoring & Logging

#### `LOG_LEVEL`
- **Type:** Enum: `debug` | `info` | `warn` | `error`
- **Default:** `info`
- **Development:** `debug`
- **Staging:** `info`
- **Production:** `info`
- **Description:** Logging verbosity level

**Example:**
```env
LOG_LEVEL=info
```

#### `SENTRY_DSN`
- **Type:** String (Sentry Data Source Name)
- **Optional:** Yes
- **Description:** Sentry error tracking integration
- **Staging/Production:** Recommended for error monitoring

**Example:**
```env
SENTRY_DSN=https://abc123@sentry.io/123456
```

#### `DATADOG_API_KEY`
- **Type:** String (DataDog API key)
- **Optional:** Yes
- **Description:** DataDog APM and metrics integration

**Example:**
```env
DATADOG_API_KEY=$(PROD_DATADOG_API_KEY)
```

#### `ENABLE_PERFORMANCE_MONITORING`
- **Type:** Boolean (string: "true" | "false")
- **Default:** `false` (development), `true` (production)
- **Description:** Enable performance metrics collection

**Example:**
```env
ENABLE_PERFORMANCE_MONITORING=true
```

---

### Feature Flags

#### `ENABLE_CUSTOM_VALUES_FEATURE`
- **Type:** Boolean (string: "true" | "false")
- **Default:** `true`
- **Description:** Master feature flag to enable/disable entire Custom Values feature
- **Use Case:** Gradual rollout, emergency disable

**Example:**
```env
ENABLE_CUSTOM_VALUES_FEATURE=true
```

#### `CUSTOM_VALUES_ROLLOUT_PERCENTAGE`
- **Type:** Integer (0-100)
- **Default:** `100`
- **Description:** Percentage of users to enable Custom Values for (gradual rollout)
- **Use Case:** Canary deployment, gradual release

**Example (50% of users):**
```env
CUSTOM_VALUES_ROLLOUT_PERCENTAGE=50
```

#### `ENABLE_VALUE_PRESETS`
- **Type:** Boolean (string: "true" | "false")
- **Default:** `true`
- **Description:** Enable preset value suggestions for users

**Example:**
```env
ENABLE_VALUE_PRESETS=true
```

#### `ENABLE_BULK_EDITOR`
- **Type:** Boolean (string: "true" | "false")
- **Default:** `true`
- **Description:** Enable bulk value editor component

**Example:**
```env
ENABLE_BULK_EDITOR=true
```

---

## 🔐 Secrets Configuration (Vercel)

Add these secrets in Vercel project settings (not in code):

| Secret Name | Type | Environment | Required |
|-------------|------|-------------|----------|
| `DATABASE_PASSWORD` | password | Staging, Production | ✅ |
| `SESSION_SECRET` | string | All | ✅ |
| `CRON_SECRET` | string | All | ✅ |
| `REDIS_PASSWORD` | password | Production | ✅ |
| `SENTRY_DSN` | string | Staging, Production | ⚠️ |
| `DATADOG_API_KEY` | string | Production | ⚠️ |

### Setting Secrets in Vercel CLI

```bash
# Add secret for production
vercel env add DATABASE_PASSWORD --prod

# List all secrets
vercel env ls

# Pull environment from production
vercel env pull
```

### Vercel Dashboard Method

1. Navigate to Project Settings → Environment Variables
2. Click "Add New"
3. Enter key name (e.g., `SESSION_SECRET`)
4. Enter value
5. Select environments (Production, Preview, Development)
6. Click "Add"

---

## 📝 Configuration Files

### `.env.local` (Development)
```env
# Database
DATABASE_URL="file:./prisma/dev.db"

# Sessions & Security
SESSION_SECRET="6d3f7e8c2b9a1d4f5e6c7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c"
CRON_SECRET="9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a"

# Custom Values
CUSTOM_VALUES_CACHE_TTL=300
CUSTOM_VALUES_TIMEOUT=30000
ROI_CALCULATION_MAX_RETRIES=3
ENABLE_VALUE_HISTORY=true
ENABLE_BULK_UPDATES=true
BULK_UPDATE_BATCH_SIZE=50

# Cache (in-memory for development)
CACHE_STRATEGY=memory

# Logging
LOG_LEVEL=debug
NODE_ENV=development
```

### `.env.example` (Template)
```env
# Database Configuration
DATABASE_URL=file:./prisma/dev.db

# Authentication & Session Management
SESSION_SECRET=                    # Generate: openssl rand -hex 32
CRON_SECRET=                       # Generate: openssl rand -hex 32

# Custom Values Feature Configuration
CUSTOM_VALUES_CACHE_TTL=300        # Cache TTL in seconds (5 min default)
CUSTOM_VALUES_TIMEOUT=30000        # Timeout in milliseconds
ROI_CALCULATION_MAX_RETRIES=3
ENABLE_VALUE_HISTORY=true
ENABLE_BULK_UPDATES=true
BULK_UPDATE_BATCH_SIZE=50

# Cache Configuration
REDIS_URL=                         # Optional: Redis connection string
CACHE_STRATEGY=memory              # memory | redis | hybrid

# Database Connection Pooling
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_QUERY_TIMEOUT=30

# Monitoring & Logging
LOG_LEVEL=info
SENTRY_DSN=                        # Optional: Sentry error tracking
DATADOG_API_KEY=                   # Optional: DataDog APM
ENABLE_PERFORMANCE_MONITORING=false

# Feature Flags
ENABLE_CUSTOM_VALUES_FEATURE=true
CUSTOM_VALUES_ROLLOUT_PERCENTAGE=100
ENABLE_VALUE_PRESETS=true
ENABLE_BULK_EDITOR=true

# Runtime
NODE_ENV=development
```

---

## 🚀 Environment-Specific Configurations

### Development

**Purpose:** Local development and testing

```env
NODE_ENV=development
DATABASE_URL=file:./prisma/dev.db
CACHE_STRATEGY=memory
LOG_LEVEL=debug
CUSTOM_VALUES_CACHE_TTL=60
DATABASE_POOL_MIN=1
DATABASE_POOL_MAX=5
ENABLE_PERFORMANCE_MONITORING=false
```

**Setup Steps:**
```bash
# 1. Copy template
cp .env.example .env.local

# 2. Generate secrets
openssl rand -hex 32 > SESSION_SECRET
openssl rand -hex 32 > CRON_SECRET

# 3. Initialize database
npm run db:reset

# 4. Start development server
npm run dev
```

### Staging

**Purpose:** Pre-production testing and validation

```env
NODE_ENV=staging
DATABASE_URL=postgresql://user:pass@staging-db:5432/card_benefits
CACHE_STRATEGY=hybrid
LOG_LEVEL=info
CUSTOM_VALUES_CACHE_TTL=300
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=15
ENABLE_PERFORMANCE_MONITORING=true
SENTRY_DSN=https://abc123@sentry.io/123456
CUSTOM_VALUES_ROLLOUT_PERCENTAGE=50  # 50% canary
```

**Setup Steps:**
```bash
# 1. Set environment variables in Vercel
vercel env add NODE_ENV --prod  # For staging, use preview
vercel env add DATABASE_URL --prod

# 2. Deploy to staging
vercel deploy

# 3. Run migrations
DATABASE_URL=... npm run prisma:migrate
```

### Production

**Purpose:** Live environment serving real users

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@prod-db:5432/card_benefits
CACHE_STRATEGY=redis
REDIS_URL=redis://default:pass@redis-host:6379
LOG_LEVEL=info
CUSTOM_VALUES_CACHE_TTL=300
DATABASE_POOL_MIN=10
DATABASE_POOL_MAX=20
ENABLE_PERFORMANCE_MONITORING=true
SENTRY_DSN=https://abc123@sentry.io/123456
CUSTOM_VALUES_ROLLOUT_PERCENTAGE=100  # All users
```

**Setup Steps:**
```bash
# 1. Set environment variables in Vercel
vercel env add SESSION_SECRET --prod
vercel env add DATABASE_URL --prod
vercel env add REDIS_URL --prod

# 2. Deploy to production
vercel deploy --prod

# 3. Run migrations
DATABASE_URL=... npm run prisma:migrate
```

---

## ✅ Configuration Validation

### Pre-Deployment Checklist

Run this to verify all configurations:

```bash
#!/bin/bash

# Check required environment variables
check_env() {
  local var=$1
  if [ -z "${!var}" ]; then
    echo "❌ Missing: $var"
    return 1
  fi
  echo "✅ $var configured"
  return 0
}

echo "Validating environment configuration..."
check_env "DATABASE_URL"
check_env "SESSION_SECRET"
check_env "CRON_SECRET"
check_env "CUSTOM_VALUES_CACHE_TTL"
check_env "CUSTOM_VALUES_TIMEOUT"

# Validate database connection
echo "Testing database connection..."
npm run test:db-connection

# Validate feature flags
echo "Validating feature flags..."
if [ "$ENABLE_VALUE_HISTORY" != "true" ]; then
  echo "⚠️ Warning: Value history disabled"
fi

echo "✅ Configuration validation complete"
```

---

## 🔄 Secrets Rotation Schedule

| Secret | Rotation Period | Procedure |
|--------|-----------------|-----------|
| `SESSION_SECRET` | Every 90 days | Generate new, update Vercel, restart servers |
| `CRON_SECRET` | Every 90 days | Generate new, update Vercel, no restart needed |
| `DATABASE_PASSWORD` | Every 180 days | Coordinate with database team, migrate connection string |
| `REDIS_PASSWORD` | Every 180 days | Coordinate with Redis provider, update connection string |

**Rotation Process:**
1. Generate new secret
2. Add new secret as `[SECRET_NAME]_NEW` in Vercel
3. Update code to check both old and new secrets
4. Monitor for errors over 7 days
5. Remove old secret from Vercel

---

## 🆘 Troubleshooting

### Issue: `DATABASE_URL` Not Found

**Error:** `Error: ENOENT: no such file or directory`

**Solution:**
```bash
# Verify environment file exists
ls -la .env.local

# Check if DATABASE_URL is set
echo $DATABASE_URL

# For Vercel, pull environment:
vercel env pull
```

### Issue: Redis Connection Failed

**Error:** `Error: getaddrinfo ENOTFOUND redis-host`

**Solution:**
```bash
# Verify Redis URL format
echo $REDIS_URL

# Test connection
redis-cli -u $REDIS_URL ping

# If failing, switch to memory cache
CACHE_STRATEGY=memory
```

### Issue: Secret Mismatch

**Error:** `Invalid JWT token` or `Unauthorized cron request`

**Solution:**
```bash
# Verify secrets are consistent between local and Vercel
vercel env ls

# Rotate secrets if compromised
vercel env remove SESSION_SECRET
vercel env add SESSION_SECRET --prod
```

---

## 📖 Related Documentation

- **Deployment Guide:** [DEPLOYMENT_GUIDE_CUSTOM_VALUES.md](DEPLOYMENT_GUIDE_CUSTOM_VALUES.md)
- **CI/CD Workflow:** [.github/workflows/ci-custom-values.yml](.github/workflows/ci-custom-values.yml)
- **Monitoring Setup:** [MONITORING_CUSTOM_VALUES.md](MONITORING_CUSTOM_VALUES.md)
- **QA Report:** [.github/specs/custom-values-qa-report.md](.github/specs/custom-values-qa-report.md)

---

**Last Updated:** April 3, 2024  
**Version:** 1.0  
**Status:** Ready for use after QA fixes
