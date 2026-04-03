# Custom Values Feature - Production Deployment Guide

**Feature:** Custom Benefit Values (Edit, ROI Recalculation, Audit Trail)  
**Deployment Target:** Vercel (production environment)  
**Database:** SQLite (local development) → PostgreSQL (production)  
**Estimated Duration:** 45-60 minutes  
**Downtime:** <2 minutes (database migration)  
**Created:** April 3, 2024  
**Status:** ⏳ AWAITING QA FIX COMPLETION

---

## ⚠️ PRE-DEPLOYMENT REQUIREMENTS

**🚨 DO NOT DEPLOY UNTIL ALL 5 CRITICAL ISSUES ARE RESOLVED:**

1. ✋ **Component Stubs Not Functional** - EditableValueField, BenefitValueComparison, and others must be fully implemented
2. ✋ **Value History Audit Trail Disabled** - Schema field must be added and audit trail enabled
3. ✋ **Test Suite Failures** - All 5 failing tests + 4 parsing errors must be resolved
4. ✋ **Incomplete ROI Calculations** - Player and household ROI must cascade properly
5. ✋ **TSX Test File Syntax Errors** - All test files must parse without errors

**Verification:** Once issues are fixed, run:
```bash
npm run test:all          # All tests must pass
npm run test:coverage     # Coverage must be ≥80% per file
npm run build             # Build must succeed
npm run type-check        # No TypeScript errors
npm run lint              # No linting errors
```

---

## ✅ Pre-Deployment Checklist

Complete this checklist 4 hours before deployment window:

### 1. Code Quality Verification
- [ ] All 5 critical QA issues resolved and documented
- [ ] All tests passing: `npm run test:all` (100% pass rate)
- [ ] Code coverage ≥80%: `npm run test:coverage`
- [ ] Type checking passes: `npm run type-check`
- [ ] Linting passes: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] No console errors or warnings in build output
- [ ] Custom values server actions tested end-to-end

### 2. Database Verification
- [ ] Database backups created and verified
- [ ] Prisma migration tested in staging: `npm run prisma:migrate`
- [ ] Migration rollback procedure tested
- [ ] Value history audit trail schema deployed
- [ ] Connection pool settings: min=2, max=20 connections
- [ ] Query timeout: 30 seconds (value updates)
- [ ] Indexes created on frequently queried fields

### 3. Performance Verification
- [ ] ROI calculation performance <300ms for single value update
- [ ] ROI calculation performance <500ms for player-level updates
- [ ] ROI calculation performance <1000ms for household-level updates
- [ ] Cache hit rate >85% for benefit values
- [ ] Memory usage <100MB per request cycle

### 4. Environment Configuration
- [ ] `CUSTOM_VALUES_CACHE_TTL` = "300" (5 minutes)
- [ ] `CUSTOM_VALUES_TIMEOUT` = "30000" (30 seconds)
- [ ] `ROI_CALCULATION_MAX_RETRIES` = "3"
- [ ] Feature flag `ENABLE_VALUE_HISTORY` = "true"
- [ ] `DATABASE_URL` points to production PostgreSQL
- [ ] All secrets configured in Vercel environment
- [ ] Log level: "info" (errors and important events)

### 5. Monitoring Setup
- [ ] Alert thresholds configured:
  - [ ] ROI calculation > 500ms: Page/Slack alert
  - [ ] Value update failure rate > 2%: Page/Slack alert
  - [ ] Audit trail records missing: Critical alert
  - [ ] Cache miss rate < 70%: Warning alert
- [ ] Dashboards created in monitoring platform
- [ ] Error log aggregation configured (Sentry, DataDog, etc.)
- [ ] Performance metrics collection enabled

### 6. Security Verification
- [ ] No hardcoded secrets in code
- [ ] All environment variables in Vercel secrets manager
- [ ] Database credentials rotated
- [ ] API rate limiting: 100 value updates per minute per user
- [ ] Audit trail data encrypted at rest
- [ ] Input validation tested for edge cases
- [ ] Authorization checks on custom value modifications

