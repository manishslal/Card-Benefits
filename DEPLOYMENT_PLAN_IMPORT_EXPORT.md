# Import/Export Feature - Production Deployment Plan

**Feature:** CSV/XLSX Import and Export for Card Benefits Tracker  
**Status:** Ready for Deployment (After QA Fixes Complete)  
**Deployment Target:** Production Environment  
**Created:** April 3, 2024  

---

## 📋 Executive Summary

The Import/Export feature enables users to bulk manage their card and benefit data through CSV and XLSX file formats. This deployment plan covers the complete production rollout, including CI/CD pipeline updates, environment configuration, database migration, monitoring setup, and operational runbooks.

### Quality Gate Status

| Category | Status | Details |
|----------|--------|---------|
| **Code Review** | ✅ COMPLETE | All modules reviewed, issues documented |
| **QA Findings** | ⚠️ 4 CRITICAL | Blocking issues must be fixed before deployment |
| **Test Coverage** | ⚠️ IN PROGRESS | Test suite created, Prisma mocking needs fixes |
| **Migration Ready** | ✅ YES | All database tables created and indexed |
| **Monitoring Ready** | ✅ YES | Metrics, dashboards, and alerts configured |
| **Documentation** | ✅ COMPLETE | Runbooks and guides ready |

### 🚨 Critical Blockers (Must Fix Before Deployment)

1. **Export module not implemented** (src/lib/export/ is empty)
2. **Empty CSV handling broken** (parser returns false instead of error object)
3. **Validator missing null safety** (normalizedData mapping not implemented)
4. **Committer not validating data** (uses non-null assertion without checks)

**Timeline to Fix:** Estimated 4-6 hours for experienced team  
**Blocking PR Review:** QA team must verify all 4 issues fixed before merge to main

---

## 🗺️ Deployment Scope

### What's Included

✅ **Import Functionality**
- Multi-step import wizard (upload → parse → validate → deduplicate → commit)
- CSV and XLSX format support
- Column mapping with auto-detection
- Duplicate detection (within-batch and database)
- Data validation with error reporting
- Transaction-based rollback on errors
- Database schema with 3 new tables (ImportJob, ImportRecord, UserImportProfile)

✅ **Export Functionality** (To be implemented)
- Single card export (CSV/XLSX)
- Filtered export (by date, value, benefit type)
- All cards export (full wallet)
- Audit trail export
- File streaming for large datasets

✅ **Database Infrastructure**
- 1 Prisma migration (20260403042633_add_import_export_tables)
- 3 new tables + 30 indexes
- Connection pooling configured
- Transaction timeout: 120s
- Proper foreign keys with cascade deletes

✅ **CI/CD Pipeline**
- Import/export test suite integrated
- Security scanning for file uploads
- Performance benchmarks for parser
- Database migration verification
- Coverage requirements (>80%)

✅ **Monitoring & Alerting**
- Import job metrics collection
- Parser performance tracking
- Transaction rollback monitoring
- File upload distribution
- Database connection pool metrics

### What's NOT Included

❌ **Multi-region deployment** (single region only)  
❌ **S3/Cloud Storage integration** (files stored temporarily in /tmp)  
❌ **Advanced reporting** (basic dashboards only)  
❌ **User profiling for import preferences** (stored but not used in UI)  

---

## 🔧 Phase 1: Pre-Deployment (Today - Before QA Fixes)

### 1.1 QA Issues Must Be Fixed

**Assigned To:** Development Team  
**Timeline:** 4-6 hours  
**Blocking:** YES - Cannot deploy without fixes

**Issue #1: Export Module Implementation**
- [ ] Create `src/lib/export/exporter.ts` - Main export logic
- [ ] Create `src/lib/export/csv-generator.ts` - CSV formatting  
- [ ] Create `src/lib/export/xlsx-generator.ts` - XLSX formatting
- [ ] Create `src/lib/export/schema.ts` - Export types
- [ ] Create `src/actions/export.ts` - Server actions (3 endpoints)
- [ ] Add export API routes
- [ ] Update test suite with export tests
- [ ] Verify <10s performance for 10k records

