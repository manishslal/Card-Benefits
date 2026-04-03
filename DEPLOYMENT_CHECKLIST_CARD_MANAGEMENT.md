# Card Management - Production Deployment Checklist

**Feature:** Card Management (Complete CRUD, Search, Filter, Bulk Operations)  
**Status:** ✅ APPROVED FOR PRODUCTION  
**QA Report:** 152/152 tests passing, 92%+ coverage, zero critical issues  
**Deployment Date:** _______________  
**Deployed By:** _______________  
**Reviewed By:** _______________

---

## Pre-Deployment Phase (48 hours before)

### Code & Quality Assurance

- [ ] **QA Report Reviewed**
  - Report location: `.github/specs/card-management-qa-report.md`
  - Status: ✅ APPROVED FOR PRODUCTION
  - Test Results: 152/152 passing
  - Coverage: 92%+
  - Critical Issues: 0

- [ ] **All Tests Passing**
  ```bash
  npm run test -- --run src/__tests__/lib/card-*.test.ts
  # Expected: ✅ All tests pass
  ```

- [ ] **Build Succeeds**
  ```bash
  npm run build
  # Expected: ✅ Build successful, .next folder created
  ```

- [ ] **No Type Errors**
  ```bash
  npm run type-check
  # Expected: ✅ No errors
  ```

- [ ] **Linting Passes**
  ```bash
  npm run lint
  # Expected: ✅ No errors or only warnings
  ```

- [ ] **Security Audit Passes**
  ```bash
  npm audit --audit-level=moderate
  # Expected: ✅ No moderate or high vulnerabilities
  ```

- [ ] **Code Review Complete**
  - [ ] Architecture review: ✓
  - [ ] Security review: ✓
  - [ ] Performance review: ✓
  - [ ] Authorization review: ✓
  - Approvals: ___________, ___________

### Infrastructure Prerequisites

- [ ] **Production Database Ready**
  - [ ] PostgreSQL or SQLite database created
  - [ ] Database accessible and tested
  - [ ] Connection string verified: `DATABASE_URL=_______________`
  - [ ] Backup system configured
  - [ ] Backup test performed: Date _______________

- [ ] **Environment Variables Configured**
  - [ ] `DATABASE_URL` set
  - [ ] `SESSION_SECRET` generated and stored
  - [ ] `CRON_SECRET` generated and stored
  - [ ] Feature flags configured
  - [ ] All variables validated (see ENV_CONFIGURATION_CARD_MANAGEMENT.md)

- [ ] **GitHub Secrets Configured**
  - [ ] `PROD_DATABASE_URL` ✓
  - [ ] `PROD_SESSION_SECRET` ✓
  - [ ] `PROD_CRON_SECRET` ✓
  - [ ] `PROD_SENTRY_DSN` ✓
  - [ ] `PROD_DATADOG_KEY` ✓
  - [ ] `DEPLOY_TOKEN` ✓

- [ ] **Monitoring & Alerting Setup**
  - [ ] Datadog/New Relic dashboards created
  - [ ] Alert rules configured
  - [ ] Slack integration tested
  - [ ] PagerDuty integration tested
  - [ ] Test alert fired successfully: Date _______________

- [ ] **Logging Configured**
  - [ ] Centralized logging set up
  - [ ] Log retention policy configured
  - [ ] Search/filter working
  - [ ] Test log entry created and found

- [ ] **Error Tracking Configured**
  - [ ] Sentry project created and configured
  - [ ] Test error reported and found
  - [ ] Notification routing verified

### Team & Communication

- [ ] **Stakeholders Notified**
  - [ ] DevOps team: ✓ Date _______________
  - [ ] QA team: ✓ Date _______________
  - [ ] Support team: ✓ Date _______________
  - [ ] Product team: ✓ Date _______________

- [ ] **Runbooks Reviewed**
  - [ ] Operations Runbook: OPERATIONS_RUNBOOK_CARD_MANAGEMENT.md
  - [ ] Reviewed by Ops team: ✓ Date _______________
  - [ ] Rollback procedure understood: ✓

- [ ] **Deployment Window Scheduled**
  - [ ] Date: _______________
  - [ ] Time: _______________
  - [ ] Duration estimate: _______________
  - [ ] Participants: ___________, ___________, ___________
  - [ ] Communication channel: Slack #deployment

- [ ] **Maintenance Window Planned** (if needed)
  - [ ] Start time: _______________
  - [ ] Expected duration: _______________
  - [ ] User notification: ✓
  - [ ] Status page updated: ✓

---

## Deployment Day - Pre-Deployment (3 hours before)

