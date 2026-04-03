# Troubleshooting Guide - Import/Export Feature

**Document Version:** 1.0  
**Created:** April 3, 2024  
**Audience:** QA, Support, DevOps, On-Call Engineers

---

## 🆘 Quick Troubleshooting (First 5 Minutes)

### Symptom: Users See "Import Feature Unavailable"

**Diagnosis:**
```bash
# Check if feature flag is enabled
curl https://api.card-benefits.com/api/features | jq '.import'
# Should return: true

# If false, that's the problem!
```

**Solutions:**
1. **Check feature flag setting:**
   ```bash
   echo $FEATURE_FLAG_IMPORT_ENABLED
   # Should be: true
   ```

2. **If not set, enable it:**
   ```bash
   export FEATURE_FLAG_IMPORT_ENABLED=true
   systemctl restart card-benefits
   ```

3. **Clear browser cache:**
   - Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
   - Or use incognito window to test

4. **Verify feature returned to normal:**
   ```bash
   curl https://api.card-benefits.com/api/features | jq '.import'
   # Should now return: true
   ```

---

### Symptom: "File Upload Failed"

**Quick Checks:**
```bash
# 1. Check file size limit
echo $IMPORT_MAX_FILE_SIZE_MB  # Should be 50 or higher

# 2. Check temp directory exists and writable
ls -ld $IMPORT_TEMP_DIR        # Should show rwxr-xr-x
mkdir -p $IMPORT_TEMP_DIR 2>/dev/null

# 3. Check disk space
df -h $IMPORT_TEMP_DIR         # Should show >1GB free

# 4. Check application logs
tail -f logs/error.log | grep -i "upload\|file"

# 5. Verify API endpoint working
curl -X POST https://api.card-benefits.com/api/import/upload
# Should return 400 (missing file), not 500 (error)
```

**Most Common Fix:** Disk space full
```bash
# Check temp directory size
du -sh /mnt/temp/card-benefits-imports

# If >40GB, clean up old imports
find /mnt/temp/card-benefits-imports -mtime +7 -delete  # Delete >7 days old

# Or restart to clear session temp
systemctl restart card-benefits
```

---

### Symptom: Import Takes Forever (Hangs)

**Diagnosis:**
```bash
# Check if import is actually processing
curl https://api.card-benefits.com/api/import/status/<job-id> | jq '.status'
# Should show: Parsing, Validating, or Committing

# Check application logs in real-time
tail -f logs/app.log | grep -i "import\|processing"

# Check database query performance
# If seeing many "waiting for lock" messages, indicates database contention
```

**Solutions:**

1. **If parsing hangs (stuck at "Uploading"):**
   ```bash
   # Parser might be slow, check performance
   grep "parseTimeMs" logs/app.log | tail -5
   
   # If >60s for reasonable file size:
   # Increase timeout in .env
   export IMPORT_PARSE_TIMEOUT_MS=120000  # 2 minutes
   systemctl restart card-benefits
   ```

2. **If validation hangs (stuck at "Validating"):**
   ```bash
   # Validation might have bug, check logs
   grep "ERROR.*validation" logs/error.log
   
   # If specific errors:
   # Stop import, fix data, retry
   
   # If no errors, increase timeout:
   export IMPORT_VALIDATE_TIMEOUT_MS=300000  # 5 minutes
   systemctl restart card-benefits
   ```

3. **If commit hangs (stuck at "Processing"):**
   ```bash
   # Database might be slow or locked
   # Check database query log
   # Kill long-running queries if needed (contact DBA)
   
   # Increase timeout
   export IMPORT_COMMIT_TIMEOUT_MS=600000  # 10 minutes
   systemctl restart card-benefits
   ```

---

## 📋 Detailed Troubleshooting by Error

### Error: "File is empty"

**Cause:** User uploaded empty file or file with no data

**Solution:**
```bash
# Verify file actually has content
wc -l test-import.csv  # Should show >1 line
head test-import.csv   # Should show column headers and data

# Regenerate file with data:
# 1. Export sample from tool
# 2. Fill in data
# 3. Retry upload
```

---

### Error: "Unsupported file format"

**Cause:** File extension or magic bytes don't match

**Diagnosis:**
```bash
# Check file extension
file test-import.csv
# Should show: ASCII text OR CSV

file test-import.xlsx
# Should show: Zip archive OR Microsoft Excel

# Check magic bytes
hexdump -C test-import.csv | head -1
# CSV should start with text (42 = *, 43 = +, etc)

hexdump -C test-import.xlsx | head -1
# XLSX should start with: 50 4b 03 04 (PK signature - ZIP)
```

