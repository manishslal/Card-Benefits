# Production Operations Runbook - 3 Critical Bug Fixes

**Deployment**: 2026-04-06  
**Version**: Production v1.0  
**Status**: ✅ LIVE IN PRODUCTION

---

## 🚨 Emergency Procedures

### Critical Issue Detected?

1. **Assess Severity** (0-5 minutes)
   ```
   Is this a 5XX error? → ESCALATE IMMEDIATELY
   Is this a security issue? → ESCALATE IMMEDIATELY
   Is user data affected? → ESCALATE IMMEDIATELY
   Is service down? → ROLLBACK IMMEDIATELY
   ```

2. **Check Logs** (5 minutes)
   ```bash
   # Go to Railway dashboard
   # Look at last 100 log lines
   # Identify the error
   # Search for "error", "exception", "failed"
   ```

3. **Decide: Fix or Rollback** (5 minutes)
   ```
   If simple config issue → FIX (update env vars, redeploy)
   If code issue → ROLLBACK (revert commits)
   If data issue → ESCALATE (contact DBA)
   ```

4. **Execute Rollback** (if needed)
   ```bash
   # Revert the 3 fix commits
   git revert 5770024..HEAD
   git push origin main --force
   
   # Railway automatically redeployes
   # Wait 3-5 minutes for deployment
   ```

---

## 📊 Monitoring Dashboard

### Key Metrics to Watch (24 hours)

| Metric | Normal | Warning | Critical |
|--------|--------|---------|----------|
| Error Rate | <0.1% | 0.5% | >1% |
| Response Time (p95) | <100ms | 200ms | >500ms |
| Uptime | 100% | 99.5% | <99% |
| Memory | 45-65MB | 100MB | 200MB+ |
| CPU | <5% | 20% | 50%+ |

### Alert Thresholds
```
🟢 GREEN:   All metrics normal, no action needed
🟡 YELLOW:  Monitor closely, may need intervention
🔴 RED:     Critical issue, take immediate action
```

---

## 🔍 Verification Procedures

### Daily Verification (First 24 Hours)

**Every 6 hours, verify**:
```
□ Health endpoint: /api/health → 200 OK
□ Admin benefits: GET /api/admin/benefits (as admin) → 200 OK
□ User cards: POST /api/cards/add (as user) → 201 CREATED
□ Navigation: /admin/benefits → click back → /admin
□ Error logs: No 5XX errors
□ Database: Connected and responsive
```

### Weekly Verification

**Every Monday, run full test suite**:
```bash
npm run test

# Should pass all existing tests
# New tests not required (manual testing sufficient)
```

---

## 🐛 Troubleshooting Guide

### Scenario 1: 5XX Errors in Logs

**Diagnosis**:
1. Check last 50 log lines
2. Look for "error", "exception", "failed"
3. Identify which endpoint (benefits, cards/add, admin pages)

**Common Issues**:
```
Error: "Database connection failed"
→ Check DATABASE_URL in Railway
→ Verify database is running
→ Check network connectivity

Error: "JWT verification failed"
→ Check SESSION_SECRET in Railway
→ Verify session cookie format
→ Check token expiration logic

Error: "Cannot find route"
→ Check build completed successfully
→ Verify routes registered
→ Look for import errors
```

**Resolution**:
- If config issue: Update environment variable, redeploy
- If code issue: Rollback to previous version
- If database issue: Check database health

### Scenario 2: Slow Response Times (>500ms)

**Diagnosis**:
1. Check which endpoint is slow
2. Monitor database query times
3. Check for N+1 queries

**Common Issues**:
```
GET /api/admin/benefits slow
→ Check database indexes on:
   - masterBenefit(name)
   - masterBenefit(type)
   - masterBenefit(createdAt)
→ Check current page/limit parameters
→ Verify no search on large result set

POST /api/cards/add slow
→ Check masterBenefit query time
→ Verify batch creation is working
→ Check for database locks
```

**Resolution**:
- If index missing: Add database index (requires maintenance window)
- If query slow: Optimize query pattern
- If load too high: Scale up database or application

### Scenario 3: Authentication Errors (401/403)

**Diagnosis**:
1. Check SESSION_SECRET in Railway
2. Verify JWT signature validation logic
3. Check token expiration

**Common Issues**:
```
Error: 401 for valid user
→ SESSION_SECRET changed? Verify in Railway
→ Token expired? Check expiration logic
→ Cookie not sent? Check HTTPOnly flag

Error: 403 for admin
→ Check user role in database
→ Verify admin role assignment logic
→ Check verifyAdminRole() implementation
```

