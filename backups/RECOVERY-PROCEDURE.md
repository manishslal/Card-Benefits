# Database Recovery Procedure

## ⚠️ IMPORTANT: USE ONLY IF PHASE 2A-5 DEPLOYMENT FAILS

This procedure will restore the production database to the state before Phase 2A-5 migration was applied.

---

## Quick Reference

| Item | Value |
|---|---|
| Backup File | `backups/railway-phase2a-backup-20260407-094627.sql` |
| Backup Date | 2026-04-07 09:46:27 UTC |
| Backup Size | 132K |
| Checksum | `198cd29ea6886d2897b79ae7807477f8` |
| Database | `railway` (junction.proxy.rlwy.net:57123) |
| **Estimated Recovery Time** | **5-10 minutes** |

---

## Step 1: Identify the Problem

Check if Phase 2A-5 migration caused issues:

```bash
# Check if new tables exist (should NOT exist before recovery)
export DATABASE_URL="postgresql://postgres:tsfINxwNmjUZwrXtrZzxxbKTDLbAmZKb@junction.proxy.rlwy.net:57123/railway"

export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"

psql "$DATABASE_URL" -c "\dt BenefitUsageRecord"

# If table exists, Phase 2A-5 migration was partially applied
# If error "relation does not exist", it hasn't been applied yet
```

---

## Step 2: Stop the Application

**IMMEDIATELY stop the application to prevent further writes:**

### Option A: Via Railway Dashboard (Recommended)

1. Go to: https://railway.app
2. Select your project
3. Select the application service
4. Click **Stop**
5. Wait for status to show "Stopped"

### Option B: Via Railway CLI

```bash
# If Railway CLI is installed
railway service stop [your-service-name]

# Check status
railway logs --tail 50
```

### Option C: Manual Pause

Contact your DevOps team to immediately pause the application.

**Do NOT proceed to Step 3 until application is fully stopped.**

---

## Step 3: Verify Backup File Integrity

Before restoring, verify the backup file is valid:

```bash
# Check file exists and has correct checksum
export BACKUP_FILE="backups/railway-phase2a-backup-20260407-094627.sql"

# Verify file size
ls -lh "$BACKUP_FILE"
# Expected: 132K

# Verify checksum
md5sum "$BACKUP_FILE"
# Expected: 198cd29ea6886d2897b79ae7807477f8

# Verify file is readable SQL
file "$BACKUP_FILE"
# Expected: ASCII text, with very long lines

# Quick check: file should contain CREATE TABLE statements
grep -c "^CREATE TABLE" "$BACKUP_FILE"
# Expected: 15 tables
```

**If checksum does NOT match, DO NOT restore. Contact team.**

---

## Step 4: Backup Current Database (Before Restoring)

Create a backup of the current (broken) state for investigation:

```bash
export DATABASE_URL="postgresql://postgres:tsfINxwNmjUZwrXtrZzxxbKTDLbAmZKb@junction.proxy.rlwy.net:57123/railway"

export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"

# Create backup of broken state
pg_dump "$DATABASE_URL" --format=plain > backups/railway-broken-state-$(date +%Y%m%d-%H%M%S).sql

echo "Backup of broken state created"
ls -lh backups/railway-broken-state-*.sql | tail -1
```

---

## Step 5: Restore from Phase 2A-4 Backup

**WARNING: This will OVERWRITE the database.**

```bash
export DATABASE_URL="postgresql://postgres:tsfINxwNmjUZwrXtrZzxxbKTDLbAmZKb@junction.proxy.rlwy.net:57123/railway"

export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"

# Option 1: Using psql (recommended for plain SQL backups)
echo "Restoring database from backup..."
psql "$DATABASE_URL" < backups/railway-phase2a-backup-20260407-094627.sql

# Watch for success message
echo "Restore complete!"
```

**Expected output:**
```
CREATE TABLE
CREATE TABLE
...
[Many CREATE TABLE statements]
...
ALTER TABLE
[Restore complete - no error messages]
```

