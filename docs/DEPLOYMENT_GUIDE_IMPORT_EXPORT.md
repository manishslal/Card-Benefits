# Import/Export Feature - Deployment Guide

**Deployment Target:** Production Environment  
**Estimated Duration:** 30-45 minutes  
**Downtime:** <1 minute (database migration lock)  
**Created:** April 3, 2024  

---

## ✅ Pre-Deployment Checklist

Complete this checklist 2 hours before deployment window:

### 1. Verify Code & Tests
- [ ] All 4 QA critical issues fixed and merged
- [ ] All tests passing: `npm run test:all`
- [ ] Code coverage >80%: `npm run test:coverage`
- [ ] Type checking passes: `npm run type-check`
- [ ] Linting passes: `npm run lint`
- [ ] Build succeeds: `npm run build`

### 2. Verify Database
- [ ] Database backups created and verified
- [ ] Migration tested in staging environment
- [ ] Connection pool settings reviewed
- [ ] Transaction timeout values confirmed
- [ ] Rollback procedure tested

### 3. Verify Monitoring
- [ ] All dashboards loading data
- [ ] Alert rules tested with test events
- [ ] PagerDuty integration verified
- [ ] Log aggregation working
- [ ] Metrics pipeline operational

### 4. Verify Team & Communication
- [ ] On-call engineer notified
- [ ] QA team available for quick testing
- [ ] Tech lead ready for sign-off
- [ ] Customer support prepared with FAQs
- [ ] Status page message drafted

### 5. Verify Environment
- [ ] Production database healthy
- [ ] Disk space available for imports (>1GB)
- [ ] API server responsive
- [ ] All dependent services healthy

---

## 🚀 Deployment Sequence

### Step 1: Pre-Deployment Backup (5 minutes)

**Timeline:** 15:50 - 15:55 UTC (if deploying at 16:00)

```bash
# SSH to production server
ssh deploy@card-benefits-prod.example.com

# Navigate to application directory
cd /var/www/card-benefits

# Create database backup
DATE=$(date +%Y%m%d-%H%M%S)
sqlite3 data/cards.db ".backup 'backups/cards-backup-${DATE}.db'"
# OR for MySQL:
# mysqldump -u cardbenefits -p cardbenefits > backups/cardbenefits-backup-${DATE}.sql

# Verify backup created
ls -lh backups/cards-backup-${DATE}.db
# Should show ~5-50MB file (size varies)

# Keep backup path for rollback: BACKUP_PATH=backups/cards-backup-${DATE}.db
```

### Step 2: Pull Latest Code (3 minutes)

```bash
# Verify clean working directory
git status
# Should show: "On branch main, nothing to commit"

# Fetch latest commits
git fetch origin

# Checkout release tag
git checkout v1.2.0
# Should print: "HEAD is now at <commit-hash> Release: Import/Export Feature"

# Verify correct version
git log --oneline -1
# Should show: "Release: Import/Export Feature"
```

### Step 3: Install Dependencies (5 minutes)

```bash
# Clean install (ensures consistency)
npm ci
# Should complete successfully with no errors

# Generate Prisma client (necessary for migrations)
npm run db:generate
# Should print: "✔ Generated Prisma Client"

# Verify no peer dependency issues
npm ls --depth=0
# Should show no "unmet dependencies" warnings
```

### Step 4: Run Database Migration (2 minutes)

**⚠️ CRITICAL: This is where downtime occurs**

```bash
# Run migration (creates new tables)
npm run prisma:migrate
# If prompted "Do you want to create it now?", answer: yes

# Migration creates:
# ✓ ImportJob table
# ✓ ImportRecord table  
# ✓ UserImportProfile table
# ✓ 30 indexes for performance

# Verify migration succeeded
npx prisma studio
# Open http://localhost:5555 in browser
# Check tables exist:
# - ImportJob (should be empty)
# - ImportRecord (should be empty)
# - UserImportProfile (should be empty)

# If migration failed, rollback immediately (see Rollback section)
```

