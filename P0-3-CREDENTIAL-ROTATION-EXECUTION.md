# P0-3: Credential Rotation Execution Guide
**Status**: Ready for Manual Execution
**Date**: 2026-04-05
**Environment**: Production (card-benefits-production.up.railway.app)
**Authorized Executor**: DevOps Team / Product Owner

---

## 🔒 SECURITY NOTICE

This document contains instructions for rotating production credentials. **Do not share this guide with unauthorized personnel.** Only authorized DevOps/Product Owner should execute these steps.

---

## ✅ Pre-Rotation Checklist

Before starting, verify:

- [ ] You have access to Railway Dashboard (https://railway.app/dashboard)
- [ ] You have the authorization approval (attached at top of this task)
- [ ] Production environment is stable (check dashboard health)
- [ ] No active deployments in progress
- [ ] You have backup of current credentials (archived separately)
- [ ] Verification scripts are ready (see Phase 4)
- [ ] Team is notified of maintenance window
- [ ] You have a rollback procedure ready

---

## 📋 Phase 1: Pre-Rotation Verification (2 minutes)

### Step 1.1: Verify Production Health
**Action**: Go to Railway Dashboard and check current status

1. Visit: https://railway.app/project/card-tracker
2. Select **Card-Benefits** service (web environment)
3. Verify:
   - ✅ Service is **RUNNING** (green status)
   - ✅ No error logs in the past 5 minutes
   - ✅ CPU/Memory usage is normal (not spiking)
   - ✅ Recent deployments all **SUCCEEDED**

**Record**: Screenshot or note the current state

### Step 1.2: Check No Active Deployments
1. In Railway Dashboard, click **Deployments** tab
2. Verify:
   - ✅ Latest deployment shows **SUCCESS**
   - ✅ No deployment currently **IN PROGRESS**
   - ✅ All workflow jobs completed

**Record**: Note the timestamp of the last successful deployment

### Step 1.3: Document Current State
```
PRE-ROTATION STATUS:
  - Timestamp: [RECORD TIME]
  - Service Status: [RUNNING/OTHER]
  - Last Deployment: [TIMESTAMP]
  - Active Users: [Check from logs if possible]
  - Error Rate: [Check past 5 min - should be <0.1%]
```

---

## 🔑 Phase 2: Update Railway Environment Variables (5-10 minutes)

### Step 2.1: Access Environment Configuration

1. **Go to Railway Dashboard**: https://railway.app/project/card-tracker
2. **Select Card-Benefits service**:
   - Click on "Card-Benefits" in the project
   - Select the **Production** environment (right side dropdown if available)
3. **Click "Variables" tab** in the service settings

### Step 2.2: Update SESSION_SECRET

1. Find the **SESSION_SECRET** variable
2. **Replace with new value**:
   ```
   82aae4f579d9e28f26475e05dce42704421a171ffc7c20214b246bfb6aa138bc
   ```
3. Click **Save** or **Update**

**Record**: Screenshot of updated SESSION_SECRET

### Step 2.3: Update CRON_SECRET

1. Find the **CRON_SECRET** variable
2. **Replace with new value**:
   ```
   2ea0e935688f89258dfacc1e194aeac9e12720cd4ceb8a147e3fb2c908ed05eb
   ```
3. Click **Save** or **Update**

**Record**: Screenshot of updated CRON_SECRET

### Step 2.4: Verify Other Variables Unchanged
- ✅ **DATABASE_URL**: Should remain unchanged
- ✅ **NODE_ENV**: Should still be `production`
- ✅ All other secrets: Unchanged

### Step 2.5: Trigger Redeployment
1. Railway automatically redeploys when environment variables change
2. You should see a **new deployment starting** in the Deployments tab
3. **Record**: Deployment start timestamp

---

## 📦 Phase 3: Monitor Redeployment (10-15 minutes)

### Step 3.1: Watch Build Progress

**In Railway Dashboard**:
1. Click **Deployments** tab
2. Open the **latest deployment** (should have started after variable update)
3. Monitor the **Build** phase:
   - ✅ Build starts
   - ✅ Dependencies install (`npm install`)
   - ✅ Build completes (`npm run build`)
   - ✅ Build succeeds (shows "Build succeeded" or similar)

**Expected duration**: 3-5 minutes

**Record**: Build completion timestamp

### Step 3.2: Watch Startup Phase

1. **Deployment phase** begins (after build completes)
2. Monitor:
   - ✅ Docker image pushed
   - ✅ New container starts
   - ✅ Prisma migrations run (if any)
   - ✅ Application starts (logs show "ready on port 3000" or similar)

**Expected duration**: 2-3 minutes

**Record**: Deployment completion timestamp

### Step 3.3: Verify No Errors

During deployment, check **Logs** tab:
- ❌ No errors containing: "AUTH", "SESSION", "CRON", "SECRET"
- ❌ No "500" errors
- ❌ No database connection errors
- ✅ No warning messages about credentials

**If errors appear**: Go to **Rollback Procedure** (below)

---

## ✔️ Phase 4: Post-Rotation Verification (10-15 minutes)

Run the verification scripts provided. See **Verification Scripts** section below.

### Step 4.1: Health Check
```bash
curl -s https://card-benefits-production.up.railway.app/api/health | jq .
```
**Expected Response**:
```json
{ "status": "ok" }
```
**Record**: ✅ Pass/Fail

### Step 4.2: Login Test
```bash
# Use the verification script provided below
# This will test login functionality with new SESSION_SECRET
bash P0-3-VERIFICATION-SCRIPT.sh
```

**Expected Result**: All tests PASS

### Step 4.3: Monitor for User Issues
1. Check Railway **Logs** for the next 5 minutes
2. Look for:
   - ❌ "Invalid session" errors
   - ❌ "Unauthorized" errors
   - ❌ "Token expired" errors
   - ✅ Normal user traffic
3. Check application error tracking (if available):
   - ❌ No spike in auth errors
   - ❌ No spike in 401/403 responses

### Step 4.4: Verify Cron Jobs
If a cron job runs during this window:
1. Check logs for cron endpoint (`/api/cron/*`)
2. Verify:
   - ✅ CRON_SECRET is accepted
   - ✅ Job completes successfully
   - ✅ No "Invalid cron secret" errors

---

## 📝 Phase 5: Documentation & Sign-Off (5 minutes)

### Step 5.1: Complete This Checklist

```
CREDENTIAL ROTATION COMPLETION CHECKLIST:

Pre-Rotation:
  [ ] Production verified healthy
  [ ] No active deployments
  [ ] Current state documented
  
Rotation Execution:
  [ ] SESSION_SECRET updated in Railway
  [ ] CRON_SECRET updated in Railway
  [ ] Redeployment triggered
  
Build & Deployment:
  [ ] Build succeeded
  [ ] Application started
  [ ] No errors during deployment
  
Verification:
  [ ] Health check passes (GET /api/health → 200)
  [ ] Login flow works (POST /api/auth/login → Success)
  [ ] Sessions are valid (no logout cascade)
  [ ] Cron jobs accepted (if tested)
  [ ] No auth-related errors in logs
  
Sign-Off:
  [ ] All tests passed
  [ ] No user-reported issues in monitoring
  [ ] Old credentials archived securely
  [ ] Team notified of completion
```

### Step 5.2: Archive Old Credentials

**Important**: Securely store these values in a separate, encrypted location:
- Old SESSION_SECRET: [Your value - NOT in this document]
- Old CRON_SECRET: [Your value - NOT in this document]

Do NOT commit to Git or store in plaintext.

### Step 5.3: Team Notification

Send message to team:
```
✅ P0-3 Credential Rotation COMPLETE

Timestamps:
  - Start: [TIME]
  - Deployment: [TIME]
  - Verification: [TIME]
  - Complete: [TIME]

Status: All systems operational, no user impact observed.

New credentials deployed to production environment.
```

---

## 🔄 Rollback Procedure (If Needed)

**If you encounter errors during deployment**, follow this rollback:

### Quick Rollback (First 15 minutes after update)

1. **In Railway Dashboard**:
   - Click **Deployments** tab
   - Find the **previous successful deployment** (before credential update)
   - Click the **Revert** button (or similar)

2. **Verify Rollback**:
   - Wait for redeployment to complete
   - Run health check: `curl https://card-benefits-production.up.railway.app/api/health`
   - Verify old credentials are active

3. **Document Rollback**:
   - Record timestamp
   - Note reason for rollback
   - Plan investigation

### Manual Rollback (If automated revert doesn't work)

1. In Railway, go to **Variables**
2. **Revert SESSION_SECRET and CRON_SECRET to old values**
3. Save (this triggers new deployment with old credentials)
4. Monitor deployment and verify health

---

## 📊 Monitoring Commands

After deployment, use these to monitor:

```bash
# Get health status
curl -s https://card-benefits-production.up.railway.app/api/health

# Check if new deployment is active
# (Note: You'll need SSH or log access for detailed monitoring)

# Monitor for errors in production logs (use Railway dashboard)
# Filter for: ERROR, 500, AUTH, SESSION, CRON
```

---

## 🎯 Success Criteria

P0-3 is complete when **ALL** of these are true:

✅ **New Credentials Active**: SESSION_SECRET and CRON_SECRET updated in Railway
✅ **Deployment Successful**: Application running with no errors
✅ **Health Checks Pass**: `/api/health` returns 200 OK
✅ **User Sessions Valid**: No cascade logouts, existing users stay logged in
✅ **Login Works**: New users can log in successfully
✅ **Cron Jobs Work**: If executed, CRON_SECRET is accepted
✅ **Error-Free**: No auth/session/cron errors in logs
✅ **Monitored**: No spike in errors post-deployment
✅ **Documented**: This checklist completed and archived
✅ **Old Credentials Archived**: Securely stored separately

---

## 📞 Support & Escalation

If you encounter issues:

1. **Check Railway Dashboard Logs** - Most errors are visible there
2. **Review Deployment Errors** - See build/startup logs
3. **Test Health Endpoint** - Verify basic connectivity
4. **Consider Rollback** - If errors persist after 10 minutes
5. **Contact Team Lead** - For further support

---

## 📅 Timeline Summary

| Phase | Duration | Status |
|-------|----------|--------|
| Pre-Rotation Verification | 2 min | Manual |
| Update Environment Variables | 5-10 min | Manual (in Railway) |
| Monitor Redeployment | 10-15 min | Manual (monitor) |
| Verification Testing | 10-15 min | Automated (scripts) |
| Documentation | 5 min | Manual |
| **Total** | **40-50 min** | **Estimate** |

---

## 🔐 Security Reminders

- ❌ Do NOT commit credentials to Git
- ❌ Do NOT share credentials in Slack/email
- ❌ Do NOT store credentials in plaintext
- ✅ DO use Railway's environment variable manager
- ✅ DO archive old credentials securely
- ✅ DO verify rotation with tests
- ✅ DO monitor for issues post-deployment

---

**Document Version**: 1.0
**Last Updated**: 2026-04-05
**Executor**: [Your Name]
**Completion Time**: [Record when complete]
