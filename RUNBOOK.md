# RUNBOOK - Operational Procedures

**Card Benefits Tracker** | Production Runbook  
**Target**: Railway (https://card-benefits-production.up.railway.app)  
**For**: On-call engineers and operations staff  

Quick reference for common operational tasks. For detailed information, see `OPERATIONS_GUIDE.md`.

---

## 🆘 CRITICAL ALERTS - RESPOND NOW

### "Application Down" Alert

```bash
PRIORITY: CRITICAL (Sev 1)
TIME_LIMIT: 5 minutes to respond

STEPS:
1. Open Railway dashboard: https://railway.app
2. Check Metrics tab → Is app running?
3. Check Logs → Errors in last 5 minutes?

IF CRASHED:
→ Click Deployments → Restart
→ Wait 1-2 minutes for restart
→ Verify: /api/health returns 200

IF STILL DOWN:
→ Check PostgreSQL service status
→ If PostgreSQL down: Railway auto-restarts (wait 3 min)
→ If still down: Rollback previous deployment
   Deployments → Find last green one → Redeploy

IF ALL ELSE FAILS:
→ Contact Railway support: support@railway.app
→ Open incident: #incidents Slack channel
→ Notify stakeholders: Status page (if available)
```

### "High Error Rate" Alert (>5%)

```bash
PRIORITY: HIGH (Sev 2)
TIME_LIMIT: 15 minutes to respond

STEPS:
1. Check what error:
   Dashboard → Logs → Filter "ERROR" (last 30 min)

2. Check if recent deployment:
   Deployments tab → When did latest deploy?
   
IF RECENT DEPLOY (< 30 min ago):
→ Rollback immediately
→ Deployments → Previous version → Redeploy
→ Verify error rate drops

IF NO RECENT DEPLOY:
→ Identify error pattern
→ Is it a specific endpoint? (e.g., /api/cards/*)
→ Is it a specific user? (e.g., one user affected)
→ Is it database? (e.g., "Connection pool exhausted")

→ If database: Check PostgreSQL metrics
   PostgreSQL service → Metrics → Connections
   
→ If specific endpoint broken: Investigate code
   Check recent changes in that file
   
→ If widespread: May need to scale up
   Settings → Increase RAM or add replicas
```

### "Application Slow" Alert (p95 > 3s)

```bash
PRIORITY: HIGH (Sev 2)
TIME_LIMIT: 30 minutes to respond

STEPS:
1. Check metrics:
   Dashboard → Metrics → Response time graph
   
2. Check load:
   Metrics → CPU and Memory usage
   
IF CPU/MEMORY MAXED OUT:
→ Option 1 (Immediate): Restart application
   Deployments → Restart
   
→ Option 2 (Better): Scale up
   Settings → Increase RAM from default to +50%
   Redeploy

→ Option 3 (Long-term): Optimize code
   Identify slow queries from logs
   Add database indexes
   Deploy optimization

3. Monitor response time
   Should return to <2s within 5 minutes
```

---

## 📋 COMMON OPERATIONAL TASKS

### Deploy New Code (or Rollback)

```bash
# DEPLOY (Auto - just push to main)
git commit -m "Feature: [description]"
git push origin main
→ Railway automatically builds and deploys
→ Watch: Dashboard → Deployments (real-time logs)
→ Verify: /api/health returns 200 within 2 min

# ROLLBACK (If something went wrong)
→ Dashboard → Deployments tab
→ Find last working deployment (green checkmark)
→ Click three dots (...) → "Redeploy"
→ Confirm → Watch logs
→ Verify health after 1-2 minutes

# FORCE REDEPLOY (Current code, no changes)
→ Dashboard → Deployments
→ Click latest deployment → three dots → "Redeploy"
→ Useful for: Env var changes, cache clear
```

### Restart Application

```bash
# Gentle restart (recommended)
→ Dashboard → Deployments
→ Click current deployment → "Restart" button
→ Wait 2-3 minutes for restart
→ Verify: /api/health returns 200

# Why restart?
- Clear in-memory caches
- Reload environment variables
- Reset connection pools
- Usually fixes transient issues
```

### Check Application Logs

```bash
# Via Railway Dashboard (Easiest)
→ Project → Logs tab
→ See all console output in real-time
→ Filter by: Date, text search

# Filter for errors
→ Logs → Search: "ERROR"
→ Shows all error messages
→ Click to see full context

# Filter for specific endpoint
→ Logs → Search: "/api/health"
→ Shows all requests to that endpoint

# Filter by time
→ Logs → Date picker → Select date range
→ Select "Last hour", "Last 24 hours", etc.
```

### Update Environment Variable

```bash
# When to update:
- Security secret rotation
- Configuration changes
- Feature flag toggles

STEPS:
1. Dashboard → Variables tab
2. Find variable to update
3. Click edit → New value
4. Save
5. Redeploy for changes to take effect:
   Deployments → Current → Redeploy
   
CRITICAL VARS (require redeploy):
- SESSION_SECRET
- CRON_SECRET
- NODE_ENV
- DATABASE_URL

NON-CRITICAL VARS:
- LOG_LEVEL (takes effect on restart)
```

### Database Backup Check

```bash
# Check existing backups
→ PostgreSQL service → Backups tab
→ See: Last backup time, backup list
→ Railway auto-backups: Daily

# Restore from backup (if needed)
→ Contact Railway support: support@railway.app
→ Or: Use pg_restore if you have dump file

# Manual backup (if needed)
export DATABASE_URL="<from-railway>"
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
→ Saves database snapshot to file
→ Store securely (contains data)
```

### Check Database Health

```bash
# Via Application Health Endpoint
curl https://card-benefits-production.up.railway.app/api/health

Expected response (200 OK):
{
  "status": "healthy",
  "database": "connected",
  "responseTime": "45ms"
}

If "database": "disconnected":
→ Check PostgreSQL service status
→ Check DATABASE_URL is correct
→ Check database connection pool

# Via PostgreSQL Dashboard
→ PostgreSQL service → Metrics tab
→ Check: CPU, connections, cache hit ratio
```

### Monitor Resource Usage

```bash
# CPU Usage
→ Dashboard → Metrics → CPU
→ Normal: <20% at idle
→ Warning: >50%
→ Critical: >80%

Action if high:
→ Check what's using CPU
→ Scale up or restart
→ Identify and optimize slow code

# Memory Usage
→ Dashboard → Metrics → Memory
→ Normal: 100-250MB
→ Warning: >350MB
→ Critical: >450MB

Action if high:
→ Restart application (clears caches)
→ Check for memory leaks
→ Scale up resources

# Disk Usage
→ PostgreSQL → Metrics
→ Normal: <50% of available
→ Warning: >80%
→ Critical: >95%

Action if high:
→ Check database size
→ Archive old data if possible
→ Increase disk size
```

---

## 🔍 TROUBLESHOOTING QUICK REFERENCE

### "502 Bad Gateway" Error

```bash
# User sees: "Bad Gateway" page
# Cause: Application crashed or not responding

DIAGNOSE:
curl https://card-benefits-production.up.railway.app/api/health
→ If timeout or error: App is down

REMEDY:
1. Restart: Deployments → Restart
2. Wait 2-3 minutes
3. Test again: /api/health
4. If still failing: Rollback latest deployment

PREVENT:
→ Monitor error rate (should be <1%)
→ Review logs before deploying
→ Test locally first
```

### "500 Internal Server Error"

```bash
# User sees: "Internal Server Error" page
# Cause: Application code error

DIAGNOSE:
1. Check logs for ERROR messages
2. Identify which endpoint/feature
3. Look for stack trace

REMEDY:
Option 1: Quick fix if code issue
→ Fix the bug
→ Commit and push to main
→ Railway auto-deploys

Option 2: Rollback if breaking change
→ Deployments → Previous → Redeploy
→ Investigate issue in staging first
→ Redeploy fix once ready

PREVENT:
→ Run tests locally before pushing
→ Use staging environment for testing
→ Implement error tracking (Sentry)
```

### "Connection Timeout" Error

```bash
# User sees: Request hangs, then times out
# Cause: Database slow or overloaded

DIAGNOSE:
1. Check database metrics
2. Check CPU/memory usage
3. Check recent query logs

REMEDY:
→ Restart database connection pool
  Deployments → Restart application
  
→ If database overloaded:
  Scale up PostgreSQL resources
  Or: Add more app replicas to reduce load
  
→ If specific query slow:
  Add database index
  Optimize query logic

PREVENT:
→ Monitor query performance
→ Add indexes on frequently searched fields
→ Use connection pooling (Prisma does this)
→ Implement caching for read-heavy operations
```

### "Authentication Failed" (Users can't login)

```bash
# User sees: "Invalid credentials" or "Login failed"
# Cause: Auth service issue or configuration

DIAGNOSE:
1. Test login with known good credentials
2. Check auth logs: Logs → Filter "auth" or "login"
3. Check SESSION_SECRET is set: Variables tab

REMEDY:
→ If SESSION_SECRET missing:
  Variables → Add SESSION_SECRET
  Redeploy
  
→ If password hash issue:
  Check database: Is user in database?
  Verify argon2 configuration
  
→ If session issue:
  Clear browser cookies
  Restart application: Deployments → Restart
  Try login again

PREVENT:
→ Monitor login failure rate
→ Keep auth dependencies updated (argon2, JWT)
→ Regular security audits
```

### "Database Connection Pool Exhausted"

```bash
# Error in logs: "Connection pool exhausted"
# Cause: Too many simultaneous queries

DIAGNOSE:
1. Check active connections:
   SELECT count(*) FROM pg_stat_activity;
2. Check request rate (Metrics tab)
3. Look for N+1 query patterns

REMEDY:
→ Increase connection pool size
  Prisma datasource → connection_limit: 20
  Requires new deployment
  
→ Scale up application
  More replicas = spread load
  
→ Add response caching
  Reduce database queries

PREVENT:
→ Profile database queries
→ Implement query caching
→ Use Prisma efficiently (avoid N+1)
→ Monitor pool usage over time
```

### "Out of Memory" Crash

```bash
# App crashes with OOM error
# Cause: Memory leak or insufficient resources

DIAGNOSE:
1. Check Metrics → Memory graph
2. See if memory grows over time
3. Check logs for pattern

REMEDY:
→ Immediate: Restart application
  Deployments → Restart
  Clears in-memory caches
  
→ Temporary: Scale up RAM
  Settings → Increase from 512MB to 1GB
  
→ Long-term: Find and fix leak
  Profile application
  Look for: Unbounded arrays, circular refs
  
PREVENT:
→ Monitor memory usage
→ Regular restarts (daily if needed)
→ Code review for memory leaks
→ Test under load before deploying
```

---

## 🔐 SECURITY RUNBOOK

### Suspected Security Breach

```bash
PRIORITY: CRITICAL
TIME_LIMIT: Immediate

STEPS:
1. Isolate: Stop accepting new requests (if possible)
   Settings → Maintenance mode (if available)
   
2. Notify: Contact security team immediately
   Slack: #security (urgent)
   Email: security-team@[company]
   
3. Investigate:
   Check logs for: Unauthorized access, data exfiltration
   Review recent deployments
   Check environment variables (were they exposed?)
   
4. Remediate:
   If secret exposed: Rotate immediately
   If code compromised: Rollback
   If database breached: Restore backup
   
5. Communicate:
   Notify affected users
   Post status update
   Legal/compliance review if data exposed
```

### Suspicious Login Activity

```bash
PRIORITY: HIGH
TIME_LIMIT: 1 hour

STEPS:
1. Check logs:
   Logs → Filter "auth failed"
   Look for: Repeated failed attempts from same IP
   
2. Investigate:
   Is it a bot? (Check user agent)
   Is it legitimate user? (Check IP reputation)
   
3. Remediate:
   If bot: Implement rate limiting
   If legitimate: Alert user and check password
   
4. Prevent:
   Monitor failed login attempts
   Implement CAPTCHA if needed
   Consider: 2FA for sensitive accounts
```

### Secret Rotation

```bash
ROUTINE: Quarterly (or immediately if suspected leak)

STEPS:
1. Generate new secrets:
   SESSION_SECRET=$(openssl rand -hex 32)
   CRON_SECRET=$(openssl rand -hex 32)
   
2. Update in Railway:
   Dashboard → Variables
   Update: SESSION_SECRET
   Update: CRON_SECRET
   
3. Redeploy:
   Deployments → Current → Redeploy
   
4. Notify users:
   Post message: "Please log in again for security"
   Expected: 5-10 minute disruption
   
5. Verify:
   Check: All users can log back in
   Monitor: Error rate should return to normal
   
IMPACT:
→ All active sessions become invalid
→ All users must log in again
→ Do this during low-traffic hours if possible
```

---

## 📞 ESCALATION GUIDE

### When to Escalate

**Escalate to Engineering Lead if**:
- Can't identify root cause after 15 minutes
- Sev 1 (app down) lasts >10 minutes
- Need to revert recent deployment
- Need code changes to fix

**Escalate to DevOps Lead if**:
- Database issues
- Infrastructure/scaling issues
- Need Railway support involvement
- Multiple components failing

**Escalate to Executive if**:
- Sev 1 lasting >30 minutes
- Data breach or security incident
- Significant user impact (>50% of users)
- Multiple critical systems down

### Contact Information

```
On-Call Engineer: [Slack #on-call or page via PagerDuty]
Engineering Lead: [Email + Slack]
DevOps Lead: [Email + Slack]
Security Team: [Slack #security]
Railway Support: support@railway.app
```

---

## ✅ DAILY CHECKLIST

**Start of shift**:
- [ ] Check app health: `/api/health`
- [ ] Review overnight logs
- [ ] Check critical metrics (CPU, memory, error rate)
- [ ] Review any open incidents from previous shift

**During shift**:
- [ ] Monitor metrics every 30 minutes
- [ ] Watch for alerts
- [ ] Respond to any issues immediately
- [ ] Document actions in incident log

**End of shift**:
- [ ] Summarize any issues encountered
- [ ] Pass off to next shift
- [ ] Update runbook if new issues discovered

---

## 📚 QUICK LINKS

| Task | Link |
|------|------|
| Railway Dashboard | https://railway.app |
| Application Health | https://card-benefits-production.up.railway.app/api/health |
| Full Operations Guide | See `OPERATIONS_GUIDE.md` |
| Deployment Guide | See `PHASE5_DEPLOYMENT_GUIDE.md` |
| Status Page | [Add link if available] |

---

**Runbook Version**: 1.0  
**Last Updated**: Phase 5 Deployment  
**Next Review**: After first production incident  

For detailed procedures, see `OPERATIONS_GUIDE.md`