### Final Verification

- [ ] **Code Branch Status**
  ```bash
  git status
  # Expected: On main branch, all changes committed
  git log --oneline -5
  # Expected: Latest commit is Card Management feature
  ```

- [ ] **Latest Version Built**
  ```bash
  npm run build
  # Expected: ✅ Build successful
  ```

- [ ] **Database Backup Created**
  ```bash
  # Create production backup
  cp prod.db prod.db.backup.$(date +%Y%m%d-%H%M%S)
  ls -lh prod.db.backup.* | head -1
  # Expected: Recent backup file created
  ```

- [ ] **Backup Verified**
  ```bash
  # Verify backup can be restored
  sqlite3 prod.db.backup.* "SELECT COUNT(*) FROM UserCard;" > /dev/null
  # Expected: Query succeeds
  ```

- [ ] **System Health Check**
  ```bash
  # Current application
  curl https://app.cardbenefits.com/api/health
  # Expected: 200 OK
  
  # Database connectivity
  npx prisma db execute --stdin << 'EOF'
  SELECT COUNT(*) as card_count FROM "UserCard";
  EOF
  # Expected: Current card count returned
  ```

- [ ] **Error Rates Normal**
  ```
  Current error rate: < 0.1% ✓
  P95 latency: < 500ms ✓
  Database connections: < 80% ✓
  ```

- [ ] **Documentation Current**
  - [ ] PRODUCTION_DEPLOYMENT_GUIDE.md: ✓
  - [ ] OPERATIONS_RUNBOOK_CARD_MANAGEMENT.md: ✓
  - [ ] MONITORING_SETUP_CARD_MANAGEMENT.md: ✓
  - [ ] ENV_CONFIGURATION_CARD_MANAGEMENT.md: ✓

- [ ] **Rollback Plan Verified**
  - [ ] Rollback script tested: ✓
  - [ ] Database restore tested: ✓
  - [ ] Time to rollback: _____ minutes
  - [ ] Procedure documented in: OPERATIONS_RUNBOOK_CARD_MANAGEMENT.md

- [ ] **Team Synchronized**
  - [ ] Team meeting held: Date _______________
  - [ ] Deployment plan reviewed: ✓
  - [ ] Responsibilities assigned: ✓
  - [ ] Communication plan confirmed: ✓

---

## Deployment Phase

### Step 1: Pre-Deployment System Check (5 minutes)

```bash
# 1.1 Environment variables
[ -n "$DATABASE_URL" ] && echo "✓ DATABASE_URL set" || echo "✗ DATABASE_URL missing"
[ -n "$SESSION_SECRET" ] && echo "✓ SESSION_SECRET set" || echo "✗ SESSION_SECRET missing"
[ -n "$CRON_SECRET" ] && echo "✓ CRON_SECRET set" || echo "✗ CRON_SECRET missing"

# 1.2 Database connectivity
npx prisma db execute --stdin << 'EOF'
SELECT COUNT(*) FROM "UserCard";
EOF
# Expected: ✓ Number returned

# 1.3 Current application status
curl -s https://app.cardbenefits.com/api/health | jq .
# Expected: { "status": "healthy" }
```

**Checklist:**
- [ ] All environment variables set
- [ ] Database connected
- [ ] Current application healthy
- **Decision: Proceed? [ YES / NO ]**

### Step 2: Database Migration (10 minutes)

```bash
# 2.1 Review pending migrations
npx prisma migrate status

# 2.2 Apply migrations
npx prisma migrate deploy

# 2.3 Verify migration succeeded
npx prisma db execute --stdin << 'EOF'
PRAGMA table_info(UserCard);
EOF
# Should show: status column, archivedAt column, etc.

# 2.4 Verify indexes created
npx prisma db execute --stdin << 'EOF'
SELECT name FROM sqlite_master 
WHERE type='index' AND tbl_name='UserCard';
EOF
# Should show indexes on (playerId, status), renewalDate, etc.
```

**Checklist:**
- [ ] Migrations reviewed
- [ ] Migrations applied successfully
- [ ] Schema verified
- [ ] Indexes verified
- **Decision: Proceed? [ YES / NO ]**

### Step 3: Build & Deploy (15 minutes)

```bash
# 3.1 Clean build
rm -rf .next node_modules
npm ci
npm run build
# Expected: ✓ Build successful

# 3.2 Stop current application
kill $(pgrep -f "npm start") || true
sleep 2

# 3.3 Start new application
NODE_ENV=production npm start &
APP_PID=$!
sleep 5

# 3.4 Verify new version is running
curl http://localhost:3000/api/health
# Expected: 200 OK
```

