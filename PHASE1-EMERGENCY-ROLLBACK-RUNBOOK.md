# PHASE 1 EMERGENCY ROLLBACK RUNBOOK

**Last Updated:** April 6, 2026, 23:42 UTC  
**Status:** Production Deployment Active  
**Rollback Commit SHA:** 1ff512e (Phase 1 merge)  

---

## ⚠️ WHEN TO EXECUTE THIS RUNBOOK

Execute this rollback procedure **IMMEDIATELY** if ANY of these conditions occur:

### Critical Conditions (Execute Within 5 Minutes)
- [ ] Error rate exceeds 5% of all requests
- [ ] API response time exceeds 2 seconds consistently  
- [ ] Components failing to render (blank pages)
- [ ] "500 Internal Server Error" appearing on dashboard
- [ ] Database connection completely broken
- [ ] Data corruption or integrity violations

### Severe Conditions (Execute Within 10 Minutes)
- [ ] Multiple users reporting the same critical issue
- [ ] Feature completely unavailable to all users
- [ ] Health check failing (3 consecutive failures)
- [ ] Memory leak detected (growing unbounded)

### Normal Rollback (Can Plan Coordinated Timing)
- [ ] Non-critical bugs found
- [ ] Minor UI issues
- [ ] Performance degradation <50%
- [ ] Partial feature unavailability

---

## IMMEDIATE ROLLBACK STEPS (< 2 minutes)

### Step 1: Alert Team (30 seconds)

**Post to Slack #incidents or #deployment:**
```
🚨 ROLLING BACK Phase 1 deployment (commit 1ff512e)
   Reason: [State the issue]
   ETA to rollback: 2 minutes
   ETA to recovery: 5 minutes
```

**Email Alert (if Slack down):**
- To: dev-team@example.com, tech-lead@example.com
- Subject: URGENT: Phase 1 Rollback Initiated
- Body: [Same as Slack message]

### Step 2: Execute Rollback (90 seconds)

**On local machine or CI/CD:**

```bash
# 1. Navigate to repo
cd /Users/manishslal/Desktop/Coding-Projects/Card-Benefits

# 2. Fetch latest main (verify you're on main)
git checkout main
git fetch origin

# 3. Get the merge commit SHA for Phase 1
# This should be: 1ff512e
git log origin/main -1 --pretty=format:"%h"

# 4. Create revert commit
# This REVERTS the merge but keeps git history intact
git revert -m 1 1ff512e --no-edit

# 5. Push to main (Railway auto-deploys)
git push origin main

# 6. You should see in output:
# "To github.com:manishslal/Card-Benefits.git"
# "main -> main"
```

**Expected Output:**
```
[main ...revert...] Revert "auto-commit: ..."
 19 files changed, 4743 deletions(-)
 delete mode 100644 PHASE1-QA-ACCEPTANCE-CRITERIA.md
 ...
To github.com:manishslal/Card-Benefits.git
   1ff512e..xxxxx main -> main
```

### Step 3: Monitor Deployment (3-5 minutes)

**Check Railway Dashboard:**
1. Go to Railway project dashboard
2. Click "Deployments" tab
3. Look for new deployment (should start within 10 seconds)
4. Wait for status to change to "Success" (typically 2-3 minutes)

**Monitor Health Endpoint:**
```bash
# Run every 10 seconds until healthy
curl https://card-benefits-production.up.railway.app/api/health

# Expected response (success):
{
  "status": "ok",
  "database": "connected"
}

# If still showing error, wait 30 more seconds and retry
```

**Watch Error Logs:**
- Railway dashboard → Logs tab
- Filter for errors
- Should see error rate dropping as old code is replaced

### Step 4: Verify Rollback Complete (5 minutes)

**Checklist:**
- [ ] New deployment shows "Success" in Railway
- [ ] Health endpoint returns 200 OK with status: "ok"
- [ ] Error rate returns to <0.1%
- [ ] API response time returns to <100ms
- [ ] Dashboard loads without errors in production browser
- [ ] Components are NOT visible (pre-Phase 1 version)

**Manual Verification:**
```bash
# Open in browser:
https://card-benefits-production.up.railway.app

# Expected behavior:
✓ Page loads (no 500 error)
✓ Dashboard shows benefits (old version without Phase 1 components)
✓ No ResetIndicator visible
✓ No BenefitsFilterBar visible
✓ Browser console clean
```

---

## POST-ROLLBACK STEPS (Do Not Skip!)

### Step 1: Document the Incident (5 minutes)

**Create incident report:**
```markdown
# Incident Report: Phase 1 Rollback

## Timeline
- Detection time: [HH:MM UTC]
- Rollback initiated: [HH:MM UTC]
- Rollback complete: [HH:MM UTC]
- Duration: [X minutes]

## Root Cause
[Describe what failed and why]

## Affected Users
[Estimate number of users impacted]

## Components Rolled Back
- ResetIndicator
- BenefitStatusBadge
- BenefitsFilterBar
- benefitFilters utility

## What Worked
[List things that went right]

## What Failed
[List specific failures]

## Next Steps
[What needs to be fixed before re-deploying]
```

### Step 2: Notify Stakeholders (Immediate)

**Send email to:**
- Tech Lead
- Product Manager  
- Relevant team members

**Subject:** Phase 1 Rollback Completed - [Root Cause]

