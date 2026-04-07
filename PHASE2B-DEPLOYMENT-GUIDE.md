# Phase 2B Deployment Guide

**Version:** 1.0.0  
**Status:** PRODUCTION READY  
**Last Updated:** April 7, 2026  

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Deployment Overview](#deployment-overview)
3. [Step-by-Step Deployment](#step-by-step-deployment)
4. [Environment Configuration](#environment-configuration)
5. [Monitoring & Verification](#monitoring--verification)
6. [Rollback Procedures](#rollback-procedures)
7. [Post-Deployment Checklist](#post-deployment-checklist)
8. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

### Code Quality ✅
- [ ] `npm run build` passes with 0 errors
- [ ] `npm run test` passes (all tests green)
- [ ] `npm run lint` passes (no blocking issues)
- [ ] `npm audit` shows no critical vulnerabilities
- [ ] TypeScript strict mode: no errors

### Database Readiness ✅
- [ ] Phase 2A migration applied to staging
- [ ] All 3 new Phase 2B tables exist:
  - `BenefitUsageRecord`
  - `BenefitPeriod`
  - `BenefitRecommendation`
- [ ] All 12 indexes created and verified
- [ ] Database backup created and tested
- [ ] Migration script tested on staging

### Deployment Infrastructure ✅
- [ ] Railway tokens configured in GitHub Secrets
- [ ] GitHub Actions workflows in place
- [ ] Environment variables defined
- [ ] Health check endpoint working
- [ ] Slack webhook configured for notifications

### Feature Flags & Configuration ✅
- [ ] Feature flags configured correctly
- [ ] Environment variables loaded correctly
- [ ] Secrets not committed to repository
- [ ] All config files use environment variables

### Documentation & Communication ✅
- [ ] Team trained on deployment procedures
- [ ] Rollback procedure documented and tested
- [ ] Monitoring setup complete
- [ ] Incident response team notified
- [ ] Stakeholders aware of deployment window

---

## Deployment Overview

### Architecture

```
GitHub Push (main branch)
    ↓
GitHub Actions Trigger
    ↓
Quality Checks (Build, Test, Lint)
    ↓
Deploy to Staging (if branch is staging)
    ↓
Health Checks & Smoke Tests
    ↓
Deploy to Production (if branch is main)
    ↓
Health Checks & Verification
    ↓
Monitoring & Alerts
```

### Timeline

| Phase | Duration | Activity |
|-------|----------|----------|
| **Pre-deployment** | 30 min | Code review, backup creation, monitoring setup |
| **Quality checks** | 5-10 min | Build, tests, linting, security audit |
| **Staging deployment** | 15-20 min | Deploy, health checks, smoke tests |
| **Production deployment** | 20-30 min | Deploy, health checks, verification |
| **Post-deployment** | 60 min | Monitor logs, verify features, user testing |
| **Total** | **2-3 hours** | Full cycle from push to stable production |

---

## Step-by-Step Deployment

### Step 1: Prepare for Deployment

```bash
# 1. Verify code quality locally
npm run build          # Should complete with 0 errors
npm run lint          # Should show no blocking issues
npm run test          # All tests should pass

# 2. Create database backup (Railway handles this)
# Backup is created automatically by Railway before release command

# 3. Verify environment variables
echo "FEATURE_FLAGS_ENABLED=phase2b,recommendations,usage_ui"
echo "NODE_ENV=production"
echo "LOG_LEVEL=warn"
```

### Step 2: Deploy to Staging (Testing)

```bash
# 1. Push to staging branch
git checkout staging
git merge main
git push origin staging

# GitHub Actions automatically triggers:
# - Quality checks
# - Deploy to staging environment
# - Health check verification
# - Slack notification
```

### Step 3: Verify Staging Deployment

```bash
# 1. Check staging health
curl https://card-benefits-staging.railway.app/api/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2026-04-07T12:34:56.789Z",
#   "version": "2B-1.0",
#   "checks": {
#     "db": true,
#     "redis": true,
#     "services": true
#   }
# }

# 2. Test core features
# - Login: Verify authentication works
# - View Benefits: Check benefit display
# - Track Usage: Test usage recording
# - Get Recommendations: Verify recommendation generation

# 3. Monitor logs
# Check Railway dashboard for any errors

# 4. Run smoke tests
# Basic API connectivity
# Database connectivity
# Authentication flow
```

### Step 4: Deploy to Production

```bash
# 1. Merge staging to main
git checkout main
git merge staging
git push origin main

# GitHub Actions automatically triggers:
# - Quality checks
# - Database backup creation
# - Deploy to production environment
# - Health check verification
# - GitHub Release creation
# - Slack notification

# Alternative: Manual production deployment
git push origin staging  # or main
# GitHub Actions will automatically handle deployment
```

### Step 5: Post-Deployment Verification

```bash
# 1. Check production health
curl https://card-benefits-prod.railway.app/api/health

# 2. Verify features
# - Login functionality
# - Benefits display
# - Usage tracking
# - Recommendations
# - Mobile sync

# 3. Check error rates
# Should be <1% (aim for 0%)

# 4. Monitor performance
# API latency should be <200ms (p95)
# Database queries <100ms (p95)

# 5. Check logs
# Review production logs for warnings/errors
```

---

## Environment Configuration

### Production Environment Variables

**Database & Authentication:**
```bash
DATABASE_URL=postgresql://user:password@host:5432/card_benefits
NEXTAUTH_URL=https://card-benefits-prod.railway.app
NEXTAUTH_SECRET=[generated-secret]  # Use: openssl rand -hex 32
SESSION_SECRET=[generated-secret]
CRON_SECRET=[generated-secret]
```

**Application:**
```bash
NODE_ENV=production
LOG_LEVEL=warn
FEATURE_FLAGS_ENABLED=phase2b,recommendations,usage_ui,api_pagination
```

**Monitoring:**
```bash
SENTRY_DSN=[sentry-project-dsn]
MONITORING_ENABLED=true
METRICS_ENABLED=true
```

**Optional Services:**
```bash
REDIS_URL=redis://host:port  # Optional, for caching
SLACK_WEBHOOK=[webhook-url]   # For notifications
```

### Staging Environment Variables

**Same as production, but with staging values:**
```bash
DATABASE_URL=postgresql://user:password@staging-host:5432/staging_db
NEXTAUTH_URL=https://card-benefits-staging.railway.app
LOG_LEVEL=info  # More verbose for testing
FEATURE_FLAGS_ENABLED=phase2b,recommendations,usage_ui,api_pagination,debug
```

---

## Monitoring & Verification

### Health Check Endpoints

**API Health:**
```bash
curl https://card-benefits-prod.railway.app/api/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-04-07T12:34:56.789Z",
  "version": "2B-1.0",
  "checks": {
    "db": true,
    "redis": true,
    "services": true
  }
}
```

### Key Metrics to Monitor

| Metric | Target | Alert | Critical |
|--------|--------|-------|----------|
| API Response Time (p95) | <200ms | >500ms | >1000ms |
| Error Rate | <0.1% | >1% | >5% |
| Database Latency (p95) | <100ms | >300ms | >500ms |
| Server CPU | <60% | >80% | >90% |
| Memory Usage | <70% | >85% | >95% |

### Logging

All logs are structured JSON for easy aggregation:

```json
{
  "level": "info",
  "timestamp": "2026-04-07T12:34:56.789Z",
  "message": "Benefit recommendation generated",
  "context": {
    "userId": "user123",
    "cardId": "card456",
    "recommendationId": "rec789"
  }
}
```

### Dashboard

Access monitoring at: https://railway.app/project/[PROJECT-ID]/monitoring

---

## Rollback Procedures

### Quick Rollback (Automatic)

Railway automatically handles version rollbacks. To trigger:

1. **Via Railway Dashboard:**
   - Go to Deployments tab
   - Select previous stable version
   - Click "Redeploy"

2. **Via CLI:**
```bash
# Install Railway CLI
curl -fsSL https://railway.app/install.sh | sh

# Rollback to previous version
railway down
# Railway will automatically revert to last stable release
```

### Manual Rollback Steps

If automatic rollback fails:

```bash
# 1. Stop current deployment
railway down

# 2. Restore from backup (Railway managed)
# Database automatically reverted to pre-deployment snapshot

# 3. Redeploy previous version
railway up --version=previous

# 4. Verify health
curl https://card-benefits-prod.railway.app/api/health

# 5. Notify team
# Post in #deployments: "🔄 Rollback completed - Phase 1 features restored"
```

### Rollback Triggers

Immediately rollback if:
- ❌ Error rate >5%
- ❌ API latency >1000ms (p95)
- ❌ Database connection failures
- ❌ Data corruption detected
- ❌ Critical security issue found
- ❌ Authentication broken

---

## Post-Deployment Checklist

### Immediate (0-15 minutes)

- [ ] Health check passing
- [ ] No error spikes
- [ ] Slack notification received
- [ ] Basic features working (login, view benefits)
- [ ] API response times normal

### Short-term (15-60 minutes)

- [ ] Monitor error logs
- [ ] Test all Phase 2B features:
  - [ ] Benefit usage tracking
  - [ ] Recommendations generation
  - [ ] Mobile sync
  - [ ] Analytics data
- [ ] Verify user feedback in support channels
- [ ] Check database performance

### Extended (1-24 hours)

- [ ] Continue monitoring metrics
- [ ] Track user adoption of new features
- [ ] Verify no performance degradation
- [ ] Confirm all data migrations successful
- [ ] Update status dashboard

---

## Troubleshooting

### Deployment Failures

**Build fails:**
```
Solution: Check build logs for TypeScript errors
npm run build locally to debug
Fix errors and retry deployment
```

**Tests fail:**
```
Solution: Review test output
Run npm run test locally
Fix failing tests
Retry deployment
```

**Health check fails:**
```
Solution: Check database connectivity
Verify environment variables
Check application logs in Railway dashboard
Verify network connectivity
```

### Runtime Issues

**High error rate after deployment:**
```
Immediate action:
1. Check error logs in Railway dashboard
2. Identify specific error pattern
3. If >5% errors: trigger rollback
4. Fix issue in staging
5. Redeploy to production
```

**Database connection errors:**
```
Solution:
1. Verify DATABASE_URL is correct
2. Check database is running
3. Verify credentials have permission
4. Check connection pool settings
5. Restart application
```

**Memory/CPU issues:**
```
Solution:
1. Check application logs for memory leaks
2. Increase Railway instance resources
3. Verify no infinite loops or blocking operations
4. Monitor specific request causing issues
5. Optimize if needed
```

### Performance Issues

**Slow API responses:**
```
Diagnostic:
1. Check database query performance
2. Look for N+1 queries
3. Verify indexes are created
4. Check for blocking operations
5. Monitor CPU/memory usage

Solution:
1. Optimize slow queries
2. Add missing indexes
3. Implement caching
4. Scale application resources
```

---

## Rollback Decision Matrix

| Issue | Severity | Decision | Action |
|-------|----------|----------|--------|
| <1% error rate | Low | Continue monitoring | Monitor logs |
| 1-5% error rate | Medium | Investigate | Check error type; may rollback if critical |
| >5% error rate | High | Rollback | Immediate rollback, debug in staging |
| API latency >1s | High | Rollback | Immediate rollback, optimize queries |
| Database errors | Critical | Rollback | Immediate rollback, verify backup |
| Security issue | Critical | Rollback | Immediate rollback, security audit |

---

## Support & Escalation

**During Deployment (0-2 hours):**
- DevOps Lead: [Contact Info]
- On-Call Engineer: [Contact Info]
- Slack Channel: #deployments

**Post-Deployment Issues (2-24 hours):**
- Engineering Team: #engineering-support
- Escalate to DevOps if infrastructure issue

**Critical Issues (Any time):**
- Incident Commander: [Contact Info]
- All hands: #incidents

---

## Success Criteria

✅ **Phase 2B Production Deployment Successful When:**

1. **Deployment Complete**
   - Code deployed to production
   - Health checks passing
   - All services running

2. **Features Working**
   - Benefit tracking functional
   - Recommendations generating
   - Mobile sync operational
   - Analytics collecting data

3. **Performance Acceptable**
   - API latency <200ms (p95)
   - Error rate <1%
   - Database queries <100ms (p95)

4. **No Critical Issues**
   - No error spikes
   - No data loss
   - No security concerns
   - No authentication issues

5. **Monitoring Active**
   - Alerts configured
   - Logs being collected
   - Metrics being tracked
   - Slack notifications working

---

## Next Steps

After successful production deployment:

1. **Monitoring** (First 24 hours)
   - Watch metrics closely
   - Monitor user reports
   - Check error logs frequently

2. **Documentation** (Day 2)
   - Update deployment runbook
   - Document any issues encountered
   - Record lessons learned

3. **Optimization** (Week 1)
   - Analyze performance data
   - Optimize slow queries
   - Refine monitoring thresholds

4. **User Communication** (Day 1)
   - Announce new features
   - Provide feature documentation
   - Gather user feedback

---

**This deployment guide is maintained by the DevOps team.**  
**For questions or updates, contact the DevOps Lead.**