**If errors occur:**
- Check database connectivity
- Verify credentials in DATABASE_URL
- Ensure backup file is not corrupted
- Contact DevOps team

---

## Step 6: Verify Data Was Restored

Verify the database was restored to pre-Phase 2A-5 state:

```bash
export DATABASE_URL="postgresql://postgres:tsfINxwNmjUZwrXtrZzxxbKTDLbAmZKb@junction.proxy.rlwy.net:57123/railway"

export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"

# Check table list (should be 15 tables, no Phase 2A tables)
echo "=== Table Count ==="
psql "$DATABASE_URL" -c "\dt" | grep "rows"

# Should show: 15 relations

# Check record counts
echo "=== Record Counts ==="
psql "$DATABASE_URL" -c "
SELECT 'MasterCard' as table_name, COUNT(*) as record_count FROM \"MasterCard\"
UNION ALL
SELECT 'MasterBenefit', COUNT(*) FROM \"MasterBenefit\"
UNION ALL
SELECT 'User', COUNT(*) FROM \"User\"
UNION ALL
SELECT 'UserCard', COUNT(*) FROM \"UserCard\"
UNION ALL
SELECT 'UserBenefit', COUNT(*) FROM \"UserBenefit\"
ORDER BY table_name;
"

# Should show:
# MasterBenefit: 105 records
# MasterCard: 26 records
# Others: 0 records (as expected)
```

**If record counts DO NOT match:**
- Restore was incomplete
- Contact DevOps team
- Do NOT restart application

---

## Step 7: Verify Phase 2A-5 Tables Are NOT Present

Confirm Phase 2A-5 migration tables don't exist:

```bash
export DATABASE_URL="postgresql://postgres:tsfINxwNmjUZwrXtrZzxxbKTDLbAmZKb@junction.proxy.rlwy.net:57123/railway"

export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"

# These tables should NOT exist
psql "$DATABASE_URL" -c "\dt BenefitUsageRecord"
psql "$DATABASE_URL" -c "\dt BenefitPeriod"
psql "$DATABASE_URL" -c "\dt BenefitRecommendation"

# All three should show: "Did not find any relation named ..."
```

---

## Step 8: Revert Code Changes

Revert the Phase 2A-5 migration from your codebase:

```bash
# Check recent commits
git log --oneline | head -10

# Find Phase 2A-5 migration commit (usually recent)
# Look for commit message like: "phase 2a-5" or "migration"

# Option 1: Soft reset (keep changes, undo commit)
git reset --soft HEAD~1

# Option 2: Hard reset (discard all changes)
git reset --hard HEAD~1

# Option 3: Revert commit (create opposite commit)
git revert [commit-hash]

# After choosing option, verify you're back to Phase 2A-4:
git log --oneline | head -1
# Should show: "Phase 2A-4" or earlier commit
```

---

## Step 9: Rebuild and Test

Rebuild the application code:

```bash
# Install dependencies (in case anything changed)
npm install

# Build the application
npm run build

# Run tests to ensure nothing is broken
npm run test

# Check TypeScript compilation
npx tsc --noEmit

# Create a fresh Prisma schema
npx prisma generate
```

---

## Step 10: Restart Application

Only restart AFTER all verification is complete:

### Option A: Via Railway Dashboard

1. Go to: https://railway.app
2. Select your project
3. Select the application service
4. Click **Start** (or **Restart**)
5. Wait for status to show "Running"
6. Check application logs for any errors

### Option B: Via CLI

```bash
# If Railway CLI is installed
railway service start [your-service-name]

# Monitor logs
railway logs --follow
```

### Option C: Manual Restart

Contact your DevOps team to restart the application.

---

## Step 11: Verify Application Health

Once application restarts, verify it's healthy:

```bash
# Check application is running
curl https://your-app-domain.com/api/health

# Expected response: { "status": "ok" }

# Check logs for errors
# Monitor application dashboard for errors
# Test critical user flows
```

---

## Step 12: Post-Recovery Cleanup

