# Phase 4 Dashboard MVP - Post-Deployment Monitoring & Health Checks

**Project**: Card Benefits Dashboard MVP  
**Phase**: 4 (DevOps Post-Deployment Monitoring)  
**Deployment Target**: Railway Production  
**Status**: 🟡 **Ready for post-deployment phase**  
**Monitoring Window**: 24 hours post-deployment  

---

## Executive Summary

This guide provides comprehensive **health check procedures**, **monitoring protocols**, and **verification commands** to validate production deployment stability and performance over the critical first 24 hours.

**Monitoring Approach**: Multi-layered verification combining:
- ✅ Automated health checks (every 30 seconds)
- ✅ API endpoint validation (every 5 minutes)
- ✅ Performance metrics tracking (continuous)
- ✅ Error rate monitoring (real-time)
- ✅ Database integrity checks (every 15 minutes)
- ✅ Manual verification checkpoints (every 30 minutes for 2 hours, then hourly)

**Success Criteria**: Zero critical issues, <0.1% error rate, <2s response times

---

## 📊 Health Check System

### 1. Automated Health Endpoint

**Purpose**: Rapid detection of application unavailability

**Endpoint**: `GET /api/health`

**Check Frequency**: Every 30 seconds (Railway automatic)

**Command for manual testing**:
```bash
curl -s https://your-production-url/api/health | jq .

# Expected response:
# {
#   "status": "ok",
#   "timestamp": "2024-01-15T14:30:45.123Z",
#   "database": "connected",
#   "uptime": 3600
# }
```

**Response codes**:
- ✅ **200 OK**: Application and database healthy
- ⚠️ **503 Service Unavailable**: Application starting or database connection issue
- ❌ **No response / Timeout**: Application crashed or not responding

**What to do if failing**:
```bash
# 1. Wait 30 seconds (container may be restarting)
sleep 30
curl -s https://your-production-url/api/health

# 2. Check logs for errors
railway logs --service web --tail 50

# 3. Check application status
railway status

# 4. If unresponsive: Rollback (see deployment guide)
```

### 2. Database Connectivity Check

**Purpose**: Verify database connection pool is healthy

**Check frequency**: Every 15 minutes

**Command**:
```bash
# Direct database query via Railway
railway run psql -c "SELECT 1;"

# Expected: (1 row)
```

**Alternative - via API**:
```bash
curl -s https://your-production-url/api/benefits/filters \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq . | head -20

# Expected: { "success": true, "data": [...] }
```

**Performance check**:
```bash
# Measure query response time
time curl -s https://your-production-url/api/benefits/filters \
  -H "Authorization: Bearer $AUTH_TOKEN" > /dev/null

# Expected: real 0m0.XXXs (under 1 second)
```

---

## 🚀 Post-Deployment Verification Timeline

### Phase 1: First 5 Minutes (Continuous)

**Critical checks** - Run every 30 seconds:

```bash
#!/bin/bash
# health-check-critical.sh

for i in {1..10}; do
  echo "[$(date +'%T')] Health Check #$i"
  
  # Check 1: Health endpoint
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://your-production-url/api/health)
  echo "  Health endpoint: $HTTP_CODE"
  
  # Check 2: Dashboard page
  DASH_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://your-production-url/dashboard)
  echo "  Dashboard page: $DASH_CODE"
  
  # Check 3: Response time
  RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" https://your-production-url/api/health)
  echo "  Response time: ${RESPONSE_TIME}s"
  
  if [[ "$HTTP_CODE" == "200" && "$DASH_CODE" == "200" ]]; then
    echo "  ✅ All checks PASS"
  else
    echo "  ❌ ISSUE DETECTED"
    exit 1
  fi
  
  sleep 30
done
```

**What to monitor**:
- [ ] Health endpoint responds with 200
- [ ] Dashboard page loads (200 or redirect)
- [ ] Response time <500ms
- [ ] No error messages in logs
- [ ] CPU usage <10%
- [ ] Memory usage <50MB

**Signs of problems**:
- ❌ Health endpoint returns 503 or no response
- ❌ Response time >5 seconds
- ❌ Dashboard shows blank page
- ❌ Errors in Railway logs
- ❌ High CPU (>50%) or memory (>100MB)

