# Phase 6 Deployment Execution Guide

**Quick Reference for Production Deployment**  
**Last Updated:** April 7, 2025  
**Status:** ✅ READY TO DEPLOY

---

## 🚀 5-Minute Deployment Checklist

### Pre-Deployment (5 min)

```bash
# 1. Verify build succeeds
npm run build
# Expected: "✓ Complete" with 0 errors

# 2. Verify types
npm run type-check
# Expected: "No errors" message

# 3. Verify git is clean
git status
# Expected: "nothing to commit, working tree clean"

# 4. Verify latest commits on main
git log --oneline -3
# Expected: Latest Phase 6 commits visible
```

**✅ Checklist: All green? Continue to deployment**

---

## 🌍 Deployment (Varies by Platform)

### Option A: Railway Deployment (Recommended if using Railway)

```bash
# Method 1: Git-based (Automatic)
git push origin main
# Railway watches main branch and auto-deploys

# Method 2: Railway CLI
railway up
# Follow CLI prompts to deploy

# Monitor deployment
railway logs
```

**Expected output:**
```
✓ Building... 
✓ Deploying...
✓ Verifying...
✓ Online
```

### Option B: Vercel Deployment (Recommended if using Vercel)

```bash
# Method 1: Git-based (Automatic)
git push origin main
# Vercel watches main branch and auto-deploys

# Method 2: Vercel CLI
vercel --prod
# Will deploy to production environment

# Monitor deployment
vercel logs --prod
```

**Expected output:**
```
✓ Building...
✓ Deploying...
✓ Ready
✓ Live at: https://your-domain.com
```

---

## ✅ Post-Deployment Verification (5 min)

### Quick Health Check

```bash
# Set your production URL
PROD_URL="https://your-production-url.com"

# 1. Health check
curl $PROD_URL/api/health
# Expected: HTTP 200 with health status

# 2. Database connectivity
curl $PROD_URL/api/benefits/usage?limit=1 \
  -H "Authorization: Bearer test_token"
# Expected: HTTP 200 (or 401 if token invalid, but connection works)

# 3. Dashboard loads
curl -I $PROD_URL/dashboard
# Expected: HTTP 200

echo "✓ All basic checks passed"
```

### Verify All 5 Endpoints

```bash
# Using the same $PROD_URL variable

# 1. POST - Create benefit claim
curl -X POST $PROD_URL/api/benefits/usage \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userBenefitId": "test",
    "userCardId": "test",
    "usageAmount": 10,
    "usageDate": "2025-04-07"
  }'
# Expected: 201 or 400/401 (connection OK)

# 2. GET - List claims
curl $PROD_URL/api/benefits/usage \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 with JSON array

# 3. GET - Period status
curl "$PROD_URL/api/benefits/test/status?userCardId=test" \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 with status data

# 4. PATCH - Update claim
curl -X PATCH $PROD_URL/api/benefits/usage/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"usageAmount": 20}'
# Expected: 200 or 404 (endpoint exists)

# 5. DELETE - Delete claim
curl -X DELETE $PROD_URL/api/benefits/usage/test \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 or 404 (endpoint exists)

echo "✓ All 5 endpoints responding"
```

### Verify UI Components

1. **Navigate to production dashboard**
   - Open https://your-production-url.com/dashboard
   - Expected: Page loads without errors

2. **Check benefit cards**
   - Benefit cards display with period information
   - Progress bars visible
   - "Claim" buttons clickable

3. **Test modal interaction**
   - Click "Claim" button
   - Modal should open
   - Period selector should populate
   - Amount input should work

4. **Check history tab**
   - Click "History" tab on benefit card
   - Should show table of claims
   - Filters and sorting should work

5. **Verify styling**
   - Buttons look correct
   - Colors are consistent
   - Layout is responsive

---

## 📊 Monitoring Setup

### Set Up Alerts (After Deployment)

**For Railway:**
```bash
# Add monitoring in Railway dashboard
1. Go to Projects → Your Project → Monitoring
2. Set up CPU/Memory alerts
3. Set up error rate alerts
4. Configure Slack/Email notifications
```

**For Vercel:**
```bash
# Add monitoring in Vercel dashboard
1. Go to Project Settings → Monitoring
2. Set up performance alerts
3. Set up error rate alerts
4. Configure email notifications
```

### Monitor Key Metrics

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| API Response Time | < 200ms | > 500ms | > 1000ms |
| Error Rate | < 0.1% | > 1% | > 5% |
| CPU Usage | < 30% | > 50% | > 80% |
| Memory Usage | < 60% | > 75% | > 90% |
| Database Queries | < 100ms | > 200ms | > 500ms |

---

## 🔄 Rollback Plan (If Issues Found)

### Quick Rollback (< 5 minutes)

**Option A: Git Revert**
```bash
# Revert the deployment
git revert HEAD --no-edit
git push origin main

# Wait for automatic redeployment (2-3 minutes)
# Verify rollback succeeded with health check above
```

**Option B: Platform Rollback**