After successful recovery:

```bash
# List backup files
ls -lh backups/

# Keep backups for 30 days minimum
# Move broken state backup to archive:
mkdir -p backups/archive
mv backups/railway-broken-state-*.sql backups/archive/

# Document what happened
echo "Recovery completed: $(date)" >> logs/recovery-log.txt
```

---

## Troubleshooting

### Problem: psql command not found

```bash
# Install PostgreSQL client tools
brew install postgresql

# Or set path if already installed
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
```

### Problem: Connection refused

```bash
# Check if Railway database is accessible
ping junction.proxy.rlwy.net

# Verify credentials in .env file
cat .env | grep DATABASE_URL

# Test connection manually
psql -h junction.proxy.rlwy.net -p 57123 -U postgres -d railway -c "SELECT 1"
```

### Problem: Restore failed / data mismatch

```bash
# Check what went wrong
tail -100 restore-error.log

# Restore aborted - can try again
# Rerun Step 5 to attempt restore

# If repeated failures:
# 1. Stop the application
# 2. Contact DevOps team
# 3. Do NOT restart application until issue resolved
```

### Problem: File checksum doesn't match

```bash
# DO NOT RESTORE

# Backup file may be corrupted
# Check if file was modified after backup:
ls -la backups/railway-phase2a-backup-*.sql

# If file is newer than backup date, it was modified
# Contact team - may need to re-backup from Railway
```

### Problem: Can't connect to Railway database

```bash
# Verify Railway service is running
# Check Railway dashboard status

# Verify IP whitelist (if applicable):
# Railway → Project → Settings → Networking

# Verify credentials are correct in .env:
grep DATABASE_URL .env

# If all else fails:
# Contact Railway support: support@railway.app
```

---

## Quick Recovery Command

If you've done this before and need quick recovery:

```bash
# One-command recovery (use with CAUTION)
export DATABASE_URL="postgresql://postgres:tsfINxwNmjUZwrXtrZzxxbKTDLbAmZKb@junction.proxy.rlwy.net:57123/railway"
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"

# Verify file integrity
md5sum backups/railway-phase2a-backup-20260407-094627.sql

# Restore
psql "$DATABASE_URL" < backups/railway-phase2a-backup-20260407-094627.sql

# Verify
psql "$DATABASE_URL" -c "SELECT COUNT(*) as total FROM \"User\" + COALESCE((SELECT COUNT(*) FROM \"MasterCard\"), 0) + COALESCE((SELECT COUNT(*) FROM \"MasterBenefit\"), 0);"

# Should output: 131 (or close to it)
```

---

## Recovery Success Checklist

- ✅ Application is stopped
- ✅ Backup file verified (checksum correct)
- ✅ Database restored from backup
- ✅ Record counts verified (match pre-migration values)
- ✅ Phase 2A-5 tables do NOT exist
- ✅ Code reverted to pre-Phase 2A-5
- ✅ Application rebuilt and tested
- ✅ Application restarted
- ✅ Application health verified
- ✅ No errors in logs

**Once all items are checked: Recovery is complete ✅**

---

## When You're Ready to Try Phase 2A-5 Again

After successful recovery:

1. **Investigate the issue** that caused Phase 2A-5 to fail
2. **Fix the issue** in code
3. **Test locally** before deploying
4. **Create fresh backup** (rerun Phase 2A-4)
5. **Deploy Phase 2A-5** with monitoring

---

## Support

If you need help:

1. Check `.github/specs/PHASE2A-BACKUP-REPORT.md` for backup details
2. Review migration file: `prisma/migrations/` (if exists)
3. Check application logs: Railway dashboard → Logs
4. Contact DevOps team with:
   - What went wrong
   - Error messages
   - Application logs
   - Migration file contents

---

**Last Updated:** 2026-04-07 09:46:27 UTC  
**Status:** Ready for use (if Phase 2A-5 fails)  
**Backup Checksum:** `198cd29ea6886d2897b79ae7807477f8`