### Phase 2: 5-30 Minutes (Every 2 Minutes)

**Extended validation** - Ensure stability:

```bash
#!/bin/bash
# health-check-extended.sh

echo "Extended health check - 25 minute monitoring"

for i in {1..13}; do
  echo "[$(date +'%T')] Extended Check #$i"
  
  # Check 1: API endpoints
  curl -s https://your-production-url/api/health | jq '.status' && echo "  ✅ Health OK"
  
  # Check 2: Benefits endpoint
  curl -s https://your-production-url/api/benefits/filters \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -w "\n  Response time: %{time_total}s\n"
  
  # Check 3: Dashboard functionality
  curl -s https://your-production-url/dashboard \
    -w "  Dashboard: %{http_code}\n"
  
  # Check 4: Logs for errors
  echo "  Checking logs for errors..."
  railway logs --service web --tail 20 | grep -i "error\|fail\|exception" | wc -l | xargs echo "  Errors found:"
  
  # Check 5: Resource usage
  echo "  Checking resource usage..."
  railway logs --service web --tail 5 | tail -1
  
  sleep 120
done
```

**Validation items**:
- [ ] All API endpoints responding
- [ ] Response times <1s
- [ ] No errors in logs
- [ ] Database queries completing
- [ ] Memory usage increasing (but not linearly)
- [ ] No stuck processes

### Phase 3: 30 Minutes - 2 Hours (Every 5 Minutes)

**Stability validation**:

```bash
#!/bin/bash
# health-check-stability.sh

echo "Stability check - 90 minute monitoring"

for i in {1..18}; do
  echo "[$(date +'%T')] Stability Check #$i"
  
  # Performance metrics
  echo "  Testing performance..."
  TIME=$(curl -s -o /dev/null -w "%{time_total}" https://your-production-url/api/health)
  echo "  Health check response time: ${TIME}s"
  
  # Error rate from logs
  ERRORS=$(railway logs --service web --tail 100 | grep -i "error" | wc -l)
  echo "  Errors in logs: $ERRORS"
  
  # Database check
  echo "  Database connectivity..."
  railway run psql -c "SELECT COUNT(*) FROM users;" && echo "  ✅ Database OK"
  
  # Memory leak check (compare with baseline)
  echo "  Memory usage check..."
  railway status | grep -A 2 "web" && echo "  ✅ Services running"
  
  sleep 300  # 5 minutes
done
```

**Validation items**:
- [ ] Response times consistent (not increasing)
- [ ] Error count stable (not growing)
- [ ] Database responsive
- [ ] No memory leaks (memory usage stable)
- [ ] No gradual performance degradation

### Phase 4: 2-24 Hours (Hourly Checks)

**Ongoing stability verification**:

```bash
#!/bin/bash
# health-check-hourly.sh

echo "Hourly monitoring - 22 hour window"

for i in {1..22}; do
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] Hourly Check #$i"
  
  # Core health
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" https://your-production-url/api/health)
  echo "  Health endpoint: $HTTP"
  
  # Performance
  PERF=$(curl -s -o /dev/null -w "%{time_total}" https://your-production-url/api/benefits/filters \
    -H "Authorization: Bearer $AUTH_TOKEN")
  echo "  API response time: ${PERF}s"
  
  # Error count
  HOUR_ERRORS=$(railway logs --service web --since="-1h" | grep -i "error" | wc -l)
  echo "  Errors (last hour): $HOUR_ERRORS"
  
  # Database
  DB_ROWS=$(railway run psql -tc "SELECT COUNT(*) FROM users;")
  echo "  Users in database: $DB_ROWS"
  
  # Memory check
  echo "  System status:"
  railway status | tail -3
  
  if [[ "$HTTP" != "200" ]]; then
    echo "  ⚠️ HEALTH CHECK FAILED - INVESTIGATE IMMEDIATELY"
    # Trigger alerts
  else
    echo "  ✅ All checks pass"
  fi
  
  sleep 3600  # 1 hour
done
```

