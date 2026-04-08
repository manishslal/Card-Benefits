# Phase 4 Dashboard MVP - Production Deployment Guide

**Project**: Card Benefits Dashboard MVP  
**Phase**: 4 (DevOps Production Deployment)  
**Deployment Platform**: Railway  
**Status**: 🔴 **DO NOT DEPLOY YET** (Fix build first)  
**Expected Duration**: 30-45 minutes after pre-checks pass  

---

## ⚠️ CRITICAL: Pre-Deployment Requirements

### MUST COMPLETE BEFORE DEPLOYMENT

1. ✅ **Build must pass**
   - [ ] BUG-001 fixed (unused variable removed)
   - [ ] `npm run build` → Exit code 0
   - [ ] No TypeScript errors

2. ✅ **Tests must pass**
   - [ ] `npm run test` → 90%+ pass rate
   - [ ] No critical test failures
   - [ ] No regressions since Phase 3 QA

3. ✅ **Deployment checklist complete**
   - [ ] All 100+ items verified
   - [ ] Tech lead signed off
   - [ ] All systems ready

### Do Not Proceed If Any Are Failed

---

## Executive Summary

This guide provides **step-by-step instructions** to deploy the Dashboard MVP to production on Railway in a safe, verifiable manner with:

- ✅ Zero-downtime deployment strategy
- ✅ Automatic database migrations
- ✅ Health check validation
- ✅ Rollback procedures
- ✅ Post-deployment verification
- ✅ Monitoring setup

**Deployment Path**: Main branch → Railway Production Environment  
**Database**: PostgreSQL (Railway managed)  
**Domain**: Configured in Railway  
**SSL/TLS**: Automatic via Railway  

---

## 🔍 Pre-Deployment Verification Checklist

### LocalSetup (2 minutes)

```bash
# Verify you have Railway CLI installed
railway --version
# Expected: railway version 3.x or higher

# Login to Railway
railway login
# Opens browser to authenticate

# Select the correct project
railway link
# Choose: Card Benefits Dashboard

# Verify connection to Railway
railway status
# Should show: Connected to production environment
```

### Code Verification (3 minutes)

```bash
# Verify we're on the main branch
git branch
# Expected: * main

# Verify latest changes are committed
git status
# Expected: nothing to commit, working tree clean

# Check commit log
git log --oneline -5
# Last commit should be from QA fixes

# Verify build passes locally
npm run build
# Expected: Exit code 0, "Build successful"
```

### Database Verification (3 minutes)

```bash
# Check for pending migrations
npx prisma migrate status
# Expected: All migrations are up to date

# Verify schema matches expectations
npx prisma db push --skip-generate --dry-run
# Expected: No changes needed
```

### Environment Verification (2 minutes)

```bash
# Verify Railway environment variables
railway variables

# Should see:
# DATABASE_URL=postgresql://...
# NODE_ENV=production
# SESSION_SECRET=<long-random-string>
# CRON_SECRET=<long-random-string>

# If any are missing, add them now:
railway variable add VAR_NAME="value"
```

---

## 🚀 Deployment Steps

### Phase 1: Pre-Deployment Backup (5 minutes)

**Step 1.1: Backup current database**

```bash
# Connect to Railway PostgreSQL
railway run psql

# In psql shell:
\dt  # List all tables (verify schema)
SELECT COUNT(*) FROM users;  # Should return a number
SELECT COUNT(*) FROM benefits;  # Should return a number
\q  # Exit

# Backup command (Railway handles automatic backups)
# Manual backup if needed:
railway run pg_dump > backup-$(date +%Y%m%d_%H%M%S).sql
```

**Step 1.2: Verify backup created**

```bash
# Check backup size
ls -lh backup-*.sql

# Expected: File exists, >100KB
```

**Step 1.3: Document backup**

```bash
# Record in deployment log
echo "Backup created: $(date)" >> deployment.log
ls -lh backup-*.sql >> deployment.log
```