**Solutions:**
- For CSV: Ensure it's plain text, not Excel saved as CSV
- For XLSX: Re-save from Excel (File → Save As → Excel Workbook)
- Try converting: `ssconvert test.ods test.xlsx` (using LibreOffice)

---

### Error: "Too many rows"

**Cause:** File has more records than `IMPORT_MAX_ROWS`

**Diagnosis:**
```bash
# Count rows
wc -l test-import.csv
# If >10,001 (accounting for header), exceeds limit

# Check current limit
echo $IMPORT_MAX_ROWS  # Should show 10000
```

**Solution:**
```bash
# Option 1: Split file into smaller chunks
head -n 5001 test-import.csv > test-import-part1.csv  # 5000 data rows + 1 header
tail -n +5001 test-import.csv > test-import-part2.csv
# Import part1, then part2

# Option 2: Increase limit (only if database can handle)
export IMPORT_MAX_ROWS=20000
systemctl restart card-benefits
# Import should now work

# Option 3: Optimize records (remove duplicates/unnecessary fields)
```

---

### Error: "Validation failed: X records have errors"

**Cause:** Data in file doesn't match schema or business rules

**Diagnosis:**
```bash
# Get detailed error log
curl https://api.card-benefits.com/api/import/errors/<job-id> | jq '.errors'

# Common errors appear:
# - "cardName is required"
# - "annualFee must be non-negative"
# - "renewalDate must be in future"
```

**Solutions by Error Type:**

1. **"cardName is required"**
   ```
   Fix: Ensure every card row has cardName column with value
   ```

2. **"Invalid date format (expected YYYY-MM-DD)"**
   ```
   Fix: Convert dates to YYYY-MM-DD format
   Excel: =TEXT(A1,"YYYY-MM-DD")
   CSV: Use Unix date conversion
   ```

3. **"annualFee must be non-negative"**
   ```
   Fix: Ensure annual fee is 0 or positive, not negative
   ```

4. **"renewalDate must be in future"**
   ```
   Fix: Set renewal dates to dates after today
   ```

---

### Error: "Duplicate detected: 3 cards conflict with existing data"

**Cause:** Import file has duplicate cards already in database

**Diagnosis:**
```bash
# Check which cards are duplicates
curl https://api.card-benefits.com/api/import/duplicates/<job-id> | jq '.conflicts'

# Shows:
# - Card name and issuer
# - Whether it's in-batch duplicate or database duplicate
# - Suggested action
```

**Solutions:**
```bash
# Option 1: Skip duplicate (user chooses in UI)
# Click "Skip duplicates" button

# Option 2: Update existing cards
# Click "Update" for each duplicate

# Option 3: Merge with existing
# Click "Merge" for each duplicate

# Option 4: Remove from import file
# Delete duplicate rows before uploading
```

---

### Error: "Import rolled back: Constraint violation"

**Cause:** Data violates database constraint (e.g., unique combination)

**Diagnosis:**
```bash
# Check database constraint logs
grep "CONSTRAINT\|UNIQUE\|FOREIGN" logs/error.log

# Get more details
curl https://api.card-benefits.com/api/import/status/<job-id> | jq '.error'
```

**Solutions:**
```bash
# Option 1: Verify constraint isn't being violated twice
# Check if importing same card twice in same file

# Option 2: Drop and re-import
# Delete partially imported data
curl -X DELETE https://api.card-benefits.com/api/import/<job-id>
# Fix data, retry

# Option 3: Check schema consistency
# Ensure all required foreign keys are valid
```

---

### Error: "Transaction timeout - import rolled back"

**Cause:** Import took longer than `IMPORT_COMMIT_TIMEOUT_MS`

**Diagnosis:**
```bash
# Check actual time taken
grep "commitTimeMs" logs/app.log | tail -1

# Check current timeout
echo $IMPORT_COMMIT_TIMEOUT_MS

# If actual > timeout, need to increase it
```

**Solution:**
```bash
# Increase timeout (based on actual time taken)
# Rule: timeout should be 2x longest observed duration

# Example: If import took 400 seconds
export IMPORT_COMMIT_TIMEOUT_MS=800000  # 13 minutes (2x400s)
systemctl restart card-benefits

# Retry import
```

