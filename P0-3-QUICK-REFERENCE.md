# P0-3: Credential Rotation - Quick Reference Checklist

**Authorization**: ✅ APPROVED  
**Environment**: Production (card-benefits-production.up.railway.app)  
**Date**: 2026-04-05  
**Estimated Duration**: 40-50 minutes

---

## 🎯 Quick Start (5 Step Process)

### STEP 1: PRE-FLIGHT CHECK (2 min)
- [ ] Visit: https://railway.app/project/card-tracker
- [ ] Verify Card-Benefits service is RUNNING (green status)
- [ ] Check Deployments tab - no active deployments
- [ ] Record current state (timestamp, status)

### STEP 2: UPDATE CREDENTIALS (5-10 min)
- [ ] In Railway, go to Card-Benefits → Variables
- [ ] Update SESSION_SECRET:
  ```
  82aae4f579d9e28f26475e05dce42704421a171ffc7c20214b246bfb6aa138bc
  ```
- [ ] Update CRON_SECRET:
  ```
  2ea0e935688f89258dfacc1e194aeac9e12720cd4ceb8a147e3fb2c908ed05eb
  ```
- [ ] Click Save
- [ ] Record timestamp

### STEP 3: MONITOR DEPLOYMENT (10-15 min)
- [ ] Watch Deployments tab for new deployment
- [ ] Build phase: Wait for "Build succeeded"
- [ ] Deploy phase: Wait for "Deployment succeeded"
- [ ] Check Logs: No AUTH/SESSION/CRON errors
- [ ] Record completion timestamp

### STEP 4: RUN VERIFICATION (10-15 min)
```bash
# Make script executable
chmod +x P0-3-VERIFICATION-SCRIPT.sh

# Run against production (recommended)
bash P0-3-VERIFICATION-SCRIPT.sh

# Or run against local (if testing locally first)
bash P0-3-VERIFICATION-SCRIPT.sh local
```

- [ ] All 4 tests PASS ✅
- [ ] Health check returns 200 ✅
- [ ] Login works ✅
- [ ] Sessions protected ✅
- [ ] Cron secret updated ✅

### STEP 5: SIGN OFF (5 min)
- [ ] All tests passed
- [ ] No errors in logs
- [ ] Old credentials archived securely
- [ ] Team notified
- [ ] Document completion time

---

## 🔗 Resources

| Resource | Link |
|----------|------|
| **Railway Dashboard** | https://railway.app/project/card-tracker |
| **Full Execution Guide** | P0-3-CREDENTIAL-ROTATION-EXECUTION.md |
| **Verification Script** | P0-3-VERIFICATION-SCRIPT.sh |
| **New Credentials** | See above (STEP 2) |

---

## 🔑 New Credentials (STORE SECURELY AFTER DEPLOYMENT)

```
SESSION_SECRET: 82aae4f579d9e28f26475e05dce42704421a171ffc7c20214b246bfb6aa138bc
CRON_SECRET: 2ea0e935688f89258dfacc1e194aeac9e12720cd4ceb8a147e3fb2c908ed05eb
```

**⚠️ DO NOT COMMIT THESE TO GIT**

---

## ⚠️ If Something Goes Wrong

### Quick Rollback (< 15 min after update)
1. Go to Railway Dashboard → Deployments
2. Click previous successful deployment
3. Click "Revert" button
4. Wait for redeployment
5. Run verification again

### Troubleshooting
- **Build fails**: Check Railway build logs
- **App won't start**: Check Railway deployment logs
- **Auth errors**: Verify credentials were saved correctly in Variables
- **Cron fails**: Verify CRON_SECRET matches exactly (no spaces)

---

## 📊 Timeline

| Step | Time | Who |
|------|------|-----|
| Pre-flight check | 2 min | You |
| Update credentials | 5-10 min | You (in Railway) |
| Monitor deployment | 10-15 min | You (automated) |
| Run verification | 10-15 min | You (script) |
| Sign off | 5 min | You |
| **TOTAL** | **40-50 min** | **YOU** |

---

## ✅ Success Criteria

P0-3 is complete when:

✅ New credentials updated in Railway  
✅ Deployment succeeded with no errors  
✅ Health check passes  
✅ Login works with new SESSION_SECRET  
✅ Cron accepts new CRON_SECRET  
✅ No auth errors in logs  
✅ Verification script passes all 4 tests  
✅ Old credentials archived securely  

---

## 📞 Need Help?

1. **Check logs**: Railway Dashboard → Select service → Logs tab
2. **Run verification**: `bash P0-3-VERIFICATION-SCRIPT.sh`
3. **Rollback if needed**: Use Revert button in Deployments
4. **Read full guide**: P0-3-CREDENTIAL-ROTATION-EXECUTION.md
5. **Contact team lead**: If issues persist

---

## 🔐 Security Checklist

Before starting:
- [ ] You are authorized to execute this
- [ ] You have Railway access
- [ ] No one else is watching/recording
- [ ] You have secure location to store old credentials
- [ ] No one else will interrupt during deployment

After completion:
- [ ] Old credentials securely archived (NOT in Git)
- [ ] New credentials NOT in plaintext anywhere
- [ ] All clipboard history cleared
- [ ] Team notified of completion
- [ ] This checklist archived

---

**Status**: Ready to Execute  
**Executor**: [Your Name - sign here when complete]  
**Completion Time**: [Record when done]  
**Verified By**: [Team review if needed]
