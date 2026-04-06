# P0-2: Pagination Implementation - Deployment Runbook

**Feature**: API Pagination for `/api/cards/master` and `/api/cards/my-cards`  
**Status**: Ready for production deployment  
**Estimated Deployment Time**: 4-6 hours total (staging + production)

---

## Pre-Deployment Checklist

### 1. Code Verification ✅
- [ ] All 7 blockers from QA report are resolved
- [ ] `npm run build` passes successfully
- [ ] `npm run test` passes all test suites
- [ ] Code review completed and approved
- [ ] No TypeScript errors: `npm run type-check`

**Verification Commands**:
```bash
# Run all checks
npm run build && npm run test && npm run type-check
```

### 2. Documentation Review ✅
- [ ] P0-2-QA-FINDINGS-SUMMARY.md reviewed
- [ ] P0-2-TEST-VERIFICATION.md reviewed
- [ ] Implementation code matches specification
- [ ] All deployment steps documented

### 3. Security Review ✅
- [ ] DoS vulnerability fixed (max limits: 50/100 enforced)
- [ ] Authentication properly enforced on my-cards endpoint
- [ ] No SQL injection risks (using Prisma parameterized queries)
- [ ] Error messages don't leak sensitive information

### 4. Performance Baseline ✅
- [ ] Document current API response times (for comparison)
- [ ] Note current database load patterns
- [ ] Identify peak traffic times to avoid

**Expected Performance After Deployment**:
- Response size: 25KB (80-90% reduction from 500KB+)
- Response time: 50-100ms (5-10x faster)

### 5. Rollback Plan ✅
- [ ] Previous version backed up
- [ ] Rollback database migrations documented (if any)
- [ ] Previous API endpoints snapshot saved
- [ ] Team communication channels ready

---

## Staging Deployment (2-3 hours)

### Step 1: Pre-Deployment Backup (10 minutes)

```bash
# Create git backup tag
git tag -a "pre-p0-2-deployment-$(date +%Y%m%d)" -m "Backup before P0-2 pagination deployment"
git push origin "pre-p0-2-deployment-$(date +%Y%m%d)"

# Note current commit SHA
git rev-parse HEAD > /tmp/pre-deployment-sha.txt
```

**Verify**: Tag created and visible in GitHub

### Step 2: Staging Environment Setup (20 minutes)

```bash
# Deploy to staging
npm run build
npm run test

# Verify staging environment URL
echo "Staging URL: https://staging-card-benefits.railway.app"
```

**Checklist**:
- [ ] Code deployed to staging
- [ ] All tests passing
- [ ] Environment variables configured (staging URLs)
- [ ] Database migrations applied (if any)

### Step 3: Staging API Testing (45 minutes)

**Test Master Cards Endpoint** (`GET /api/cards/master`):

```bash
# Test with defaults
curl -X GET "https://staging-card-benefits.railway.app/api/cards/master"

# Test with pagination parameters
curl -X GET "https://staging-card-benefits.railway.app/api/cards/master?page=1&limit=12"
curl -X GET "https://staging-card-benefits.railway.app/api/cards/master?page=2&limit=50"

# Test boundary conditions
curl -X GET "https://staging-card-benefits.railway.app/api/cards/master?page=999&limit=50"
curl -X GET "https://staging-card-benefits.railway.app/api/cards/master?limit=100"  # Over max
```

**Expected Responses**:
- Default: 12 cards, hasMore calculated correctly
- Custom page: Respects limit (1-50), returns correct pagination metadata
- Invalid params: Returns gracefully with proper defaults
- Over limit: Capped at 50 items

**Test My-Cards Endpoint** (`GET /api/cards/my-cards`):

```bash
# With authentication
curl -X GET "https://staging-card-benefits.railway.app/api/cards/my-cards" \
  -H "x-user-id: test-user-123"

# With pagination
curl -X GET "https://staging-card-benefits.railway.app/api/cards/my-cards?page=1&limit=20" \
  -H "x-user-id: test-user-123"

# Test boundary
curl -X GET "https://staging-card-benefits.railway.app/api/cards/my-cards?page=2&limit=100" \
  -H "x-user-id: test-user-123"
```

