# OPERATIONS GUIDE - Production

**Card Benefits Tracker** | Production Operations Manual  
**Deployment Target**: Railway (https://card-benefits-production.up.railway.app)  
**Last Updated**: Phase 5 Deployment  

---

## 📋 TABLE OF CONTENTS

1. [Daily Operations](#daily-operations)
2. [Monitoring & Alerts](#monitoring--alerts)
3. [Scaling & Performance](#scaling--performance)
4. [Database Operations](#database-operations)
5. [Security & Compliance](#security--compliance)
6. [Incident Response](#incident-response)
7. [Regular Maintenance](#regular-maintenance)

---

## 📅 DAILY OPERATIONS

### Morning Checks (Start of Shift)

```bash
# 1. Check application status
# Railway Dashboard → Metrics tab
# Expected: Green health indicator

# 2. Review overnight logs
# Railway Dashboard → Logs
# Filter: Last 8 hours
# Look for: Errors, warnings, anomalies

# 3. Check key metrics
# - CPU usage: Should be <20% idle state
# - Memory: Should be <300MB
# - Error rate: Should be <1%
# - Response time (p95): Should be <2s

# 4. Verify database health
# Railway Dashboard → PostgreSQL → Metrics
# Check: CPU, connections, cache hit ratio

# 5. Test critical endpoints
curl https://card-benefits-production.up.railway.app/api/health
# Expected: 200 OK with "healthy" status

# 6. Check cron job execution (if configured)
# Look for: /api/cron/reset-benefits requests
# Expected: Once daily at scheduled time
```

### During Business Hours (Continuous)

- Monitor metrics every 30 minutes
- Watch for spikes in:
  - Error rate (>1%)
  - Response time (p95 >2s)
  - CPU usage (>50%)
  - Memory usage (>400MB)
- Respond to alerts immediately
- Track any user-reported issues

### End of Shift Check

```bash
# 1. Review all errors from the day
# Railway Logs → Filter: "ERROR"
# Document: Any patterns, recurring issues

# 2. Generate daily metrics report
# Take screenshots of:
# - Response time graph
# - Error rate graph
# - CPU/Memory usage
# - Request count

# 3. Document in daily log
# File: logs/daily-operations-[DATE].log
# Format: Date, time, action, status

# 4. Pass on any issues to next shift
# Method: Slack message or email
# Include: Issue description, impact, next steps
```

### Weekly Operations

```bash
# Monday: Deeper metrics analysis
# 1. Review peak usage times
# 2. Analyze error patterns
# 3. Check performance trends
# 4. Plan any scaling if needed

# Wednesday: Security review
# 1. Check for failed login attempts
# 2. Review API usage
# 3. Check for unusual patterns
# 4. Verify all endpoints are secured

# Friday: Planning & preparation
# 1. Review upcoming deployments
# 2. Plan any maintenance windows
# 3. Check for pending updates
# 4. Prepare rollback procedures
```

### Monthly Operations

```bash
# 1. Generate monthly report
#    - Uptime percentage
#    - Average response time
#    - Error rate
#    - User growth metrics

# 2. Review infrastructure capacity
#    - Current resource usage
#    - Growth trends
#    - Scaling needs for Q+1

# 3. Security audit
#    - Review access logs
#    - Rotate secrets (if policy requires)
#    - Update security documentation

# 4. Backup validation
#    - Test restore from backup
#    - Verify backup integrity
#    - Update backup procedures
```

---

## 📊 MONITORING & ALERTS

### Built-in Railway Monitoring

**Health Dashboard**:
```
Railway Dashboard → Metrics tab
├─ CPU Usage: Real-time CPU percentage
├─ Memory Usage: Real-time memory consumption
├─ Network I/O: Request/response traffic
├─ Disk I/O: Database read/write operations
└─ Requests/sec: Request throughput
```

**Health Check Status**:
```
Railway Dashboard → Deployments → Health Checks
├─ Status: Passing/Failing
├─ Last check: Timestamp
├─ Response time: ms
└─ Failure history: Last 3 failures
```

**Logs**:
```bash
# View all logs
Railway Dashboard → Logs

# Search logs
Filter: Text search (error, warning, etc.)
Date range: Select specific timeframe
Level: error, warn, info, debug

# Common searches
"DATABASE_POOL_EXHAUSTED" → Connection pool full
"TIMEOUT" → Request timeout
"ERROR" → Application errors
"AUTH_FAILED" → Authentication failures
```

### External Uptime Monitoring (Recommended)

Set up uptime monitoring for critical endpoint:

```bash
# Using UptimeRobot (free tier):
# 1. Go to https://uptimerobot.com
# 2. Add monitor
# 3. URL: https://card-benefits-production.up.railway.app/api/health
# 4. Check every: 5 minutes
# 5. Alert: Email + Slack
# 6. Threshold: 3 consecutive failures = alert
```

### Error Tracking (Sentry - Optional)

```bash
# If Sentry is enabled:
# Dashboard: https://sentry.io/organizations/[ORG]/

# Key metrics:
# - Error rate: Should be <1%
# - Error types: Group by type
# - Affected users: How many users affected
# - Resolved errors: Clean up old errors
```

### Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| CPU | >50% | >80% | Review load, scale up |
| Memory | >350MB | >450MB | Restart or scale up |
| Error Rate | >0.5% | >5% | Check logs, investigate |
| Response Time (p95) | >1.5s | >3s | Check database, scale up |
| Health Check | 1 failure | 3 failures | Auto-restart triggered |
| Disk Space | >80% | >95% | Database cleanup needed |

---

## 🚀 SCALING & PERFORMANCE

### Horizontal Scaling (Add More Instances)

```bash
# Current: 1 replica
# For higher traffic: 2-3 replicas

# In Railway Dashboard:
# 1. Go to project settings
# 2. Find "Num Replicas"
# 3. Change from 1 to 2 or 3
# 4. Changes apply on next deployment

# Load balancing: Railway auto-handles
```

### Vertical Scaling (Increase Resources)

```bash
# Current: Default Railway tier
# For CPU/memory intensive: Premium tier

# In Railway Dashboard:
# 1. Deployments tab
# 2. Current deployment → Settings
# 3. Increase RAM or CPU allocation
# 4. Restart or redeploy
```

### Database Optimization

**Connection Pooling**:
```
Prisma default: 10 connections
For high traffic: Increase via datasource config
Max recommended: 20 connections
```

**Query Optimization**:
```bash
# Find slow queries in logs
# Look for: "Query took >500ms"

# Optimize by:
# 1. Adding database indexes
# 2. Reducing N+1 queries
# 3. Caching frequently accessed data
```

**Replication & Backup**:
```bash
# Railway handles PostgreSQL backups
# Frequency: Daily
# Retention: 7 days
# Point-in-time recovery: Available
```

### Performance Tuning

**Cache Strategy**:
```
- Static assets: 1 year (immutable)
- API responses: 5 minutes (if safe)
- User data: No cache (always fresh)
```

**Database Indexes**:
```bash
# Current indexes: Configured in Prisma schema
# Monitor slow queries: Check PostgreSQL logs

# Add index if needed:
# 1. Identify slow query
# 2. Add @@index([field]) in Prisma schema
# 3. Run: npx prisma migrate dev
# 4. Deploy
```

---

## 💾 DATABASE OPERATIONS

### Regular Backups

```bash
# Railway auto-backups: Enabled
# Schedule: Daily
# Retention: 7 days
# Access: Railway Dashboard → PostgreSQL → Backups

# Manual backup (if needed):
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Size: Typically 10-50MB
# Storage: Secure location
```

### Database Maintenance

**Monthly Vacuum & Analyze**:
```bash
# Railway PostgreSQL handles automatically
# No manual action needed
# Frees up disk space and optimizes queries

# If you need to run manually:
# (only for advanced debugging)
psql $DATABASE_URL -c "VACUUM ANALYZE;"
```

**Monitoring Connections**:
```sql
-- Check current connections
SELECT count(*) as connections FROM pg_stat_activity;
-- Expected: <10 normally, <20 max

-- List active queries
SELECT pid, usename, application_name, state, query 
FROM pg_stat_activity 
WHERE state = 'active';

-- Check connection pool
-- Configured in Prisma: datasource block
```

### Data Integrity Checks

```bash
# Monthly: Verify data consistency
# Check user accounts
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"

# Check cards
psql $DATABASE_URL -c "SELECT COUNT(*) FROM user_cards;"

# Check no orphaned records
psql $DATABASE_URL << EOF
SELECT COUNT(*) FROM user_cards 
WHERE user_id NOT IN (SELECT id FROM users);
EOF
# Expected: 0 orphaned records
```

### Data Retention & Cleanup

```bash
# Soft delete policy: Status field used
# Hard delete: Never performed automatically

# To delete old data (if needed):
# 1. Backup first
# 2. Create migration
# 3. Delete with WHERE clause
# 4. Test on staging first
# 5. Apply to production during low traffic

# Current policy: Keep all historical data
# (no automatic cleanup)
```

---

## 🔒 SECURITY & COMPLIANCE

### Access Control

**Who has access**:
- Engineers: Full access to logs and metrics
- Operations: Limited to monitoring dashboard
- Product: View-only access to metrics
- Users: No backend access (application level only)

**How to manage**:
```bash
# Railway team members
# Dashboard: Team settings → Members
# Grant: Limited to specific roles
# Revoke: Remove immediately if staff changes
```

### Secret Rotation

**Current secrets**:
- SESSION_SECRET: Use for JWT signing
- CRON_SECRET: Use for cron endpoint authentication
- DATABASE_URL: Managed by Railway

**Rotation schedule**:
```
- Quarterly: SESSION_SECRET and CRON_SECRET
- Annually: Database credentials (if changed)
- Immediately: If compromised
```

**How to rotate SESSION_SECRET**:
```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -hex 32)

# 2. In Railway dashboard: Variables
# 3. Update SESSION_SECRET to $NEW_SECRET

# 4. Deploy (redeploy current version)
# 5. All existing sessions become invalid

# 6. Notify users: "Please log in again"
# 7. Expected impact: 5-10 minutes, all users affected
```

### Compliance & Auditing

**Data Access Logs**:
```bash
# All requests logged: Railway → Logs
# Retention: Railway retains for 7 days
# For longer retention: Export to external service

# Key info logged:
# - User ID (if authenticated)
# - Endpoint accessed
# - Request time
# - Response status
# - Client IP (anonymized)
```

**Audit Trail**:
```bash
# Database changes: Tracked via Prisma
# Migrations: Tracked in git
# Deployments: Tracked in Railway
# Environment changes: Tracked in Railway
```

**Compliance checklist**:
- [x] GDPR: User data encrypted in transit
- [x] WCAG 2.1 AA: Accessible to users with disabilities
- [x] OWASP Top 10: Protections in place
- [x] Terms of Service: Available publicly
- [x] Privacy Policy: Available publicly

---

## 🚨 INCIDENT RESPONSE

### Severity Levels

**Severity 1 - Critical**:
- App is completely down
- Users cannot access service
- Data loss is possible
- Response time: <5 minutes

**Severity 2 - High**:
- Core feature is broken
- Most users affected
- Workaround possible
- Response time: <15 minutes

**Severity 3 - Medium**:
- Feature is partially broken
- Some users affected
- Workaround available
- Response time: <1 hour

**Severity 4 - Low**:
- Minor feature issue
- Few users affected
- No workaround needed
- Response time: <24 hours

### Incident Response Procedure

```bash
# 1. DETECT (< 1 minute)
# Alert received: Slack/Email
# Acknowledge: Reply to alert or dashboard

# 2. ASSESS (< 5 minutes)
# Check: /api/health endpoint
# Review: Recent logs
# Verify: Is it real or false alarm?
# Decision: Severity level?

# 3. NOTIFY (< 5 minutes)
# Internal: Slack #incidents channel
# Users: Status page (if available)
# Leadership: Email if Severity 1

# 4. INVESTIGATE (< 15 minutes)
# Check: Application logs
# Check: Database status
# Check: External dependencies
# Hypothesis: What's the likely cause?

# 5. REMEDIATE (< 30 minutes)
# Option 1: Quick fix (if obvious)
# Option 2: Scale up resources
# Option 3: Restart application
# Option 4: Rollback deployment
# Execute: Implement chosen fix

# 6. VERIFY (< 45 minutes)
# Test: Health endpoint
# Test: Key features
# Confirm: Issue resolved
# Monitor: Watch for regression

# 7. COMMUNICATE
# Users: "Issue resolved, thank you for patience"
# Team: Post-incident summary
# Stakeholders: Brief on impact

# 8. ROOT CAUSE ANALYSIS (< 24 hours)
# Document: What happened?
# Why: Root cause analysis
# Prevent: How to prevent next time
# Action items: Assign owners
```

### Common Incident Scenarios

**Scenario 1: Application Crashed**
```bash
# 1. Check Railway dashboard: Is it restarting?
# 2. Check logs: Error messages?
# 3. If auto-restart working: Wait 2 minutes
# 4. If not: Manual restart
#    Deployments → Current → Restart
# 5. If still failing: Rollback
#    Deployments → Previous → Redeploy
```

**Scenario 2: Database Connection Lost**
```bash
# 1. Check: /api/health (should return 503)
# 2. Check: Railway PostgreSQL service status
# 3. If PostgreSQL down: Railway auto-restarts (wait 2-3 min)
# 4. If still failing: Check connection pool
# 5. Last resort: Restart application service
```

**Scenario 3: High Error Rate (>5%)**
```bash
# 1. Check: Recent logs for error pattern
# 2. Identify: What endpoint/feature is broken?
# 3. Cause: Bug in recent deploy? External service down?
# 4. If recent deploy: Rollback
# 5. If external: Fallback gracefully, notify users
```

**Scenario 4: Performance Degradation (p95 > 3s)**
```bash
# 1. Check: Database performance metrics
# 2. Check: CPU and memory usage
# 3. If CPU high: Identify slow query
# 4. Scale: Increase resources or reduce load
# 5. Optimize: Add indexes if needed (for future)
```

### Incident Reporting Template

```markdown
# Incident Report [DATE/TIME]

## Summary
[2-3 sentence description of what happened]

## Timeline
- HH:MM - Issue detected
- HH:MM - Investigation started
- HH:MM - Root cause identified
- HH:MM - Fix implemented
- HH:MM - Verified resolved

## Impact
- Affected users: [estimate]
- Duration: [minutes]
- Features affected: [list]
- Severity: [1-4]

## Root Cause
[Detailed explanation of why it happened]

## Resolution
[What was done to fix it]

## Prevention
[What will we do differently next time]

## Action Items
- [ ] Item 1 - Owner: [Name]
- [ ] Item 2 - Owner: [Name]
```

---

## 🔧 REGULAR MAINTENANCE

### Weekly Maintenance Tasks

```bash
# Monday (Start of week):
- [ ] Review uptime report
- [ ] Check security alerts
- [ ] Plan any deployments

# Wednesday (Mid-week):
- [ ] Database optimization check
- [ ] Performance analysis
- [ ] Backup validation

# Friday (End of week):
- [ ] Prepare release notes (if deploying)
- [ ] Document outstanding issues
- [ ] Plan for next week
```

### Monthly Maintenance Tasks

```bash
# 1. Update dependencies (if applicable)
npm audit
npm audit fix  # Only if safe

# 2. Review and optimize queries
# Identify slow queries from logs
# Add indexes if needed

# 3. Backup testing
# Verify you can restore from backup
# Document any issues

# 4. Security review
# Check for unauthorized access attempts
# Review audit logs
# Validate secret rotation

# 5. Capacity planning
# Review growth trends
# Plan for scaling

# 6. Documentation update
# Update this guide if procedures changed
# Update runbook with new incidents
```

### Quarterly Maintenance Tasks

```bash
# 1. Major version updates
# Check for Next.js, React, Prisma updates
# Test locally before deploying

# 2. Security audit
# Run: npm audit
# Verify: No critical vulnerabilities
# Update: Vulnerable packages

# 3. Performance benchmarking
# Establish new baseline metrics
# Compare against previous quarter
# Plan optimizations if needed

# 4. Infrastructure review
# Assess: Do we need more resources?
# Plan: Scaling for next quarter
# Cost: Review and optimize spending

# 5. Disaster recovery drill
# Test: Can we recover from data loss?
# Verify: Backup restore procedure works
# Document: Any issues found
```

### Annual Maintenance Tasks

```bash
# 1. Dependency refresh
# Update all major dependencies
# Test thoroughly before deploying

# 2. Security certification
# Verify: WCAG compliance still valid
# Check: Privacy policy compliance
# Audit: OWASP Top 10 protections

# 3. Architecture review
# Assess: Is current architecture still appropriate?
# Plan: Any refactoring needed?
# Document: Lessons learned from past year

# 4. Capacity planning
# Forecast: Growth for next year
# Plan: Infrastructure needs
# Budget: Cost projections
```

---

## 📞 SUPPORT & ESCALATION

### Support Contacts

| Role | Contact | Availability |
|------|---------|--------------|
| On-Call Engineer | [Slack #on-call] | 24/7 |
| Engineering Lead | [Email] | Business hours |
| DevOps Lead | [Email] | Business hours |
| Railway Support | support@railway.app | 24/7 |

### Escalation Path

```
User reports issue
    ↓
First responder (engineer on duty)
    ↓
Technical investigation (< 30 min)
    ↓
Sev 1? → Engineering lead + DevOps lead (parallel)
    ↓
Needs external help? → Railway support
    ↓
Still unresolved? → Executive escalation
```

---

## 📚 Quick Reference

### Useful Links
- Railway Dashboard: https://railway.app
- GitHub Repository: [repo URL]
- Deployment Guide: `PHASE5_DEPLOYMENT_GUIDE.md`
- Runbook: `RUNBOOK.md`
- Pre-Deployment Checklist: `PRE_DEPLOYMENT_CHECKLIST.md`

### Common Commands

```bash
# Check app health
curl https://card-benefits-production.up.railway.app/api/health

# View logs (requires Railway CLI)
railway logs

# Restart application
# Via dashboard: Deployments → Restart

# Deploy new version
git push origin main  # Auto-deploys

# Rollback
# Via dashboard: Deployments → Previous → Redeploy
```

---

**Operations Guide Complete** ✅

For day-to-day issues and procedures, refer to the **RUNBOOK.md**.
For deployment procedures, refer to the **PHASE5_DEPLOYMENT_GUIDE.md**.