**Validation items**:
- [ ] Health endpoint consistently 200
- [ ] Response time stable <1s
- [ ] Error count low and stable
- [ ] Database contains expected data
- [ ] No performance degradation
- [ ] Memory usage stable

---

## 🔍 Detailed Health Check Procedures

### Check 1: Application Responsiveness

```bash
# Test response time
time curl -s https://your-production-url/api/health

# Expected:
# real 0m0.123s
# user 0m0.010s
# sys 0m0.005s

# Red flags:
# - real > 2s (slow response)
# - Connection refused (app crashed)
# - No response (network issue)
```

### Check 2: Database Integrity

```bash
# Verify data consistency
railway run psql <<EOF
  -- Count records
  SELECT 'Users' as table_name, COUNT(*) as count FROM users
  UNION ALL
  SELECT 'Benefits', COUNT(*) FROM benefits
  UNION ALL
  SELECT 'Usage Records', COUNT(*) FROM "benefitUsageRecords"
  UNION ALL
  SELECT 'Periods', COUNT(*) FROM periods;

  -- Check for orphaned records (foreign key violations)
  SELECT COUNT(*) as orphaned_benefits
  FROM benefits b
  WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = b."userId");

  -- Verify indexes are valid
  SELECT * FROM pg_stat_user_indexes;
EOF

# Expected: All counts >0 (for populated database), orphaned_benefits = 0
```

### Check 3: Error Rate Analysis

```bash
# Get error count and rate
railway logs --service web --since="-1h" | tee /tmp/logs.txt

# Count errors
grep -i "error\|exception\|failed" /tmp/logs.txt | wc -l

# Calculate error rate
TOTAL_LINES=$(wc -l < /tmp/logs.txt)
ERROR_LINES=$(grep -i "error" /tmp/logs.txt | wc -l)
ERROR_RATE=$(echo "scale=4; $ERROR_LINES / $TOTAL_LINES * 100" | bc)

echo "Error rate: ${ERROR_RATE}%"

# Expected: <0.1% error rate
# Warning: >1% error rate
# Critical: >5% error rate
```

### Check 4: Performance Benchmarks

```bash
# Test all critical API endpoints

echo "Testing API performance..."

# Test 1: Benefits list endpoint
echo "1. GET /api/benefits/filters"
time curl -s https://your-production-url/api/benefits/filters \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq 'length'

# Test 2: Progress endpoint
echo "2. GET /api/benefits/progress"
time curl -s "https://your-production-url/api/benefits/progress?benefitId=1" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.data.percentage'

# Test 3: Dashboard page (measure TTFB)
echo "3. Dashboard page load"
curl -s -o /dev/null -w "Status: %{http_code}\nTTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" \
  https://your-production-url/dashboard

# Expected:
# /api/benefits/filters: <1000ms
# /api/benefits/progress: <500ms
# Dashboard TTFB: <1000ms, Total: <2000ms
```

### Check 5: Database Query Performance

```bash
# Measure query performance
railway run psql <<EOF
  -- Slow query log analysis
  SELECT query, mean_exec_time, max_exec_time, calls
  FROM pg_stat_statements
  WHERE query NOT LIKE '%pg_stat_statements%'
  ORDER BY mean_exec_time DESC
  LIMIT 10;

  -- Verify index usage
  SELECT schemaname, tablename, indexname, idx_scan
  FROM pg_stat_user_indexes
  ORDER BY idx_scan DESC;
EOF

# Expected:
# - No query with mean_exec_time > 1000ms
# - Indexes being used (idx_scan > 0)
# - Query execution time trending down or stable
```

### Check 6: Resource Utilization

```bash
# Monitor CPU and memory
railway run ps aux | grep node

# Expected output format:
# USER       PID %CPU %MEM    VSZ   RSS COMMAND
# root       123  2.5  8.5 634892 87654 node ...

# Red flags:
# %CPU > 50% for extended period
# %MEM > 15% (should be <10%)
# VSZ growing (memory leak indicator)

# Monitor over time
for i in {1..5}; do
  echo "[$(date)]"
  railway run ps aux | grep node | grep -v grep
  sleep 60
done
```

### Check 7: Connection Pool Status

