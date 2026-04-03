# Railway MVP Deployment Checklist

## Pre-Deployment (Local)
- [ ] All critical issues fixed (health check, middleware, cron config)
- [ ] Build succeeds: `npm run build` completes without errors
- [ ] Type checking passes: `npm run type-check` shows 0 errors
- [ ] Tests pass: `npm run test:all` shows green results
- [ ] No hardcoded secrets in code: `grep -r "secret\|password" src/ | wc -l` = 0
- [ ] .env.local removed from git: `git log --all -- .env.local` shows nothing
- [ ] Environment variables documented: `.env.example` complete
- [ ] Database migrations valid: `npx prisma validate` passes
- [ ] Health check endpoint implemented: `curl http://localhost:3000/api/health`
- [ ] Graceful shutdown handler added: `process.on('SIGTERM', ...)`

## Railway Project Setup
- [ ] Railway account created (https://railway.app)
- [ ] New project created
- [ ] GitHub repository linked
- [ ] PostgreSQL service added
- [ ] railway.json committed to repository
- [ ] .env.local removed from git

## Environment Configuration (Railway Dashboard)
- [ ] SESSION_SECRET set (generated: `openssl rand -hex 32`)
- [ ] CRON_SECRET set (generated: `openssl rand -hex 32`)
- [ ] NODE_ENV set to "production"
- [ ] DATABASE_URL auto-provided by PostgreSQL plugin
- [ ] LOG_LEVEL set to "info" (optional but recommended)
- [ ] REDIS_URL set if using Redis (optional)
- [ ] All other required vars from .env.example set

## First Deployment
- [ ] Verified "Deploy from GitHub" is enabled
- [ ] Selected main branch for automatic deploys
- [ ] Initial deploy triggered
- [ ] Deployment logs show no errors
- [ ] Build completed successfully
- [ ] Application started successfully
- [ ] Previous deploy still running (for zero-downtime switch)

## Post-Deployment Verification
- [ ] Health check endpoint responds: `curl https://your-app.railway.app/api/health`
- [ ] Application is accessible: `curl https://your-app.railway.app`
- [ ] Database connection working: Health check shows `"database": "connected"`
- [ ] Sign up page loads without errors
- [ ] Login page functions (test with wrong credentials)
- [ ] Create user flow works end-to-end
- [ ] File upload works (try CSV/XLSX)
- [ ] Cron job triggered successfully (check logs)
- [ ] No 500 errors in logs
- [ ] CPU usage stable (<50%)
- [ ] Memory usage stable (<75%)
- [ ] Error rate minimal (<0.1%)

## Monitoring Setup
- [ ] Sentry (or similar) configured for error tracking
- [ ] Railway logs dashboard accessible
- [ ] Uptime monitoring configured (optional)
- [ ] Alert for 500 errors enabled
- [ ] Alert for high latency configured
- [ ] Database backup enabled (Railway auto-backups)
- [ ] Backup retention set to 7+ days

## Cron Job Configuration
- [ ] Cron endpoint verified working: Manual curl test successful
- [ ] External scheduler configured (Easycron, AWS EventBridge, etc.)
  - Schedule: Daily at 00:00 UTC (or preferred time)
  - Endpoint: https://your-app.railway.app/api/cron/reset-benefits
  - Method: GET
  - Auth Header: Authorization: Bearer [CRON_SECRET]
- [ ] Cron job ran at least once successfully
- [ ] Benefits reset in database: `SELECT * FROM "UserBenefit" WHERE "isUsed" = false` shows results
- [ ] Cron failure alerts configured

## Security Verification
- [ ] No .env.local in git history: `git log --all --full-history -- .env.local` = empty
- [ ] Secrets rotation documented
- [ ] HTTPS enforced (Railway default)
- [ ] Security headers present: Check browser DevTools Network tab
  - X-Content-Type-Options
  - X-Frame-Options
  - Strict-Transport-Security
- [ ] CORS configured correctly
- [ ] Rate limiting working: Test with multiple requests
- [ ] SQL injection protection: Prisma parameterized queries only
- [ ] XSS protection: React escape + CSP headers
- [ ] CSRF protection: SameSite cookies set

## Performance Verification
- [ ] Pages load in <3 seconds
- [ ] API responses <500ms average
- [ ] No N+1 query issues
- [ ] Database queries optimized
- [ ] Static assets cached (Next.js default)
- [ ] Gzip compression enabled (Next.js default)

## Data & Backup Verification
- [ ] Database has production data (or seed data)
- [ ] Migrations applied: `\d` shows all tables in psql
- [ ] Indexes created: `SELECT * FROM pg_indexes;` shows strategic indexes
- [ ] Backup created successfully (Railway auto-backup)
- [ ] Backup restoration tested (in separate database)
- [ ] Data retention policy documented

## Failover & Recovery Testing
- [ ] Kill one app instance (Railway dashboard): App still responds
- [ ] Restart app (Railway dashboard): Comes back online
- [ ] Database connection lost: Health check returns 503
- [ ] Database recovered: Health check returns 200 again
- [ ] Cron fails once: Retries successfully next time
- [ ] Deployment rollback procedure tested

## Team & Documentation
- [ ] Deployment guide shared with team
- [ ] Rollback procedures documented
- [ ] Monitoring dashboard shared with team
- [ ] Alert escalation path defined
- [ ] On-call rotation established (if applicable)
- [ ] Post-mortem process defined for incidents
- [ ] Regular backup testing scheduled

## Day 1 Post-Launch Monitoring (Critical!)
- [ ] Monitor error logs every 30 minutes
- [ ] Check cron job ran at scheduled time
- [ ] Verify no database connection exhaustion
- [ ] Monitor for any unexpected patterns
- [ ] Have rollback plan ready
- [ ] Have team on standby for first 24 hours

## Sign-Off
- **Deployment Date:** ___________
- **Deployed By:** ___________
- **Reviewed By:** ___________
- **Team Lead Approval:** ___________

---

## Rollback Procedure (If Critical Issue)

If critical issue found within first hour:

1. **Via Railway Dashboard (Preferred)**
   ```
   Deployments tab → Find previous deployment → Click "Rollback"
   ```

2. **Via Git Revert**
   ```bash
   git revert HEAD
   git push origin main
   # Railway auto-deploys and reverts code
   # Note: Database changes NOT rolled back automatically
   ```

3. **Scale Down to Investigate**
   ```
   Settings → Replicas → Set to 0
   Investigate logs and database
   Fix issue
   Set Replicas back to 2+
   ```

---

## Post-Launch Incident Response

### If 500 Errors Spike
1. Check logs in Railway dashboard
2. Check database connection status (health check)
3. Check error tracking (Sentry) for patterns
4. If database issue: Restart single replica first
5. If code issue: Rollback to previous deployment
6. Notify team and initiate incident response

### If Cron Jobs Fail
1. Check cron logs: `curl -v https://your-app.railway.app/api/cron/reset-benefits -H "Authorization: Bearer $CRON_SECRET"`
2. Check database locks: `SELECT * FROM pg_locks WHERE NOT granted;`
3. Check if benefits need manual reset: `SELECT COUNT(*) FROM "UserBenefit" WHERE "expirationDate" <= now() AND "isUsed" = true;`
4. If locked: Kill blocking queries: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE query LIKE '%benefit%';`
5. Manually trigger cron: See step 1

### If Database Connection Issues
1. Check Railway PostgreSQL status
2. Check connection pool: Should be <20 connections normally
3. If >50 connections: May need connection pooling fix
4. Kill idle connections: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle';`
5. Scale down to 1 replica to reduce connection count
6. Investigate root cause (N+1 queries, missing indexes, etc.)

---

**Version 1.0**  
**Last Updated: 2025-01-15**  
**Maintained By: DevOps Team**