### Phase 2: Pre-Deployment Checks (10 minutes)

**Step 2.1: Verify current health**

```bash
# Check current production status
curl -H "Authorization: Bearer $RAILWAY_TOKEN" \
  https://api.railway.app/graphql \
  -d '{"query":"{ services { edges { node { id, name, status } } } }"}'

# Alternative: Check via Railway dashboard
# https://railway.app → Select project → View deployment status
```

**Step 2.2: Current deployment metrics**

```bash
# Before deployment, record baseline
curl https://your-production-url/api/health
# Should return: { status: 'ok', timestamp: '...' }
```

**Step 2.3: Verify no active issues**

```bash
# Check recent error rate
# Via Railway Dashboard:
# 1. Select project
# 2. Go to "Monitoring"
# 3. Check error rate <0.1%
# 4. No recent critical errors
```

### Phase 3: Deployment Execution (15 minutes)

**Step 3.1: Trigger deployment**

```bash
# Method 1: Automatic via Git push (RECOMMENDED)
# This is the safest approach
git push origin main

# Railway detects push to main branch
# Automatically builds and deploys
# Build logs available in Railway dashboard

# Monitor build progress:
railway logs --service dashboard-service
# Press Ctrl+C to exit logs
```

**Alternative: Manual deployment via CLI**

```bash
# Method 2: Manual CLI deployment (if needed)
railway deploy

# This rebuilds and deploys the current code
# Only use if git push doesn't trigger build
```

**Step 3.2: Monitor build process**

```bash
# Watch the build in real-time
railway logs --service web

# Expected sequence:
# 1. "Pulling build cache..." (5s)
# 2. "Building application..." (30-60s)
# 3. "Pushing to registry..." (15s)
# 4. "Starting container..." (10s)

# Total build time: ~2 minutes
# Look for: "Build successful" or "Deployment complete"
```

**Step 3.3: Database migrations run automatically**

```bash
# Railway runs release command automatically:
# npx prisma migrate deploy && npx prisma db push --skip-generate

# Monitor for success:
railway logs --service web | grep -i "prisma\|migrate"

# Expected messages:
# - "Running migrations..."
# - "✓ Migrations applied successfully"
# - "✓ Database schema updated"

# If migration fails: IMMEDIATE ROLLBACK (see Step 4.1)
```

**Step 3.4: Deployment completion**

```bash
# Deployment completes when container starts responding
# Timeline: 3-5 minutes total

# Check deployment status
railway status

# Expected:
# Service: web → Status: Running
# All environment variables: Present
# Recent deployment: [timestamp]
```

### Phase 4: Post-Deployment Verification (10 minutes)

**Step 4.1: Health check**

```bash
# Verify application is running
curl https://your-production-url/api/health

# Expected response:
# { "status": "ok", "timestamp": "2024-..." }

# Status code should be: 200 OK
```

**Step 4.2: Database connectivity test**

```bash
# Test database connection
curl -X GET https://your-production-url/api/benefits/filters \
  -H "Authorization: Bearer $AUTH_TOKEN"

# Expected response:
# { "success": true, "data": [...] }
# Status code: 200 OK

# If error: Check database logs in Railway
```

**Step 4.3: Key endpoint tests**

```bash
# Test all critical endpoints
AUTH_TOKEN="your-session-token"  # Get from browser cookies

# Test 1: Get benefits
curl -H "Authorization: Bearer $AUTH_TOKEN" \
  https://your-production-url/api/benefits/filters

# Test 2: Get progress
curl -H "Authorization: Bearer $AUTH_TOKEN" \
  "https://your-production-url/api/benefits/progress?benefitId=1"

# Test 3: Dashboard page
curl https://your-production-url/dashboard

# All should return 200 OK (or 401 if auth required)
```

**Step 4.4: Dashboard functionality test**