**Expected Responses**:
- Returns user's cards with pagination (default 20/page, max 100)
- Summary calculated from ALL cards (not just paginated subset)
- Proper authentication required (401 if no x-user-id)

**Performance Verification**:
- Response time < 200ms (should be 50-100ms)
- Response size < 50KB (should be ~25KB)
- Database query time < 100ms

### Step 4: Load Testing (20 minutes)

```bash
# Simple load test (optional but recommended)
# Using Apache Bench or similar tool

# Load test master cards endpoint
ab -n 100 -c 10 "https://staging-card-benefits.railway.app/api/cards/master?page=1&limit=12"

# Monitor response times, ensure no degradation
```

**Success Criteria**:
- No timeout errors
- Response times consistent (< 200ms)
- No memory leaks (CPU/memory stable)

### Step 5: Staging Sign-Off (10 minutes)

- [ ] All API endpoints responding correctly
- [ ] Pagination logic working as expected
- [ ] Performance metrics acceptable
- [ ] Error handling working properly
- [ ] Pagination metadata accurate
- [ ] Security checks passed (DoS protected)

**Decision**: Proceed to production OR rollback to previous version

---

## Production Deployment (2-3 hours)

### Step 1: Production Environment Preparation (20 minutes)

```bash
# Create pre-deployment snapshot
git tag -a "production-p0-2-$(date +%Y%m%d)" \
  -m "P0-2 Pagination deployment to production"
git push origin "production-p0-2-$(date +%Y%m%d)"

# Note deployment time
echo "Deployment started: $(date -u)" > /tmp/deployment-log.txt
```

### Step 2: Production Deployment (30-45 minutes)

```bash
# Deploy to production (using Railway/Vercel/your platform)
# Follow your CI/CD pipeline

# Verify deployment
# - Check that new code is running
# - Verify all routes are accessible
# - Monitor error logs for issues
```

**Monitoring**:
- [ ] Check application logs for errors
- [ ] Verify database connectivity
- [ ] Monitor CPU/memory usage
- [ ] Track API response times
- [ ] Check error rates (should be < 1%)

### Step 3: Production API Verification (45 minutes)

**Smoke Tests** (5 minutes):

```bash
# Test master cards endpoint
curl -X GET "https://card-benefits.app/api/cards/master?page=1&limit=12"

# Test my-cards endpoint (as authenticated user)
curl -X GET "https://card-benefits.app/api/cards/my-cards?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Verify response structure
# - Should include pagination metadata
# - Should have correct record count
# - Should return 200 OK
```

**Detailed Tests** (30 minutes):

```bash
# Test various pagination scenarios
for page in 1 2 3 5 10; do
  curl "https://card-benefits.app/api/cards/master?page=$page&limit=12"
  echo "Page $page: OK"
done

# Test boundary conditions
curl "https://card-benefits.app/api/cards/master?limit=51"  # Over max
curl "https://card-benefits.app/api/cards/master?page=0"   # Invalid page
curl "https://card-benefits.app/api/cards/master?page=-1"  # Negative
```

**Expected Results**:
- All requests return 200 OK (invalid params gracefully handled)
- Response structure matches specification
- Pagination metadata accurate
- Database performance acceptable

### Step 4: User Acceptance Testing (30 minutes)

Test from end-user perspective:

```bash
# Open application in browser
# 1. Navigate to dashboard
# 2. Load card catalog (uses /api/cards/master)
#    - Verify cards load
#    - Verify pagination works
#    - Click through pages
# 
# 3. Load user cards (uses /api/cards/my-cards)
#    - Verify user cards load
#    - Verify summary calculation
#    - Verify pagination works
# 
# 4. Add new benefit to card
#    - Create new benefit
#    - Verify it appears in list
#    - Verify pagination still works
```

### Step 5: Monitoring Activation (10 minutes)

- [ ] Enable alerts for:
  - API response time > 500ms
  - Error rate > 5%
  - 5xx server errors
  - Database query time > 1000ms
- [ ] Set up dashboards to monitor pagination usage
- [ ] Configure log aggregation for debugging