**Issue #2: Empty File Handling**
- [ ] Fix parseFile() to properly handle header-only CSVs
- [ ] Return proper ParseResult object, not false
- [ ] Add test: "Handles empty CSV (headers only)"
- [ ] Test with completely empty file

**Issue #3: Validator Null Safety**
- [ ] Implement actual validation in validateImportFile()
- [ ] Fetch ImportRecords from database
- [ ] Map column mappings to field values
- [ ] Validate each record properly
- [ ] Update ImportRecord with validation results
- [ ] Return proper ValidateResponse with counts

**Issue #4: Committer Data Validation**
- [ ] Add null checks for normalizedData before use
- [ ] Validate required fields exist
- [ ] Remove non-null assertion operators (!)
- [ ] Return proper error messages
- [ ] Add try-catch for field access

### 1.2 Test Suite Validation

**Assigned To:** QA Team  
**Timeline:** 2 hours after fixes merged

- [ ] All unit tests pass (target: >80% coverage)
- [ ] All integration tests pass
- [ ] All edge cases covered (18 total)
- [ ] E2E tests pass for import wizard
- [ ] E2E tests pass for export flows
- [ ] No unhandled exceptions in error scenarios
- [ ] Database rollback verified for failure cases

### 1.3 Code Review & Sign-Off

**Assigned To:** Tech Lead  
**Timeline:** 1 hour

- [ ] All critical issues resolved
- [ ] No security vulnerabilities found
- [ ] Test coverage meets 80%+ threshold
- [ ] Documentation complete
- [ ] QA sign-off received
- [ ] Ready for merge to main branch

---

## 🚀 Phase 2: Deployment Preparation (Main Branch)

### 2.1 Merge to Main & Tag Release

```bash
# After QA sign-off
git checkout main
git pull origin main
git merge feature/import-export --no-ff -m "feat: add import/export functionality"
git tag -a v1.2.0 -m "Release: Import/Export Feature"
git push origin main --tags
```

### 2.2 Database Migration

**Timeline:** 1 hour before deployment  
**Downtime:** <1 minute for SQLite (lock during migration)

```bash
# Run migration locally first (test environment)
npm run prisma:migrate

# Verify migration applied
npx prisma studio

# Check schema matches specification
# All 3 new tables present:
# - ImportJob ✓
# - ImportRecord ✓
# - UserImportProfile ✓
```

### 2.3 Environment Configuration

**Create `.env.production` or update platform secrets:**

```env
# File Upload Configuration
IMPORT_MAX_FILE_SIZE_MB=50
IMPORT_MAX_ROWS=10000
IMPORT_TEMP_DIR=/tmp/card-benefits-imports
IMPORT_UPLOAD_TIMEOUT_MS=300000  # 5 minutes

# Processing Configuration
IMPORT_PARSE_TIMEOUT_MS=60000    # 1 minute
IMPORT_VALIDATE_TIMEOUT_MS=120000 # 2 minutes
IMPORT_COMMIT_TIMEOUT_MS=300000  # 5 minutes

# Feature Flags
FEATURE_FLAG_IMPORT_ENABLED=true
FEATURE_FLAG_EXPORT_ENABLED=true
IMPORT_EXPORT_GRADUAL_ROLLOUT_PCT=100  # 0-100 for gradual rollout

# Database Transaction Settings
DATABASE_TRANSACTION_TIMEOUT_MS=120000
DATABASE_CONNECTION_POOL_MIN=5
DATABASE_CONNECTION_POOL_MAX=20

# Monitoring
MONITORING_IMPORT_METRICS_ENABLED=true
MONITORING_EXPORT_METRICS_ENABLED=true
DATADOG_API_KEY=<fetch from secrets>
```

---

## 📊 Phase 3: Deployment Execution

### 3.1 Pre-Deployment Checklist

**Verify before starting deployment:**