### Step 5: Build Application (8 minutes)

```bash
# Build Next.js application
npm run build

# Output should include:
# ✓ Compiled client and server successfully
# ✓ Created optimized production build
# ✓ Analyzing bundles
# ✓ No warnings about bundle size

# Verify no build errors
echo $?  # Should print 0 (success)

# If build failed, diagnose:
# - Check TypeScript errors: npm run type-check
# - Check lint issues: npm run lint
# - Review build logs for specific failures
```

### Step 6: Verify Configuration (2 minutes)

```bash
# Check environment variables are set
env | grep IMPORT
# Should show:
# IMPORT_MAX_FILE_SIZE_MB=50
# IMPORT_MAX_ROWS=10000
# IMPORT_PARSE_TIMEOUT_MS=60000
# IMPORT_VALIDATE_TIMEOUT_MS=120000
# IMPORT_COMMIT_TIMEOUT_MS=300000

# Check feature flags
env | grep FEATURE_FLAG_IMPORT
# Should show:
# FEATURE_FLAG_IMPORT_ENABLED=true
# FEATURE_FLAG_EXPORT_ENABLED=true

# If missing, set them now:
# export IMPORT_MAX_FILE_SIZE_MB=50
# etc.

# Verify database connection
node -e "const prisma = require('@prisma/client'); new prisma.PrismaClient().\$disconnect()"
# Should complete without error
```

### Step 7: Deploy Application (5 minutes)

**Choose deployment method based on your infrastructure:**

#### Option A: Systemd Service
```bash
# Restart service with zero downtime
sudo systemctl restart card-benefits

# Verify service is running
sudo systemctl status card-benefits
# Should show: "active (running)"

# Check service logs for errors
sudo journalctl -u card-benefits -n 20 --no-pager
# Should show: "Server started on port 3000"
```

#### Option B: Docker Container
```bash
# Build and push container
docker build -t card-benefits:v1.2.0 .
docker tag card-benefits:v1.2.0 registry.example.com/card-benefits:v1.2.0
docker push registry.example.com/card-benefits:v1.2.0

# Update service with rolling restart (zero downtime)
docker service update --image registry.example.com/card-benefits:v1.2.0 card-benefits

# Verify rolling update in progress
docker service ps card-benefits
# Should show new task with Running status while old ones shut down

# Wait for all tasks to be running
# Usually completes within 1-2 minutes
```

#### Option C: PM2 Process Manager
```bash
# Update application code
git checkout v1.2.0

# Reload with zero downtime
pm2 reload card-benefits

# Verify reload successful
pm2 status
# Should show: card-benefits - 'online'

# Check logs
pm2 logs card-benefits --lines 20
# Should show no error messages
```

### Step 8: Health Checks (3 minutes)

Run these checks immediately after deployment:

```bash
# 1. Application responding
curl -s https://api.card-benefits.com/health | jq .
# Expected: {"status": "ok"}

# 2. Database connection working
curl -s https://api.card-benefits.com/api/health/db | jq .
# Expected: {"status": "connected", "latency": 5}

# 3. Import endpoint available
curl -s -X OPTIONS https://api.card-benefits.com/api/import/upload
# Expected: 200 OK with Allow header

# 4. Check application logs
tail -f logs/app.log
# Should show: "INFO: Import/Export module loaded"
# Should NOT show: ERROR or WARNING messages

# 5. Verify feature is enabled
curl -s https://api.card-benefits.com/api/features | jq '.features | select(.import == true)'
# Expected: {"import": true, "export": true}

# 6. Test import wizard (manual via UI)
# - Navigate to dashboard
# - Click "Import Cards" button
# - Verify upload form appears
# - Verify "Choose File" button works
# - Verify file size limit shown correctly
```

### Step 9: Monitor for Errors (5 minutes)

