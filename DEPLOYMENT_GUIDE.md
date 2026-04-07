# Card-Benefits Production Deployment Guide

**Date:** April 7, 2026
**Target:** Railway Production Environment
**Database:** PostgreSQL on Railway (junction.proxy.rlwy.net)
**Application URL:** https://card-benefits.railway.app

---

## Pre-Deployment Checklist

### Code Changes
- [x] Schema corrections committed (fix: Correct schema references for Phase 2A models)
- [x] Production build verified and passing
- [x] All critical dependencies resolved
- [x] Code on main branch (commit 87d7e44)

### Database Migrations
- [x] 4 pending migrations identified
  - `20260403042633_add_import_export_tables`
  - `20260403062132_add_card_status_and_management_fields`
  - `20260403100000_add_admin_feature_phase1`
  - `20260403_add_value_history_tracking`

### Environment Setup
- [x] Railway PostgreSQL database verified
- [x] Connection string confirmed: `postgresql://postgres:...@junction.proxy.rlwy.net:57123/railway`
- [x] SESSION_SECRET configured in Railway environment
- [x] CRON_SECRET configured in Railway environment

### Health Checks
- [x] `/api/health` endpoint implemented and working
- [x] Database connectivity verified locally
- [x] Health check configured in railway.json (10s initial delay, 30s interval)

---

## Deployment Steps

### Step 1: Code Push to Repository

The code is already on the main branch. Verify the latest commit:

```bash
git log --oneline -3
# Should show: 87d7e44 fix: Correct schema references for Phase 2A models
```

### Step 2: Railway Deployment Trigger

Railway will automatically deploy when code is pushed to the main branch. The deployment process includes:

1. **Build Phase** (3-5 minutes)
   - Install dependencies: `npm ci`
   - Generate Prisma client: `prisma generate`
   - Build Next.js application: `npm run build`
   - Optimizations and artifact preparation

2. **Release Phase** (2-3 minutes)
   - Run release command: `prisma db push --skip-generate`
   - This applies all 4 pending migrations
   - Validates database schema synchronization

3. **Start Phase** (1-2 minutes)
   - Start application: `npm start`
   - Health check enabled
   - Initial delay: 10 seconds
   - Check interval: 30 seconds
   - Failure threshold: 3 failed checks

### Step 3: Post-Deployment Verification

Once deployment completes (approximately 10-15 minutes), verify:

#### 1. Application Health
```bash
curl https://card-benefits.railway.app/api/health
# Expected: 200 OK with JSON response
```

#### 2. Database Connectivity
The health endpoint will validate:
- PostgreSQL connection pool active
- Database schema migrated
- Tables created and indexed

#### 3. Authentication System
- Login page accessible: `/login`
- Signup page accessible: `/signup`
- Session management working

#### 4. Dashboard Functionality
- Dashboard loads: `/dashboard`
- Settings page accessible: `/dashboard/settings`
- User can access protected routes when authenticated

#### 5. API Endpoints
- Master cards endpoint: `/api/cards/master`
- User cards endpoint: `/api/cards/my-cards` (requires auth)
- Cron endpoint protected: `/api/cron/reset-benefits` (requires CRON_SECRET)

---

## Database Migration Details

### Migration 1: add_import_export_tables
- **Purpose:** Create import/export infrastructure
- **Tables:** ImportJob, ImportRecord, UserImportProfile
- **Duration:** ~30 seconds
- **Risk:** Low (new tables only)

### Migration 2: add_card_status_and_management_fields
- **Purpose:** Add card lifecycle management
- **Fields Added:**
  - status, statusChangedAt, statusChangedReason, statusChangedBy
  - archivedAt, archivedBy, archivedReason
  - version tracking
- **Duration:** ~30 seconds
- **Risk:** Low (adding columns with defaults)

### Migration 3: add_admin_feature_phase1
- **Purpose:** Admin audit logging and role management
- **Tables:** AdminAuditLog
- **Fields:** New role enum (USER, ADMIN, SUPER_ADMIN)
- **Duration:** ~30 seconds
- **Risk:** Low (new enum, new table, non-blocking fields)

### Migration 4: add_value_history_tracking
- **Purpose:** Track benefit value changes over time
- **Fields Added:** valueHistory (JSON string)
- **Duration:** ~30 seconds
- **Risk:** Low (optional field, defaults to null)