- [ ] All 4 QA issues fixed and merged to main
- [ ] All tests passing (unit, integration, E2E)
- [ ] Code coverage >80%
- [ ] QA sign-off received
- [ ] No conflicting PRs in flight
- [ ] Production environment healthy
- [ ] Database backups current
- [ ] Monitoring systems online
- [ ] On-call team notified
- [ ] Rollback procedure tested

### 3.2 Deployment Steps

**Step 1: Database Migration (Lowest Risk)**
```bash
# On production server
cd /var/www/card-benefits
git fetch origin
git checkout v1.2.0

# Run migration with backup
mysqldump cardbenefits > backups/cardbenefits-pre-import-export.sql  # if MySQL
# OR for SQLite
cp data/cards.db backups/cards-pre-import-export.db

npm run prisma:migrate
# Verify: ImportJob, ImportRecord, UserImportProfile tables exist
```

**Step 2: Update Application Code**
```bash
npm ci  # Clean install in production
npm run build  # Build Next.js application
npm run type-check  # Verify no type errors
```

**Step 3: Deploy to Production**
```bash
# Update environment variables in production
# source /etc/card-benefits/.env.production

# Restart application (zero-downtime with rolling restart)
systemctl restart card-benefits
# OR for containerized deployment
docker pull card-benefits:v1.2.0
docker service update --image card-benefits:v1.2.0 card-benefits
```

**Step 4: Health Checks**
```bash
# Verify application is running
curl https://api.card-benefits.com/health
# Should return 200 OK

# Check database connection
curl https://api.card-benefits.com/api/health/db
# Should return: {"status": "connected"}

# Verify import endpoint available
curl https://api.card-benefits.com/api/import/upload
# Should return 405 (POST only, not GET)
```

### 3.3 Verification & Monitoring

**Immediate Post-Deployment (0-5 minutes):**
- Monitor application logs for errors
- Check error rates in monitoring dashboard
- Verify no spike in database connection pool usage
- Confirm import/export endpoints responding

**First Hour Monitoring:**
- Monitor error rate (target: <0.1%)
- Watch database query performance (target: <200ms p95)
- Track API response times (target: <500ms p95)
- Monitor memory usage (target: <80%)

**First Day Monitoring:**
- Monitor user adoption of import feature
- Track any import failures
- Check for edge cases in validation
- Verify duplicate detection accuracy

---

## 🛡️ Phase 4: Rollback Procedure

**Only if critical issues found after deployment**

### 4.1 Zero-Downtime Rollback

```bash
# Immediate action: Revert to previous version
cd /var/www/card-benefits
git fetch origin
git checkout v1.1.0  # Previous stable version

npm ci
npm run build
systemctl restart card-benefits
```

### 4.2 Database Rollback

If data corruption detected:

```bash
# SQLite: Restore from backup
cp backups/cards-pre-import-export.db data/cards.db
systemctl restart card-benefits

# Verify: ImportJob table is gone
# Users won't see import feature in UI (safe state)
```

### 4.3 Feature Flag Disable (Safe Option)

```bash
# In .env.production
FEATURE_FLAG_IMPORT_ENABLED=false
FEATURE_FLAG_EXPORT_ENABLED=false

# Restart
systemctl restart card-benefits

# Users see "Import/Export temporarily unavailable" message
# Data remains in database for future fixes
```

### 4.4 Incident Response

**If rollback executed:**

1. Create incident in status page
2. Notify users via dashboard banner
3. Post-mortem with development team (within 24 hours)
4. Root cause analysis
5. Implement fix with extended testing
6. Redeploy with enhanced monitoring

---

## 🔒 Security Configuration

### File Upload Validation