```bash
# Watch error logs in real-time
tail -f logs/error.log

# Check monitoring dashboard
open https://monitoring.card-benefits.com/dashboards/import-export

# Verify metrics appearing
# Should see:
# ✓ Import job counter: 0
# ✓ API response time: <500ms
# ✓ Error rate: 0%
# ✓ Database connections: 2-5 active

# Check for any alerts triggered
open https://pagerduty.com/incidents

# Should see: No new incidents

# Review application metrics
curl -s https://api.card-benefits.com/metrics | grep import
# Should show metrics like:
# import_jobs_total{status="success"} 0
# import_parser_duration_ms 0
```

---

## ⏱️ Rollback Procedure

**Execute immediately if critical errors detected**

### Rollback Step 1: Stop New Imports (30 seconds)

```bash
# Disable feature flags to prevent new imports
export FEATURE_FLAG_IMPORT_ENABLED=false
export FEATURE_FLAG_EXPORT_ENABLED=false

# Restart application to apply flags
sudo systemctl restart card-benefits
# OR
docker service update --env-add FEATURE_FLAG_IMPORT_ENABLED=false card-benefits

# Users now see: "Import feature temporarily unavailable"
# All user data preserved in database
```

### Rollback Step 2: Verify No Corruption (2 minutes)

```bash
# Check database integrity
sqlite3 data/cards.db "PRAGMA integrity_check;"
# Expected: "ok"

# Verify no orphaned records
sqlite3 data/cards.db "SELECT COUNT(*) FROM ImportJob WHERE status = 'Processing';"
# Expected: 0 (all jobs should be in terminal state)

# If corruption detected, continue to Step 3
# If database OK, stop here - feature is safely disabled
```

### Rollback Step 3: Full Rollback to Previous Version (5 minutes)

**Only if database corruption detected:**

```bash
# Restore database from backup
BACKUP_PATH="backups/cards-backup-20240403-160000.db"

# Stop application
sudo systemctl stop card-benefits

# Restore backup
cp data/cards.db data/cards-backup-corrupted-$(date +%s).db
cp ${BACKUP_PATH} data/cards.db

# Revert to previous version
git checkout v1.1.0

# Install dependencies
npm ci

# Restart application
sudo systemctl start card-benefits

# Verify restoration
curl https://api.card-benefits.com/health
# Should return 200 OK
```

### Rollback Step 4: Verify Service Restored (2 minutes)

```bash
# Verify data integrity after rollback
sqlite3 data/cards.db "SELECT COUNT(*) FROM UserCard;" 
# Should show expected card count

# Test basic functionality
curl https://api.card-benefits.com/api/cards/summary
# Should return card summary data

# Check no import records present
curl https://api.card-benefits.com/api/import/status
# Should return 404 or "feature disabled"

# Declare incident resolved
open https://status.card-benefits.com
# Post update: "Import feature temporarily disabled, service restored"
```

---

## 📊 Post-Deployment Verification (Next 24 Hours)

### Hour 0-1: Immediate Verification
- [ ] All health checks passing
- [ ] No error spikes in logs
- [ ] No alerts triggered
- [ ] API response times normal
- [ ] Database queries performing normally

### Hour 1-4: Extended Monitoring
- [ ] User traffic normal for time of day
- [ ] No repeated error patterns
- [ ] Feature flags working correctly
- [ ] Database connection pool stable
- [ ] Disk space usage normal

### Hour 4-24: Full Day Monitoring
- [ ] Successful import tests by QA team
- [ ] Successful export tests by QA team
- [ ] No unhandled exceptions in logs
- [ ] Monitoring dashboards showing data
- [ ] User support receives no critical issues
- [ ] Database backups completing normally

### End of Day: Deployment Sign-Off
- [ ] Tech Lead: Reviews logs, confirms no issues
- [ ] QA Lead: Confirms all test scenarios working
- [ ] DevOps: Verifies monitoring stable
- [ ] On-Call: Documents deployment notes

---

## 🔍 Monitoring During Deployment

### Real-Time Dashboard Links

Keep these open during deployment:

1. **Application Metrics**
   - URL: `https://monitoring.card-benefits.com/dashboards/application`
   - Watch: Error rate, response time, requests/sec