```bash
# Open in browser:
https://your-production-url/dashboard

# Verify:
1. Page loads (no blank page)
2. Period selector visible and works
3. Status filters functional
4. Benefits display correctly
5. "Mark Used" button functional
6. No console errors (DevTools)
7. Loading time <2 seconds
```

**Step 4.5: Error rate monitoring**

```bash
# Watch error rate for 5 minutes
# Via Railway Dashboard:
# 1. Select project → "Monitoring"
# 2. Watch "Error Rate" metric
# 3. Should remain <0.1%
# 4. Check logs for any issues

# Alternative CLI:
railway logs --service web --tail 50
# Should show: Only normal startup messages
# No errors or warnings
```

### Phase 5: Issue Resolution (if needed)

**If deployment fails:**

#### Issue: Build failed

```bash
# Check build logs
railway logs --service web

# Common issues:
# 1. TypeScript error - Check recent commits
# 2. Prisma migration failed - Check migration files
# 3. Dependency install failed - Check package.json

# Fix locally:
npm run build  # Test build locally

# Recommit and push:
git add .
git commit -m "Fix: [issue description]"
git push origin main
```

#### Issue: Database migration failed

```bash
# Check migration status
npx prisma migrate status

# Resolve migration issue:
# 1. Check Prisma error message
# 2. Fix migration file if needed
# 3. Test locally: npm run db:reset
# 4. Create new migration: npx prisma migrate dev

# Redeploy:
git push origin main
```

#### Issue: Health check failing

```bash
# Application may be starting, wait 30 seconds
sleep 30

# Check again:
curl https://your-production-url/api/health

# If still failing:
# Check logs for startup errors
railway logs --service web

# Common causes:
# - Database not connected
# - Environment variables missing
# - Port not binding correctly
```

#### Issue: Database not connecting

```bash
# Verify Railway PostgreSQL is running
railway logs --service postgres

# Check connection string
railway variables | grep DATABASE_URL

# Test connection locally (using SSH):
railway run psql

# If connection fails:
# 1. Check PostgreSQL service in Railway is "Running"
# 2. Verify firewall rules (Railway manages this)
# 3. Check credentials match
```

---

## ⏮️ Rollback Procedures

### Immediate Rollback (if critical issue detected)

**Option 1: Via Git (Recommended)**

```bash
# Revert to previous version
git revert HEAD --no-edit
git push origin main

# Railway rebuilds with previous code
# Takes ~3-5 minutes
# After deploy: Verify health
```

**Option 2: Via Railway Dashboard (Faster)**

```bash
# Go to https://railway.app
# Select project
# In "Deployments" tab
# Find previous working deployment
# Click "Redeploy"
# Takes ~2 minutes
```

**Option 3: Database rollback (if migration broke)**

```bash
# If migration caused data loss:
# 1. Railway has automatic backups (see pre-deployment backup step)
# 2. Contact Railway support for point-in-time recovery
# 3. Alternative: Use your backup:

# Restore from backup
railway run psql < backup-YYYYMMDD_HHMMSS.sql

# Redeploy with previous code
git revert HEAD --no-edit
git push origin main
```

### Gradual Rollback Strategy

For critical issues that need slower investigation:

```bash
# Step 1: Scale down new version to 0 replicas
railway scale web --replicas 0

# Step 2: Deploy previous version
git revert HEAD --no-edit
git push origin main

# Step 3: Once working, scale down problematic build
# (This removes it from serving traffic)

# Step 4: Investigate in staging environment
# Deploy problematic version to staging for debugging
```

---

## 📊 Deployment Monitoring Plan

### First 5 Minutes (continuous monitoring)

```bash
# Watch logs in real-time
railway logs --service web --tail 100

# Expected:
# - Container starts
# - Migrations run
# - Server listening on port 3000
# - Ready to accept requests

# Signs of problems:
# - Errors or exceptions
# - Database connection refused
# - Port already in use
```

