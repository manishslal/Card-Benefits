# Production Deployment Guide

## Table of Contents
1. [Overview](#overview)
2. [Pre-Deployment Requirements](#pre-deployment-requirements)
3. [Deployment Architecture](#deployment-architecture)
4. [Step-by-Step Deployment](#step-by-step-deployment)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Monitoring & Alerts](#monitoring--alerts)
7. [Troubleshooting](#troubleshooting)
8. [Rollback Procedures](#rollback-procedures)

---

## Overview

**Application**: Card Benefits Tracker  
**Technology Stack**: Next.js 15, TypeScript, Prisma, PostgreSQL  
**Deployment Platform**: Railway  
**CI/CD Pipeline**: GitHub Actions  
**Container Registry**: GitHub Container Registry (GHCR)  

### Key Features of This Deployment
- ✅ **Zero-downtime deployments** with health checks
- ✅ **Automatic CI/CD pipeline** on push to main
- ✅ **Docker containerization** with multi-stage builds
- ✅ **Database migration automation** (Prisma)
- ✅ **Security hardening** (non-root user, minimal base images)
- ✅ **Comprehensive health checks** and monitoring
- ✅ **Quick rollback capability** (< 3 minutes)

---

## Pre-Deployment Requirements

### Local Environment Setup

Before deploying, verify your local environment:

```bash
# 1. Run pre-deployment checks
./scripts/pre-deployment-check.sh

# Expected output:
# ✅ READY FOR DEPLOYMENT (all green checks)
```

### Required Environment Variables

Set these variables in Railway dashboard before deployment:

```env
# Database (auto-provided by Railway PostgreSQL plugin)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Authentication
SESSION_SECRET=<generate-with: openssl rand -hex 32>
CRON_SECRET=<generate-with: openssl rand -hex 32>

# Optional
NODE_ENV=production
LOG_LEVEL=info
```

### GitHub Secrets

Set up these secrets for GitHub Actions (needed for automated Docker push):

```
RAILWAY_TOKEN=<your-railway-api-token>
RAILWAY_SERVICE_ID=<your-railway-service-id>
```

**How to get Railway credentials:**
1. Go to Railway dashboard
2. Settings → Tokens → Create token
3. Copy token to GitHub Secrets as `RAILWAY_TOKEN`
4. Find Service ID in your service settings

---

## Deployment Architecture

### Infrastructure Overview

```
┌─────────────────────────────────────────────────────────┐
│                    GitHub Repository                     │
│  (triggers on push to main branch)                      │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ↓
         ┌─────────────────────────────┐
         │  GitHub Actions CI/CD       │
         │  1. Security audit          │
         │  2. Build & test            │
         │  3. Build Docker image      │
         │  4. Push to GHCR            │
         │  5. Deploy to Railway       │
         └──────────────┬──────────────┘
                        │
                        ↓
        ┌───────────────────────────────────┐
        │  GitHub Container Registry (GHCR) │
        │  Stores: ghcr.io/owner/repo:tag   │
        └───────────────┬───────────────────┘
                        │
                        ↓
         ┌──────────────────────────────────┐
         │  Railway Production Environment  │
         │                                  │
         │  ┌──────────────────────────┐   │
         │  │  Next.js Container       │   │
         │  │  - Port 3000             │   │
         │  │  - Health: /api/health   │   │
         │  │  - Auto-scaling enabled  │   │
         │  └───────────┬──────────────┘   │
         │              │                  │
         │  ┌───────────▼──────────────┐   │
         │  │  PostgreSQL Database     │   │
         │  │  - Auto-backup enabled   │   │
         │  │  - Version: 15           │   │
         │  └──────────────────────────┘   │
         │                                  │
         │  Monitoring:                     │
         │  - Health checks every 30s       │
         │  - Auto-restart on failure       │
         │  - Logs streamed to Railway      │
         └──────────────────────────────────┘
```

---

## Step-by-Step Deployment

### Phase 1: Local Preparation (5 minutes)

```bash
# 1. Navigate to project directory
cd card-benefits-tracker

# 2. Run pre-deployment verification
./scripts/pre-deployment-check.sh

# Expected: All checks pass with ✅ READY FOR DEPLOYMENT

# 3. Verify code changes
git status
git diff

# 4. Create feature branch (if not already on main)
git checkout main
git pull origin main
```

### Phase 2: Code Review & Merge (varies)

```bash
# 1. Create a pull request (if changes not on main)
# 2. Request code review
# 3. Address any review comments
# 4. Merge to main when approved

# Merge on GitHub or via CLI:
git checkout main
git merge --no-ff feature/your-feature-name
git push origin main
```

### Phase 3: Automated Deployment (5-10 minutes)

Once merged to `main`, GitHub Actions automatically:

1. **Runs security audit** - Scans for vulnerabilities
2. **Builds application** - Compiles Next.js
3. **Runs tests** - Executes test suite
4. **Builds Docker image** - Multi-stage build
5. **Pushes to registry** - Pushes to GHCR
6. **Deploys to Railway** - Triggers deployment
7. **Verifies health** - Confirms app is responsive

**Monitor deployment:**
```bash
# Option 1: GitHub Actions
https://github.com/yourusername/card-benefits-tracker/actions

# Option 2: Railway Dashboard
https://railway.app (your project)

# Option 3: Command line (if Railway CLI installed)
railway logs --follow
```

### Phase 4: Post-Deployment Verification (5 minutes)

See [Post-Deployment Verification](#post-deployment-verification) section below.

---

## Post-Deployment Verification

### Immediate Checks (First 5 minutes)

```bash
# 1. Verify application is accessible
curl https://your-app-url.railway.app

# Expected: HTML response from Next.js app

# 2. Check health endpoint
curl https://your-app-url.railway.app/api/health

# Expected: {"status": "ok", "database": "connected"}

# 3. Verify database connection
curl https://your-app-url.railway.app/api/health | jq .database

# Expected: "connected"
```

### Functional Tests (Next 10 minutes)

```bash
# 1. Sign up page loads
# Navigate to: https://your-app-url.railway.app/signup
# Verify: Form displays without errors

# 2. Login page works
# Navigate to: https://your-app-url.railway.app/login
# Verify: Page loads, form interactive

# 3. Create test user
# Complete signup form with test account
# Verify: User created successfully

# 4. Database connectivity
# After login, verify cards display or create new card
# Verify: Data persists in PostgreSQL

# 5. File upload (CSV/XLSX)
# Test uploading a CSV file
# Verify: File processed correctly, data imported
```

### Performance & Monitoring

```bash
# View deployment logs
railway logs --follow

# Expected log entries:
# - "Ready - started server on" (app started)
# - No ERROR entries in first 5 minutes
# - Health checks passing (every 30 seconds)

# Check deployment status
railway status
# Expected: "Status: Running" or "Status: Healthy"

# View container metrics
# Go to Railway dashboard → Metrics tab
# Verify: CPU < 80%, Memory < 500MB, No errors
```

---

## Monitoring & Alerts

### Health Endpoint

The application includes a comprehensive health check endpoint:

**Endpoint**: `GET /api/health`  
**Response**:
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 3600
}
```

### Railway Monitoring

1. **Health Checks**
   - Interval: Every 30 seconds
   - Timeout: 5 seconds
   - Failure threshold: 3 consecutive failures triggers restart

2. **Metrics Dashboard**
   - CPU Usage
   - Memory Usage
   - Network I/O
   - Deployment history

3. **Logs**
   - Real-time log streaming
   - Filter by severity (ERROR, WARN, INFO)
   - 7-day retention

### Setting Up Alerts (Optional)

In Railway dashboard:
1. Go to your project
2. Settings → Notifications
3. Configure alerts for:
   - Deployment failures
   - High resource usage
   - Service crashes

---

## Troubleshooting

### Deployment Failed

**Symptom**: GitHub Actions workflow shows red ❌

**Steps**:
1. Click on failed job in GitHub Actions
2. View detailed logs
3. Common issues:

| Issue | Solution |
|-------|----------|
| Build fails | Run `npm run build` locally to debug |
| Type errors | Run `npm run type-check` locally |
| Test failures | Run `npm run test` locally |
| Docker build fails | Run `docker build .` locally |

### Health Check Failing

**Symptom**: Railway shows unhealthy or crashing

**Steps**:
```bash
# 1. Check health endpoint directly
curl https://your-app-url.railway.app/api/health

# 2. If fails, check logs
railway logs --follow

# 3. Look for errors like:
# - "Cannot connect to database"
# - "Prisma client not initialized"
# - "Port already in use"

# 4. Verify environment variables are set
# Go to Railway → Service → Variables
# Confirm DATABASE_URL, SESSION_SECRET, CRON_SECRET present

# 5. If database error, check DATABASE_URL
# Ensure PostgreSQL service is running
railway status
```

### Database Connection Issues

**Symptom**: Health check shows `"database": "disconnected"`

**Steps**:
```bash
# 1. Verify DATABASE_URL in Railway environment
railway variables:get DATABASE_URL

# 2. Run database migrations
railway run prisma db push --skip-generate

# 3. Check PostgreSQL service
railway services
# Verify PostgreSQL is listed and running

# 4. If still failing, restart services
# Go to Railway → Services → Stop → Start
```

### Application Running But No Data Showing

**Symptom**: App loads but database queries fail

**Steps**:
```bash
# 1. Check Prisma client generation
npm run db:generate

# 2. Run migrations
npm run prisma:migrate

# 3. View deployment logs for query errors
railway logs --follow

# 4. Check .env configuration
# DATABASE_URL format: postgresql://user:password@host:port/database
```

---

## Rollback Procedures

### Quick Rollback (< 3 minutes)

**Scenario**: Deployment introduces critical issues

```bash
# Option 1: Using GitHub
1. Go to Actions tab
2. Find the problematic deploy run
3. Click "Re-run all jobs" on previous stable commit
4. Or manually re-run a previous action

# Option 2: Using Railway CLI
railway redeploy --from-commit <stable-commit-sha>

# Option 3: Manual rollback
git revert <problematic-commit-sha>
git push origin main
# This triggers new deployment from previous state
```

### Full Database Rollback

**If database migration fails or data corruption:**

```bash
# 1. Get backup timestamp
railway backups:list

# 2. Restore from backup
railway backups:restore --backup-id <backup-id>

# 3. Verify restoration
curl https://your-app-url.railway.app/api/health

# 4. Run migrations again (carefully)
npm run prisma:migrate
```

### Step-by-Step Rollback Process

| Step | Action | Command |
|------|--------|---------|
| 1 | Identify last stable commit | `git log --oneline \| head -5` |
| 2 | Create revert commit | `git revert -m 1 <bad-commit-sha>` |
| 3 | Push revert | `git push origin main` |
| 4 | Wait for deployment | Monitor GitHub Actions (2-5 min) |
| 5 | Verify health | `curl .../api/health` |
| 6 | Confirm in production | Test key features |

**Total rollback time**: 3-5 minutes

---

## Deployment Checklist

Before deploying, verify:

- [ ] All tests pass locally: `npm run test:all`
- [ ] Build succeeds: `npm run build`
- [ ] Type check passes: `npm run type-check`
- [ ] No hardcoded secrets in code
- [ ] Environment variables documented in `.env.example`
- [ ] Pre-deployment check passes: `./scripts/pre-deployment-check.sh`
- [ ] Code reviewed and approved
- [ ] Feature branch merged to main
- [ ] GitHub Actions workflow triggered
- [ ] Deployment completed successfully
- [ ] Health endpoint responding
- [ ] Core functionality tested in production
- [ ] Logs monitored for errors

---

## Emergency Contacts & Resources

### Documentation
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Railway Documentation](https://docs.railway.app)
- [Prisma Deployment](https://www.prisma.io/docs/guides/deployment)

### Tools
- GitHub Actions: https://github.com/yourusername/card-benefits-tracker/actions
- Railway Dashboard: https://railway.app
- Container Registry: https://ghcr.io

### Useful Commands

```bash
# View recent commits
git log --oneline -10

# Check current deployment
railway status

# Stream logs in real-time
railway logs --follow

# Restart application
railway redeploy

# Run database migrations
npm run prisma:migrate

# Generate Prisma client
npm run db:generate
```

---

## Success Criteria

Deployment is successful when:

✅ GitHub Actions pipeline shows all green checks  
✅ Health endpoint returns `{"status": "ok"}`  
✅ Database shows as "connected"  
✅ Application loads in browser  
✅ Sign up/login flows work  
✅ No 500 errors in logs  
✅ No pending migrations  
✅ Performance metrics normal (CPU < 80%, Mem < 500MB)  

---

## Need Help?

1. Check logs: `railway logs --follow`
2. Review this guide: Search troubleshooting section
3. Run pre-deployment check: `./scripts/pre-deployment-check.sh`
4. Contact team lead with:
   - Deployment logs
   - Error messages
   - Commit SHA of problematic code