---

### Error: "Database connection pool exhausted"

**Cause:** Too many concurrent operations, running out of connections

**Diagnosis:**
```bash
# Check active connections
curl https://api.card-benefits.com/metrics | grep db_connection_pool
# Should show something like:
# db_connection_pool{status="active"} 5
# db_connection_pool{status="max"} 20

# If active == max, pool is exhausted

# Check what's holding connections
# Review active queries on database
```

**Solutions:**
```bash
# Option 1: Increase pool size
export DATABASE_CONNECTION_POOL_MAX=40
systemctl restart card-benefits

# Option 2: Kill long-running queries
# SSH to database
sqlite3 data/cards.db ".timeout 300"  # Set query timeout

# Option 3: Reduce concurrent imports
# Load balance imports across time
# Don't start 10 imports simultaneously

# Option 4: Check for connection leaks
# Look for unclosed connections in code
grep -r "new PrismaClient\|disconnect" src/
# Ensure all clients are disconnected after use
```

---

### Error: "Export failed: No data to export"

**Cause:** Selected filters returned no results

**Solution:**
```bash
# Verify filters are correct
# Check if cards exist that match filters
curl https://api.card-benefits.com/api/cards/summary | jq '.totalCards'

# If 0 cards, need to import some first
# If >0, filters might be too restrictive
# Try: "Export all cards" without filters
```

---

### Error: "Export file download failed"

**Cause:** File streaming error or network issue

**Diagnosis:**
```bash
# Check export job status
curl https://api.card-benefits.com/api/export/<job-id> | jq '.status'

# Check logs for generation errors
grep "export\|generation" logs/error.log | tail -20

# Check file was actually created
ls -lh /tmp/card-benefits-exports/
```

**Solutions:**
```bash
# Option 1: Retry export (might be network timeout)

# Option 2: Check file size
# If export file >500MB, browser download might fail
# Use command-line download instead:
curl -O https://api.card-benefits.com/api/export/<job-id>/download

# Option 3: Check browser limits
# Some browsers have limits on file size
# Try different browser or use curl
```

---

## 🔧 Database-Level Troubleshooting

### Check Import Job Status

```sql
-- SQLite
SELECT id, status, totalRecords, processedRecords, errorLog 
FROM ImportJob 
ORDER BY createdAt DESC 
LIMIT 10;

-- Check for jobs stuck in "Processing"
SELECT id, status, createdAt, DATETIME('now') - createdAt as age_minutes
FROM ImportJob 
WHERE status = 'Processing'
AND DATETIME('now') - createdAt > '30 minutes';
-- If any results, these jobs are stuck

-- Check import records for a job
SELECT recordType, status, COUNT(*) as count
FROM ImportRecord
WHERE importJobId = '<job-id>'
GROUP BY recordType, status;
```

### Check for Data Corruption

```sql
-- Look for orphaned import records
SELECT COUNT(*) as orphaned
FROM ImportRecord
WHERE importJobId NOT IN (SELECT id FROM ImportJob);

-- Check for incomplete transactions
SELECT COUNT(*) as incomplete
FROM ImportJob
WHERE status IN ('Uploading', 'Parsing', 'Validating', 'Deduplicating', 'Committing')
AND createdAt < DATETIME('now', '-1 hour');

-- If any, these should be marked as Failed
UPDATE ImportJob
SET status = 'Failed', errorLog = 'Job abandoned due to timeout'
WHERE status IN ('Uploading', 'Parsing', 'Validating')
AND createdAt < DATETIME('now', '-1 hour');
```

### Reset Import State (Emergency)

**Only if imports completely broken and need manual reset:**

```bash
# Backup database first!
cp data/cards.db backups/cards-backup-$(date +%s).db

# Connect to database
sqlite3 data/cards.db

# Clear stuck imports (careful!)
DELETE FROM ImportRecord WHERE importJobId IN (
  SELECT id FROM ImportJob WHERE status IN ('Uploading', 'Parsing', 'Validating')
  AND createdAt < DATETIME('now', '-1 hour')
);

DELETE FROM ImportJob WHERE status IN ('Uploading', 'Parsing', 'Validating')
AND createdAt < DATETIME('now', '-1 hour');

-- Verify database integrity
PRAGMA integrity_check;
-- Should return: ok

-- Disconnect
.exit
```

---

## 📊 Performance Troubleshooting