### 5-30 Minutes (check every 2 minutes)

```bash
# Health check
curl https://your-production-url/api/health

# Check error logs
railway logs --service web

# Monitor metrics (via Railway Dashboard):
# - CPU usage: Should be <30%
# - Memory: Should be <100MB
# - Error rate: Should be 0%
```

### 30 minutes - 2 hours (check every 5 minutes)

```bash
# Continue health checks
curl https://your-production-url/api/health

# Test key features
curl -H "Authorization: Bearer $TOKEN" \
  https://your-production-url/api/benefits/filters

# Monitor performance:
# - Response time: <1s expected
# - No 5xx errors
# - <0.1% error rate
```

### 2-24 Hours (hourly checks)

```bash
# Daily monitoring
# 1. Error rate stable <0.1%
# 2. Performance metrics normal
# 3. No database issues
# 4. No memory leaks (memory usage stable)
# 5. All API endpoints responding

# Set up automated alerts if not already done
```

### Performance Baseline (to establish after deployment)

```bash
# Record metrics:
# - Dashboard load time: ____ ms
# - API response time: ____ ms
# - Database query time: ____ ms
# - Error rate: ____ %
# - Memory usage: ____ MB
# - CPU usage: ____ %

# These become the baseline for future deployments
```

---

## 🔧 Common Post-Deployment Issues & Fixes

### Issue: "502 Bad Gateway"

**Cause**: Application not responding  
**Fix**:
```bash
# Wait 30 seconds (container may still starting)
sleep 30

# Check logs
railway logs --service web

# Check if process crashed
railway status

# If still failing: Rollback
git revert HEAD --no-edit
git push origin main
```

### Issue: "500 Internal Server Error"

**Cause**: Application error or database issue  
**Fix**:
```bash
# Check recent logs
railway logs --service web --tail 100 | grep -i error

# Common causes:
# 1. Database migration failed
# 2. Environment variable missing
# 3. Prisma error

# For database:
railway logs --service postgres

# Fix and redeploy:
git push origin main
```

### Issue: "Connection timeout"

**Cause**: Database not responding  
**Fix**:
```bash
# Check PostgreSQL is running
railway status  # postgres should be "Running"

# Check connection string
railway variables | grep DATABASE_URL

# Try connecting
railway run psql

# If failing: Restart PostgreSQL
# Via Railway Dashboard: Select PostgreSQL service → Restart
```

### Issue: High memory usage / Memory leak

**Cause**: Application using too much memory  
**Fix**:
```bash
# Monitor memory
railway logs --service web | grep -i memory

# Check for memory leaks
# This usually requires code investigation

# Temporary fix: Restart container
railway scale web --replicas 0
railway scale web --replicas 2  # Restart with scale-up

# Permanent fix: Deploy patched version
```

---

## 📈 Post-Deployment Monitoring Checklist

### Immediate (0-5 minutes)

- [ ] Health check endpoint responds: 200 OK
- [ ] No critical errors in logs
- [ ] Database connected successfully
- [ ] Container memory <50MB
- [ ] CPU usage <10%

### Short-term (5 minutes - 2 hours)

- [ ] Dashboard page loads
- [ ] API endpoints responding <1s
- [ ] Error rate <0.1%
- [ ] No 5xx errors
- [ ] User reports: None

### Medium-term (2-24 hours)

- [ ] Performance stable
- [ ] Error rate remained <0.1%
- [ ] Memory usage stable
- [ ] No gradual degradation
- [ ] Database performance normal

### Long-term (Post-launch)

- [ ] Error tracking active
- [ ] Alerts configured
- [ ] On-call rotation active
- [ ] Weekly reviews scheduled
- [ ] Performance baseline established

---

## 📋 Deployment Log Template