**Body:**
```
Phase 1 Dashboard Benefits UI components have been rolled back from production.

Timeline:
- Issue detected: [time]
- Rollback initiated: [time]
- Service restored: [time]
- Total downtime: [duration]

Root cause: [brief explanation]

Users can resume normal operations. The benefits dashboard is now showing the 
previous version (without the new filters and indicators).

We will reschedule the deployment after fixing the issue.
```

### Step 3: Schedule Post-Mortem (within 24 hours)

**Meeting Details:**
- Invite: Tech Lead, DevOps, QA, Product
- Duration: 30-60 minutes
- Topics:
  1. What happened?
  2. Why did it happen?
  3. How do we prevent it?
  4. When can we try again?

### Step 4: Fix the Issue

**Investigation Steps:**
1. Review error logs from production deployment
2. Identify the specific failing component/function
3. Check test coverage for the failure scenario
4. Add tests if missing
5. Fix the bug in feature branch
6. Re-test thoroughly

**Testing Before Re-deployment:**
```bash
# Re-run full test suite locally
npm test -- --run

# Re-run build
npm run build

# Test in local dev
npm run dev

# Consider staging deployment if available
```

---

## ROLLBACK VERIFICATION CHECKLIST

After rollback completes, verify with this checklist:

### Functionality (5 min)
- [ ] Dashboard loads
- [ ] Benefits list displays
- [ ] Can navigate pages
- [ ] Cards load correctly
- [ ] Settings page accessible
- [ ] Admin pages functional

### Metrics (5 min)
- [ ] Error rate <0.1%
- [ ] Response time <100ms
- [ ] Database connected
- [ ] Health check passing
- [ ] CPU usage normal
- [ ] Memory usage normal

### User-Facing (5 min)
- [ ] No 500 errors visible
- [ ] No broken layouts
- [ ] Dark mode works
- [ ] Mobile responsive
- [ ] Filters work (old filters if any)
- [ ] Icons display correctly

### Logs (5 min)
- [ ] No critical errors in logs
- [ ] No database errors
- [ ] No auth errors
- [ ] No API errors
- [ ] No component errors

---

## CONTACT ESCALATION CHAIN

**If anything goes wrong during rollback:**

1. **First (5 min):** DevOps Engineer on-call
   - Check slack: #infrastructure
   - Check email: devops@example.com
   
2. **Second (10 min):** Tech Lead
   - Check slack: #tech-leadership
   - Check calendar for availability
   
3. **Third (15 min):** VP Engineering (if critical)
   - Escalate only if rollback doesn't complete
   - Critical = >30 min downtime

**On-Call Rotation:**
- Check Railway project settings for on-call schedule
- Or check team calendar "on-call" events

---

## PREVENTING FUTURE ISSUES

**What to check before next Phase 1 re-deployment:**

1. **Code Review**
   - [ ] Have two engineers review changes
   - [ ] Check for console.log left in
   - [ ] Verify no hardcoded values
   - [ ] Check error boundaries

2. **Testing**
   - [ ] All unit tests passing
   - [ ] All integration tests passing
   - [ ] Test the specific issue scenario
   - [ ] Test edge cases

3. **Staging**
   - [ ] Deploy to staging first
   - [ ] Run full smoke tests
   - [ ] Load test with realistic data
   - [ ] Verify monitoring works

4. **Monitoring**
   - [ ] Set lower alert thresholds initially
   - [ ] Have logs readily viewable
   - [ ] Test alert notifications work
   - [ ] Verify all metrics collecting

5. **Communication**
   - [ ] Notify team before deployment
   - [ ] Have rollback plan reviewed
   - [ ] Confirm on-call engineer available
   - [ ] Set up #incidents channel alert

---

## QUICK REFERENCE

### Rollback Commit SHA
```
1ff512e
```

### Production URL
```
https://card-benefits-production.up.railway.app
```

### Health Check Endpoint
```
GET https://card-benefits-production.up.railway.app/api/health
```

### Key Command (Copy/Paste)
```bash
git revert -m 1 1ff512e --no-edit && git push origin main
```

### Rollback Time Estimate
```
- Execution: < 2 minutes
- Deployment: 2-3 minutes
- Verification: 3-5 minutes
- Total: < 10 minutes to full recovery
```

---

## TESTING THE ROLLBACK (NON-PRODUCTION ONLY)

**If you want to practice rollback before it's needed:**

```bash
# In staging or local:
git revert -m 1 1ff512e --no-edit

# This creates a revert commit without pushing it
git log -1  # See the revert commit

# Verify the Phase 1 files are gone
ls src/features/benefits/components/indicators/

# Reset if it's just practice
git reset --hard HEAD~1
```

---

## DOCUMENT SIGN-OFF

**Runbook Created:** 2026-04-06 23:42 UTC  
**Last Reviewed:** [To be updated after first production week]  
**Next Review:** [Schedule for Phase 2]  

**Approval:**
- [ ] DevOps Engineer: Reviewed and understood
- [ ] Tech Lead: Reviewed and approved
- [ ] Product Manager: Aware and informed

---

⚠️ **KEEP THIS DOCUMENT ACCESSIBLE**

Post link in:
- [ ] Slack #incidents topic
- [ ] Team wiki/documentation
- [ ] On-call engineer handoff docs
- [ ] Deployment checklist

🎯 **REMEMBER:** This runbook ensures rapid recovery. The goal is <10 minutes from detection to full service restoration.