**Checklist:**
- [ ] Build completed successfully
- [ ] Old application stopped
- [ ] New application started
- [ ] Health check passed
- **Decision: Proceed? [ YES / NO ]**

### Step 4: Smoke Tests (10 minutes)

```bash
# 4.1 Run card management tests
npm run test:e2e -- tests/smoke/card-management.spec.ts

# 4.2 Test card creation
curl -X POST https://app.cardbenefits.com/api/cards \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Card","fee":5500}'
# Expected: 201 Created

# 4.3 Test card retrieval
curl https://app.cardbenefits.com/api/cards \
  -H "Authorization: Bearer $AUTH_TOKEN"
# Expected: 200 OK, card list returned

# 4.4 Test card update
curl -X PUT https://app.cardbenefits.com/api/cards/card-id \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{"status":"ACTIVE"}'
# Expected: 200 OK

# 4.5 Test card archive
curl -X POST https://app.cardbenefits.com/api/cards/card-id/archive \
  -H "Authorization: Bearer $AUTH_TOKEN"
# Expected: 200 OK
```

**Checklist:**
- [ ] Smoke tests passed
- [ ] Card creation works
- [ ] Card retrieval works
- [ ] Card update works
- [ ] Card archive works
- **Decision: Proceed? [ YES / NO ]**

### Step 5: Continuous Monitoring (First 30 minutes)

```bash
# 5.1 Monitor error rate
watch -n 10 'curl -s https://app.cardbenefits.com/api/metrics | grep error_rate'

# 5.2 Monitor response times
watch -n 10 'curl -s https://app.cardbenefits.com/api/metrics | grep latency'

# 5.3 Watch logs for errors
tail -f logs/app.log | grep -i "error\|exception\|failed"

# 5.4 Check database connections
watch -n 5 'sqlite3 prod.db "SELECT COUNT(*) FROM sqlite_master WHERE type=\"table\";"'

# 5.5 Monitor system resources
watch -n 5 'ps aux | grep node | grep -v grep'
```

**Metrics to Monitor:**
- [ ] Error rate: _________ (target: < 0.1%)
- [ ] P95 latency: _________ ms (target: < 500ms)
- [ ] P99 latency: _________ ms (target: < 1000ms)
- [ ] Database connections: _________ / 30 (target: < 80%)
- [ ] Memory usage: _________ MB (target: < 1000MB)
- [ ] CPU usage: _________ % (target: < 30%)

**Decision at 30 minutes:**
- [ ] All metrics green → **CONTINUE**
- [ ] Issues detected → **INVESTIGATE / ROLLBACK**

---

## Post-Deployment Phase (First 24 hours)

### Hour 1: Active Monitoring

- [ ] **Error Rate Check**
  - Current: __________%
  - Target: < 0.1%
  - [ ] ✓ Within target
  - [ ] ✗ Above target (escalate)

- [ ] **Response Time Check**
  - P95: _________ ms
  - P99: _________ ms
  - Target P95: < 500ms
  - [ ] ✓ Within target
  - [ ] ✗ Above target (investigate)

- [ ] **Database Health Check**
  ```bash
  sqlite3 prod.db << 'EOF'
  SELECT 
    COUNT(*) as total_cards,
    SUM(CASE WHEN status='ACTIVE' THEN 1 ELSE 0 END) as active_cards,
    SUM(CASE WHEN status='ARCHIVED' THEN 1 ELSE 0 END) as archived_cards
  FROM UserCard;
  EOF
  ```
  - Total cards: _________
  - Active: _________
  - Archived: _________
  - [ ] ✓ Count matches expectations
  - [ ] ✗ Unexpected count (investigate)

- [ ] **Feature Availability Check**
  - [ ] Card creation available
  - [ ] Card search working
  - [ ] Card archive working
  - [ ] Bulk operations working

### Hour 2-4: Expanded Testing

- [ ] **User Acceptance Testing**
  - [ ] Test card creation with different card types
  - [ ] Test search with various queries
  - [ ] Test filtering by status
  - [ ] Test bulk operations
  - [ ] All tests pass: ✓ Date _______________

- [ ] **Edge Case Testing**
  - [ ] Create card with max annual fee
  - [ ] Search with special characters
  - [ ] Bulk update 100 cards
  - [ ] Archive and restore cards
  - [ ] All tests pass: ✓ Date _______________

- [ ] **Performance Under Load**
  - Run load test: `npm run test:load -- --users 100 --duration 300`
  - Results:
    - Average latency: _________ ms
    - P95 latency: _________ ms
    - Error rate: _________%
    - [ ] ✓ Meets SLA
    - [ ] ✗ Below SLA (investigate)