**Resolution**:
- If SESSION_SECRET wrong: Update in Railway, restart app
- If token expired: Have user login again
- If role wrong: Update user role in database

### Scenario 4: Database Connectivity Issues

**Diagnosis**:
1. Check DATABASE_URL in Railway
2. Verify PostgreSQL service status
3. Check network connectivity

**Common Issues**:
```
Error: "connect ECONNREFUSED"
→ Database not running
→ Wrong host/port in DATABASE_URL
→ Network firewall blocking connection

Error: "too many connections"
→ Connection pool exhausted
→ Long-running transactions not closing
→ Database max connections limit
```

**Resolution**:
- Restart database service (Railway dashboard)
- Check connection pool settings
- Terminate long-running queries
- Scale up database if load too high

---

## 📋 Daily Checklist

**Start of Day** (Every morning)
```
□ Check error logs: Last 24 hours
□ Verify uptime: 100%
□ Check response times: <100ms p95
□ Verify all endpoints responding
□ Check database health
□ Review alert notifications
□ No customer complaints?
```

**End of Day** (Every evening)
```
□ Document any incidents
□ Update monitoring dashboard
□ Verify backups completed
□ Check for pending updates
□ Review performance trends
□ Plan next day monitoring
```

---

## 🔐 Security Procedures

### Session Secret Rotation (Every 90 days)

```bash
# Step 1: Generate new secret
openssl rand -hex 32

# Step 2: Update in Railway dashboard
# Environment Variables → SESSION_SECRET → Paste new value

# Step 3: Redeploy application
# Railway auto-redeploys

# Step 4: Verify working
# Test login: should work
# Old sessions: will be invalidated (users must login again)

# Step 5: Document rotation
# Add to changelog: "Session secret rotated on YYYY-MM-DD"
```

### Database Credentials

**Never share via**:
- Email, Slack, Discord
- Github issues, pull requests
- Public URLs, logs

**Always use**:
- Railway dashboard environment variables
- Production database access only as needed
- Rotate credentials quarterly

---

## 📈 Performance Tuning

### Database Query Optimization

**If GET /api/admin/benefits is slow**:
```sql
-- Verify indexes exist
SELECT * FROM pg_indexes 
WHERE tablename = 'master_benefit';

-- Add missing indexes if needed
CREATE INDEX idx_master_benefit_name ON master_benefit(name);
CREATE INDEX idx_master_benefit_type ON master_benefit(type);
CREATE INDEX idx_master_benefit_created_at ON master_benefit(created_at);

-- Analyze table statistics
ANALYZE master_benefit;
```

### Connection Pool Tuning

**If database connections exhausted**:
```
Check current settings:
- Max connections: 100 (default)
- Idle timeout: 30 minutes
- Connection wait timeout: 5 seconds

Adjust in database config:
- Increase max connections (if needed)
- Decrease idle timeout
- Monitor connection usage
```

### Caching Strategy

**Current implementation**:
```
GET /api/admin/benefits:
  - No application cache (each request hits DB)
  - Consider adding Redis cache for heavy use
  - Cache TTL: 5 minutes recommended

POST /api/cards/add:
  - No cache needed (user action, must be current)
  - Database transaction ensures data consistency
```

---

## 🛠️ Manual Testing Procedures

### Test #1: Admin Benefits Endpoint

```bash
# 1. Get admin token (login as admin)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "password"}'

# 2. Extract session cookie from response

# 3. Test benefits endpoint
curl -X GET "http://localhost:3000/api/admin/benefits?page=1&limit=20" \
  -H "Cookie: session=YOUR_COOKIE"

# Expected response: 200 OK with benefits array and pagination metadata

# 4. Test search
curl -X GET "http://localhost:3000/api/admin/benefits?search=lounge" \
  -H "Cookie: session=YOUR_COOKIE"

# Expected: 200 OK with filtered results

# 5. Test unauthorized (no cookie)
curl -X GET "http://localhost:3000/api/admin/benefits"

# Expected: 401 UNAUTHORIZED
```

### Test #2: Back Navigation

```
1. Navigate to https://app.example.com/admin
2. Click on "Benefits"
3. Verify breadcrumb shows: "← Back to Admin / Benefits"
4. Click "← Back to Admin"
5. Verify navigated to /admin
6. Repeat for: Users, Cards, Audit
```