2. **Database Health**
   - URL: `https://monitoring.card-benefits.com/dashboards/database`
   - Watch: Connection pool, query latency, transaction count

3. **Import/Export Metrics**
   - URL: `https://monitoring.card-benefits.com/dashboards/import-export`
   - Watch: Job counts, parse times, success rates

4. **Application Logs**
   - Command: `tail -f logs/app.log | grep -E "(ERROR|WARN|import|export)"`
   - Watch: Any errors related to import/export

5. **Error Tracking**
   - URL: `https://sentry.card-benefits.com/releases/v1.2.0`
   - Watch: New errors introduced by release

### Alert Thresholds During Deployment

| Metric | Normal | Alert | Action |
|--------|--------|-------|--------|
| Error Rate | <0.1% | >1% | Investigate logs |
| Response Time (p95) | <500ms | >2000ms | Check database |
| Connection Pool | <50% | >80% | Restart service |
| Database Queries | <200ms p95 | >500ms p95 | Check slow query log |
| Disk Usage | <80% | >90% | Review temp files |

---

## 🐛 Deployment Troubleshooting

### Issue: Migration Fails with "Table Already Exists"

**Symptom:** `npx prisma migrate deploy` fails with error about table existing

**Solution:**
```bash
# Check current migration status
npx prisma migrate status
# Should show: "20260403042633_add_import_export_tables ... Pending"

# If showing "Applied", migration already ran (safe)
# If showing error, check if deployment was partially completed

# To recover:
git checkout v1.1.0  # Revert
npm ci
npm run build
sudo systemctl restart card-benefits
# Try deployment again after investigating
```

### Issue: Build Fails with TypeScript Errors

**Symptom:** `npm run build` fails with TypeScript errors

**Solution:**
```bash
# Detailed error analysis
npm run type-check
# Review specific type errors

# Common fixes:
# 1. Missing dependency: npm ci
# 2. Stale build: rm -rf .next && npm run build
# 3. Cache issue: npm cache clean --force && npm ci

# If still failing, rollback to v1.1.0
```

### Issue: Application Starts But Import Endpoint Returns 500

**Symptom:** `/api/import/upload` returns 500 error

**Solution:**
```bash
# Check application logs
tail -f logs/error.log

# Common causes:
# 1. Environment variables missing: env | grep IMPORT
# 2. Database not migrated: npx prisma studio (verify ImportJob table exists)
# 3. Prisma client not generated: npm run db:generate

# Verify Prisma client loaded
node -e "const { PrismaClient } = require('@prisma/client'); new PrismaClient().importJob.findMany().then(() => console.log('OK')).catch(e => console.error(e))"
```

### Issue: Database Migration Hangs (Timeout)

**Symptom:** `npm run prisma:migrate` takes >5 minutes

**Solution:**
```bash
# Check if another process is using database
lsof | grep cards.db
# Kill any lingering processes if needed: kill -9 <PID>

# Try migration with increased timeout
DATABASE_URL="file:./data/cards.db" npx prisma migrate deploy --skip-generate

# If still hanging, there may be a lock
# Stop application, check database:
sqlite3 data/cards.db "PRAGMA database_list;" # Should show database
sqlite3 data/cards.db "PRAGMA wal_checkpoint(TRUNCATE);" # Force checkpoint
# Retry migration
```

### Issue: Deployment Succeeds But No Import Option in UI

**Symptom:** Users don't see import button in dashboard

**Solution:**
```bash
# 1. Check feature flag
curl https://api.card-benefits.com/api/features | jq '.import'
# Should return: true

# If false, set environment variable:
export FEATURE_FLAG_IMPORT_ENABLED=true
sudo systemctl restart card-benefits

# 2. Check UI is loading correctly
# - Open Developer Console (F12)
# - Check for JavaScript errors
# - Verify import component is in DOM: document.querySelector('[data-testid="import-button"]')

# 3. Check browser cache
# - Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)
# - Clear browser cache
# - Try incognito window

# 4. Check Next.js build included UI components
grep -r "ImportWizard" .next/ | head -5
# Should show component in build output
```