### Hours 4-24: Continued Verification

- [ ] **Monitoring Dashboard**
  - [ ] All metrics displayed correctly
  - [ ] Alerts triggering properly
  - [ ] No false positives

- [ ] **Error Tracking**
  - [ ] Sentry showing expected errors only
  - [ ] No unexpected error patterns
  - [ ] Error count < 10 in 24 hours

- [ ] **Data Integrity**
  ```bash
  # Verify no data corruption
  sqlite3 prod.db << 'EOF'
  SELECT 
    COUNT(*) as total_records,
    SUM(CASE WHEN status NOT IN ('ACTIVE','PENDING','PAUSED','ARCHIVED','DELETED') THEN 1 ELSE 0 END) as invalid_status
  FROM UserCard;
  EOF
  ```
  - Invalid status count: 0 ✓

- [ ] **Backup Created**
  - [ ] Post-deployment backup created
  - [ ] Backup verified
  - [ ] Location: prod.db.backup._________

- [ ] **Team Notification**
  - [ ] Deployment complete message sent
  - [ ] Monitoring status shared
  - [ ] No critical issues found

---

## Rollback Readiness

### Automatic Rollback Triggers

**Rollback immediately if:**

- [ ] Error rate > 5%
- [ ] Service becomes completely unavailable
- [ ] Data corruption detected
- [ ] More than 3 failed tests

**Investigate before rollback if:**

- [ ] Error rate 1-5%
- [ ] Slow responses (but not unavailable)
- [ ] Single failed test case

### Rollback Procedure

```bash
#!/bin/bash
echo "🔄 INITIATING ROLLBACK"

# 1. Stop current deployment
kill $(pgrep -f "npm start")

# 2. Restore database
cp prod.db.backup.latest prod.db

# 3. Revert code
git revert --no-edit HEAD

# 4. Rebuild with previous version
npm install
npm run build

# 5. Start previous version
npm start &

# 6. Verify
sleep 10
curl https://app.cardbenefits.com/api/health

# 7. Notify
# Send message to #deployment channel
```

**Rollback Time: _________ minutes**

---

## Sign-Off

### Deployment Approval

- [ ] **Tech Lead Approval**
  - Name: _______________
  - Date: _______________
  - Signature: _______________

- [ ] **QA Lead Approval**
  - Name: _______________
  - Date: _______________
  - Signature: _______________

- [ ] **DevOps Lead Approval**
  - Name: _______________
  - Date: _______________
  - Signature: _______________

### Post-Deployment Sign-Off (24 hours after)

- [ ] **All Metrics Green**
  - Error rate: _________% ✓
  - Response time P95: _________ ms ✓
  - Database health: ✓
  - No critical issues: ✓

- [ ] **Production Status**
  - [ ] Feature fully functional
  - [ ] No user-facing issues
  - [ ] Performance acceptable
  - [ ] Data integrity confirmed

- [ ] **Final Approval**
  - DevOps Engineer: _____________ Date: _______
  - Engineering Manager: _____________ Date: _______

---

## Deployment Record

```
┌─────────────────────────────────────────────────────┐
│          DEPLOYMENT COMPLETION RECORD               │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Feature:               Card Management              │
│ Deployment Date:       _______________              │
│ Deployment Time:       _____________ UTC            │
│ Deployed By:           _______________              │
│ Approved By:           _______________              │
│                                                     │
│ Database Backup:       _______________              │
│ Code Version:          _______________              │
│ Build Artifact:        _______________              │
│                                                     │
│ Issues Found:          ___ (specify)                │
│ Issues Resolved:       ___ (specify)                │
│ Rollback Required:     [ YES / NO ]                 │
│                                                     │
│ Post-Deployment Status: ✓ STABLE                   │
│                                                     │
│ Notes:                                              │
│ _____________________________________________________│
│ _____________________________________________________│
│ _____________________________________________________│
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Related Documentation

- 📘 [Production Deployment Guide](./PRODUCTION_DEPLOYMENT_GUIDE.md)
- 📘 [Operations Runbook](./OPERATIONS_RUNBOOK_CARD_MANAGEMENT.md)
- 📘 [Monitoring Setup](./MONITORING_SETUP_CARD_MANAGEMENT.md)
- 📘 [Environment Configuration](./ENV_CONFIGURATION_CARD_MANAGEMENT.md)
- 📊 [QA Report](../.github/specs/card-management-qa-report.md)

---

**For questions during deployment, contact the on-call engineer at: #deployment**