**Total Migration Time:** ~2-3 minutes
**Downtime:** Zero (Railway rolling updates with health checks)

---

## Rollback Procedure

If deployment fails or critical issues arise:

### Option 1: Automatic Rollback (Railway UI)
1. Go to Railway dashboard → Card-Benefits project
2. Click "Deployments" tab
3. Select previous successful deployment
4. Click "Rollback to this deployment"
5. Confirm and wait for health checks

**Estimated Time:** 2-3 minutes

### Option 2: Manual Rollback (Git)
```bash
# Identify last known good commit
git log --oneline | grep -E "Merge|fix:|feat:" | head -5

# Revert to previous commit
git revert HEAD
git push origin main

# Railway will auto-deploy the reverted code
```

**Estimated Time:** 5-10 minutes (including build)

### Option 3: Database Rollback
If only database migrations need reverting:

```bash
# Connect to Railway PostgreSQL
# Run rollback for specific migration
npx prisma migrate resolve --rolled-back 20260403_add_value_history_tracking
```

---

## Security Considerations

### Secrets Management
- All secrets stored in Railway environment variables
- No hardcoded credentials in source code
- SESSION_SECRET: Must be 256-bit (32 bytes)
- CRON_SECRET: Must be cryptographically secure

### Database Security
- PostgreSQL 15 with strong password
- Connection via SSL/TLS tunnel
- Automatic backups configured in Railway
- No direct SSH access needed

### API Security
- CORS properly configured
- CSRF tokens for form submissions
- Password reset tokens with expiration
- Session validation middleware

---

## Monitoring and Logging

### Railway Console
- Access at: https://railway.app/project/[PROJECT_ID]/logs
- Real-time logs for build, release, and runtime

### Application Health Dashboard
- Health endpoint: `/api/health`
- Returns uptime, database status, error rates

### Key Metrics to Monitor (First 24 Hours)
1. **Response Time:** Should be < 200ms (p95)
2. **Error Rate:** Should be < 0.1%
3. **Database Connections:** Should be stable (3-5 active)
4. **Memory Usage:** Should be stable around 200-300MB
5. **CPU Usage:** Should be < 50% during normal traffic

### Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| 502 Bad Gateway | App crash during startup | Check migration logs, verify DB connection |
| 503 Service Unavailable | Health checks failing | Wait for health checks to pass (up to 1.5 min) |
| Database connection refused | Migration issues | Rollback to previous deployment |
| Slow responses | Missing indexes | Check prisma/schema.prisma for missing @@index |
| Auth failures | Session secret mismatch | Verify SESSION_SECRET in Railway env vars |

---

## Post-Deployment Tasks

### Day 1 (Hours 0-24)
- [ ] Monitor application logs continuously
- [ ] Verify all user flows work (login, signup, dashboard)
- [ ] Test database migrations with sample data
- [ ] Check error rate and performance metrics
- [ ] Verify cron jobs trigger correctly

### Week 1
- [ ] Run performance tests
- [ ] Review error logs for patterns
- [ ] Test backup and restore procedures
- [ ] Verify email alerts (if configured)

### Week 4 (Optional)
- [ ] Run security audit
- [ ] Verify disaster recovery procedures
- [ ] Update documentation if needed

---

## Deployment Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Code build | 3-5 min | Automated |
| Database migrations | 2-3 min | Automated via release command |
| Application startup | 1-2 min | Automated |
| Health checks pass | 10-30 sec | Automated |
| **Total** | **~10-15 min** | ✅ **Ready** |

---

## Emergency Contacts & Resources

- **Railway Support:** https://railway.app/support
- **PostgreSQL Docs:** https://www.postgresql.org/docs/15/
- **Next.js Deployment:** https://nextjs.org/docs/deployment
- **Prisma Migration Docs:** https://www.prisma.io/docs/orm/prisma-migrate

---

## Deployment Confirmation

Once deployment completes, you should see:

```
✅ Code Build: PASSED
✅ Database Migrations: COMPLETED (4/4)
✅ Health Checks: PASSING
✅ Application Status: RUNNING
✅ SSL Certificate: VALID

Production URL: https://card-benefits.railway.app
Status: READY FOR PRODUCTION USE
```

---

**Deployment Date:** April 7, 2026
**Deployed By:** Claude (DevOps Agent)
**Last Updated:** 2026-04-07
**Next Review:** 2026-04-14