```typescript
// Enforced in src/actions/import.ts
const MAX_FILE_SIZE = parseInt(process.env.IMPORT_MAX_FILE_SIZE_MB || '50') * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.csv', '.xlsx'];
const ALLOWED_MIME_TYPES = [
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

// Magic bytes verification
const CSV_MAGIC = Buffer.from([0x2C]); // Comma or common starting char
const XLSX_MAGIC = Buffer.from([0x50, 0x4B, 0x03, 0x04]); // PK (ZIP)

function validateFileFormat(buffer: Uint8Array, filename: string): boolean {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  if (!ALLOWED_EXTENSIONS.includes(ext)) return false;
  
  // Check magic bytes
  if (ext === '.csv') {
    return buffer[0] >= 0x20 && buffer[0] <= 0x7E; // Printable ASCII
  } else if (ext === '.xlsx') {
    return buffer.slice(0, 4).every((b, i) => b === XLSX_MAGIC[i]);
  }
  return false;
}
```

### Database Transaction Security

```typescript
// All imports run in transactions with automatic rollback
const result = await prisma.$transaction(
  async (tx) => {
    // All operations happen here
    // If any operation fails, all changes are rolled back
  },
  {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    timeout: 120000, // 2 minute timeout
  }
);
```

### Authorization

```typescript
// All endpoints verify user ownership
const userId = getAuthUserIdOrThrow();
const importJob = await prisma.importJob.findUnique({
  where: { id: importJobId }
});

if (importJob.userId !== userId) {
  throw new AppError('AUTHZ_OWNERSHIP', {
    resource: 'ImportJob'
  });
}
```

---

## 📈 Monitoring & Alerting

### Metrics Collected

**Import Job Metrics:**
- Import job start/completion (gauge)
- Import success rate (rate)
- Records imported per job (histogram)
- Parse time per file (timing)
- Validation duration (timing)
- Duplicate detection accuracy (rate)
- Rollback frequency (rate)

**Parser Metrics:**
- CSV parse time (timing)
- XLSX parse time (timing)
- Column mapping accuracy (rate)
- Parse errors (counter)
- Records per file (histogram)

**Database Metrics:**
- Transaction duration (timing)
- Transaction rollback count (counter)
- ImportJob lock contention (gauge)
- Connection pool utilization (gauge)
- Query performance (timing)

### Dashboards

**Primary Dashboard (Real-Time Monitoring)**
- Import success/failure rate (last 1 hour)
- Average import time (last 24 hours)
- Records imported (last 7 days)
- Error rate by type
- Database transaction health

**Performance Dashboard**
- Parser latency (p50, p95, p99)
- Validation latency (p50, p95, p99)
- Transaction duration distribution
- File size distribution
- Duplicate detection accuracy

**Health Dashboard**
- Application availability (target: 99.9%)
- Error rate (target: <0.1%)
- Database connection pool (target: <80% utilization)
- Memory usage (target: <85%)
- API response time (p95 target: <500ms)

### Alerts (PagerDuty Integration)

**Critical Alerts** (Wake on-call immediately)
- Import feature error rate >5% for 5 minutes
- Database transaction timeout >1% for 10 minutes
- Application crash/restart
- Database connection pool exhausted
- Out of disk space for imports

**High Alerts** (Daily digest + dashboard warning)
- Rollback rate >1% of imports
- Parser timeout >0.5% of files
- Validation errors >10% of records
- Large file uploads (>40MB)
- Database query slowdown (>2x normal)

**Info Alerts** (Metrics only, no notification)
- Import job count >100 in 1 hour
- Average parse time increasing trend
- Duplicate detection accuracy <95%

---

## 🔄 Maintenance & Operations

### Regular Tasks

**Daily:**
- Monitor import feature dashboards
- Check error logs for new patterns
- Verify database health
- Confirm backups completed

**Weekly:**
- Analyze import success rates
- Review slow query logs
- Check for abandoned import jobs
- Verify rollback procedures still working

**Monthly:**
- Optimize database indexes if needed
- Review and update feature flags
- Analyze user adoption metrics
- Performance capacity planning

**Quarterly:**
- Security audit of file upload handling
- Database optimization review
- Test disaster recovery procedures
- Update monitoring thresholds

### Data Retention Policy