### Test #3: Card Addition

```bash
# 1. Get user token (login as regular user)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# 2. Get master card ID
curl -X GET "http://localhost:3000/api/cards/master" \
  -H "Cookie: session=YOUR_COOKIE"

# 3. Add card
curl -X POST http://localhost:3000/api/cards/add \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_COOKIE" \
  -d '{"masterCardId": "card-123"}'

# Expected: 201 CREATED with userCard object

# 4. Verify in user's collection
curl -X GET http://localhost:3000/api/cards/my-cards \
  -H "Cookie: session=YOUR_COOKIE"

# Expected: Card should appear in collection
```

---

## 📞 Escalation Procedures

### Level 1: Warning (Yellow Alert)

**Response Time**: 15 minutes  
**Action**:
1. Investigate logs
2. Identify issue
3. Determine if fix or monitor

**Examples**:
- Response time: 200ms (not critical, but watch)
- CPU: 20% (higher than normal, but acceptable)
- Memory: 100MB (higher than normal, but acceptable)

### Level 2: Critical (Red Alert)

**Response Time**: 5 minutes  
**Action**:
1. Check logs immediately
2. Determine if rollback needed
3. Execute rollback or fix

**Examples**:
- 5XX errors in logs
- Response time: >500ms
- Uptime: <99%
- Memory: >200MB
- CPU: >50%

### Level 3: Catastrophic (Black Alert)

**Response Time**: Immediate  
**Action**:
1. Escalate to senior engineer
2. Immediately assess rollback
3. Execute rollback without waiting
4. Post-mortem after stability

**Examples**:
- Service completely down
- Data corruption detected
- Security breach
- All requests failing
- Database inaccessible

---

## 📝 Incident Log Template

When an issue occurs, document it:

```
Incident Report
==============
Date: YYYY-MM-DD HH:MM UTC
Severity: [CRITICAL / HIGH / MEDIUM / LOW]
Duration: HH:MM

Issue Description:
[What happened, who noticed, when noticed]

Root Cause:
[Why it happened, which component]

Detection Method:
[How was it discovered, alert or manual]

Resolution:
[How was it fixed, steps taken]

Impact:
[How many users affected, data loss, downtime]

Prevention:
[How to prevent in future]

Lessons Learned:
[What we learned, improvements needed]

Owner: [Name]
Status: [RESOLVED / PENDING]
```

---

## 🔄 Deployment Cycle

### Weekly Deployment Schedule
- Monday: New feature deployments
- Wednesday: Hotfix deployments (if needed)
- Friday: Patch deployments (if needed)
- No deployments: Tuesday, Thursday, Saturday, Sunday

### Pre-Deployment Checklist
- [ ] Code review: APPROVED
- [ ] Tests: PASSING
- [ ] QA: SIGNED OFF
- [ ] Rollback plan: DOCUMENTED
- [ ] Team notified: YES
- [ ] Monitoring ready: YES

### Post-Deployment
- [ ] Monitor first 30 minutes continuously
- [ ] Monitor first 24 hours closely
- [ ] Daily check first week
- [ ] Weekly check first month

---

## 📚 Documentation References

- **QA Report**: `.github/specs/PRODUCTION-BUGS-QA-REPORT.md`
- **Deployment Summary**: `.github/specs/PRODUCTION-DEPLOYMENT-SUMMARY.md`
- **Verification Checklist**: `.github/specs/PRODUCTION-DEPLOYMENT-VERIFICATION-CHECKLIST.md`
- **Quick Reference**: `.github/specs/PRODUCTION-DEPLOYMENT-QUICK-REFERENCE.md`
- **API Spec**: `openapi.yaml`

---

## 🎯 Success Metrics

### 30-Day Goals (After Deployment)
```
□ Error rate: <0.1%
□ Response time p95: <100ms
□ Uptime: >99.9%
□ User satisfaction: >95%
□ No regressions: VERIFIED
□ Performance stable: CONFIRMED
```

---

## ✅ Sign-Off

**Runbook Created**: 2026-04-06  
**For Production Deployment**: Card-Benefits (3 Critical Fixes)  
**Reviewed By**: DevOps Engineer  
**Status**: ✅ APPROVED FOR OPERATIONS

**Next Review**: 2026-04-13 (1 week post-deployment)

---

**Remember**: When in doubt, check the logs and escalate immediately. We'd rather be safe than sorry!