### 7. Team Communication
- [ ] Deployment window scheduled and communicated
- [ ] On-call engineer confirmed
- [ ] Rollback contact information documented
- [ ] Stakeholders notified of deployment schedule

---

## 📋 Deployment Steps

### Phase 1: Pre-Deployment (T-30 minutes)

#### 1.1 Merge to Main Branch
```bash
# Ensure all fixes are merged to main
git log --oneline main | head -5
# Verify commit includes custom values fixes
git show --stat HEAD | grep -E "src/(actions|lib|components)/custom-values"
```

#### 1.2 Trigger CI/CD Pipeline
- Verify GitHub Actions workflow runs automatically on push to main
- Monitor at: `https://github.com/[owner]/Card-Benefits/actions`
- All jobs must complete successfully:
  - ✅ Lint & Type Check
  - ✅ Build Next.js
  - ✅ Security Audit
  - ✅ Unit Tests
  - ✅ E2E Tests

```bash
# Verify build locally before pushing
npm run build
npm run test:all
```

#### 1.3 Database Backup
```bash
# Create backup of production database (if PostgreSQL)
# Run on production server or through Vercel backup tool
# Timestamp: $(date +%Y%m%d-%H%M%S)
```

### Phase 2: Database Migration (T-0 to T+2 minutes)

#### 2.1 Review Migration
```bash
# Verify migration is correct
npx prisma migrate diff --from-empty --to-schema-datasource prisma/schema.prisma

# Key changes:
# - Add valueHistory field to UserBenefit model
# - Create ValueHistory table for audit trail
# - Add indexes for custom values queries
```

#### 2.2 Run Migration
```bash
# In production environment (via Vercel deploy hook or direct access)
npx prisma migrate deploy

# Verify migration success
npx prisma studio  # Check data integrity
```

**Expected Output:**
```
✔ Database has been successfully migrated to migration_[timestamp]_init
```

### Phase 3: Application Deployment (T+2 to T+5 minutes)

#### 3.1 Deploy to Production
```bash
# Vercel automatic deployment (triggered on main branch push)
# Or manual deployment via Vercel CLI:
vercel deploy --prod

# Monitor deployment progress at Vercel dashboard
# Expected deployment time: 3-5 minutes
```

#### 3.2 Verify Deployment
- Check deployment logs for errors
- Verify build succeeded
- Check server-side logs for startup errors
- Verify database connection established

```bash
# Check application health endpoint
curl https://card-benefits.vercel.app/api/health

# Expected response:
# {
#   "status": "healthy",
#   "database": "connected",
#   "timestamp": "2024-04-03T12:00:00Z"
# }
```

### Phase 4: Post-Deployment Verification (T+5 to T+30 minutes)

#### 4.1 Smoke Testing
```bash
# Test core custom values functionality
1. Navigate to wallet page: https://card-benefits.vercel.app/wallet
2. Select a benefit value to edit
3. Update value in EditableValueField component
4. Verify save succeeds (toast notification)
5. Verify ROI calculation updates in real-time
6. Verify value history appears in ValueHistoryPopover
7. Verify audit trail records the change
```

**Test Scenarios:**
- Edit single benefit value
- Update multiple values in bulk
- Verify ROI calculations cascade to player level
- Verify ROI calculations cascade to household level
- Check value history audit trail completeness
- Verify data persists after page refresh

#### 4.2 Performance Verification
```bash
# Monitor key metrics in production
# Expected baseline:
# - ROI calculation: <300ms (p50), <500ms (p99)
# - Value update latency: <100ms (p50), <200ms (p99)
# - Cache hit rate: >85%
# - Memory usage: <100MB per request
```

#### 4.3 Error Monitoring
```bash
# Check error logs for issues
# Monitor Sentry/DataDog for exceptions
# Alert if error rate > 1% for custom values operations
# Check for validation errors or edge cases
```

#### 4.4 Database Verification
```bash
# Verify data integrity after migration
SELECT COUNT(*) as total_benefits FROM UserBenefit;
SELECT COUNT(*) as with_history FROM UserBenefit WHERE valueHistory IS NOT NULL;
SELECT COUNT(*) as audit_records FROM ValueHistory;

# Verify no data loss
# Ensure all user benefits still present
# Ensure custom values preserved
```