```
ImportJob records:
  - Keep for 90 days after completion
  - Archive to cold storage after 90 days
  - Delete after 1 year

ImportRecord entries:
  - Keep for 90 days (linked to ImportJob)
  - Bulk delete with ImportJob after retention expires

UserImportProfile:
  - Keep indefinitely (user preference data)
  - Archive profiles not used for 1 year
```

---

## 📞 Support & Troubleshooting

### Common Issues & Fixes

**Import fails with "File is empty" error**
- [ ] User uploaded file without any data
- [ ] Solution: Ask user to export sample file, verify format

**Import times out during large file processing**
- [ ] File size exceeds parser timeout
- [ ] Solution: Split large file into smaller batches, try again

**Parser can't detect column mappings**
- [ ] Headers in file don't match expected names
- [ ] Solution: Use provided template file, or manually map columns

**Duplicate detection throws database error**
- [ ] Race condition with concurrent imports
- [ ] Solution: Wait 30 seconds, retry import

**Entire import rolled back with unclear error**
- [ ] Check error log for specific issue
- [ ] Solution: Review validation errors, fix data, retry

### Escalation Path

**Level 1: User Support (Tier 1 - 1 hour SLA)**
- Use troubleshooting guide above
- Check feature is enabled (FEATURE_FLAG_IMPORT_ENABLED)
- Suggest exporting then re-importing subset

**Level 2: Engineering Support (Tier 2 - 4 hour SLA)**
- Check application logs for errors
- Verify database connectivity
- Review import job status/error_log in database

**Level 3: Incident Response (Tier 3 - 15 minute SLA)**
- Potential system outage
- Execute rollback procedure
- Declare incident, notify stakeholders

---

## 📋 Success Criteria

### Deployment Success Defined As:

✅ **Functionality**
- All import wizard steps complete (upload → parse → validate → deduplicate → commit)
- Export functionality working (all 3 variants)
- File validation working correctly
- Duplicate detection accurate (>95%)
- Transaction rollback working on errors

✅ **Reliability**
- Error rate <0.1% for 7 days post-deployment
- No unhandled exceptions in logs
- All critical and high alerts resolved
- Database transaction success rate >99%

✅ **Performance**
- Average import time <30 seconds for typical file (100 records)
- Parser latency <5 seconds per 1000 records
- API response time p95 <500ms
- No connection pool saturation

✅ **Security**
- No file upload vulnerabilities exploited
- No SQL injection possible (Prisma + parameterized queries)
- All authorization checks working
- File type validation working correctly

✅ **Operations**
- All monitoring dashboards populated with data
- All alerts configured and tested
- Runbooks verified by on-call team
- Feature flags working correctly

### Sign-Off Required From:
- [ ] QA Lead: All tests passing, issues resolved
- [ ] Security: File upload validation reviewed
- [ ] Database Admin: Migration tested, backups verified
- [ ] DevOps: CI/CD pipeline updated, monitoring configured
- [ ] Tech Lead: Code review complete, ready for production
- [ ] Product Manager: Feature scope agreed, user communication ready

---

## 📚 Related Documentation

- [Import/Export Specification](./SPEC_PHASE4_IMPORT_EXPORT.md)
- [QA Report & Findings](../.github/specs/import-export-qa-report.md)
- [Operational Runbook](./DEPLOYMENT_GUIDE_IMPORT_EXPORT.md)
- [CI/CD Pipeline Updates](../.github/workflows/ci-import-export.yml)
- [Environment Configuration Guide](./ENV_CONFIGURATION.md)
- [Troubleshooting Guide](./TROUBLESHOOTING_IMPORT_EXPORT.md)
- [Monitoring Setup](./MONITORING_IMPORT_EXPORT.md)

---

## 📞 Contact

**Questions or Issues During Deployment?**

- **Tech Lead**: @leads on GitHub
- **QA Team**: @qa-team
- **DevOps**: #devops Slack channel
- **Emergency**: Page on-call engineer (PagerDuty)

**Documentation Maintained By:** Development Team  
**Last Updated:** April 3, 2024  
**Next Review:** April 10, 2024 (Post-Deployment)
