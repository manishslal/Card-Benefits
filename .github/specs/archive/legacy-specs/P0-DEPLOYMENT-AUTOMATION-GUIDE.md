# P0 Deployment Automation Guide

**Version**: 1.0.0  
**Created**: April 5, 2026  
**Purpose**: Complete guide for executing automated P0 deployment pipelines

---

## 📋 Table of Contents

1. [Quick Start (5 minutes)](#quick-start)
2. [Pre-Deployment Verification](#pre-deployment-verification)
3. [Staging Deployment](#staging-deployment)
4. [Production Deployment](#production-deployment)
5. [Monitoring & Verification](#monitoring--verification)
6. [Rollback Procedures](#rollback-procedures)
7. [Troubleshooting](#troubleshooting)
8. [Emergency Contacts](#emergency-contacts)

---

## 🚀 Quick Start

### For the Impatient

```bash
# 1. Verify everything is ready (5 minutes)
bash .github/scripts/p0-pre-deployment-check.sh

# 2. If all checks pass, deploy to staging
git push origin main

# 3. Monitor GitHub Actions
# Open: https://github.com/YOUR_ORG/Card-Benefits/actions

# 4. After staging passes, approve production
# GitHub UI → Actions → p0-deployment → Approve

# 5. Watch production deployment (30 minutes)
```

**Total time**: ~45 minutes from start to production live

---

## 🔍 Pre-Deployment Verification

### Step 1: Run Pre-Check Script

```bash
# Navigate to project root
cd /path/to/Card-Benefits

# Run full verification (recommended)
bash .github/scripts/p0-pre-deployment-check.sh --full

# OR quick check (critical only)
bash .github/scripts/p0-pre-deployment-check.sh --quick
```

### Expected Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  P0 DEPLOYMENT PRE-CHECK VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Node.js installed ... PASS
  ℹ Node.js version: v18.17.0
✓ npm installed ... PASS
  ℹ npm version: 9.6.7
...
✓ All tests passed ... PASS
  ℹ Tests executed: 33+

✅ ALL CHECKS PASSED - READY FOR DEPLOYMENT
```

### What Gets Checked

- ✅ Environment (Node.js, npm, git)
- ✅ Dependencies (package.json, node_modules)
- ✅ Build (`npm run build`)
- ✅ Types (`npm run type-check`)
- ✅ Tests (`npm run test`)
- ✅ Linting (`npm run lint`)
- ✅ Security (no hardcoded secrets)
- ✅ Configuration files
- ✅ P0-specific verifications

### If Check Fails

```bash
# 1. Read the error message carefully
# 2. Fix the issue (e.g., npm install, npm run build)
# 3. Re-run the check
bash .github/scripts/p0-pre-deployment-check.sh --full

# 4. If still failing, don't proceed to deployment
# Contact DevOps team
```

---

## 📦 Staging Deployment

### Step 1: Push Changes

```bash
# Ensure you're on main branch
git checkout main

# Pull latest changes
git pull origin main

# Push to trigger staging deployment
git push origin main
```

### Step 2: Monitor GitHub Actions

```bash
# Option A: Web UI
# 1. Go to: https://github.com/YOUR_ORG/Card-Benefits
# 2. Click: "Actions" tab
# 3. Select: "P0 Deployment Pipeline"
# 4. Watch: Live workflow execution

# Option B: GitHub CLI
gh workflow run p0-deployment.yml --ref main
gh run watch  # Watch in real-time
```

### What Happens in Staging

```
T+0m  ├─ Pre-deployment checks
      │  └─ Build, type-check, tests, security audit
      │
T+5m  ├─ P0-1 Staging Deployment
      │  ├─ Build application
      │  ├─ Run type checks (P0-1 validation)
      │  └─ Run all tests
      │
T+15m ├─ P0-3 Staging Deployment
      │  ├─ Build with test credentials
      │  ├─ Verify no hardcoded secrets
      │  └─ Run security tests
      │
T+25m ├─ P0-2 Staging Testing
      │  ├─ Deploy pagination feature
      │  ├─ Run 33+ test cases
      │  ├─ Performance verification
      │  └─ Load testing
      │
T+40m ├─ Staging Sign-Off
      │  └─ All checks pass → Ready for production
```

### Staging Success Indicators

```
✅ Green checkmark on all jobs
✅ All 33+ tests passed
✅ Performance benchmarks met
✅ No errors in build logs
✅ Security checks passed
```

### If Staging Fails

```bash
# 1. Click failed job for details
# 2. Read error message in logs
# 3. Fix code locally
# 4. Commit and push again
git add .
git commit -m "Fix: P0 deployment issue"
git push origin main

# 5. GitHub Actions will retry automatically
```

---

## 🚀 Production Deployment

### Step 1: Prepare Production Credentials (P0-3 Only)

```bash
# CRITICAL: Do this BEFORE production deployment

# Generate new SESSION_SECRET
SESSION_SECRET=$(openssl rand -hex 32)
echo "New SESSION_SECRET: $SESSION_SECRET"

# Generate new CRON_SECRET
CRON_SECRET=$(openssl rand -hex 32)
echo "New CRON_SECRET: $CRON_SECRET"

# Get new DATABASE_URL from Railway
# 1. Go to https://railway.app
# 2. Select Card Benefits project
# 3. Click PostgreSQL service
# 4. Click "Details"
# 5. Change password
# 6. Copy new DATABASE_URL
```

### Step 2: Update Railway Environment

```bash
# 1. Go to https://railway.app
# 2. Select "Card Benefits" project
# 3. Click "Variables" tab
# 4. Update each variable:
#    - SESSION_SECRET: <paste-new-value>
#    - CRON_SECRET: <paste-new-value>
#    - DATABASE_URL: <paste-new-value>
# 5. Save changes
```

### Step 3: Approve Production Deployment

```bash
# Option A: GitHub UI
# 1. Go to: https://github.com/YOUR_ORG/Card-Benefits
# 2. Click: "Actions" tab
# 3. Select: "P0 Deployment Pipeline" → Latest run
# 4. Scroll to: "production-approval" job
# 5. Click: "Review deployments"
# 6. Select: "production"
# 7. Click: "Approve and deploy"

# Option B: GitHub CLI (if configured)
gh run view <run-id>
gh run resume <run-id>
```

### Step 4: Monitor Production Deployment

```
T+0m   ├─ Production Approval
       │  └─ Manual approval required ✓
       │
T+5m   ├─ P0-1 Production Deployment
       │  ├─ Code pushed to production
       │  ├─ Build and test
       │  └─ Health check: /api/health ✓
       │
T+15m  ├─ P0-3 Production Deployment
       │  ├─ Code pushed to production
       │  ├─ Environment variables loaded
       │  └─ Database connection verified ✓
       │
T+30m  ├─ P0-2 Production Deployment
       │  ├─ Code pushed to production
       │  ├─ Health check passed
       │  └─ APIs responding ✓
       │
T+40m  ├─ Production Verification
       │  ├─ Performance metrics normal
       │  ├─ Error rate < 0.1%
       │  └─ All services healthy ✓
```

### Production Success Indicators

```
✅ All 3 phases complete (green checkmarks)
✅ Health endpoint responding (200 OK)
✅ API endpoints working correctly
✅ Performance improved (5-10x faster)
✅ No errors in production logs
✅ Error rate: < 0.1%
✅ Database: Connected
✅ Session auth: Working
✅ Cron jobs: Ready
```

---

## 📊 Monitoring & Verification

### Real-Time Monitoring

```bash
# Monitor application health
curl https://card-benefits.railway.app/api/health

# Expected response:
# {
#   "status": "ok",
#   "timestamp": "2026-04-05T10:30:00Z",
#   "uptime": 3600
# }
```

### Check Railway Metrics

```
Railway Dashboard → Card Benefits → Metrics
├─ CPU Usage        (target: < 50%)
├─ Memory Usage     (target: < 300MB)
├─ Requests/sec    (monitor for spikes)
├─ Response Time    (target: < 200ms)
└─ Error Rate       (target: < 0.1%)
```

### Test Each API Endpoint

```bash
# P0-2 Feature: Master Cards API
curl "https://card-benefits.railway.app/api/cards/master"

# P0-2 Feature: My Cards API (requires auth)
curl "https://card-benefits.railway.app/api/cards/my-cards" \
  -H "x-user-id: test-user-123"

# Auth Test (uses SESSION_SECRET)
curl -X POST "https://card-benefits.railway.app/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Cron Test (uses CRON_SECRET)
curl -X POST "https://card-benefits.railway.app/api/cron/reset-benefits" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

### Check Application Logs

```bash
# Railway Logs
# Go to: https://railway.app → Card Benefits → Logs
# Look for:
# ✅ "Successfully initialized"
# ✅ "Database connected"
# ✅ "Environment loaded: production"
# ⚠️  Watch for: "SESSION_SECRET undefined" (ERROR)
# ⚠️  Watch for: "CRON_SECRET undefined" (ERROR)
# ⚠️  Watch for: "Database connection error" (ERROR)
```

### Performance Baseline

```
Expected Performance After Deployment:
──────────────────────────────────────

P0-1 (TypeScript any removal):
  - No performance impact (code quality only)
  - Same binary, same speed

P0-2 (Pagination):
  - Response time: 50-100ms (was 500ms+)
  - Response size: ~25KB (was 500KB+)
  - Database load: Reduced
  - Improvement: 5-10x faster

P0-3 (Secrets):
  - No performance impact
  - Security improved
  - Old credentials invalidated
```

---

## 🔄 Rollback Procedures

### Rollback P0-1 (TypeScript)

```bash
# Quick rollback (< 5 minutes)
git revert <p0-1-commit-sha>
git push origin main

# GitHub Actions automatically:
# 1. Rebuilds with old code
# 2. Runs all tests
# 3. Deploys to staging first
# 4. (Requires manual approval for production)

# To find commit SHA:
git log --oneline --grep="P0-1" | head -1
```

### Rollback P0-3 (Secrets)

⚠️ **P0-3 is COMPLEX because it involves git history rewrite**

```bash
# Option 1: Keep new credentials, revert code changes
git revert <p0-3-commit-sha>
git push origin main
# ✅ Better: Keep secure credentials, revert to old code pattern

# Option 2: Full rollback (requires force-push)
# Only if credentials were compromised
git push origin +<old-main-sha>:main
git push origin --force --all
# ⚠️  Requires admin permissions
# ⚠️  Team must re-clone

# Recovery:
# 1. New credentials are already active (keep them)
# 2. Just revert the code changes
# 3. Old code pattern will work with new credentials
```

### Rollback P0-2 (Pagination)

```bash
# Rollback the feature
git revert <p0-2-commit-sha>
git push origin main

# GitHub Actions automatically:
# 1. Rebuilds without pagination
# 2. API returns old full response
# 3. Deploys new version
# 4. (Requires manual approval for production)

# Time to rollback: 10-15 minutes

# After rollback:
# - Keep P0-1 and P0-3 deployed (they're good)
# - Investigate P0-2 issue
# - Re-deploy fixed version when ready
```

### Manual Rollback (Emergency)

```bash
# If automated rollback fails:

# 1. Stop the application
# Go to: https://railway.app → Stop service

# 2. Revert code
git revert <problematic-commit-sha>
git push origin main

# 3. Restart application
# Go to: https://railway.app → Restart service

# 4. Verify health
curl https://card-benefits.railway.app/api/health

# 5. Document incident
# Create GitHub issue: [INCIDENT] P0 Rollback
# Include: timeline, root cause, fix applied
```

### Rollback Decision Tree

```
Error detected?
  │
  ├─ Build failed
  │  └─ → git revert + push
  │
  ├─ Tests failing
  │  └─ → git revert + push
  │
  ├─ Production error rate > 5%
  │  └─ → Identify which fix
  │      ├─ P0-1: git revert + push
  │      ├─ P0-3: Keep new credentials, git revert code
  │      └─ P0-2: git revert + push
  │
  ├─ Database connectivity error
  │  └─ → Check DATABASE_URL in Railway
  │      → Verify credential rotation
  │
  ├─ Session authentication failing
  │  └─ → Check SESSION_SECRET in Railway
  │      → Verify credential is set
  │
  └─ Cron jobs not running
     └─ → Check CRON_SECRET in Railway
         → Verify scheduler updated
```

---

## 🔧 Troubleshooting

### Build Failed

```bash
# Error: "Build failed"

# Steps:
1. Check error message in GitHub Actions log
2. Run locally: npm run build
3. Fix any TypeScript errors: npm run type-check
4. Fix any compilation errors
5. Commit and push: git push origin main
6. Check GitHub Actions again
```

### Tests Failing

```bash
# Error: "npm run test failed"

# Steps:
1. Run locally: npm run test
2. Identify failing test
3. Review test file and fix logic
4. Verify fix: npm run test -- <test-file>
5. Commit and push: git push origin main
```

### Database Connection Error

```bash
# Error: "DATABASE_URL connection failed"

# P0-3 Specific Issue:

# Steps:
1. Go to: https://railway.app
2. Click PostgreSQL service
3. Verify password is set correctly
4. Copy new DATABASE_URL
5. Update in Variables tab
6. Restart service
7. Verify: curl /api/health
```

### SESSION_SECRET Error

```bash
# Error: "SESSION_SECRET undefined" OR "SESSION_SECRET invalid"

# P0-3 Specific Issue:

# Steps:
1. Go to: https://railway.app → Variables
2. Verify SESSION_SECRET is set
3. Verify value is 64 hex characters
4. If blank: Generate new one
   openssl rand -hex 32
5. Update in Railway Variables
6. Restart service
7. Verify: Test login endpoint
```

### CRON_SECRET Error

```bash
# Error: "/api/cron/reset-benefits returns 401"

# P0-3 Specific Issue:

# Steps:
1. Go to: https://railway.app → Variables
2. Verify CRON_SECRET is set
3. Verify value is 64 hex characters
4. If blank: Generate new one
   openssl rand -hex 32
5. Update in Railway Variables
6. Restart service
7. Test cron endpoint with new secret:
   curl -H "Authorization: Bearer <NEW_SECRET>" \
     https://card-benefits.railway.app/api/cron/reset-benefits
```

### Staging Deploys But Production Fails

```bash
# Staging = ✅ Production = ❌

# Possible Causes:
1. Environment variables different
   → Check Railway Variables
   → Ensure same values as staging

2. Production database different
   → Check DATABASE_URL points to correct DB
   → Verify database is accessible

3. Credentials not rotated yet
   → Generate new credentials
   → Update Railway Variables
   → Restart service

# Fix:
1. Identify the issue above
2. Fix in Railway
3. Restart service
4. Re-run GitHub Actions production approval
```

### Performance Degradation

```bash
# Performance after P0-2 deployment is slow

# Debug:
1. Check response time: curl -w "%{time_total}\n" ...
2. Check database load: Railway → Metrics
3. Check error logs: Railway → Logs
4. Load test: ab -n 100 -c 10 /api/cards/master

# If P0-2 caused it:
1. Rollback P0-2: git revert <sha>
2. Keep P0-1 and P0-3 deployed
3. Investigate pagination implementation
4. Re-deploy fixed version

# Common causes:
- Query not using indexes → Add indexes
- Pagination limit too low → Increase limit
- N+1 queries → Optimize queries
```

### Credentials Compromised

```bash
# Suspected breach of SESSION_SECRET, CRON_SECRET, or DATABASE_URL

# IMMEDIATE ACTIONS (within 1 hour):
1. Stop application
   → Railway: Stop service

2. Generate new credentials
   SESSION_SECRET=$(openssl rand -hex 32)
   CRON_SECRET=$(openssl rand -hex 32)
   # Get new DATABASE_URL from Railway

3. Update Railway Variables
   → All 3 new values

4. Restart application
   → Railway: Restart service

5. Verify health
   → curl /api/health

# FOLLOW-UP (within 24 hours):
1. Audit logs for unauthorized access
2. Investigate how credentials were exposed
3. Review git history for accidental commits
4. Add pre-commit hooks to prevent future leaks
5. Document incident and root cause
```

---

## 📞 Emergency Contacts

### Escalation Path

```
Problem Detected
  ↓
1. Check troubleshooting guide above (5 min)
  ↓
2. Reach out to #deployments Slack channel (2 min)
  ↓
3. If critical (production down):
   - Notify Engineering Lead
   - Notify Product Manager
   - Prepare rollback
  ↓
4. Execute rollback if needed (5-15 min)
  ↓
5. Post-incident review
   - Document what happened
   - Identify root cause
   - Prevent recurrence
```

### Key Contact Roles

| Role | Responsibility |
|------|-----------------|
| **DevOps Lead** | Deployment execution, troubleshooting |
| **Engineering Lead** | Code review, approval, escalation |
| **Product Manager** | Communication, user impact assessment |
| **DBA** | Database issues, password resets |
| **Security** | Credential compromises, breach response |

### Communication Channels

```
GitHub Issues     → Technical discussions, bugs
Slack #deployments → Real-time updates, support
PagerDuty         → On-call rotation, alerts
Email             → Formal notifications
```

---

## ✅ Deployment Checklist

### Pre-Deployment (1 Day Before)

- [ ] Read all P0 documentation
- [ ] Generate new P0-3 credentials
- [ ] Test credentials in staging environment
- [ ] Update Railway Variables
- [ ] Notify team of deployment schedule
- [ ] Verify no other deployments scheduled
- [ ] Prepare rollback procedures

### Pre-Deployment (1 Hour Before)

- [ ] Run pre-check script: `bash .github/scripts/p0-pre-deployment-check.sh`
- [ ] Verify all checks pass
- [ ] Check team availability
- [ ] Start monitoring dashboard
- [ ] Prepare communication messages
- [ ] Have rollback commands ready

### During Staging Deployment

- [ ] Monitor GitHub Actions workflow
- [ ] Verify each stage completes
- [ ] Check build logs for errors
- [ ] Verify all tests pass
- [ ] Confirm staging health check
- [ ] Note any warnings or issues

### Before Production Approval

- [ ] Staging deployment 100% complete
- [ ] All health checks passing
- [ ] Test performance metrics
- [ ] Review staging logs (no errors)
- [ ] Get stakeholder sign-off
- [ ] Final go/no-go decision

### During Production Deployment

- [ ] Monitor each phase (P0-1 → P0-3 → P0-2)
- [ ] Verify health checks after each phase
- [ ] Watch production logs in real-time
- [ ] Check performance metrics
- [ ] Monitor error rates
- [ ] Have rollback procedures ready

### Post-Deployment (Immediate)

- [ ] Verify all 3 fixes are live
- [ ] Test critical functionality
- [ ] Check application health
- [ ] Monitor error rate (target: < 0.1%)
- [ ] Document deployment details
- [ ] Notify team of successful deployment

### Post-Deployment (24 Hours)

- [ ] Monitor logs for anomalies
- [ ] Check performance metrics
- [ ] Review user reports
- [ ] Verify no rollback needed
- [ ] Document lessons learned
- [ ] Close P0 issues in GitHub

---

## 🎓 Learn More

- **P0-1 Details**: `.github/specs/P0-1-TYPESCRIPT-ANY-AUDIT.md`
- **P0-2 Details**: `.github/specs/DEPLOYMENT_RUNBOOK_P0-2.md`
- **P0-3 Details**: `.github/specs/P0-3-SECRETS-AUDIT.md`
- **Secrets Management**: `SECRETS.md`
- **Deployment Strategy**: `.github/specs/P0-DEPLOYMENT-STRATEGY.md`

---

## 📝 Document Version

- **Version**: 1.0.0
- **Created**: April 5, 2026
- **Last Updated**: April 5, 2026
- **Status**: Ready for Production

---

**Remember**: A successful deployment is a boring deployment. If nothing breaks, that's the goal! 🎉