```
DEPLOYMENT LOG - Dashboard MVP Phase 4
======================================

Date: [YYYY-MM-DD]
Time: [HH:MM UTC]
Deployed by: [Your name]
Approved by: [Tech Lead]

PRE-DEPLOYMENT:
---------------
Build status: PASS
Tests status: PASS  
Checklist: COMPLETE
Database backup: [backup-YYYYMMDD_HHMMSS.sql]
Backup size: [X MB]

DEPLOYMENT EXECUTION:
---------------------
Start time: [HH:MM UTC]
Build triggered: [via Git push / manual]
Build duration: [X minutes]
Build result: SUCCESS
Migrations: APPLIED
Deployment completion: [HH:MM UTC]
Total duration: [X minutes]

POST-DEPLOYMENT VERIFICATION:
-----------------------------
Health check (0 min): PASS
Error rate (5 min): 0%
Response time (5 min): [X ms]
API tests (10 min): PASS
Dashboard load (10 min): PASS
Error rate (30 min): <0.1%
All systems: HEALTHY

ISSUES ENCOUNTERED:
-------------------
None / List any issues here

ROLLBACK NEEDED:
----------------
No / Yes - Reason: [if needed]
Rollback completed: [time]
Previous version running: [status]

SIGN-OFF:
---------
Deployment successful: YES
On-call assigned: [Name]
Monitoring active: YES
Next review: [Date/Time]

Notes:
------
[Any additional notes]
```

---

## 🔐 Security Verification (Post-Deployment)

### HTTPS/SSL Verification

```bash
# Verify SSL certificate
curl -I https://your-production-url

# Should show:
# HTTP/2 200
# strict-transport-security: max-age=31536000

# Check certificate validity
openssl s_client -connect your-production-url:443 -servername your-production-url | grep -A 5 "Verify return code"

# Should show: "Verify return code: 0 (ok)"
```

### Security Headers Check

```bash
# Check security headers
curl -I https://your-production-url

# Should include:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# Content-Security-Policy: ...
# Referrer-Policy: strict-origin-when-cross-origin
```

### CORS Verification

```bash
# Check CORS headers
curl -I -X OPTIONS https://your-production-url/api/benefits/filters

# Should include appropriate CORS headers if enabled
# Or reject cross-origin requests if disabled
```

---

## 📞 Deployment Support

### Troubleshooting Resources

1. **Railway Documentation**: https://docs.railway.app
2. **PostgreSQL Docs**: https://www.postgresql.org/docs/
3. **Next.js Deployment**: https://nextjs.org/docs/deployment
4. **Prisma Migration**: https://www.prisma.io/docs/concepts/components/prisma-migrate

### Get Help

```bash
# Railway CLI help
railway help

# View service logs
railway logs --help

# Status information
railway status
```

### Contact Information

- **DevOps Lead**: [Name/Contact]
- **Tech Lead**: [Name/Contact]
- **On-call**: [Name/Contact]
- **Railway Support**: support@railway.app

---

## ✅ Deployment Completion Checklist

Before considering deployment complete:

- [ ] All 100+ pre-deployment items verified
- [ ] Build completed successfully
- [ ] Database migrations applied
- [ ] Health checks passing
- [ ] API endpoints responding correctly
- [ ] Dashboard loads and functions
- [ ] Error rate <0.1%
- [ ] Performance metrics acceptable
- [ ] No critical issues in logs
- [ ] Team notified of successful deployment
- [ ] Monitoring active and alerting configured
- [ ] On-call engineer assigned
- [ ] Deployment logged
- [ ] All sign-offs complete

---

## 🎯 Next Steps After Deployment

1. **Monitor for 24 hours** (see monitoring checklist above)
2. **Gather user feedback** from beta testers
3. **Review performance metrics** against baseline
4. **Document any issues** discovered
5. **Plan next feature iteration** if all stable

---

**Phase 4C Complete**  
*Next: Phase 4D Monitoring & Health Checks*  
*Status: Deployment guide ready; awaiting build fix*