**For Railway:**
```bash
# Via dashboard:
# Deployments → Select previous version → Rollback

# Or via CLI:
railway environment --set preview  # or specify version
railway restart
```

**For Vercel:**
```bash
# Via dashboard:
# Deployments → Select previous → Rollback

# Or via CLI:
vercel rollback --confirm
```

### Manual Rollback Steps (If Needed)

1. **Identify the issue**
   - Check error logs
   - Determine if it's code, data, or infrastructure

2. **Revert code**
   ```bash
   git checkout <previous_commit>
   git push origin HEAD:main --force
   ```

3. **Restore data (if needed)**
   ```bash
   # Only if database corruption occurred
   pg_restore -d $DATABASE_URL backup.sql
   ```

4. **Verify rollback**
   ```bash
   curl https://production-url/api/health
   # Should return 200
   ```

5. **Notify team**
   - Document what went wrong
   - Post incident report
   - Plan fix for next deployment

---

## 📋 Complete Deployment Checklist

### Phase: Pre-Deployment
- [ ] npm run build succeeds (0 errors)
- [ ] npm run type-check passes
- [ ] git status shows clean working tree
- [ ] Latest commits are on main branch
- [ ] DATABASE_URL is set in environment
- [ ] NEXTAUTH_SECRET is set in environment
- [ ] NODE_ENV is set to "production"

### Phase: Deployment
- [ ] Code pushed/deployed to production
- [ ] Deployment logs show success
- [ ] No errors during deployment
- [ ] All services started successfully

### Phase: Post-Deployment Verification
- [ ] Health check returns 200
- [ ] All 5 API endpoints responding
- [ ] Dashboard loads without errors
- [ ] Components render correctly
- [ ] Buttons are clickable
- [ ] Modals open and close
- [ ] Tables display data
- [ ] No console errors in browser

### Phase: Monitoring
- [ ] Error rate < 0.1%
- [ ] Response times < 200ms
- [ ] CPU usage < 30%
- [ ] Memory usage < 60%
- [ ] Alerts configured

### Phase: Documentation
- [ ] Deployment report completed
- [ ] Verification summary created
- [ ] Rollback plan documented
- [ ] Changes committed to git

---

## 🆘 Troubleshooting

### Issue: Build Fails

```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build

# Check for TypeScript errors
npm run type-check

# Check for Node version issues
node --version  # Should be 18.x or 20.x
```

### Issue: Deployment Fails

**For Railway:**
```bash
# Check recent logs
railway logs -n 100

# Verify environment variables
railway variables

# Rebuild and deploy
railway restart --build
```

**For Vercel:**
```bash
# Check deployment logs in dashboard
# Settings → Deployments → View logs

# Check environment variables
# Settings → Environment Variables

# Force redeploy
vercel --prod --force
```

### Issue: API Endpoints Not Responding

```bash
# Check if database is accessible
psql $DATABASE_URL -c "SELECT 1"

# Check database tables exist
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables"

# Check server logs
railway logs  # or Vercel logs

# Verify environment variables
echo $DATABASE_URL
echo $NEXTAUTH_SECRET
```

### Issue: UI Components Not Rendering

```bash
# Check browser console for errors
# Open DevTools → Console tab

# Check network requests
# Open DevTools → Network tab
# Look for failed requests (red items)

# Check server logs for API errors
# Same steps as above
```

---

## 📞 Support Information

### Getting Help

1. **Check logs first**
   - Server logs (Railway/Vercel)
   - Browser console (F12)
   - Network tab (F12)

2. **Review documentation**
   - PHASE6-DEPLOYMENT-REPORT.md - Full details
   - PHASE6-IMPLEMENTATION-SUMMARY.md - Architecture
   - .github/specs/phase6-period-tracking-spec.md - Requirements

3. **Contact team**
   - DevOps team: Infrastructure issues
   - Frontend team: UI component issues
   - Database team: Data integrity issues

### Emergency Contacts

- **DevOps Lead**: [Contact]
- **Database Admin**: [Contact]
- **Frontend Lead**: [Contact]
- **On-Call**: [Contact]

---

## 📈 Success Metrics (First 24 Hours)

Monitor these after deployment:

```
API Metrics:
✓ Endpoints responding: 5/5
✓ Error rate: < 0.1%
✓ Response time: < 200ms average
✓ Database queries: < 100ms average

System Metrics:
✓ CPU usage: < 30%
✓ Memory usage: < 60%
✓ Uptime: 100%
✓ No exceptions

User Metrics:
✓ Dashboard loads
✓ Can create claims
✓ Can view history
✓ No UI errors
```

---

## ✅ Deployment Complete!

When all checks pass and monitoring is active:

```
🎉 PHASE 6 IS LIVE IN PRODUCTION 🎉

✓ Period-based benefit tracking active
✓ All endpoints operational
✓ All components rendering
✓ Users can now:
  - Track benefits by period
  - Claim multiple times per period
  - View and edit history
  - See accurate progress
```

---

**Deployment Execution Guide - Phase 6**  
*This guide provides the fastest path to production deployment*  
*For detailed information, see PHASE6-DEPLOYMENT-REPORT.md*