```bash
# Check database connections
railway run psql -c "SELECT count(*) FROM pg_stat_activity;"

# Expected: 2-10 connections (depends on workload)
# Warning: >15 connections
# Critical: >20 connections (connection pool exhausted)

# Detailed connection info
railway run psql -c "SELECT pid, usename, application_name, state, wait_event FROM pg_stat_activity;"

# Should show:
# - Most connections idle
# - Few active queries
# - No long-running transactions
```

---

## 📈 Monitoring Dashboard Setup (Optional but Recommended)

### Railway Metrics Dashboard

```bash
# Access via https://railway.app
# 1. Select your project
# 2. Click "Monitoring" tab
# 3. Watch real-time metrics:
#    - CPU usage
#    - Memory usage
#    - Network I/O
#    - Deployment status
#    - Recent logs
```

### Local Monitoring (CLI)

```bash
#!/bin/bash
# Real-time monitoring dashboard

clear
while true; do
  clear
  echo "=== Card Benefits Dashboard - Production Monitoring ==="
  echo "Time: $(date +'%Y-%m-%d %H:%M:%S')"
  echo ""
  
  echo "HEALTH STATUS:"
  curl -s https://your-production-url/api/health | jq . 2>/dev/null || echo "❌ Health check failed"
  echo ""
  
  echo "RESOURCE USAGE:"
  railway status | head -10
  echo ""
  
  echo "RECENT LOGS:"
  railway logs --service web --tail 5
  echo ""
  
  echo "ERROR COUNT (last hour):"
  railway logs --service web --since="-1h" | grep -i "error" | wc -l
  echo ""
  
  echo "NEXT UPDATE: $(date -d '+60 seconds' +'%H:%M:%S')"
  echo "Press Ctrl+C to exit"
  
  sleep 60
done
```

---

## ⚠️ Alert Conditions & Response

### Alert: High Error Rate (>1%)

**Detection**:
```bash
ERROR_RATE=$(railway logs --service web --since="-5m" | grep -i "error" | wc -l)
if [ $ERROR_RATE -gt 10 ]; then
  echo "⚠️ ALERT: High error rate detected"
fi
```

**Response**:
1. [ ] Check logs for error patterns
2. [ ] Identify affected endpoints
3. [ ] Check database connectivity
4. [ ] Investigate recent code changes
5. [ ] If unrecoverable: Initiate rollback

### Alert: Slow Response Times (>2s)

**Detection**:
```bash
RESPONSE=$(curl -s -o /dev/null -w "%{time_total}" https://your-production-url/api/health)
if (( $(echo "$RESPONSE > 2.0" | bc -l) )); then
  echo "⚠️ ALERT: Slow response time"
fi
```

**Response**:
1. [ ] Check database query performance
2. [ ] Check for long-running migrations
3. [ ] Monitor memory usage
4. [ ] Check CPU usage
5. [ ] Review slow query logs
6. [ ] Scale up if needed

### Alert: Database Connection Failure

**Detection**:
```bash
if ! railway run psql -c "SELECT 1;" &>/dev/null; then
  echo "🔴 ALERT: Database connection failed"
fi
```

**Response**:
1. [ ] Verify PostgreSQL service is running: `railway status`
2. [ ] Check connection string: `railway variables | grep DATABASE_URL`
3. [ ] Try to connect manually: `railway run psql`
4. [ ] Check Railway service health
5. [ ] If persistent: Trigger immediate rollback

### Alert: Memory Leak (Memory Usage >200MB)

**Detection**:
```bash
MEMORY=$(railway run ps aux | grep node | grep -v grep | awk '{print $6}')
if [ $MEMORY -gt 200000 ]; then
  echo "🔴 ALERT: Memory usage critical"
fi
```

**Response**:
1. [ ] Monitor memory trend (is it still increasing?)
2. [ ] Check for memory leaks in application code
3. [ ] Restart container if memory >300MB: `railway scale web --replicas 0 && railway scale web --replicas 2`
4. [ ] Deploy fix if identified
5. [ ] Monitor for recurrence

---

## ✅ Post-Deployment Sign-Off Checklist

### 2-Hour Mark