---

## 📞 Getting Help During Deployment

### Escalation Path

**During Deployment (Real-Time)**
1. Check this guide's Troubleshooting section
2. Slack #devops channel for immediate help
3. Page on-call engineer (PagerDuty)

**After Deployment (Next 24 Hours)**
1. Review dashboards for anomalies
2. Check error logs and monitoring
3. Create issue on GitHub if pattern found
4. Follow up with engineering team

### Key Contacts

| Role | Slack Handle | Phone | On-Call |
|------|-------------|-------|---------|
| DevOps Lead | @devops-lead | ext 1234 | Check PagerDuty |
| Database Admin | @db-admin | ext 5678 | Check PagerDuty |
| QA Lead | @qa-lead | ext 9012 | Business hours |
| Tech Lead | @tech-lead | ext 3456 | Business hours |
| On-Call Engineer | PagerDuty | PagerDuty | 24/7 |

---

## ✨ Success Indicators

### Deployment is Successful When:

✅ **Immediate (0-5 minutes)**
- Application starts without errors
- All health checks pass
- No error spikes in logs
- Monitoring dashboards show data

✅ **Short-Term (1 hour)**
- Feature flags working correctly
- Import button visible in UI
- Export button visible in UI
- File upload form accepts files

✅ **First Day**
- Users can complete import wizard
- Imports are processed without errors
- Exports generate files successfully
- Monitoring shows normal metrics
- No support tickets from crashes

✅ **One Week**
- Consistent user adoption of feature
- >95% import success rate
- <0.1% error rate
- Database performance stable
- All alerts operating correctly

---

## 📋 Deployment Log Template

**Use this to document actual deployment:**

```
Deployment Date: ________
Deployment Window: ______ UTC to ______ UTC
Deployed By: ________
Reviewed By: ________

Pre-Deployment Checklist:
[ ] Code merged and tests passing
[ ] Backups created
[ ] Team notified
[ ] Monitoring ready

Deployment Timeline:
15:50 - Backup started _____ [✓/✗]
15:55 - Code pulled _____ [✓/✗]
16:00 - Dependencies installed _____ [✓/✗]
16:05 - Migration started _____ [✓/✗]
16:07 - Migration completed _____ [✓/✗]
16:15 - Build completed _____ [✓/✗]
16:20 - Application restarted _____ [✓/✗]
16:25 - Health checks passed _____ [✓/✗]

Issues Encountered:
_________________________________

Resolution:
_________________________________

Sign-Off:
Tech Lead: __________ Date: __________
DevOps: __________ Date: __________
QA: __________ Date: __________
```

---

## 🎓 Training & Resources

### Team Training (Before Deployment)

**For Developers:**
- Read: DEPLOYMENT_PLAN_IMPORT_EXPORT.md
- Review: QA report and issues fixed
- Test locally: `npm run test:all`

**For DevOps/SRE:**
- Review: Database migration SQL
- Practice: Rollback procedure in staging
- Verify: Monitoring dashboards loaded

**For QA:**
- Test: Import with sample CSV file
- Test: Import with sample XLSX file
- Test: Export all card formats
- Test: Error handling and edge cases

**For Support:**
- Read: TROUBLESHOOTING_IMPORT_EXPORT.md
- Know: Rollback procedure
- Have: FAQ prepared for users

### Documentation Links

- [Main Deployment Plan](./DEPLOYMENT_PLAN_IMPORT_EXPORT.md)
- [Environment Configuration](./ENV_CONFIGURATION.md)
- [Monitoring & Alerting](./MONITORING_IMPORT_EXPORT.md)
- [Troubleshooting Guide](./TROUBLESHOOTING_IMPORT_EXPORT.md)
- [CI/CD Pipeline Docs](../.github/workflows/)

---

**Version:** 1.0  
**Last Updated:** April 3, 2024  
**Next Review:** April 10, 2024
