# Environment Configuration for Production

## Overview

This document outlines all environment variables required for production deployment.

**CRITICAL**: Never commit `.env.local` or production secrets to version control.

---

## Required Environment Variables

### Database Configuration

```env
# Production PostgreSQL Connection
# Format: postgresql://[user]:[password]@[host]:[port]/[database]
# Example: postgresql://postgres:MySecurePass123@db.railway.internal:5432/card_benefits
DATABASE_URL=postgresql://user:password@host:5432/card_benefits
```

**How to set in Railway:**
1. Click your PostgreSQL service in Railway
2. Copy the DATABASE_URL from "Connection" section
3. Add to main app service → Variables
4. Keep the provided URL (Railway manages credentials)

---

### Authentication & Security

```env
# Session Secret (256-bit encryption key)
# CRITICAL: Generate a unique, random value
# Do NOT reuse or share this value
# Command: openssl rand -hex 32
SESSION_SECRET=<your-256-bit-hex-string-here>

# Cron Job Secret (prevents unauthorized API access)
# CRITICAL: Different from SESSION_SECRET
# Command: openssl rand -hex 32
CRON_SECRET=<your-different-256-bit-hex-string-here>
```

**How to generate:**

```bash
# Generate Session Secret
openssl rand -hex 32
# Output: abc123def456abc123def456abc123def456abc123def456abc123def456

# Generate Cron Secret (different value)
openssl rand -hex 32
# Output: xyz789uvw012xyz789uvw012xyz789uvw012xyz789uvw012xyz789uvw012
```

**How to set in Railway:**
1. Go to your service → Variables
2. Click "Add Variable"
3. Enter variable name: `SESSION_SECRET`
4. Enter the generated value
5. Repeat for `CRON_SECRET`
6. Click Save

---

### Node.js & Deployment

```env
# Environment type (development, production, staging)
# Set to 'production' for Railway
NODE_ENV=production

# Logging level (debug, info, warn, error)
LOG_LEVEL=info

# Next.js Telemetry (disable in production)
NEXT_TELEMETRY_DISABLED=1
```

---

## Optional Environment Variables

```env
# Redis Cache (for advanced caching, sessions, rate limiting)
# Only set if you added Redis service to Railway
REDIS_URL=redis://default:password@host:6379

# Email Service (for transactional emails)
# Example using SendGrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Analytics
GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX

# API Base URL (for client-side requests)
NEXT_PUBLIC_API_URL=https://your-app.railway.app
```

---

## Secrets Management Best Practices

### ✅ DO

- ✅ Generate secrets with `openssl rand -hex 32`
- ✅ Store secrets in Railway's Variables tab (encrypted at rest)
- ✅ Rotate secrets periodically (quarterly minimum)
- ✅ Use different secrets for different environments (dev, staging, prod)
- ✅ Document which variables are secrets in `.env.example`
- ✅ Audit access logs for secret usage
- ✅ Enable Railway's backup/restore for disaster recovery

### ❌ DON'T

- ❌ Commit `.env.local` or any `.env.*` files with actual secrets
- ❌ Hardcode secrets in application code
- ❌ Reuse the same secret across environments
- ❌ Share secrets in chat, email, or unencrypted channels
- ❌ Log or print secrets to console
- ❌ Include secrets in error messages
- ❌ Commit backup/export files with secrets

---

## Database Setup

### Initial Setup

```bash
# 1. Push schema to database (creates tables)
npm run db:push

# 2. Generate Prisma client
npm run db:generate

# 3. Seed demo data (optional)
npm run prisma:seed
```

### On Production (Railway)

```bash
# Railway automatically runs release command:
# "releaseCommand": "prisma db push --skip-generate"
# This is defined in railway.json

# To manually run migrations:
railway run npm run prisma:migrate
```

---

## Health Check Configuration

The application includes a health endpoint for monitoring:

```
GET /api/health

Response:
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 3600
}
```

Railway monitors this endpoint:
- **Interval**: Every 30 seconds
- **Timeout**: 5 seconds
- **Restart on failure**: After 3 consecutive failures

---

## Security Headers

These are configured in `next.config.js`:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

---

## Environment-Specific Configurations

### Development

```env
NODE_ENV=development
DATABASE_URL=file:./dev.db
LOG_LEVEL=debug
SESSION_SECRET=dev-secret-change-this
CRON_SECRET=dev-secret-change-this
```

### Staging

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
LOG_LEVEL=info
SESSION_SECRET=<staging-secret-from-Railway>
CRON_SECRET=<staging-secret-from-Railway>
```

### Production

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
LOG_LEVEL=info
SESSION_SECRET=<production-secret-from-Railway>
CRON_SECRET=<production-secret-from-Railway>
```

---

## Verification Checklist

Before deploying, verify:

- [ ] DATABASE_URL is set and connects successfully
- [ ] SESSION_SECRET is a 64-character hex string (32 bytes)
- [ ] CRON_SECRET is different from SESSION_SECRET
- [ ] NODE_ENV is set to "production"
- [ ] All required variables are documented
- [ ] No secrets are hardcoded in application
- [ ] `.env.local` is in `.gitignore`
- [ ] Health endpoint responds with status "ok"

---

## Troubleshooting

### "DATABASE_URL is not set"

**Error in logs**: `Error: DATABASE_URL is not set`

**Solution**:
1. Go to Railway → Your Service → Variables
2. Add `DATABASE_URL` variable
3. For PostgreSQL service, copy the connection string
4. Redeploy: `railway redeploy`

### "SIGTERM: signal termination (graceful shutdown)"

This is expected behavior when Railway restarts the service.

---

## Secrets Rotation Schedule

Rotate secrets on this schedule:

| Secret | Frequency | Method |
|--------|-----------|--------|
| SESSION_SECRET | Quarterly | Generate new, update Railway, redeploy |
| CRON_SECRET | Quarterly | Generate new, update Railway, redeploy |
| Database password | Semi-annually | Change in PostgreSQL, update DATABASE_URL |

---

## Questions?

Refer to:
- `PRODUCTION_DEPLOYMENT_GUIDE.md` for deployment steps
- Railway docs: https://docs.railway.app
- Prisma docs: https://www.prisma.io/docs