- [ ] Health checks passing consistently
- [ ] Response times <1s
- [ ] Error rate <0.1%
- [ ] Dashboard loading successfully
- [ ] All API endpoints responding
- [ ] Database responsive
- [ ] No critical issues in logs
- [ ] Memory usage stable
- [ ] CPU usage <10%

**Sign-off**: _________________ **Time**: _________

### 4-Hour Mark

- [ ] All previous items still passing
- [ ] No performance degradation
- [ ] Error count stable (not growing)
- [ ] Database integrity verified
- [ ] User feedback: Positive / No issues reported
- [ ] No rollback required

**Sign-off**: _________________ **Time**: _________

### 24-Hour Mark

- [ ] All checks passing for 24 hours
- [ ] Performance metrics stable
- [ ] Error rate remains <0.1%
- [ ] Database size stable
- [ ] No memory leaks detected
- [ ] No performance degradation
- [ ] Deployment considered SUCCESSFUL

**Sign-off**: _________________ **Time**: _________

**Overall Deployment Status**: ✅ **APPROVED FOR FULL PRODUCTION**

---

## 📞 Emergency Procedures

### Immediate Rollback (if critical issue)

```bash
# Step 1: Revert code
git revert HEAD --no-edit
git push origin main

# Step 2: Monitor new deployment
railway logs --service web

# Step 3: Verify health
curl https://your-production-url/api/health
```

### Contact On-Call Engineer

```
Primary: [Name] - [Phone/Email]
Secondary: [Name] - [Phone/Email]
Escalation: [Manager] - [Phone/Email]
```

### Know When to Rollback

Rollback immediately if:
- ❌ Error rate >10%
- ❌ Response time >10s
- ❌ Database connection fails
- ❌ Data corruption detected
- ❌ Critical business logic broken
- ❌ Security issue detected

---

## 📊 Metrics Baseline (Establish After Deployment)

Record these metrics as baseline for future deployments:

```
PERFORMANCE METRICS (POST-DEPLOYMENT BASELINE)
==============================================

Health endpoint response time: _____ ms
API benefits endpoint response time: _____ ms
Dashboard page load time: _____ ms

Error rate (normal operation): _____% 
Error rate (peak load): _____%

Database query response time: _____ ms
Database connection time: _____ ms

Memory usage (baseline): _____ MB
Memory usage (peak): _____ MB

CPU usage (baseline): _____%
CPU usage (peak): _____%

Request success rate: _____%

Date recorded: __________
Recorded by: ____________
```

---

## 🎓 Monitoring Best Practices

1. **Automate**: Use scripts to automate health checks
2. **Alert**: Set up alerts for critical thresholds
3. **Document**: Log all findings and actions
4. **Baseline**: Establish metrics for comparison
5. **Escalate**: Know when to involve senior engineers
6. **Communicate**: Keep team updated on status
7. **Review**: Analyze post-deployment data weekly

---

## 📝 Deployment Monitoring Report Template

```
DEPLOYMENT MONITORING REPORT
============================

Deployment Date/Time: [YYYY-MM-DD HH:MM:SS UTC]
Product/Component: Card Benefits Dashboard MVP
Monitoring Period: 24 hours post-deployment

SUMMARY:
--------
Status: ✅ SUCCESSFUL / ⚠️ ISSUES / ❌ CRITICAL

METRICS (24-hour averages):
---------------------------
Availability: _____%
Response time: _____ ms
Error rate: _____% 
Success rate: _____%

CPU usage: ____% (peak: ___%)
Memory usage: _____ MB (peak: _____ MB)

Database uptime: _____%
Database response time: _____ ms

ISSUES ENCOUNTERED:
-------------------
None / [List any issues]

RESOLUTION STEPS:
-----------------
[If issues, describe resolution]

ACTIONS TAKEN:
--------------
- ✅ Item 1
- ✅ Item 2
- ❌ Item 3 (pending)

RECOMMENDATIONS:
----------------
1. ________________________________________
2. ________________________________________
3. ________________________________________

SIGN-OFF:
---------
Monitoring completed by: ____________
Date: ____________
Status: APPROVED FOR FULL PRODUCTION
```

---

**Phase 4D Complete**  
*All DevOps deliverables created*  
*Status: Ready for deployment after build fixes*