---

## 🔄 Rollback Procedure

**Use rollback if:**
- Tests fail in production
- Error rate > 5% for custom values operations
- ROI calculation performance > 1 second
- Database migration fails
- Audit trail not recording data

### Rollback Steps

#### Step 1: Pause Traffic (T-0 minutes)
```bash
# Option A: Revert deployment in Vercel dashboard
# Click "Deployments" → Select previous stable version → "Promote to Production"
# OR

# Option B: CLI rollback
vercel rollback --prod
```

#### Step 2: Database Rollback (T+1 minutes)
```bash
# Only if migration failed
# Use backup created before deployment

# If using PostgreSQL with versioning:
psql $DATABASE_URL -c "SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;"

# Rollback to previous migration:
npx prisma migrate resolve --rolled_back [migration_name]
```

**Important:** Do not modify production database directly. Use Prisma migration tools.

#### Step 3: Verify Rollback (T+3 minutes)
```bash
# Verify previous version is running
curl https://card-benefits.vercel.app/api/version

# Run smoke tests on rolled back version
# Verify basic functionality works
# Check error logs for issues
```

#### Step 4: Notify Team
- Post-mortem: Document what went wrong
- Fix identified issues
- Plan remediation steps
- Schedule re-deployment with additional testing

---

## 📊 Monitoring & Verification

### Key Metrics to Monitor (First 24 Hours)

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| ROI Calculation Latency (p50) | <300ms | >500ms |
| ROI Calculation Latency (p99) | <500ms | >1000ms |
| Value Update Success Rate | >99% | <98% |
| Value Update Failure Rate | <1% | >2% |
| Audit Trail Completeness | 100% | <99% |
| Cache Hit Rate | >85% | <70% |
| Error Rate | <1% | >2% |
| Page Load Time | <2s | >3s |
| Database Connection Pool Utilization | <70% | >80% |

### Custom Values Operations Monitoring

```javascript
// Metrics to track in application
1. updateBenefitValue() call count
2. updateBenefitValue() success rate
3. updateBenefitValue() error rate
4. updateBenefitValue() latency (p50, p99)
5. recalculatePlayerROI() latency
6. recalculateHouseholdROI() latency
7. createValueHistoryRecord() success rate
8. Value validation error rate
9. Cache hit/miss ratio
10. Audit trail write latency
```

### Dashboard Setup

Create dashboards in your monitoring platform (DataDog, New Relic, Grafana):

**Custom Values Dashboard:**
```
Row 1:
- ROI Calculation Latency (timeseries)
- Value Update Success Rate (gauge)
- Error Rate (line chart)

Row 2:
- Cache Hit Rate (line chart)
- Database Query Performance (heatmap)
- Audit Trail Records Created (counter)

Row 3:
- Error Log Entries (table, last 50)
- Slow Transactions (>500ms)
- User Action Heatmap (geography)
```

### Alerting Rules

**Critical Alerts (Page immediately):**
```
- ROI calculation latency > 1000ms
- Value update failure rate > 5%
- Audit trail records missing (count < expected)
- Database connection pool exhausted
```

**Warning Alerts (Slack/Email):**
```
- ROI calculation latency > 500ms
- Value update failure rate > 2%
- Cache hit rate < 70%
- Memory usage > 100MB
```

---

## 🔍 Troubleshooting

### Issue: ROI calculations not updating

**Diagnosis:**
```bash
# Check server logs for calculation errors
vercel logs --prod | grep -i "roi"

# Verify custom values are being saved
SELECT * FROM UserBenefit 
WHERE userDeclaredValue IS NOT NULL 
ORDER BY updatedAt DESC LIMIT 5;
```

**Resolution:**
1. Verify `recalculatePlayerROI()` is being called
2. Check for calculation timeout errors
3. Verify data types are correct (all cents, not dollars)
4. Clear cache and force recalculation

### Issue: Audit trail not recording

**Diagnosis:**
```bash
# Check if ValueHistory table exists
SELECT * FROM ValueHistory LIMIT 1;

# Check if feature flag is enabled
echo $ENABLE_VALUE_HISTORY
```