### Step 6: Production Sign-Off (10 minutes)

**Deployment Complete**: 
- [ ] All endpoints working correctly
- [ ] Performance metrics acceptable
- [ ] Error rates normal
- [ ] No user complaints
- [ ] Monitoring configured

**Decision**: Deployment successful ✅

---

## Post-Deployment Monitoring (24-48 hours)

### Real-Time Monitoring (First 2 hours)

Monitor these metrics:
- **API Response Times**: Target < 150ms (95th percentile)
- **Error Rates**: Target < 1% (5xx errors)
- **Database Query Times**: Target < 100ms
- **Success Rates**: Target > 99%

**Action If Issues Found**:
1. **If response time > 500ms**: Check database query performance
2. **If error rate > 5%**: Check error logs immediately
3. **If 5xx errors spike**: Consider rollback

### Daily Monitoring (First week)

Track:
- Daily API request volume
- Page distribution (are users using pagination?)
- Error patterns
- Performance trends

**Weekly Review**:
- Aggregate statistics
- User feedback
- Performance comparison to baseline
- Identify optimization opportunities

---

## Rollback Procedure (If Needed)

**Decision to Rollback**: Error rate > 10%, response time > 1s, or critical bug found

```bash
# 1. Identify previous stable version
PREVIOUS_SHA=$(cat /tmp/pre-deployment-sha.txt)

# 2. Revert deployment
git revert -n $PREVIOUS_SHA
git push origin main

# 3. Deploy reverted code
npm run build
# Deploy to production

# 4. Verify rollback
# Test endpoints to confirm previous behavior restored

# 5. Notify team
# Communicate rollback and timeline for fix

# 6. Root cause analysis
# Document what went wrong
# Plan for re-deployment with fix
```

---

## Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Build Passes | ✅ | npm run build succeeds |
| Tests Pass | ✅ | npm run test all pass |
| API Endpoint 1 | ✅ | /api/cards/master responds < 150ms |
| API Endpoint 2 | ✅ | /api/cards/my-cards responds < 150ms |
| Error Rate | < 1% | No excessive errors |
| Security | ✅ | DoS protected, auth enforced |
| Pagination Logic | ✅ | hasMore, totalPages accurate |
| Database Load | ✅ | Query time < 100ms |

---

## Deployment Timeline

| Phase | Duration | Owner |
|-------|----------|-------|
| Pre-Deployment Checks | 30 min | QA |
| Staging Deployment | 2 hours | DevOps |
| Staging Verification | 1 hour | QA |
| Production Deployment | 1 hour | DevOps |
| Production Verification | 1 hour | QA + Team |
| Monitoring Setup | 30 min | DevOps |
| **Total** | **~5-6 hours** | |

---

## Communication Plan

### Before Deployment
- Notify stakeholders of scheduled deployment
- Estimated maintenance window: 2-3 hours
- Expected impact: Improved API performance

### During Deployment
- Post updates to #deployments channel
- Note estimated completion time
- Alert on any issues

### After Deployment
- Confirm successful deployment
- Share performance metrics
- Thank team for support

---

## Contact & Escalation

**On-Call Engineer**: [Name/Slack]  
**DevOps Lead**: [Name/Slack]  
**QA Lead**: [Name/Slack]  

**Escalation Path**:
1. Issue detected → Notify on-call engineer (Slack)
2. If not resolved in 15 min → Notify DevOps lead
3. If not resolved in 30 min → Initiate rollback
4. After rollback → Notify all stakeholders

---

## Document History

| Date | Version | Status | Notes |
|------|---------|--------|-------|
| 2026-04-06 | 1.0 | Draft | Initial runbook created |
| | | | |

---

## Appendix: Useful Commands

```bash
# Health check
curl https://card-benefits.app/api/health

# Check API version
curl https://card-benefits.app/api/version

# Monitor real-time logs
tail -f logs/production.log

# Database query stats
psql -d card_benefits_prod -c "SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10"

# API performance metrics
curl https://card-benefits.app/api/metrics | jq '.pagination'
```

---

**Deployment Runbook Created**: 2026-04-06  
**Status**: Ready for use  
**Last Updated**: N/A
