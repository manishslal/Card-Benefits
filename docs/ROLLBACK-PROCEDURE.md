# Phase 2B Rollback Procedure

**Version:** 1.0.0  
**Severity:** CRITICAL - Follow exactly as written  
**Response Time:** < 5 minutes  

---

## Table of Contents

1. [Rollback Decision Matrix](#rollback-decision-matrix)
2. [Quick Rollback (Recommended)](#quick-rollback-recommended)
3. [Manual Rollback](#manual-rollback)
4. [Data Recovery](#data-recovery)
5. [Verification Steps](#verification-steps)
6. [Post-Rollback Analysis](#post-rollback-analysis)

---

## Rollback Decision Matrix

**Rollback IMMEDIATELY if:**

| Trigger | Indicator | Action |
|---------|-----------|--------|
| **Critical Error Rate** | >5% of requests failing | 🔴 ROLLBACK NOW |
| **Database Unavailable** | Cannot connect to database | 🔴 ROLLBACK NOW |
| **Authentication Broken** | Users cannot log in | 🔴 ROLLBACK NOW |
| **Data Corruption** | Detected data integrity issues | 🔴 ROLLBACK NOW |
| **Security Breach** | Vulnerability detected in code | 🔴 ROLLBACK NOW |
| **Performance Critical** | API latency >5s or timeouts | 🔴 ROLLBACK NOW |

**Rollback within 15 minutes if:**

| Trigger | Indicator | Action |
|---------|-----------|--------|
| **High Error Rate** | 1-5% of requests failing | 🟡 INVESTIGATE then decide |
| **Memory Leak** | Memory growing unbounded | 🟡 MONITOR, prepare rollback |
| **Intermittent Issues** | Sporadic failures | 🟡 IDENTIFY pattern, then act |

**Continue monitoring if:**

| Trigger | Indicator | Action |
|---------|-----------|--------|
| **Low Error Rate** | <1% errors | 🟢 MONITOR |
| **Normal Performance** | All metrics in range | 🟢 MONITOR |
| **Expected Issues** | Known issues in changelog | 🟢 MONITOR |

---

## Quick Rollback (Recommended)

### Option 1: Via Railway Dashboard (Fastest)

**Time: ~2-3 minutes**

1. **Go to Railway Dashboard**
   - URL: https://railway.app
   - Select project: `card-benefits`
   - Select service: `card-benefits-prod`

2. **Locate Deployments Tab**
   - Click "Deployments" in service navigation
   - Find most recent stable deployment (before Phase 2B)

3. **Trigger Rollback**
   - Hover over previous deployment
   - Click "Redeploy" button
   - Confirm: "Rollback to this version"

4. **Monitor Rollback Progress**
   - Watch deployment logs
   - Wait for "Deployment successful" message
   - Takes ~1-2 minutes

5. **Verify Rollback**
   ```bash
   curl https://card-benefits-prod.railway.app/api/health
   # Should show Phase 1 version (not Phase 2B)
   ```

### Option 2: Via Railway CLI

**Time: ~2-3 minutes**

```bash
# 1. Install Railway CLI (if not installed)
curl -fsSL https://railway.app/install.sh | sh

# 2. Login to Railway
railway login

# 3. Select project
railway project select

# 4. Stop current deployment
railway down

# 5. List deployment history
railway logs --deployment

# 6. Redeploy specific version
railway up --version=<PREVIOUS_VERSION_ID>

# 7. Verify rollback
curl https://card-benefits-prod.railway.app/api/health
```

### Option 3: Via GitHub CLI

**Time: ~3-5 minutes (if GitHub Actions integration)**

```bash
# 1. List recent workflow runs
gh workflow run list --workflow=phase2b-ci-cd.yml

# 2. Re-run specific past deployment
gh workflow run [WORKFLOW_ID] --ref=refs/tags/[STABLE_TAG]

# 3. Monitor workflow
gh workflow view [WORKFLOW_ID]
```

---

## Manual Rollback

### Full Step-by-Step Manual Rollback

**Use only if automated rollback fails**

#### Step 1: Stop Current Deployment

```bash
# 1. SSH into production server (if applicable)
# Or use Railway dashboard to stop service

# Via Railway CLI:
railway down

# This immediately stops Phase 2B deployment
# Old version remains in backup
```

#### Step 2: Verify Backup Availability

```bash
# Railway automatically maintains backups
# Check backup created at deployment start time

# View available backups in Railway Dashboard:
# - Settings → Backups → Database Backups
# - Find backup labeled "pre-phase2b-deployment"
```

#### Step 3: Restore Previous Version

**Option A: Railway Automatic Rollback**
```bash
# Railway automatically restores previous state
railway up --rollback
```

**Option B: Manual Database Restore (if needed)**
```bash
# This should NOT be necessary with Railway
# Only use if automatic rollback fails

# 1. Stop application
railway down

# 2. Get backup location
# Check Railway dashboard: Settings → Backups

# 3. Restore database (Railway handles this)
# Contact Railway support if needed
```

#### Step 4: Start Previous Version

```bash
# Redeploy from previous commit tag
railway up --version=stable

# Wait for deployment to complete
# Estimated time: 2-3 minutes

# Monitor logs
railway logs --service card-benefits-prod
```

---

## Data Recovery

### Pre-Deployment Backup

**Railway automatically creates backups:**
- Trigger: At deployment start (release command)
- Location: Railway managed PostgreSQL backup
- Retention: 7 days (automatic)
- Time to restore: ~5 minutes

### Manual Backup Restoration

```bash
# 1. Verify backup exists
# Railway Dashboard → Backups → Database

# 2. Contact Railway support for restore
# Only needed if automatic rollback fails

# 3. Expected data state after restore:
# - All Phase 1 data intact
# - Phase 2B data removed (reverted to pre-deployment state)
# - No data loss (backup created before migration)
```

### Data Integrity Check

After rollback, verify data integrity:

```bash
# 1. Check Phase 1 tables exist
# - MasterCard
# - MasterBenefit
# - User
# - UserCard

# 2. Count records (should match pre-Phase 2B)
curl -X GET https://card-benefits-prod.railway.app/api/cards/master

# 3. Verify user data
curl -X GET https://card-benefits-prod.railway.app/api/user/profile

# 4. Test authentication
# Login with test account
# Verify session/token creation
```

---

## Verification Steps

### Immediate Verification (After Rollback Initiated)

```bash
# Wait 2-3 minutes for deployment to complete

# 1. Check service status
curl -v https://card-benefits-prod.railway.app/api/health

# Expected response (HTTP 200):
# {
#   "status": "healthy",
#   "version": "1.0.0"  # NOT "2B-1.0"
# }

# 2. Check error logs
# Railway Dashboard → Logs
# Should NOT show Phase 2B related errors
```

### Feature Verification

```bash
# 1. Test login (Phase 1 feature)
POST /api/auth/login
{
  "email": "test@example.com",
  "password": "password123"
}

# 2. Test card management (Phase 1 feature)
GET /api/cards/my-cards
# Should return user's cards

# 3. Verify Phase 2B features are NOT available
GET /api/benefits/usage
# Should return 404 or empty until re-enabled

# 4. Test database connectivity
# All queries should complete in <100ms
```

### Performance Verification

```bash
# 1. Check API response time
time curl https://card-benefits-prod.railway.app/api/cards/my-cards
# Should be <200ms

# 2. Check CPU/Memory
# Railway Dashboard → Metrics
# CPU: <60%
# Memory: <70%

# 3. Check database connections
# Should be <50 active connections
```

### User Experience Verification

- [ ] Can users log in?
- [ ] Can users view their benefits?
- [ ] Can users manage cards?
- [ ] Is the UI responsive?
- [ ] Are there any console errors?

### Error Log Review

```bash
# Check production logs in Railway Dashboard

# Look for:
# ❌ Connection errors
# ❌ Authentication errors
# ❌ Database errors
# ❌ Timeout errors

# Should see:
# ✅ Normal request logs
# ✅ Occasional info messages
# ✅ No error spikes
```

---

## Post-Rollback Analysis

### Immediate Actions (Within 1 hour)

1. **Create Incident Report**
   - What went wrong?
   - When was it detected?
   - How was rollback executed?
   - Impact: # of users affected

2. **Notify Stakeholders**
   ```
   Slack message template:
   
   🔄 ROLLBACK COMPLETED
   
   Status: Phase 2B deployment rolled back
   Reason: [specific error/issue]
   Duration: X minutes down
   Data Status: ✅ No data loss
   
   Timeline:
   - 12:30 Deployment started
   - 12:35 Issues detected
   - 12:38 Rollback initiated
   - 12:41 Rollback complete
   
   Next Steps:
   - Root cause analysis
   - Fix implementation
   - Staging validation (24+ hours)
   - Production redeployment
   ```

3. **Document What Happened**
   - Create GitHub issue: `[ROLLBACK] Phase 2B deployment`
   - Document exact error messages
   - Note environmental factors
   - Record decision timeline

### Root Cause Analysis (Within 24 hours)

1. **Gather Information**
   - Deployment logs
   - Application logs (last 2 hours)
   - Database logs
   - Error traces
   - Performance metrics

2. **Identify Root Cause**
   - Was it code? (Specific function/module)
   - Was it configuration? (Wrong env vars)
   - Was it infrastructure? (Database, network)
   - Was it data? (Migration issue)

3. **Develop Fix**
   - Fix code/config issue
   - Add tests to prevent recurrence
   - Update documentation
   - Plan validation in staging

### Prevention Measures

1. **Add Tests**
   - Test case for the issue
   - Add to CI/CD pipeline
   - Ensure test catches the problem

2. **Improve Monitoring**
   - Add alert for this error pattern
   - Lower alert threshold if needed
   - Add health check for this system

3. **Update Procedures**
   - Update deployment guide
   - Update runbook
   - Train team on lesson learned

### Staging Validation (Before Re-deployment)

```bash
# 1. Fix deployed to staging
git checkout staging
git merge develop  # or your branch
git push origin staging

# 2. Wait 24+ hours for monitoring
# Monitor staging in production-like way

# 3. Reproduce issue in staging
# Verify fix actually works

# 4. Run full test suite
npm run test
npm run test:e2e

# 5. Load test in staging
# Simulate production traffic
# Monitor performance metrics

# 6. Get approval from:
# [ ] Engineering lead
# [ ] DevOps lead
# [ ] Product manager

# 7. Schedule production re-deployment
```

---

## Escalation Path

**If rollback fails or doesn't resolve issue:**

1. **Level 1: DevOps Engineer**
   - Try automated rollback
   - Try manual rollback
   - Check application logs
   - Verify database state

2. **Level 2: Engineering Lead + DevOps**
   - Root cause analysis
   - Database integrity check
   - Consider full system restart
   - May need infrastructure changes

3. **Level 3: CTO + Infrastructure Team**
   - Critical infrastructure issues
   - Complete data recovery needed
   - May require vendor support (Railway, PostgreSQL)

4. **Level 4: Incident Commander**
   - Prolonged outage (>1 hour)
   - Data loss concerns
   - Security implications

---

## Communication Templates

### Initial Incident Report

```
⚠️ PRODUCTION ALERT

Service: Card Benefits Tracker
Environment: Production
Severity: CRITICAL
Time Detected: HH:MM UTC
Duration: X minutes

Issue: [Brief description]

Impact:
- Users affected: ~X
- Features unavailable: [list]
- Data at risk: No / Yes

Action Taken: Rollback initiated
Expected Resolution: 10-15 minutes

Updates will be posted here.
```

### Rollback Complete

```
✅ ROLLBACK COMPLETED

Status: All Phase 1 features restored
Downtime: X minutes
Data Loss: None
Recovery Time: X minutes

Current Status:
- ✅ API responding
- ✅ Database connected
- ✅ Users can log in
- ✅ All Phase 1 features working

Phase 2B will be re-deployed after:
1. Root cause analysis
2. Fix implementation
3. Staging validation (24+ hours)
4. Team approval

Thank you for your patience.
```

### Root Cause Analysis Report

```
🔍 ROOT CAUSE ANALYSIS: Phase 2B Rollback

Incident: [Description]
Date/Time: [When it happened]
Duration: [How long]

Root Cause:
[Detailed explanation of what went wrong]

Contributing Factors:
- Factor 1
- Factor 2
- Factor 3

Impact:
- Users affected: X
- Features unavailable: [list]
- Estimated cost: $X

Immediate Fix:
[What was changed to fix it]

Preventive Measures:
1. [Measure 1]
2. [Measure 2]
3. [Measure 3]

Timeline:
- 12:30 Deployment started
- 12:35 Issue detected
- 12:38 Rollback initiated
- 12:41 Rollback complete
- 13:00 Analysis started
- [etc]
```

---

## Success Criteria for Rollback

✅ **Rollback Successful When:**

1. **Service Available**
   - API responding to requests
   - Health check endpoint returns 200
   - Average response time <200ms

2. **Features Working**
   - Authentication working
   - All Phase 1 features available
   - Phase 2B features removed

3. **Data Intact**
   - No data loss
   - User accounts functional
   - Card data accessible
   - Benefit data visible

4. **No New Errors**
   - Error rate <1%
   - No database errors
   - No authentication errors
   - Logs clean

5. **Monitoring Active**
   - Dashboards showing metrics
   - Alerts functioning
   - Slack notifications working

---

**This rollback procedure is maintained by the DevOps team.**  
**For emergencies, call the On-Call Engineer.**  
**For questions, contact DevOps Lead.**