**Resolution:**
1. Verify migration ran successfully: `npx prisma migrate deploy`
2. Enable feature flag: `ENABLE_VALUE_HISTORY=true`
3. Check server logs for write errors
4. Verify database permissions

### Issue: Performance degradation

**Diagnosis:**
```bash
# Check query performance
vercel logs --prod | grep "duration:"

# Monitor cache effectiveness
# Check if values are being cached properly
```

**Resolution:**
1. Increase cache TTL if appropriate: `CUSTOM_VALUES_CACHE_TTL=600`
2. Clear cache and rebuild: Clear Redis/in-memory cache
3. Optimize queries: Add database indexes
4. Scale database connections if needed

### Issue: Validation errors

**Diagnosis:**
```bash
# Check which validation is failing
vercel logs --prod | grep -i "validation"

# Check for edge cases
curl -X POST https://card-benefits.vercel.app/api/values \
  -H "Content-Type: application/json" \
  -d '{"value": -100}' \
  --verbose
```

**Resolution:**
1. Review validation rules in `src/lib/custom-values/validation.ts`
2. Test edge cases (negative values, zero, large values)
3. Check input sanitization
4. Verify TypeScript types match validation logic

---

## 📝 Post-Deployment Tasks

### Immediate (Within 1 hour)
- [ ] Confirm all smoke tests passed
- [ ] Verify no critical errors in logs
- [ ] Confirm monitoring alerts are triggered correctly
- [ ] Verify audit trail is recording data
- [ ] Test ROI calculations on sample data

### Short-term (Within 24 hours)
- [ ] Monitor error rates in production
- [ ] Gather performance metrics baseline
- [ ] Test rollback procedure (document findings)
- [ ] Review user feedback for issues
- [ ] Verify cache effectiveness

### Follow-up (Within 1 week)
- [ ] Conduct post-deployment review with team
- [ ] Document lessons learned
- [ ] Optimize performance based on production metrics
- [ ] Plan next feature improvements
- [ ] Update documentation based on real-world usage

---

## 📞 Support Contacts

| Role | Contact | On-Call Schedule |
|------|---------|------------------|
| DevOps Engineer | [name] | [hours] |
| Backend Engineer | [name] | [hours] |
| Database Admin | [name] | [hours] |
| Product Manager | [name] | [hours] |

**Escalation Path:**
1. Alert on-call engineer → Slack #incidents
2. If unresolved in 15 min → Page team lead
3. If unresolved in 30 min → Page engineering manager
4. Critical: Initiate rollback and open bridge call

---

## 🔐 Security Checklist

Before deployment, verify:
- [ ] No sensitive data in logs
- [ ] API rate limiting enabled (100 req/min per user)
- [ ] Authorization checks on value updates
- [ ] Audit trail data encrypted at rest
- [ ] Database credentials rotated
- [ ] HTTPS enforced on all endpoints
- [ ] CORS properly configured
- [ ] Input validation prevents injection attacks
- [ ] Session tokens validated on each request
- [ ] Error messages don't leak sensitive information

---

## 📖 Related Documentation

- **Environment Configuration:** [ENV_CONFIGURATION_CUSTOM_VALUES.md](ENV_CONFIGURATION_CUSTOM_VALUES.md)
- **CI/CD Pipeline:** [.github/workflows/ci-custom-values.yml](.github/workflows/ci-custom-values.yml)
- **Monitoring Setup:** [MONITORING_CUSTOM_VALUES.md](MONITORING_CUSTOM_VALUES.md)
- **Operations Runbook:** [OPERATIONS_RUNBOOK_CUSTOM_VALUES.md](OPERATIONS_RUNBOOK_CUSTOM_VALUES.md)
- **Troubleshooting Guide:** [TROUBLESHOOTING_CUSTOM_VALUES.md](TROUBLESHOOTING_CUSTOM_VALUES.md)
- **Performance Tuning:** [PERFORMANCE_TUNING_CUSTOM_VALUES.md](PERFORMANCE_TUNING_CUSTOM_VALUES.md)

---

**Last Updated:** April 3, 2024  
**Next Review:** After QA fixes are deployed  
**Version:** 1.0