### Parser Is Slow

**Diagnosis:**
```bash
# Measure actual parse time for a file
grep "parseTimeMs" logs/app.log | tail -10
# Look for values >5000ms

# Check file size
ls -lh <import-file>  # In MB

# Calculate rate: MB/s = filesize_MB / (parseTimeMs / 1000)
# Target: CSV >50 MB/s, XLSX >10 MB/s
```

**Optimization:**
```bash
# 1. Check CPU usage during parse
top -p $(pgrep -f "card-benefits")
# If CPU <30%, not CPU bound, might be IO bound

# 2. Check memory usage
ps aux | grep card-benefits | grep -v grep
# Should be <500MB

# 3. Profile parser (for developers)
# Add performance markers to code:
const start = performance.now();
// ... parsing code ...
console.log(`Parse took ${performance.now() - start}ms`);

# 4. Consider caching frequently parsed formats
# If seeing same file formats repeatedly
```

---

### Validation Is Slow

**Diagnosis:**
```bash
# Check validation time
grep "validationTimeMs" logs/app.log | tail -10

# Compare to record count
# Target: 5-10ms per record
# 10,000 records = 50-100 seconds expected

# If taking longer:
# - Check for slow database lookups
# - Profile validation rules
```

**Optimization:**
```bash
# 1. Batch database lookups
# Instead of looking up each MasterCard individually,
# batch them: WHERE issuer IN ('Chase', 'Amex', ...)

# 2. Cache validation rules
# Compile regex patterns once, reuse

# 3. Parallel validation
# If validation rules are independent, run in parallel
```

---

## 🆘 Emergency Procedures

### If Import Feature Completely Broken

**Step 1: Disable Feature (Prevent More Damage)**
```bash
export FEATURE_FLAG_IMPORT_ENABLED=false
export FEATURE_FLAG_EXPORT_ENABLED=false
systemctl restart card-benefits
```

**Step 2: Assess Damage**
```bash
# Check how many imports failed
sqlite3 data/cards.db \
  "SELECT COUNT(*) FROM ImportJob WHERE status = 'Failed'"

# Check if data corruption occurred
sqlite3 data/cards.db "PRAGMA integrity_check;"
# Should return: ok

# Get error details
sqlite3 data/cards.db \
  "SELECT id, errorLog FROM ImportJob WHERE status = 'Failed' LIMIT 5"
```

**Step 3: Rollback if Needed**
```bash
# If database corrupted:
systemctl stop card-benefits
cp backups/cards-backup-<timestamp>.db data/cards.db
systemctl start card-benefits

# Verify restored
curl https://api.card-benefits.com/api/health
```

**Step 4: Notify Stakeholders**
```bash
# Post incident update
# "Import/Export temporarily disabled for investigation"

# Create incident ticket
# Document what went wrong
# Plan fix and retest

# Re-enable once fixed and verified
```

---

## 📞 Escalation Guide

### Level 1: User/Support Can Handle (30 min SLA)
- Feature flag not enabled
- File too large or wrong format
- Browser cache issue
- Missing required columns
- Data validation errors (user can fix)

**Solution Path:**
1. Use this troubleshooting guide
2. Check feature flag and file format
3. Ask user to clear cache and retry
4. Provide error feedback to user

### Level 2: Engineering Team (2 hour SLA)
- Parser timeout issues
- Database constraint violations
- Rollback failures
- Performance degradation
- New error types

**Solution Path:**
1. Gather logs and metrics
2. Review recent code changes
3. Check environment configuration
4. Consider temporary workaround
5. File bug for permanent fix

### Level 3: Incident Response (15 min SLA)
- Feature completely broken
- Database corruption
- Multiple user impact
- Data loss risk
- Requires rollback

**Solution Path:**
1. Disable feature immediately
2. Assess damage scope
3. Rollback to previous version
4. Restore from backup if needed
5. Post-mortem within 24 hours

---

## 📚 Related Documentation

- [Deployment Guide](./DEPLOYMENT_GUIDE_IMPORT_EXPORT.md)
- [Monitoring](./MONITORING_IMPORT_EXPORT.md)
- [Environment Config](./ENV_CONFIGURATION_IMPORT_EXPORT.md)
- [QA Report](../.github/specs/import-export-qa-report.md)

---

**Version:** 1.0  
**Last Updated:** April 3, 2024  
**Maintained By:** DevOps / Engineering Team
